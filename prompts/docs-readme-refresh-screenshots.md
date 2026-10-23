# Docs refresh: README, docs/, and screenshots

## Goal

Bring `README.md` and `docs/*.md` in line with the code as shipped (phases 0-7, UI phases, monitor and project edit/delete, operations
endpoints), and add real screenshots of the web client to the README, captured with the Playwright MCP.

Documentation only. No code, schema, route, payload, or test changes.

## References read

- `AGENTS.md`, `CLAUDE.md`, `apps/web/README.md`, `apps/worker/README.md`
- `README.md` (889 lines), `docs/architecture.md`, `docs/queue-contract.md`, `docs/security-checks.md` (headings, "Phase" and "planned" markers)
- `docs/development.md` and `docs/display-content-mapping.md` (headings only so far; full read happens during implementation)

## Existing code inspected

- API: `apps/api/src/modules/*` route files. Routes the README does not list today: `PATCH`/`DELETE /monitors/:monitorId`,
  `GET`/`PATCH /monitors/:monitorId/check-settings`, `GET /monitors/:monitorId/security-posture/latest`,
  `GET /monitors/:monitorId/dns-watch/latest`, `GET /monitors/:monitorId/dns-baseline`, `GET /monitors/:monitorId/edge-profile`,
  `GET /workspaces/:workspaceId/operations/queue-health`, `POST /workspaces/:workspaceId/operations/dlq/:scanId/redrive`.
- Web: router (`/login`, `/register`, `/dashboard`, workspace, project, monitor, scan routes), widgets `security-posture`, `dns-watch`,
  `monitor-detail`, `scan-detail`, features `monitors`, `projects`, `scans`, `security`, `workspaces`.
- Worker: modules `scans`, `security_posture`, `dns_watch`, `edge_detection`.
- Tooling: `.env.example` (`DNS_RESOLVERS`), seed (`apps/api/prisma/seed.ts`), `docker-compose.yml`.

## Stale content found (to fix)

README:

- Intro, key features, status table, domain model, worker section, finding policies, security section, and "Current limitations" describe only
  `HTTP_PROBE`. Missing: `SECURITY_POSTURE`, `DNS_WATCH`, edge profile, path probes (opt-in), check settings, recurring runs, operations tools.
- "Monitors cannot be edited or deleted" and "no monitor update/delete" are wrong: both routes exist. Verify the web UI and role rules first.
- API overview lacks the routes listed above. Web routes table lacks `/login` and `/register` and the monitor tabs.
- Repository structure omits `references/`, `prompts/`, and `docs/security-checks.md`; worker structure omits the three new modules.
- Tech stack: `dnspython` missing; check Web list (Anime.js, OGL) against `apps/web/package.json`, since the repo now uses `three`.
- Env table lacks `DNS_RESOLVERS`.

docs:

- `architecture.md`: "Planned: security features", "Planned additions", "Planned: check families", "Planned: security data flow" and the
  line "None of them is implemented yet" are outdated; the domain model tree stops at Scan/Finding.
- `queue-contract.md`: "(planned ...)" in the security and DNS section.
- `security-checks.md`: "Phase N" wording and "not built in Phase 6" notes; section 13 "Open items" may be resolved. Keep it a catalog, only fix
  statements that are now false. Do not change IDs, severities, or thresholds.
- `development.md`, `display-content-mapping.md`: check against code (monitor edit/delete, tabs, role rules). The mapping file stays in
  Bahasa Indonesia.
- `apps/web/README.md`, `apps/worker/README.md`: web entities list lacks edge profile and DNS; worker README covers only `scans`.

Every claim is checked against the code (routes, schema, constants) before it is written, not against memory or the older docs.

## Decisions and assumptions

- Language: English for README and docs (Indonesian for `display-content-mapping.md`). Reply to the user stays in Bahasa Indonesia.
- Screenshots are stored in `docs/screenshots/` as PNG, kebab-case names, referenced from the README with relative paths and alt text.
  Target about 6-8 images, each under ~400 KB (viewport screenshots at 1440 px, plus one 360 px mobile shot). No `reference/` files change.
- Screenshot data: a fresh demo user and workspace created through the real UI/API. Monitors point only at public hosts meant for testing
  (`example.com`, `badssl.com`), as AGENTS.md section 15 allows. No third party's real site, no personal data. The demo email uses a reserved
  domain such as `demo@example.com`; the password is not shown. The seed hosts (`*.example.com` subdomains) do not resolve, so they are not used
  for scan results.
- Screens to capture (final list depends on what renders): landing (hero), auth, dashboard, workspace, project with monitors, monitor with the
  security tab, monitor with the DNS tab, edge profile card, scan detail with findings, 360 px mobile view.
- If a screen cannot be reached (for example the worker cannot reach the internet), it is skipped and listed under Result, not faked or mocked.
- Dark theme only, so no light variants.
- No new dependency, script, or CI step.

## Contract changes

None. Docs and image files only. Sync list: none.

## Files likely to change

- `README.md`
- `docs/architecture.md`, `docs/queue-contract.md`, `docs/security-checks.md`, `docs/development.md`, `docs/display-content-mapping.md` (only where stale)
- `apps/web/README.md`, `apps/worker/README.md`
- New: `docs/screenshots/*.png`
- This prompt file (Result section)

## Implementation requirements

1. Create the branch (see Open question) and tell the user its name.
2. Read the remaining docs fully; make a list of verified facts (routes, roles, constants, env vars, versions) from the code.
3. Rewrite README sections listed above. Keep the existing structure and table of contents; add sections only where needed
   (Security checks, Screenshots). Keep it accurate and not longer than necessary.
