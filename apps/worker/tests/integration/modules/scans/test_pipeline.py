import json
import os
import shutil
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import pairwise
from threading import Thread
from time import monotonic
from urllib.parse import quote, urlsplit, urlunsplit
from uuid import uuid4

import pytest
from dotenv import dotenv_values
from sqlalchemy import text

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.consumer import RabbitMqScanConsumer
from ontapulse_worker.modules.scans.adapters.outbound.http.http_scan_executor import (
    HttpScanExecutor,
)
from ontapulse_worker.modules.scans.adapters.outbound.persistence import sqlalchemy_scan_repository
from ontapulse_worker.modules.scans.application.services.scan_lifecycle import ScanLifecycleService
from ontapulse_worker.modules.scans.domain.models import ScanJob
from ontapulse_worker.platform.config.settings import REPOSITORY_ROOT, Settings
from ontapulse_worker.platform.database.sqlalchemy import (
    create_database_engine,
    create_session_factory,
)
from ontapulse_worker.platform.messaging.rabbitmq import create_connection


def docker(*args):
    result = subprocess.run(
        ["docker", "exec", "ontapulse-rabbitmq", *args], capture_output=True, timeout=45
    )
    assert result.returncode == 0, "Isolated RabbitMQ fixture command failed"


@pytest.fixture
def infrastructure():
    values = {**dotenv_values(REPOSITORY_ROOT / ".env.test"), "NODE_ENV": "test"}
    settings = Settings.model_validate(values)
    assert urlsplit(str(settings.database_url)).path.endswith("_test")
    broker = dotenv_values(REPOSITORY_ROOT / ".env")["RABBITMQ_URL"]
    assert broker
    parsed = urlsplit(broker)
    assert parsed.hostname in {"127.0.0.1", "localhost"}
    vhost = "worker-e2e-" + uuid4().hex
    project = uuid4()
    engine = create_database_engine(settings)
    docker("rabbitmqctl", "add_vhost", vhost)
    try:
        docker("rabbitmqctl", "set_permissions", "-p", vhost, parsed.username, ".*", ".*", ".*")
        broker = urlunsplit(parsed._replace(path="/" + quote(vhost, safe="")))
        with engine.begin() as connection:
            connection.execute(
                text('INSERT INTO "Project" (id, name, "updatedAt") VALUES (:id, :name, NOW())'),
                {"id": project, "name": "Worker infrastructure test"},
            )
        yield engine, broker, project, values
    finally:
        with engine.begin() as connection:
            connection.execute(text('DELETE FROM "Project" WHERE id = :id'), {"id": project})
        engine.dispose()
        docker("rabbitmqctl", "delete_vhost", vhost)


def trigger(infrastructure, target):
    _, broker, project, values = infrastructure
    env = {
        **os.environ,
        **{k: v for k, v in values.items() if v is not None},
        "RABBITMQ_URL": broker,
        "E2E_PROJECT_ID": str(project),
        "E2E_TARGET_URL": target,
    }
    result = subprocess.run(
        [shutil.which("node"), "--import", "tsx", "scripts/worker-e2e-trigger.ts"],
        cwd=REPOSITORY_ROOT / "apps/api",
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        "API trigger helper failed (output withheld to protect credentials)"
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


def scan_row(engine, scan_id):
    with engine.connect() as connection:
        return (
            connection.execute(text('SELECT * FROM "Scan" WHERE id = :id'), {"id": scan_id})
            .mappings()
            .one()
        )


def test_api_broker_get_database_ack(infrastructure, capsys):
    engine, broker, _, _ = infrastructure
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append(self.path)
            self.send_response(200)
            self.end_headers()

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    target = f"http://127.0.0.1:{server.server_port}/health"

    class LocalFixtureValidator:
        def validate(self, url):
            assert url == target  # Test-only injection; production SSRF policy is unchanged.

    class SingleDeliveryConsumer(RabbitMqScanConsumer):
        def _on_message(self, channel, method, properties, body):
            super()._on_message(channel, method, properties, body)
            channel.stop_consuming()

    try:
        job = trigger(infrastructure, target)
        assert scan_row(engine, job["scan_id"])["status"] == "QUEUED"
        with HttpScanExecutor(target_validator=LocalFixtureValidator()) as executor:

            class ObservedExecutor:
                def execute(self, url):
                    assert scan_row(engine, job["scan_id"])["status"] == "RUNNING"
                    return executor.execute(url)

            repository = sqlalchemy_scan_repository.SqlAlchemyScanRepository(
                create_session_factory(engine)
            )
            lifecycle = ScanLifecycleService(repository, ObservedExecutor())
            SingleDeliveryConsumer(broker, lifecycle.handle).run()
        row = scan_row(engine, job["scan_id"])
        assert row["status"] == "SUCCEEDED"
        assert row["statusCode"] == 200
        assert row["responseTimeMs"] >= 0
        assert requests == ["/health"]
        with create_connection(broker) as connection:
            assert (
                connection.channel()
                .queue_declare(queue="scan.jobs", passive=True)
                .method.message_count
                == 0
            )
        assert "worker.consumer_ready" in capsys.readouterr().out
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


@pytest.mark.parametrize("failures", [1, 4])
def test_real_broker_bounded_retry(infrastructure, failures):
    _, broker, _, _ = infrastructure
    job = trigger(infrastructure, "https://example.com")
    attempts = []

    def handle(_job):
        attempts.append(monotonic())
        if len(attempts) <= failures:
            raise RuntimeError("injected infrastructure failure")

    class RetryConsumer(RabbitMqScanConsumer):
        def _on_message(self, channel, method, properties, body):
            super()._on_message(channel, method, properties, body)
            if len(attempts) == min(failures + 1, 4):
                channel.stop_consuming()

    RetryConsumer(broker, handle).run()
    assert len(attempts) == min(failures + 1, 4)
    for elapsed, minimum in zip([b - a for a, b in pairwise(attempts)], [5, 30, 120], strict=False):
        assert elapsed >= minimum - 0.2
    with create_connection(broker) as connection:
        channel = connection.channel()
        assert channel.queue_declare(queue="scan.jobs", passive=True).method.message_count == 0
        method, properties, body = channel.basic_get(queue="scan.jobs.dead", auto_ack=True)
        if failures == 4:
            assert method is not None
            assert str(ScanJob.model_validate_json(body).scan_id) == job["scan_id"]
            assert properties.headers["x-scan-retry-count"] == 3
        else:
            assert method is None
