# Refactor: flatten the worker directory structure

## Goal

Make `apps/worker` easier to navigate by removing folder nesting that holds only one or two
files. Behavior, the queue contract, env vars, and moon task names do not change. This is a
pure move and import rewrite. The user asked for it explicitly, so the "worker is out of scope"
rule in `AGENTS.md` is lifted for this task only.

## References read

- `AGENTS.md` (sections 1, 2, 13, 14), `apps/worker/README.md`, `apps/worker/pyproject.toml`,
  `apps/worker/moon.yml`
- `docs/architecture.md`, `docs/development.md` (mentions of `ontapulse_worker` paths)
- No reference prototype applies (no UI).

## Existing code inspected

68 tracked files, about 1,300 lines. Layout today is hexagonal and nests up to 6 levels for a
single feature (`modules/scans`). Many folders contain only one or two files.
`tests/integration` contains real tests (`test_pipeline.py`, `test_retry_topology.py`); only its
README is stale.

## Decisions (confirmed with the user)

- Flatten nesting, keep the `domain` / `application` / `adapters` separation and dependency
  direction.
- Merge `tests/entrypoints` into `tests/unit/entrypoints`. Keep `tests/integration`.

## Target layout

```
ontapulse_worker/
  __init__.py  __main__.py
  bootstrap/container.py
  entrypoints/
    worker.py
    database_check.py            # was entrypoints/commands/database_check.py
  platform/
    config.py                    # was config/settings.py
    database.py                  # was database/sqlalchemy.py
    messaging.py                 # was messaging/rabbitmq.py
    logging.py                   # was observability/logging.py
    resilience.py                # backoff.py + errors.py merged
  modules/scans/
    domain/                      # unchanged (errors, models, policies)
    application/
      ports.py                   # scan_executor.py + scan_repository.py merged
      scan_lifecycle.py          # was application/services/
    adapters/
      rabbitmq/                  # was adapters/inbound/rabbitmq/ (consumer, contract, retry, topology)
      http/                      # was adapters/outbound/http/ (http_scan_executor, url_security)
      sqlalchemy_scan_repository.py   # was adapters/outbound/persistence/
```

Tests mirror this under `tests/unit/...`; `tests/entrypoints/*` moves to
`tests/unit/entrypoints/`. If merging `backoff`/`errors` or the two ports would create name
clashes or a file over about 150 lines, keep them separate and say so.

## Files likely to change

- Every `.py` under `apps/worker/ontapulse_worker` and `apps/worker/tests` (moves via `git mv`,
  import rewrites).
- `apps/worker/pyproject.toml`: the `ontapulse-worker-check` script target.
- `apps/worker/moon.yml`: `check-db` and `dev` module paths.
- `apps/worker/README.md`, `apps/worker/tests/integration/README.md` (fix the stale text),
  and path mentions in `docs/architecture.md`, `docs/development.md`, `README.md`.
- `.github/workflows/worker-infrastructure.yml` only if it references moved paths.
- Drop `__init__.py` only from folders that disappear; keep them in the remaining packages.

## Implementation requirements

1. Use `git mv` so history follows the files.
2. Rewrite imports to absolute `ontapulse_worker...` paths. No behavior edits.
3. Update `unittest.mock.patch("...")` string targets in tests; these are easy to miss.
4. Do not touch `apps/api`, `docs/queue-contract.md`, `docker-compose.yml`, `.env*`,
   `uv.lock`, or `reference/`.
5. Keep dependency direction: adapters -> application -> domain; `platform` never imports
   `modules`.

## Parity checklist

Not a visual task. The equivalent: public behavior is identical. The module entrypoints
`python -m ontapulse_worker`, `ontapulse_worker.entrypoints.worker`, and the
`ontapulse-worker-check` script keep working. Moon tasks `worker:dev`, `check-db`, `test`,
`lint`, `format-check`, and `integration-test` keep their names.

## Performance / accessibility / security

No runtime change, so none apply. Do not log or print secrets while verifying.

## Acceptance criteria

- No folder under `ontapulse_worker/` holds a single module unless it is a real package
  boundary (`domain`, `rabbitmq`, `http`).
- `grep -rn "adapters.inbound\|adapters.outbound\|application.services\|application.ports\|entrypoints.commands\|platform.config.settings"`
  returns nothing in code, tests, config, or docs.
- All checks below pass with the same test count as before the move.

## Checks to run

From the repo root, if the toolchain is available (report real output; say so if not):

- `moon run worker:lint`, `moon run worker:format-check`, `moon run worker:test`
- `moon run worker:coverage` (threshold `fail_under = 85` stays as is)
- `uv run --locked --no-sync python -c "import ontapulse_worker.entrypoints.worker, ontapulse_worker.entrypoints.database_check"` inside `apps/worker`
- `git diff --check`
- Record the test count before the move for comparison.

## Manual test steps

1. `docker compose up -d`, then `docker compose ps` (wait for healthy).
2. `moon run worker:check-db` should report the database as ready.
3. `moon run api:dev` and `moon run worker:dev`.
4. Trigger a scan from the web client (`http://localhost:5173`) or via Swagger at `/docs`.
   Expect `QUEUED` -> `RUNNING` -> `SUCCEEDED` or `FAILED`, and no import errors in the worker
   terminal.
5. Optional: `WORKER_INFRA_TESTS=1 moon run worker:integration-test`.

## Result

_(to be filled in after execution, including anything that could not be verified)_

## Result

- Executed as planned. Files were moved with `git mv`; `platform/resilience.py` (backoff + errors)
  and `application/ports.py` (executor + repository ports) were merged; no files were split.
- Fix needed beyond import rewrites: `WORKER_ROOT` in `platform/config.py` now uses
  `parents[2]` because the file moved up one directory.
- Docs updated: `README.md`, `docs/architecture.md`, `docs/development.md`, worker README, and
  `tests/integration/README.md` (it wrongly said no live tests exist).
- Checks: `ruff check` and `ruff format --check` pass; `pytest -m "not integration"` gives
  95 passed, 3 failed. The same 3 `test_http_scan.py` tests failed before the refactor
  (baseline), so they are unrelated; their cause was not investigated. Coverage 87.77%
  (threshold 85). Integration tests collect (7 skipped without `WORKER_INFRA_TESTS=1`).
- Not verified: `moon run ...` (moon unavailable here; the equivalent `uv run` commands were
  used), live `worker:check-db` / `worker:dev` and the manual scan flow (no Docker infra),
  and the integration tests against real services.
- Repo-wide `pnpm format:check` reports 30 pre-existing style issues in other files
  (e.g. `references/*.html`); the files touched here pass Prettier.
