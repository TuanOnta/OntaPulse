"""Orchestration of one SECURITY_POSTURE scan (ScanExecutor port implementation)."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from time import perf_counter
from urllib.parse import urlsplit, urlunsplit

from ontapulse_worker.modules.edge_detection.domain.detector import (
    detect_edge,
    is_confirmed_challenge,
)
from ontapulse_worker.modules.edge_detection.domain.models import EdgeInput, EdgeResponse
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import (
    EdgeProfile,
    ScanFinding,
    ScanOptions,
    ScanResult,
    SubCheckResult,
    SubCheckState,
)
from ontapulse_worker.modules.security_posture.application.ports import (
    PostureConnectionError,
    PostureHttpClient,
    TlsConnectionError,
    TlsInspector,
)
from ontapulse_worker.modules.security_posture.domain.catalog import (
    MAX_REQUESTS_PER_SCAN,
    MAX_TLS_HANDSHAKES_PER_SCAN,
    REASON_CHALLENGE_RESPONSE,
    REASON_CONNECTION_FAILED,
    REASON_NOT_ENABLED,
    REASON_PREREQUISITE_FAILED,
    SUB_CHECK_COOKIES,
    SUB_CHECK_CORS,
    SUB_CHECK_EDGE,
    SUB_CHECK_EXPOSED_FILES,
    SUB_CHECK_HEADERS,
    SUB_CHECK_REDIRECT,
    SUB_CHECK_TLS,
)
from ontapulse_worker.modules.security_posture.domain.challenge import (
    ChallengeKind,
    classify_challenge,
    mark_possible_challenge,
)
from ontapulse_worker.modules.security_posture.domain.cookie_rules import evaluate_cookies
from ontapulse_worker.modules.security_posture.domain.cors_rules import evaluate_cors
from ontapulse_worker.modules.security_posture.domain.header_rules import evaluate_headers
from ontapulse_worker.modules.security_posture.domain.models import (
    PostureResponse,
    TlsObservation,
)
from ontapulse_worker.modules.security_posture.domain.path_probe_rules import (
    MAX_PATH_PROBE_REQUESTS,
    PROBE_ALLOWLIST,
    evaluate_probe,
)
from ontapulse_worker.modules.security_posture.domain.redirect_rules import evaluate_redirect
from ontapulse_worker.modules.security_posture.domain.tls_rules import evaluate_tls
from ontapulse_worker.modules.security_posture.domain.urls import derive_posture_urls

logger = logging.getLogger(__name__)


class RequestBudgetExceededError(RuntimeError):
    """A third request was attempted; this is a programming error, never a target condition."""


class RequestBudget:
    def __init__(
        self,
        limit: int = MAX_REQUESTS_PER_SCAN,
        handshakes: int = MAX_TLS_HANDSHAKES_PER_SCAN,
        probes: int = MAX_PATH_PROBE_REQUESTS,
    ) -> None:
        self._remaining = limit
        self._handshakes = handshakes
        self._probes = probes

    def consume(self) -> None:
        if self._remaining <= 0:
            raise RequestBudgetExceededError("posture request budget exhausted")

        self._remaining -= 1

    def consume_probe(self) -> None:
        if self._probes <= 0:
            raise RequestBudgetExceededError("posture path-probe budget exhausted")

        self._probes -= 1

    def consume_handshake(self) -> None:
        if self._handshakes <= 0:
            raise RequestBudgetExceededError("posture handshake budget exhausted")

        self._handshakes -= 1


def utc_now() -> datetime:
    return datetime.now(UTC)


class PostureScanExecutor:
    """Run the posture checks with at most two requests and one TLS handshake."""

    def __init__(
        self,
        client: PostureHttpClient,
        tls_inspector: TlsInspector,
        *,
        clock: Callable[[], float] = perf_counter,
        now: Callable[[], datetime] = utc_now,
    ) -> None:
        self._client = client
        self._tls_inspector = tls_inspector
        self._clock = clock
        self._now = now

    def execute(self, target_url: str, *, options: ScanOptions | None = None) -> ScanResult:
        https_url, http_url = derive_posture_urls(target_url)
        budget = RequestBudget()
        started_at = self._clock()

        # ScanExecutionError (non-public or unresolvable target) ends the scan right away.
        https_response = self._fetch(budget, https_url)
        http_response = self._fetch(budget, http_url)
        observation = self._handshake(budget, https_url)

        if https_response is None and http_response is None and observation is None:
            raise ScanExecutionError("Scan target is unavailable")

        findings: list[ScanFinding] = []
        sub_checks: list[SubCheckResult] = []

        findings.extend(self._https_checks(https_response, sub_checks))
        findings.extend(self._redirect_check(http_response, sub_checks))
        findings.extend(self._tls_check(observation, sub_checks))
        findings.extend(
            self._exposed_files_check(https_url, https_response, options, budget, sub_checks)
        )
        edge_profile = self._edge_check((https_response, http_response), observation, sub_checks)

        elapsed_ms = max(0, round((self._clock() - started_at) * 1_000))
        logger.info(
            "posture.sub_checks",
            extra={
                "sub_checks": {item.name: item.state.value for item in sub_checks},
                "finding_count": len(findings),
            },
        )

        return ScanResult(
            status_code=https_response.status_code if https_response else None,
            response_time_ms=https_response.elapsed_ms if https_response else elapsed_ms,
            findings=tuple(findings),
            sub_checks=tuple(sub_checks),
            edge_profile=edge_profile,
        )

    def _fetch(self, budget: RequestBudget, url: str) -> PostureResponse | None:
        budget.consume()

        try:
            return self._client.fetch(url)
        except PostureConnectionError:
            return None

    def _handshake(self, budget: RequestBudget, https_url: str) -> TlsObservation | None:
        parts = urlsplit(https_url)
        host = parts.hostname or ""
        budget.consume_handshake()

        try:
            return self._tls_inspector.inspect(host, parts.port or 443)
        except TlsConnectionError:
            return None

    def _exposed_files_check(
        self,
        https_url: str,
        https_response: PostureResponse | None,
        options: ScanOptions | None,
        budget: RequestBudget,
        sub_checks: list[SubCheckResult],
    ) -> list[ScanFinding]:
        """Opt-in: three fixed GETs, a bounded body match, nothing kept from the body."""
        if options is None or not options.path_probes_enabled:
            sub_checks.append(_skipped(SUB_CHECK_EXPOSED_FILES, REASON_NOT_ENABLED))
            return []

        if https_response is None:
            sub_checks.append(_skipped(SUB_CHECK_EXPOSED_FILES, REASON_PREREQUISITE_FAILED))
            return []

        # A challenge page says nothing about the site, and the scanner must not keep hitting it.
        if classify_challenge(https_response) is ChallengeKind.CONFIRMED:
            sub_checks.append(_skipped(SUB_CHECK_EXPOSED_FILES, REASON_CHALLENGE_RESPONSE))
            return []

        parts = urlsplit(https_url)
        origin = urlunsplit((parts.scheme, parts.netloc, "", "", ""))
        findings: list[ScanFinding] = []
        usable = 0
        challenged = 0

        for probe in PROBE_ALLOWLIST:
            budget.consume_probe()

            try:
                response = self._client.probe(origin + probe.path)
            except PostureConnectionError:
                continue
            except ScanExecutionError:
                # The host was valid moments ago; a rejection now (say, a changed DNS answer)
                # means no connection was made. Skip the probe, do not fail a scan that ran.
                logger.warning("posture.probe_rejected")
                continue

            if is_confirmed_challenge(
                response.status_code, response.headers, response.cookie_names
            ):
                challenged += 1
                continue

            usable += 1
            finding = evaluate_probe(probe, response.status_code, response.body_prefix)

            if finding is not None:
                findings.append(finding)

        logger.info(
            "posture.path_probes",
            extra={
                "probed": len(PROBE_ALLOWLIST),
                "usable": usable,
                "challenged": challenged,
                "finding_count": len(findings),
            },
        )

        if usable == 0:
            reason = REASON_CHALLENGE_RESPONSE if challenged else REASON_CONNECTION_FAILED
            sub_checks.append(_skipped(SUB_CHECK_EXPOSED_FILES, reason))
            return []

        sub_checks.append(SubCheckResult(SUB_CHECK_EXPOSED_FILES, SubCheckState.RAN))

        return findings

    def _tls_check(
        self,
        observation: TlsObservation | None,
        sub_checks: list[SubCheckResult],
    ) -> list[ScanFinding]:
        if observation is None:
            sub_checks.append(_skipped(SUB_CHECK_TLS, REASON_CONNECTION_FAILED))
            return []

        sub_checks.append(SubCheckResult(SUB_CHECK_TLS, SubCheckState.RAN))

        return evaluate_tls(observation, self._now())

    @staticmethod
    def _edge_check(
        responses: tuple[PostureResponse | None, ...],
        observation: TlsObservation | None,
        sub_checks: list[SubCheckResult],
    ) -> EdgeProfile | None:
        """Reuse the data already collected; this makes no request of its own."""
        collected = tuple(response for response in responses if response is not None)

        if not collected:
            # Nothing was observed, so the stored profile must not be overwritten with "none".
            sub_checks.append(_skipped(SUB_CHECK_EDGE, REASON_CONNECTION_FAILED))
            return None

        data = EdgeInput(
            responses=tuple(
                EdgeResponse(
                    status_code=response.status_code,
                    headers=response.headers,
                    cookie_names=tuple(cookie.name for cookie in response.cookies),
                )
                for response in collected
            ),
            tls_issuer=observation.issuer if observation is not None else None,
        )

        try:
            profile = detect_edge(data)
        except Exception:
            # The evaluator is pure; a failure here is a bug and must not fail the scan.
            logger.exception("posture.edge_failed")
            sub_checks.append(_skipped(SUB_CHECK_EDGE, REASON_PREREQUISITE_FAILED))
            return None

        sub_checks.append(SubCheckResult(SUB_CHECK_EDGE, SubCheckState.RAN))
        logger.info(
            "posture.edge_profile",
            extra={
                "edge_vendors": [item.vendor for item in profile.detections],
                "challenge_observed": profile.challenge_observed,
            },
        )

        return profile

    @staticmethod
    def _https_checks(
        response: PostureResponse | None,
        sub_checks: list[SubCheckResult],
    ) -> list[ScanFinding]:
        names = (SUB_CHECK_HEADERS, SUB_CHECK_COOKIES, SUB_CHECK_CORS)

        if response is None:
            sub_checks.extend(_skipped(name, REASON_CONNECTION_FAILED) for name in names)
            return []

        challenge = classify_challenge(response)

        if challenge is ChallengeKind.CONFIRMED:
            sub_checks.extend(_skipped(name, REASON_CHALLENGE_RESPONSE) for name in names)
            return []

        findings: list[ScanFinding] = []
        findings.extend(evaluate_headers(response))
        findings.extend(evaluate_cookies(response.cookies))
        findings.extend(evaluate_cors(response))
        sub_checks.extend(SubCheckResult(name, SubCheckState.RAN) for name in names)

        return (
            mark_possible_challenge(findings) if challenge is ChallengeKind.POSSIBLE else findings
        )

    @staticmethod
    def _redirect_check(
        response: PostureResponse | None,
        sub_checks: list[SubCheckResult],
    ) -> list[ScanFinding]:
        if response is None:
            sub_checks.append(_skipped(SUB_CHECK_REDIRECT, REASON_CONNECTION_FAILED))
            return []

        challenge = classify_challenge(response)

        if challenge is ChallengeKind.CONFIRMED:
            sub_checks.append(_skipped(SUB_CHECK_REDIRECT, REASON_CHALLENGE_RESPONSE))
            return []

        findings = evaluate_redirect(response)
        sub_checks.append(SubCheckResult(SUB_CHECK_REDIRECT, SubCheckState.RAN))

        return (
            mark_possible_challenge(findings) if challenge is ChallengeKind.POSSIBLE else findings
        )


def _skipped(name: str, reason: str) -> SubCheckResult:
    return SubCheckResult(name, SubCheckState.SKIPPED, reason)
