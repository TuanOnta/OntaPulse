import json
import os
import shutil
import subprocess
from base64 import b64encode
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import pairwise
from threading import Event, Lock, Thread
from time import monotonic, sleep
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from uuid import uuid4

import pytest
from dotenv import dotenv_values
from sqlalchemy import text

from ontapulse_worker.entrypoints.worker import WorkerShutdown, run_worker
from ontapulse_worker.modules.scans.adapters import sqlalchemy_scan_repository
from ontapulse_worker.modules.scans.adapters.http.http_scan_executor import (
    HttpScanExecutor,
)
from ontapulse_worker.modules.scans.adapters.rabbitmq.consumer import RabbitMqScanConsumer
from ontapulse_worker.modules.scans.application.scan_lifecycle import ScanLifecycleService
from ontapulse_worker.modules.scans.domain.models import ScanJob
from ontapulse_worker.platform.config import REPOSITORY_ROOT, Settings
from ontapulse_worker.platform.database import (
    create_database_engine,
    create_session_factory,
)
from ontapulse_worker.platform.messaging import create_connection

pytestmark = pytest.mark.integration


def docker(*args):
    result = subprocess.run(
        ["docker", "exec", "ontapulse-rabbitmq", *args],
        capture_output=True,
        text=True,
        timeout=45,
    )
    assert result.returncode == 0, "Isolated RabbitMQ fixture command failed"
    return result.stdout


def management_request(broker, path, method="GET"):
    parsed = urlsplit(broker)
    management_port = os.environ.get("RABBITMQ_MANAGEMENT_PORT") or dotenv_values(
        REPOSITORY_ROOT / ".env"
    ).get("RABBITMQ_MANAGEMENT_PORT", "15672")
    credentials = f"{unquote(parsed.username or '')}:{unquote(parsed.password or '')}"
    return Request(
        f"http://{parsed.hostname}:{management_port}/api/{path}",
        method=method,
        headers={"Authorization": f"Basic {b64encode(credentials.encode()).decode()}"},
    )


def broker_connection_names(broker, vhost):
    with urlopen(management_request(broker, "connections"), timeout=10) as response:
        connections = json.load(response)
    return [
        connection["name"]
        for connection in connections
        if connection["vhost"].removeprefix("/") == vhost.removeprefix("/")
    ]


def close_broker_connection(broker, connection_name):
    connection_path = quote(connection_name, safe="")
    request = management_request(broker, f"connections/{connection_path}", "DELETE")
    with urlopen(request, timeout=10) as response:
        assert response.status == 204


@pytest.fixture
def infrastructure():
    values = {**dotenv_values(REPOSITORY_ROOT / ".env.test"), "NODE_ENV": "test"}
    settings = Settings.model_validate(values)
    assert urlsplit(str(settings.database_url)).path.endswith("_test")
    broker = os.environ.get("RABBITMQ_URL") or dotenv_values(REPOSITORY_ROOT / ".env").get(
        "RABBITMQ_URL"
    )
    assert broker
    parsed = urlsplit(broker)
    assert parsed.hostname in {"127.0.0.1", "localhost"}
    vhost = "worker-e2e-" + uuid4().hex
    user = uuid4()
    workspace = uuid4()
    project = uuid4()
    engine = create_database_engine(settings)
    docker("rabbitmqctl", "add_vhost", vhost)
    try:
        docker("rabbitmqctl", "set_permissions", "-p", vhost, parsed.username, ".*", ".*", ".*")
        broker = urlunsplit(parsed._replace(path="/" + quote(vhost, safe="")))
        with engine.begin() as connection:
            connection.execute(
                text(
                    'INSERT INTO "User" (id, email, name, "passwordHash", "updatedAt") '
                    "VALUES (:id, :email, :name, :password_hash, NOW())"
                ),
                {
                    "id": user,
                    "email": f"worker-e2e-{user}@ontapulse.local",
                    "name": "Worker infrastructure test user",
                    "password_hash": "not-used-by-infrastructure-tests",
                },
            )
            connection.execute(
                text('INSERT INTO "Workspace" (id, name, "updatedAt") VALUES (:id, :name, NOW())'),
                {"id": workspace, "name": "Worker infrastructure test workspace"},
            )
            connection.execute(
                text(
                    'INSERT INTO "WorkspaceMember" ("workspaceId", "userId", role) '
                    "VALUES (:workspace_id, :user_id, 'OWNER')"
                ),
                {"workspace_id": workspace, "user_id": user},
            )
            connection.execute(
                text(
                    'INSERT INTO "Project" (id, "workspaceId", name, "updatedAt") '
                    "VALUES (:id, :workspace_id, :name, NOW())"
                ),
                {
                    "id": project,
                    "workspace_id": workspace,
                    "name": "Worker infrastructure test",
                },
            )
        yield engine, broker, project, {**values, "E2E_USER_ID": str(user)}
    finally:
        with engine.begin() as connection:
            connection.execute(text('DELETE FROM "Project" WHERE id = :id'), {"id": project})
            connection.execute(text('DELETE FROM "Workspace" WHERE id = :id'), {"id": workspace})
            connection.execute(text('DELETE FROM "User" WHERE id = :id'), {"id": user})
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


