# Phase 3 — Posture B: TLS and certificate

Apps touched: docs, worker. API: no code change (verified below). Web: none (blocked until prototypes exist).
Branch if used: `security/phase-3-posture-tls`, created **after Phase 2 is committed** (see D1).

## 1. Goal

Add the `tls` sub-check to the existing `SECURITY_POSTURE` scan: one TLS handshake to a validated address, then
evaluate the certificate (validity window, expiry thresholds, hostname match, trust chain) and the negotiated protocol
version (`SEC_TLS_*`, catalog section 6.5). Certificate expiry is produced here once; the later domain view only
displays it.

Not in this phase: edge/WAF detection (Phase 4), path probes (Phase 5), DNS (Phase 6), recurring runs (Phase 7),
web UI. `HTTP_PROBE` is unchanged.

## 2. References read

- Root `AGENTS.md` (sections 7, 8, 10, 16), `apps/worker/AGENTS.md`, `apps/api/AGENTS.md`.
- `docs/security-checks.md` (sections 2 to 6.5, 9), `docs/queue-contract.md`, `prompts/phase-2-posture-response-checks.md`
  (its Result section).

## 3. Existing code inspected

Worker (Phase 2, **uncommitted** on branch `security/phase-2-posture-response-checks`):

- `modules/security_posture/application/posture_scan.py`: `PostureScanExecutor` runs HTTPS GET, then HTTP GET, through
  the `PostureHttpClient` port; returns `ScanResult` with `sub_checks`; `RequestBudget` (2 requests).
- `modules/security_posture/adapters/http/pinned_httpx_client.py`: resolves the host once, requires every address to be
  public (`ensure_public_address` from `url_security.py`), connects to one validated address.
- `modules/scans/domain/models.py`: `SubCheckResult`, `FindingCategory.TLS` already exists (Phase 1).
- `bootstrap/container.py`: the only place that creates clients; closes them on shutdown.

Verified against the **installed** runtime (Python 3.13.3, OpenSSL 3.0.16, run in the worker venv):

- `ssl.create_default_context()` has `minimum_version = TLSv1_2` (771), `check_hostname = True`,
  `verify_mode = CERT_REQUIRED`.
- `minimum_version = TLSVersion.TLSv1` works (emits a `DeprecationWarning`), and `set_ciphers("DEFAULT:@SECLEVEL=0")`
  is accepted. `ssl.HAS_TLSv1`, `HAS_TLSv1_1`, `HAS_TLSv1_2`, `HAS_TLSv1_3` are all true in this build.
- `ssl.cert_time_to_seconds` parses the `notAfter` format of `getpeercert()`.
- Not found in this build: SSL 3.0 support is not a runtime option, so SSL 3.0 can never be negotiated by the scanner.