4. Fix the stale statements in `docs/` without rewriting sections that are still correct.
5. Start infra, API, worker, and web (`docker compose up -d`, migrate, then `moon run api:dev`, `worker:dev`, `web:dev`). Capture screenshots
   with the Playwright MCP at 1440 px (and 360 px for one mobile shot). Wait for scans to reach a terminal state before capturing.
6. Insert images into the README under a "Screenshots" section (and in "Web client" where it fits). Check that each file path resolves.
7. Stop the servers and containers started for this task. Do not reset or clean any database. The demo data lives in the development database
   only; do not run any destructive command.

## Acceptance criteria

- No remaining "planned", "not implemented yet", or "cannot be edited or deleted" statement that the code contradicts.
- Every route in the README API overview exists in the route files, with correct access roles.
- Every env var in the README exists in `.env.example` or the Zod/Pydantic settings.
- All README links and image paths resolve; images render on GitHub (relative paths, PNG).
- Screenshots show real app output from this repo, no secrets, no real personal data, no browser chrome with unrelated tabs.
- `git diff --check` and `pnpm format:check` pass.

## Checks to run

- `pnpm format:check` and `git diff --check`.
- A link/path check: every `docs/screenshots/*.png` referenced exists; every relative link in the changed files resolves.
- Route check: compare the README route tables with `grep` over `apps/api/src/modules/**/*.routes.ts`.
- No code app touched, so `api:*`, `worker:*`, `web:*` test suites are not required. If something unexpected changes in code, stop and report.

## Manual test steps expected after implementation

1. Open `README.md` in the VS Code Markdown preview (or on GitHub after push) and scroll through: images load, tables render, TOC anchors work.
2. Follow "Quick start" on a clean clone mentally or in a scratch directory: commands and variable names match the repo.
3. Click each link under "Additional documentation".
4. Open `docs/screenshots/` and check that no image shows credentials, tokens, or real emails.

## Security requirements

- No `.env` values, passwords, cookies, session ids, or real emails in screenshots or text. Blur or avoid, do not include.
- Scanner safety rules (AGENTS.md section 8) apply to the demo scans: public test hosts only, one scan of each kind per monitor, path probes
  stay off unless the user asks (they need an acknowledgment from an authorized user).
- Docs must not weaken the SSRF statement; keep "internal targets are rejected by design".

## UI verification

Screenshots are taken from the running app, which is the source of truth for how the screens look. No UI changes are made, so no parity check
against `references/*.html` applies. Report any visible defect noticed while capturing instead of fixing it here.

## Open question (blocks the branch)

The working tree is on `fix/web-shell-and-lists` with changes outside this task (`AGENTS.md` modified, `prompts/perf-seo-landing.md` untracked).
AGENTS.md section 13 says to branch from an up-to-date `main` and to stop if the tree is dirty. Proposed: I leave those two files alone, switch to
`main` (carrying them over is not possible without a stash or commit), and create `docs/readme-refresh-screenshots`. You choose how to handle
the two files and whether `fix/web-shell-and-lists` is already merged.

## Result

Branch: `docs/readme-refresh-screenshots`, created from `fix/web-shell-and-lists` (not from `main`): that branch is not merged, and the
docs describe code it contains. `AGENTS.md` (modified) and `prompts/perf-seo-landing.md` (untracked) were left untouched and are not part
of this change. Nothing was committed or pushed.

Done:

- `README.md`: new intro, key features, implementation status, a Screenshots section, domain model, permissions, API overview (monitor
  update/delete, check settings, security/DNS/edge reads, scan kind and limits, operations), a Security checks section, web routes, security
  controls, limitations, and the file/worker structure. `DNS_RESOLVERS` added to the env table.
- `docs/architecture.md`, `docs/queue-contract.md`, `docs/security-checks.md`, `docs/development.md`, `docs/display-content-mapping.md`,
  `apps/web/README.md`, `apps/worker/README.md`: stale "planned", "phase", and "not available" statements corrected. No finding ID, severity,
  or threshold changed.
- 12 screenshots in `docs/screenshots/` (1440 px, plus one 360 px), taken with the Playwright MCP from the running app against `example.com`
  and `badssl.com`.

Checks: `git diff --check` clean; every image and relative link in the README resolves; every `/api/...` path in the README exists in the
route files; Prettier run on the changed Markdown files.

Not verified or notable:

- `pnpm format:check` fails on 71 files, none of them changed here (it also flags `references/*.html` and other READMEs); not investigated.
- The README was not rendered on GitHub; only the file paths were checked.
- `landing.png` and `auth.png` are about 520 KB, above the ~400 KB target (WebGL scene).
- The demo user (`demo-docs@example.com`), workspace, and two monitors remain in the development database. No database was reset.
- When the API started it scheduled 13 monitors that already existed in the development database, and the worker scanned them.
- The scan detail of a `SECURITY_POSTURE` scan shows "Target: Not available" in the Request card. Noticed, not changed.
- The monitor update/delete role rules were read from the service code, not exercised through the API.
- The test suites of the API, worker, and web were not run (no code changed). `web:test-e2e` not run.

### Follow-up: README shortened and made visual-first

The first README was 1,022 lines, with the screenshots deep inside it. It was rewritten to about 150 lines: hero screenshot first, a four-row
"What it checks" table, a screenshot section, features, an architecture diagram, quick start, and a documentation table. Moved, not deleted:
the permissions and API sections went to `docs/api.md`; local services and troubleshooting went to `docs/development.md`. Environment variables,
commands, migrations, and the RabbitMQ rules were already in `docs/development.md` and `docs/queue-contract.md`. The old README is in git
history on `fix/web-shell-and-lists`. Rendered once through a local Markdown renderer and a browser: all images show. Not checked on GitHub.
The screenshots are untracked until committed, so they will not show on GitHub before that.