def schedule(infrastructure, target):
    _, broker, project, values = infrastructure
    env = {
        **os.environ,
        **{k: v for k, v in values.items() if v is not None},
        "RABBITMQ_URL": broker,
        "E2E_PROJECT_ID": str(project),
        "E2E_TARGET_URL": target,
    }
    result = subprocess.run(
        [shutil.which("node"), "--import", "tsx", "scripts/worker-e2e-schedule.ts"],
        cwd=REPOSITORY_ROOT / "apps/api",
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        "API scheduler helper failed (output withheld to protect credentials)"
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


def scan_row(engine, scan_id):
    with engine.connect() as connection:
        return (
            connection.execute(text('SELECT * FROM "Scan" WHERE id = :id'), {"id": scan_id})
            .mappings()
            .one()
        )


def wait_for(predicate, timeout=30):
    deadline = monotonic() + timeout
    while monotonic() < deadline:
        if predicate():
            return
        sleep(0.1)
    assert predicate()


class LocalFixtureValidator:
    def __init__(self, target):
        self._target = target

    def validate(self, url):
        assert url == self._target


class RecoveryWorker:
    def __init__(self, broker, database_url, target):
        self._broker = broker
        self._ready = Event()
        self._ready_count = 0
        self._ready_lock = Lock()
        self._shutdown = WorkerShutdown()
        settings = Settings.model_validate(
            {
                "NODE_ENV": "test",
                "DATABASE_URL": database_url,
                "RABBITMQ_URL": broker,
            }
        )
        self._engine = create_database_engine(settings)
        self._executor = HttpScanExecutor(target_validator=LocalFixtureValidator(target))
        repository = sqlalchemy_scan_repository.SqlAlchemyScanRepository(
            create_session_factory(self._engine)
        )
        self._lifecycle = ScanLifecycleService(repository, self._executor)
        self._thread = Thread(target=run_worker, args=(self, self._shutdown), daemon=True)

    def build_consumer(self):
        worker = self

        class ObservedConsumer(RabbitMqScanConsumer):
            def run(self, on_ready=None):
                def observed_ready():
                    with worker._ready_lock:
                        worker._ready_count += 1
                    worker._ready.set()
                    if on_ready:
                        on_ready()

                super().run(on_ready=observed_ready)

        return ObservedConsumer(self._broker, self._lifecycle.handle)

    def close(self):
        self._shutdown.request()
        self._thread.join(timeout=10)
        assert not self._thread.is_alive()
        self._executor.close()
        self._engine.dispose()

    def start(self):
        self._thread.start()
        assert self._ready.wait(timeout=10)

    def wait_until_ready(self, count):
        wait_for(lambda: self.ready_count >= count)

    def database_backend_ids(self):
        with self._engine.connect() as connection:
            return [connection.execute(text("SELECT pg_backend_pid()")).scalar_one()]

    @property
    def ready_count(self):
        with self._ready_lock:
            return self._ready_count


def test_api_broker_get_database_ack(infrastructure):
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
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_scheduler_broker_worker_database_ack(infrastructure):
    engine, broker, _, _ = infrastructure

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    target = f"http://127.0.0.1:{server.server_port}/scheduled"

    class LocalFixtureValidator:
        def validate(self, url):
            assert url == target

    class SingleDeliveryConsumer(RabbitMqScanConsumer):
        def _on_message(self, channel, method, properties, body):
            super()._on_message(channel, method, properties, body)
            channel.stop_consuming()

    try:
        job = schedule(infrastructure, target)
        assert scan_row(engine, job["scan_id"])["status"] == "QUEUED"
        with HttpScanExecutor(target_validator=LocalFixtureValidator()) as executor:
            repository = sqlalchemy_scan_repository.SqlAlchemyScanRepository(
                create_session_factory(engine)
            )
            lifecycle = ScanLifecycleService(repository, executor)
            SingleDeliveryConsumer(broker, lifecycle.handle).run()
        row = scan_row(engine, job["scan_id"])
        assert row["status"] == "SUCCEEDED"
        assert row["statusCode"] == 200
        assert row["responseTimeMs"] >= 0
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_scheduler_worker_recovers_after_broker_connection_is_closed(infrastructure):
    engine, broker, _, values = infrastructure

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    target = f"http://127.0.0.1:{server.server_port}/broker-recovery"
    worker = RecoveryWorker(broker, values["DATABASE_URL"], target)

    try:
        worker.start()
        vhost = unquote(urlsplit(broker).path.removeprefix("/"))
        wait_for(lambda: len(broker_connection_names(broker, vhost)) == 1)
        connection_names = broker_connection_names(broker, vhost)
        assert len(connection_names) == 1
        close_broker_connection(broker, connection_names[0])
        worker.wait_until_ready(2)

        job = schedule(infrastructure, target)
        wait_for(lambda: scan_row(engine, job["scan_id"])["status"] == "SUCCEEDED")
    finally:
        worker.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_scheduler_worker_reconnects_to_database_after_backend_termination(infrastructure):
    engine, broker, _, values = infrastructure

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    target = f"http://127.0.0.1:{server.server_port}/database-recovery"
    worker = RecoveryWorker(broker, values["DATABASE_URL"], target)

    try:
        worker.start()
        backend_ids = worker.database_backend_ids()
        with engine.begin() as connection:
            for backend_id in backend_ids:
                connection.execute(text("SELECT pg_terminate_backend(:pid)"), {"pid": backend_id})

        job = schedule(infrastructure, target)
        wait_for(lambda: scan_row(engine, job["scan_id"])["status"] == "SUCCEEDED")
        recovered_backend_ids = worker.database_backend_ids()
        assert set(recovered_backend_ids).isdisjoint(backend_ids)
    finally:
        worker.close()
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
