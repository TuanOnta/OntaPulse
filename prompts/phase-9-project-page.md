# Phase 9 — Project page

Branch: `refactor/project-page` (from `refactor/workspace-page`, which holds the workspace page, the shared
shell and `references/project-prototype.html`; the workspace branch is not merged yet).

## 1. Goal

Port `references/project-prototype.html` to `/workspaces/:workspaceId/projects/:projectId`: tinted project
header, monitor list with search, "Add monitor" dialog, per-monitor "Run scan" with the real
QUEUED -> RUNNING -> terminal progression, and loading / error / not-found / empty / no-results states.
Colours follow the workspace card on the dashboard (user request): the header tone is
`workspaceLook(workspace).tone`, the same tone as the workspace card and the workspace hero.

## 2. References read

- `AGENTS.md` (sections 2, 4, 5, 6, 10, 11, 12, 14, 16).
- `references/project-prototype.html`, fully read: header comment (API, role rules, status chip only after a
  scan is triggered here, no edit / delete / pause, no aggregates), CSS (project header, monitor row grid
  with a 1360 px breakpoint, scan chips and their keyframes, monitor dialog with presets), glue (URL and
  interval validation messages, host / path split, human interval, search, simulated lifecycle).

## 3. Existing code inspected

- `pages/project-page.tsx` (old table + side form), `features/monitors/create-monitor-form.tsx` (+ test),
  `shared/api/client.ts` (`monitors`, `createMonitor`, `triggerScan`, `scan`), `shared/types/domain.ts`
  (`Monitor`, `Scan`, `ScanDetail` with `findings`), `apps/api` monitor schema (`name` required, 1-120),
  `apps/api/prisma/schema.prisma` (`@@unique([projectId, targetUrl])`).
- Workspace work to reuse: `entities/project` (`useProjects`), `entities/workspace` (`workspaceLook`,
  `TONE_VAR`, permissions, context), `shared/ui/pill-button`, `state-art`, `shared/lib/rise`,
  `pointer-spotlight`, the Radix `Dialog`.

## 4. Decisions and assumptions (veto any)

| Decision                                                                                                                                                                                                                                                                                                                                                                        | Source                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **The API requires a monitor `name`; the prototype dialog has no name field** (its header says "verify against schema"). The dialog keeps the prototype's two fields and the port sends `name = URL host` (trimmed to 120 chars). The list shows host + path as in the prototype. Adding an optional Name field would be a prototype change, so it is left for the design chat. | Schema + prototype               |
| There is no `GET /projects/:id`; project name / description / createdAt come from `GET /workspaces/:id/projects` (existing `useProjects`). Not in that list, or 404, means "Project not found". The workspace name and role come from the workspaces context.                                                                                                                   | API                              |
| Header and badge tint: workspace tone (`TONE_VAR`), not the prototype's fixed white.                                                                                                                                                                                                                                                                                            | User                             |
| New files: `entities/monitor` (`useMonitors`, URL / interval helpers, `MonitorRow`), `entities/scan` (`ScanRun` model + chip), `features/monitors` (`CreateMonitorDialog`, `useScanRuns` polling hook, `RunScanButton`), `widgets/project-detail`, `pages/project`. `LoadErrorBanner`, panel classes and `LockIcon` move to `shared/ui` so widgets and features share them.     | AGENTS.md section 6              |
| Scan chip: `Queued`, `Running`, `Succeeded · no findings`, `Succeeded · N finding(s)` (warn tone when N > 0), `Failed`. Chip appears only after a scan was run in this session. Polling: `GET /scans/:id` every 1.5 s, stops on a terminal status, on unmount and after 120 polls.                                                                                              | Prototype + AGENTS.md section 11 |
| Duplicate URL check is a client hint (exact string, as in the prototype); the API (409) is authoritative and its message is shown under the URL field. Private-network rejections are shown the same way.                                                                                                                                                                       | Prototype + API                  |
| `?role=`, `?state=`, `?motion=` flags are not ported. Old `create-monitor-form` is removed; the monitor page stays as is (its prototype is not ported yet).                                                                                                                                                                                                                     | AGENTS.md section 4              |

## 5. Implementation requirements

Tokens only; limits in named constants (interval 60-86,400, default 300, presets 1 min / 5 min / 15 min /
1 hour / 24 hours, poll 1.5 s / 120). Roles: OWNER and ADMIN see "Add monitor" and "Run scan"; MEMBER sees the
view-only note. Row actions sit above the stretched link. Search filters by URL, case-insensitive.