API: `FindingCategory` already includes `TLS`; scan detail already returns `category`, `checkId`, `confidence`, `evidence`,
and `subChecks` (a free-form name, so `tls` needs no schema change).

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Phase 2 must be committed first.** Phase 3 extends its executor and client. I will not start coding on top of uncommitted work; the user commits Phase 2 (or asks me to) and says which branch Phase 3 uses.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D2  | New port `TlsInspector` (application layer): `inspect(host, port) -> TlsObservation`. Stdlib `ssl` and `socket` only (allowed by the stack list). No new dependency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D3  | **One handshake per scan** (catalog budget). The handshake uses full verification (`CERT_REQUIRED`, `check_hostname=True`). On success the certificate dictionary from `getpeercert()` supplies subject, issuer, SANs, `notBefore`, `notAfter`, and `version()` supplies the protocol. On `SSLCertVerificationError` the OpenSSL `verify_code` classifies the failure.                                                                                                                                                                                                                                                                                                   |
| D4  | **Known limitation, stated in the catalog:** when verification fails the certificate is not parsed (the standard library cannot read an unverified certificate without a second, unverified handshake or a parser dependency). Findings for a failed verification therefore carry the failure class and OpenSSL message but no expiry date.                                                                                                                                                                                                                                                                                                                              |
| D5  | `verify_code` mapping (numbers confirmed against OpenSSL documentation and a live handshake in the tests before use): 10 expired -> `SEC_TLS_CERT_EXPIRED`; 9 not yet valid -> `SEC_TLS_CERT_NOT_YET_VALID`; 62 hostname mismatch -> `SEC_TLS_HOSTNAME_MISMATCH`; every other verify failure (self-signed, unknown issuer, bad signature, ...) -> `SEC_TLS_CHAIN_INVALID` with `MEDIUM` confidence. OpenSSL reports the first error it finds, so a certificate with two defects yields one finding.                                                                                                                                                                      |
| D6  | Protocol detection needs the client to accept old versions. The scanner's own probe context sets `minimum_version = TLSv1` and `DEFAULT:@SECLEVEL=0`, and still verifies the certificate. Nothing is sent after the handshake; the socket is closed right away. Without this, a TLS 1.0 or 1.1 only server would fail the handshake and be invisible. A server that also supports TLS 1.2 or 1.3 negotiates the better version, so **only servers whose best version is TLS 1.0 or 1.1 are flagged** (as the catalog already states). Veto if you do not want the scanner's context weakened; the alternative is dropping `SEC_TLS_PROTOCOL_DEPRECATED` from this phase. |
| D7  | `SEC_TLS_NO_HTTPS` (`HIGH`, `MEDIUM` confidence): the TCP connection works but the handshake fails with a non-certificate SSL error (for example `WRONG_VERSION_NUMBER`, the server speaks plain HTTP on that port). A refused or timed-out TCP connection is **not** a finding: the sub-check is `skipped: connection_failed`.                                                                                                                                                                                                                                                                                                                                          |
| D8  | Port: the port of the derived HTTPS URL (443 unless the monitor URL is `https` with an explicit port). Same host as the HTTP checks. SNI and hostname checks use the monitor host.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D9  | Address pinning is shared: the "resolve once, all addresses public, pick one" logic moves from `PinnedHttpxClient` into a small helper used by both clients. Its existing tests keep passing unchanged. The handshake connects to that address with `server_hostname=host`.                                                                                                                                                                                                                                                                                                                                                                                              |
| D10 | Timeouts: TCP connect 5 s, total handshake 10 s _(draft from the catalog)_, enforced with socket timeouts. Constants live in `catalog.py`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D11 | Thresholds from the catalog, now confirmed or changed by the user: expired -> `CRITICAL`; within 14 days -> `HIGH`; within 30 days (and more than 14) -> `MEDIUM`. Days are computed in the pure evaluator from an injected `now` (UTC). Boundary: exactly 14 days left counts as the 14-day band; exactly 0 seconds left is expired.                                                                                                                                                                                                                                                                                                                                    |
| D12 | The `tls` sub-check runs after the two HTTP requests. It is independent of them: an HTTPS GET that failed on a certificate error still gets its TLS finding. A confirmed challenge response does **not** skip `tls` (the handshake is below HTTP, catalog 6.6).                                                                                                                                                                                                                                                                                                                                                                                                          |
| D13 | The scan is `FAILED` as before: non-public/unresolvable host, or no HTTP request and no handshake could connect. A TLS failure alone never fails the scan.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D14 | Observation data (issuer, protocol, SAN count, days left) is returned in memory by the inspector for Phase 4's edge evaluator; Phase 3 stores only finding evidence and sub-check states.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D15 | Evidence: subject CN, issuer organization/CN, `notBefore`, `notAfter` (ISO 8601 UTC), negotiated protocol name, `daysRemaining`, and for verification failures the verify code and the OpenSSL message (bounded to 200 characters). Never the serial number, public key, raw certificate, or any peer-supplied free text beyond those bounded fields.                                                                                                                                                                                                                                                                                                                    |
| D16 | **Test fixtures:** committed test-only PEM files under `tests/fixtures/tls/` (valid with a private test CA, expired, self-signed, wrong host, not yet valid), generated once with the `openssl` CLI and documented in a README next to them. A loopback `ssl` server in the tests uses them; the adapter takes an injectable context factory and address so the test can reach loopback (the scanner itself never can). Private keys in the repository are test-only; this may trip a secret scanner. No new dependency such as `cryptography` or `trustme`.                                                                                                             |
| D17 | TLS 1.3 and 1.2 are not findings. TLS 1.0, 1.1 (RFC 8996) are `HIGH`. SSL 3.0 cannot be observed in this build; documented, not tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## 5. Contract changes and sync list

| Contract                   | Change                                                                                  | Apps |
| -------------------------- | --------------------------------------------------------------------------------------- | ---- |
| Prisma / migrations        | **None**                                                                                | none |
| Routes and response shapes | **None**. `tls` appears as a new `subChecks[].name`; `TLS` findings use existing fields | none |
| Queue payload / topology   | **None**                                                                                | none |
| Worker settings / env      | **None**                                                                                | none |
| Docs                       | Catalog 6.5 corrections (D4 to D6, D11, D15, D17), budget table, `architecture.md`      | docs |

API: a regression test is added that a `TLS`-category finding and a `tls` sub-check serialize through scan detail and
`GET /monitors/:id/security-posture/latest`. No source change is expected; if one turns out to be needed, I stop and ask.

