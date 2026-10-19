# OntaPulse worker (`apps/worker`)

Python 3.13 scan worker: consumes `scan.requested` jobs from RabbitMQ (Pika), dispatches by scan kind, runs the check with HTTPX, `ssl`, and DNS queries, evaluates findings, and stores the terminal status in PostgreSQL (SQLAlchemy 2 + Psycopg 3). Read the root `AGENTS.md` and `README.md` first; this file only adds worker-specific rules. Where the root file is web-specific, it does not apply here. The root sections on scanner safety (8), build order (9), and queue and scan execution (10) apply in full.

Source of truth (do not duplicate):

- Queue payload, topology, retries, delivery semantics: `../../docs/queue-contract.md`.
- Check catalog (finding IDs, severities, thresholds, request budgets, path allowlist, vendor fingerprints): `../../docs/security-checks.md`.
- Data model: `../api/prisma/schema.prisma` (the API owns the schema; the worker only reads/writes through SQLAlchemy).
- Architecture: `../../docs/architecture.md`. Layout notes: `README.md` in this folder.

## Scope

- Work here only when the user asks. Changing the message contract, queue topology, or DB columns affects the API: stop and ask. The producer and consumer, their tests, and `docs/queue-contract.md` change together.
- The worker never runs Prisma and never imports API code. Schema changes originate in the API migration.
- Checks are plain network calls. No headless browsers, no browser automation, no third-party scanning or threat-intel APIs.

## Layout and dependency rule

```text
ontapulse_worker/
  bootstrap/container.py     Composition root; creates and closes all resources; kind registry
  entrypoints/               worker.py (process), database_check.py
  modules/
    scans/                   lifecycle: claim, status, retry, ACK, dispatch by scan kind
      domain/                models, policies, errors. Pure Python
      application/           ports.py, scan_lifecycle.py
      adapters/              http/, rabbitmq/, sqlalchemy_scan_repository.py
    http_probe/              existing check (one GET, status, timing, findings)
    security_posture/        headers, cookies, CORS, redirect, TLS, path probes
    dns_watch/               baseline, diff, dangling CNAME, SPF/DKIM/DMARC
    edge_detection/          WAF, CDN, anti-bot evaluator (pure; no I/O of its own)
      (each check family uses the same domain / application / adapters split)
  platform/                  config, database, logging, messaging, resilience
```

Direction: `domain <- application <- adapters`; `bootstrap` wires them.

- `domain` and `application` must not import HTTPX, Pika, SQLAlchemy, `ssl`, `socket`, a DNS library, or `platform.config`.
- Adapters implement ports in `application/ports.py`. New external dependencies get a port first: `HttpClient`, `TlsInspector`, `DnsResolver`, repositories. A new library (for example a DNS library or a public-suffix list) needs the user's approval in the phase prompt.
- `modules/scans` owns the lifecycle and retry rules and dispatches to a check family through a registry built in `bootstrap`. A check family never touches the broker or claims scans.
- `platform` must not import `modules`.
- Only `bootstrap` creates connections, clients, sockets, and engines, and closes them on shutdown.
- Pure evaluators (header rules, cookie flag rules, CORS rules, SPF/DMARC parsing, fingerprint matching, DNS diffing, expiry thresholds) live in `domain`. They take plain data and an injected clock, and return findings and observations. No network, no wall clock, no I/O.
- Python files are snake_case. Line length 100, Ruff rules `E F I UP B SIM RUF`. Use type hints on public functions.

## Behavior that must not regress

`HTTP_PROBE` (the existing check):

- Job: one HTTP GET. Only `http`/`https`; reject URLs with userinfo; resolve DNS; every resolved address must be public (no private, loopback, link-local, multicast, reserved). Redirects are not followed. Response bodies are not read or stored. Timeouts: connect 5 s, read 30 s, write 5 s, pool 5 s.
- Findings: `HTTP_CLIENT_ERROR` (`MEDIUM`), `HTTP_SERVER_ERROR` (`HIGH`), `SLOW_RESPONSE` (`MEDIUM`, response time >= 2000 ms). One scan may have several.
- HTTP 4xx/5xx is `SUCCEEDED` with findings. Timeout, DNS failure, connection failure, and non-public target are terminal `FAILED`, with no broker retry.
- Its tests must pass unchanged after every phase.

Lifecycle and delivery (all kinds):

- Statuses: `QUEUED -> RUNNING -> SUCCEEDED | FAILED`.
- Idempotency: `scanId` is the key. Claim the scan atomically; a duplicate delivery of a terminal scan must not re-execute it, write a second set of findings, or write a second DNS baseline.
- ACK only after the result is persisted. Publish the retry and wait for confirm before ACKing the original; if the retry publish fails, leave the original unacked.
- Retries are for infrastructure failures only: 5 s, 30 s, 120 s, then `scan.jobs.dead`. Max 4 attempts. Retry count is the `x-scan-retry-count` header, not in the JSON.
- Invalid payloads, permanent errors, unknown scan kinds, and scans that no longer exist (deleted project) go to the dead-letter queue.
- The payload stays `{ scanId, monitorId }`. The scan kind is read from the `Scan` row.
- Graceful shutdown: stop consuming, drain active jobs, close resources. Reconnect on connection loss.

## Security-check behavior

Applies to `SECURITY_POSTURE` and `DNS_WATCH`. Safety rules 1-13 in the root `AGENTS.md` section 8 are binding. The ones that most affect worker code:

- **Passive only.** GET requests, a TLS handshake, DNS queries. No payloads, fuzzing, login attempts, port scanning, or form submission.
- **SSRF validation on every connection.** Run it for the HTTPS request, the HTTP request used for the redirect check, the TLS handshake, and every path probe. Connect to the validated address; never re-resolve between validation and connect. Do not weaken `adapters/http/url_security.py` or its successor. Never follow redirects; the redirect check reads the first response's `Location` only.
- **Request budget.** Fixed maximum requests per scan, fixed paths, existing timeouts, and an identifying `User-Agent` naming OntaPulse. Budget values are named constants from the catalog.
- **Bodies.** Header, cookie, CORS, and redirect checks never read the body. Only path probes read the body: at most 4 KB, in memory, matched against a fixed signature, then discarded. Never persist or log it.
- **Path probes are opt-in.** Run them only when the monitor has them enabled with a recorded acknowledgment. Skip and record `skipped: not enabled` otherwise. The path list comes from the catalog allowlist only.
- **Evidence.** Store header names, cookie names and flags, and bounded non-secret values (for example a CSP string up to 2 KB). Never store or log cookie values, authorization headers, tokens, or body content. Evidence size is bounded in code.
- **Edge detection is detection only.** Fingerprint vendors from header names, cookie names, status, challenge headers (for example a challenge marker header), certificate issuer, and CNAME/NS patterns. Never solve, bypass, or evade a challenge. Record the result as an observation with confidence and the signals used.
- **Challenge awareness.** If the response is a WAF or bot challenge, posture findings derived from it are suppressed or marked low confidence per the catalog.
- **Partial results.** Each sub-check records `ran` or `skipped` with a reason. Conditions caused by the target (invalid certificate, no HTTPS, missing headers, NXDOMAIN on a CNAME target) are findings, not scan failures. The scan is `FAILED` only when the check could not run at all (non-public target, base connection timeout, DNS failure for the monitor host).
- **DNS watch.**
  - Query only through the `DnsResolver` port against the configured public resolvers, never an internal resolver.
  - Normalize records before comparing: lowercase, sorted, TTL ignored.
  - The first snapshot is the baseline and creates no change findings. Later snapshots diff against it.
  - Treat A/AAAA churn on CDN-fronted hosts as low severity or suppressed per the catalog.
  - Update the baseline and insert findings in the same transaction as the terminal status.
  - Dangling CNAME in the first version is DNS-level only (target does not resolve, or provider suffix with no resolution). A body fingerprint for takeover needs a separate approved design.
  - SPF, DKIM, and DMARC are evaluated against the organizational domain. DKIM selector discovery is best effort; a missing selector alone is never a finding.
- **Certificates.** Expiry thresholds and protocol-version rules are constants from the catalog. Use UTC and an injected clock. Certificate expiry is produced here once; the domain view only displays it.
- **No data leaves the system.** Do not send hostnames or results to external services.

## Logging and security

- Structured logs only. Never log credentials, `DATABASE_URL`, `RABBITMQ_URL`, cookies, authorization headers, cookie values or bodies from scanned targets, or full evidence payloads.
- Config comes from `platform/config.py` (Pydantic Settings). `DATABASE_URL` and `RABBITMQ_URL` are required outside test mode. New settings (resolver hosts, user agent, budgets) are added to Pydantic Settings and `.env.example` together, after asking. Never commit `.env*`.

## Tests

- Pytest. Unit tests mirror the source tree under `tests/unit/` and use fakes or mocks for RabbitMQ, HTTP, TLS, DNS, and repositories.
- Evaluators are tested table-driven: real header sets, cookie sets, certificate fixtures, DNS record sets, and challenge responses, each with an expected finding list. Tests inject the clock.
- Tests never contact the public internet. The SSRF validator is covered by tests for every connection type, including a hostname that resolves to a private address and a DNS answer that changes between validation and connect.
- Infrastructure tests live in `tests/integration/`, are marked `integration`, and run only with `WORKER_INFRA_TESTS=1` against isolated PostgreSQL and RabbitMQ (separate vhost). Never touch development data.
- New behavior needs a unit test next to its mirror path. Include idempotency tests (duplicate delivery writes no second findings or baseline). Coverage floor is 85 (`pyproject.toml`); do not lower it.

## Commands (repo root)

| Task                  | Command                                                   |
| --------------------- | --------------------------------------------------------- |
| Sync dependencies     | `moon run worker:sync`                                    |
| Run worker            | `moon run worker:dev`                                     |
| Check DB connectivity | `moon run worker:check-db`                                |
| Unit tests            | `moon run worker:test`                                    |
| Integration tests     | `moon run worker:integration-test`                        |
| Coverage              | `moon run worker:coverage`                                |
| Lint                  | `moon run worker:lint`                                    |
| Format / format check | `moon run worker:format` / `moon run worker:format-check` |

Do not change `uv.lock` or the Python version without testing the full workspace. Before reporting done run `worker:lint`, `worker:format-check`, `worker:test`, `pnpm format:check`, and `git diff --check`. Run `worker:integration-test` only when infrastructure is available and the change touches the consumer, retry, topology, dispatch, or repository. Report real output; say plainly what was not run.

## Workflow and language

- Follow the root workflow: inspect code, write a prompt file in `prompts/` (scanner phases include the safety review), get approval, implement, check, share manual test steps (trigger a scan from the web, watch the worker log and RabbitMQ UI; manual targets are ones you own or public test hosts such as `badssl.com`). Tiny fixes may skip the prompt.
- One branch per task, conventional commits (`feat(worker): ...`, `fix(worker): ...`), no commits or pushes unless asked.
- Reply to the user in Bahasa Indonesia. Code, comments, commits, and prompt files in English.