## 6. Parity checklist

Must match: breadcrumb (Dashboard / workspace / project), header (badge, name, description, meta
"Created … · N monitors"), "Monitors" head + search, monitor rows (globe, host + protocol tag, path, Interval,
Added, chip, Run scan, chevron, progress bar while busy) at both layouts, dialog copy / presets / human
interval, empty, no-results, error, not-found, loading.
Deliberate differences: tone from the workspace; Radix dialog; Sonner toasts; locale dates; monitor name
derived from the host; no preview flags; demo data and simulated scans removed.

## 7. Performance, accessibility, security

Polling is cleaned up on unmount; no per-monitor scan fetch on load. Dialog focus is handled by Radix; fields
are labelled with `aria-invalid` and error ids; chip text carries the status (never colour alone); reduced
motion disables blink / ping / slide / pop. URLs are rendered as text, links use router `Link`; the API
rejects private targets and the hint stays visible.

## 8. Acceptance, checks, manual steps

Acceptance: parity at 360 / 768 / 1024 / 1440 px for the main states; roles behave per the table; add monitor
and run scan work against the API; polling stops at a terminal status. Checks: typecheck, unit tests,
coverage, Prettier, build, `git diff --check`, e2e `monitoring-flow` (updated for the new dialog).
Manual: start infra, API, worker, web; `/dashboard` -> workspace -> project; add a monitor with an https URL;
run a scan and watch Queued -> Running -> result; try a duplicate and a private URL; try MEMBER; narrow
viewport; reduced motion.

## Result

Implemented on `refactor/project-page`.

Colour rule (revised by the user during this phase): the tone of a workspace is decided by the user's role
in it, **gold = OWNER, blue = ADMIN, white = MEMBER** (no role: white). `workspaceLook(workspace)` now takes
the `role` and returns that tone (`toneForRole`, `ROLE_TONE` in `entities/workspace`); the waveform and glow
delay still derive from the workspace id and name. It applies to the dashboard card, the workspace hero and
the project header, and the role badge now uses the same colours (owner gold, member white). This replaces
the earlier "tone from a hash of the workspace" behaviour of phase 8 and is a deliberate difference from the
prototypes.

Other notes:

- Shared pieces added or moved: `shared/ui/state-panel.tsx` (panel classes + `LoadErrorBanner`),
  `shared/ui/lock-icon.tsx`; the workspace widget re-exports what it used to define.
- Monitor name: the API requires one, the prototype has no field for it, so the port sends the URL host.
  A Name field would need a prototype change.
- The old `create-monitor-form` and `pages/project-page.tsx` are removed; `e2e/monitoring-flow.spec.ts` now
  uses the Add monitor dialog and the `Open monitor <url>` link.

Checks (pnpm from `apps/web`; `moon` not installed, Node 22.22.0): typecheck pass; 29 files / 157 tests
pass; coverage thresholds pass (52.2 / 49.0 / 64.0 / 53.0); Prettier pass for everything touched; `pnpm build`
pass (project chunk 7.2 KB gzip, no 3D reference); `git diff --check` clean; e2e `monitoring-flow` passes
(installed Chromium through a temporary config, removed afterwards).

Parity (headless Chromium, reduced motion, owner, prototype with demo data, port with a mocked API), 1440 /
1024 / 768 / 360 px: share of pixels differing by more than 40/255 is 2.8 %, 3.4 %, 3.4 % and 6.9 %; page
heights within 4 px at 1440, within about 40 px at 1024 / 768 / 360. Differences seen: fonts (the prototype
could not load Google Fonts offline), a 2 px line-height offset in the header, the dialog scrim (the shared
Radix overlay is a plain 50 % black, the prototype is 65 % with a blur), and the tone, which now follows the
role rule. Viewed the 1440 page, the 1440 add-monitor dialog and the 360 page side by side; viewed the header
and dashboard card for OWNER, ADMIN and MEMBER.

Not verified: the scan chip animations and a real scan lifecycle in a browser (unit tests only, with fake
timers), hover frames, error / loading / not-found / empty / no-results states and the ADMIN / MEMBER roles in
a browser beyond the header screenshot, a run against the real API and worker, real devices, `moon`, Node 24.