## 6. Files likely to change

Worker:

- New: `modules/security_posture/domain/tls_rules.py` (pure evaluator), `domain/models.py` (additions: `TlsObservation`,
  outcome enum), `application/ports.py` (`TlsInspector`), `adapters/tls/ssl_tls_inspector.py`, `adapters/pinned_address.py`
  (shared helper).
- Edited: `domain/catalog.py` (TLS entries, thresholds, timeouts, `SUB_CHECK_TLS`, `MAX_TLS_HANDSHAKES = 1`),
  `application/posture_scan.py` (third step), `adapters/http/pinned_httpx_client.py` (use the helper),
  `bootstrap/container.py` (create and close the inspector).
- Tests: `tests/unit/modules/security_posture/{domain,application,adapters/tls}/...`, fixtures under `tests/fixtures/tls/`.

Docs: `docs/security-checks.md`, `docs/architecture.md`. API: one test file addition only.

## 7. Implementation requirements

1. **Pure evaluator** `evaluate_tls(observation, now)` returns findings; table-driven tests with fixed `now` for: far
   future, 31, 30, 15, 14, 1 day, 0 seconds, expired, not yet valid, hostname mismatch, chain invalid (several verify
   codes), deprecated protocols (`TLSv1`, `TLSv1.1`), `TLSv1.2` and `TLSv1.3` (no finding), no-HTTPS.
2. **Inspector adapter:** resolve once through the shared helper, all addresses public, `socket.create_connection((ip,
port), timeout=5)`, `context.wrap_socket(sock, server_hostname=host)` with a total handshake deadline, read
   `getpeercert()` and `version()`, close. Convert exceptions: `SSLCertVerificationError` -> verification outcome;
   other `ssl.SSLError` -> `NO_TLS`; `TimeoutError`/`OSError` on connect -> `TlsConnectionError` (skipped). It never sends
   application data and never reads any.
3. **Orchestration:** the handshake counts against its own budget (1). `tls` is `ran` when the handshake completed or a
   TLS-level failure was classified; `skipped: connection_failed` when TCP never connected.
4. **Logging:** structured; sub-check state only. No certificate subjects or issuers in logs (they are evidence, not log
   fields).
5. `HTTP_PROBE` code and tests are not edited. The shared-helper refactor must leave `test_pinned_httpx_client.py` green
   without edits.
6. No new dependency, env var, or queue change.

## 8. Safety review

- **Connections per scan:** 2 HTTP requests (unchanged) plus exactly 1 TLS handshake to the HTTPS host and port. Fixed.
  No other ports, no probing of protocol versions with extra handshakes.
- **Read:** protocol version, certificate subject/issuer/dates/SANs from the verified peer certificate. No application
  data is sent or received.
- **Stored:** bounded evidence listed in D15. **Not stored or logged:** serial, public key, raw certificate, peer-supplied
  free text beyond the bounded fields.
- **SSRF:** the handshake resolves once, requires every address public, and connects to the validated address; the same
  helper as the HTTP client, covered by the same private-address and changing-answer tests.
- **Weakened client context (D6):** limited to the scanner's own outbound probe socket; certificate verification stays on;
  nothing is sent after the handshake. This is the one safety trade-off in the phase and needs the user's decision.
- **Opt-in:** not required (passive handshake, same host as the monitor), consistent with the catalog; the existing
  enablement, minimum interval, and workspace limits apply because it is part of `SECURITY_POSTURE`.
- **Identity:** a TLS handshake carries no `User-Agent`; the HTTP requests keep theirs.

## 9. Acceptance criteria

- With the fixtures: valid certificate -> no TLS finding; expired -> `SEC_TLS_CERT_EXPIRED`; not yet valid; wrong host ->
  `SEC_TLS_HOSTNAME_MISMATCH`; self-signed -> `SEC_TLS_CHAIN_INVALID`; plain-HTTP port -> `SEC_TLS_NO_HTTPS`; refused port
  -> `tls` skipped and no finding.
- Expiry bands use the injected clock exactly as in D11.
- A TLS 1.0 or 1.1 only loopback server (when this OpenSSL build can serve it) -> `SEC_TLS_PROTOCOL_DEPRECATED`; if the
  build cannot serve those versions the test is skipped with a stated reason and the evaluator is still covered by the
  table.
- Exactly one handshake per scan; resolver called once; a hostname resolving to a private address is rejected before any
  connection; a changing DNS answer cannot change the connected address.
- `tls` is `ran`/`skipped` in `subChecks`; a TLS failure never fails the scan; a confirmed challenge does not skip `tls`.
- No certificate material beyond D15 appears in findings or logs.
- `HTTP_PROBE`, Phase 2 tests, and API tests pass unchanged. Worker coverage stays above 85.

## 10. Checks to run

`moon run worker:lint`, `moon run worker:format-check`, `moon run worker:test`, worker coverage via
`uv run --locked --no-sync coverage run -m pytest -m "not integration"` then `coverage report` (the `moon` coverage
task fails on this machine under PowerShell), `moon run api:typecheck`, `moon run api:test`, `pnpm format:check` for the
touched files, `git diff --check`. `worker:integration-test` hangs on this machine (Phase 1 and 2); it is not run unless the
user asks, and the Result says so.

## 11. Manual test steps

1. `docker compose up -d`; apply migrations if not yet applied; start API, worker, web.
2. Enable `securityPostureEnabled` on a monitor whose target you own, trigger `SECURITY_POSTURE`, open the scan detail:
   `subChecks` lists `tls` as `ran`, and a valid certificate yields no `SEC_TLS_*` finding.
3. Public test hosts made for this purpose (for example `expired.badssl.com`, `wrong.host.badssl.com`,
   `self-signed.badssl.com`, `tls-v1-0.badssl.com:1010`) give the matching findings. Only these test hosts; never a
   third party's site. These need outbound internet from the worker and will be reported as unverified if not run.
4. Worker log: one handshake per scan, no certificate subject/issuer values, no redirects followed.
5. Roles and isolation are unchanged from Phase 2 (member `403`, outsider `404`, disabled `409`, repeat within 3600 s
   `429`).

## 12. Security requirements

No secrets in code or logs; the committed private keys are test-only and documented as such. Error messages stay generic.
The scanner stays passive and sends no application data over the handshake.

## Result

Implemented on branch `security/phase-3-posture-tls`, created from `security/phase-2-posture-response-checks` after Phase 2 was committed and pushed. All of D1 to D17 were executed as written (the user approved the prompt without changing any decision). Not committed, not pushed.

What changed:

- Worker: new `tls` sub-check. `SslTlsInspector` (stdlib `ssl` and `socket`) does one verified handshake to the validated address; `evaluate_tls` is a pure evaluator with an injected clock; the "resolve once, require every address public, pick one" logic moved into `adapters/pinned_address.py` and is shared with `PinnedHttpxClient` (its tests pass unchanged). `PostureScanExecutor` now takes a `TlsInspector`, runs the handshake after the two requests, and only fails the scan when no request and no handshake connected. Container wiring creates the inspector.
- Catalog: eight `SEC_TLS_*` entries, thresholds, timeouts, and the OpenSSL verify codes as named constants.
- Fixtures: test-only certificates and keys under `apps/worker/tests/fixtures/tls/` with `generate.sh` and a README; no new dependency.
- Docs: `docs/security-checks.md` 6.5, `architecture.md`, `queue-contract.md`.
- API: no source change. One regression test added to `apps/api/test/security-checks.test.ts` for TLS findings and the `tls` sub-check.

Verification:

- The numeric OpenSSL codes (9, 10, 62, 18 to 21) were read from the OpenSSL 3.0 `x509_vfy.h.in` and then confirmed by live handshakes in the tests: expired -> 10, not yet valid -> 9, wrong host -> 62, self-signed -> 18.
- The loopback tests observed a TLS 1.0 only and a TLS 1.1 only server with this OpenSSL build (Python 3.13.3, OpenSSL 3.0.16), so protocol detection is proven end to end here.

Checks run: `worker:lint`, `worker:format-check` pass; `worker:test` 307 passed; worker coverage 94.36% (floor 85, measured directly with `uv run coverage`); `api:typecheck` pass.

Not verified:

- `api:test` was **not run** after adding the new regression test: Docker Desktop was not running, so PostgreSQL on port 5433 was unreachable. The previous full run (174 passed) predates this test. Run `moon run api:test` once Docker is up.
- No scan against a real host (for example `expired.badssl.com`, `tls-v1-0.badssl.com:1010`): no outbound test target was used, and the worker rejects private hosts by design.
- `worker:integration-test` was not run (it hangs on this machine, see Phases 1 and 2).
- Manual steps in section 11 (dev servers, web flow, worker log inspection) were not run.

Known limitations (documented in the catalog):

- A certificate that fails verification is reported without its dates (one handshake only).
- The 10 s handshake timeout applies per socket operation, not as a total deadline, so a server that trickles bytes can hold the handshake open (same class of gap as the HTTP read timeout).
- `@SECLEVEL=0` on the probe context means certificates with weak keys or signatures still verify; the catalog has no check for them.
