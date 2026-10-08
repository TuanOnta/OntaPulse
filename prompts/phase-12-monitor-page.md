# Phase 12 — Monitor page

Branch: `refactor/monitor-page` (from `master` at `0d9ce1c`; PR #5, the new-workspace dialog, is still open and
not needed here).

## 1. Goal

Port `references/monitor-prototype.html` to `/workspaces/:workspaceId/projects/:projectId/monitors/:monitorId`:
breadcrumb, header tinted with the workspace tone, four config tiles, a response-time bar chart, a scan
history with a status filter, "Run scan" with the real QUEUED -> RUNNING -> result progression, and the
loading / error / not-found / empty / filtered-empty states. Web only.

## 2. References read

- `AGENTS.md`; `references/monitor-prototype.html` in full: header note (API fields to verify, chart derived
  client-side, 2,000 ms line = `SLOW_RESPONSE`, no uptime / edit / delete), CSS (header, tiles, chart with
  bars / tooltip / grid lines / x labels, scan rows with a 5-column grid and a 1,100 px breakpoint, HTTP
  badges, busy bar, flash on new rows, note), glue (history filter, chart, simulated run, copy button).
- Code: `pages/monitor-page.tsx` (old table page), `shared/api/client.ts` (`monitors`, `scans`, `triggerScan`),
  `entities/scan` (`ScanRun`, `ScanRunChip`), `features/monitors`, `widgets/project-detail` (header pattern),
  `apps/api` scan routes and schema (`scan.repository.ts`, `scan.openapi.ts`).

## 3. Verified API facts and decisions (veto any)

| Decision                                                                                                                                                                                                                                                                 | Source               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| The scan list items **do** carry `status`, `statusCode`, `responseTimeMs`, `createdAt` (Prisma + OpenAPI), so the HTTP and response columns and the chart stay. The prototype calls the field `httpStatus`; the real one is `statusCode`.                                | API verified         |
| `GET /monitors/:id/scans` returns **every** scan, newest first, with no limit. The prototype says "recent scans", so the page lists the latest 50 (named constant) and the note says so only when more exist. The chart uses the last 12 finished scans.                 | API + prototype      |
| The monitor comes from `GET /projects/:id/monitors` (no single-monitor endpoint); project name for the "Added" tile and breadcrumb from `useProjects`; workspace name and role from the workspaces context. Missing monitor, project or a 404 means "Monitor not found". | API                  |
| Header tone = workspace tone from the role (gold owner, blue admin, white member), like the project header.                                                                                                                                                              | User rule            |
| The title is the URL host with a protocol tag and the path below, as in the prototype; the monitor `name` (the host, set when it was created) is not shown separately.                                                                                                   | Prototype            |
| Run scan: `POST` (202, QUEUED) puts the scan at the top of the list at once, then the list is re-fetched every 2 s while any scan is QUEUED or RUNNING (also covers scheduler-made scans), and stops when none is. Polling is cleaned up on unmount.                     | AGENTS.md section 11 |
| Chart and history times use the user's locale and time zone; the relative time ("4 min ago") refreshes every 60 s.                                                                                                                                                       | AGENTS.md section 10 |
| "Copy target URL" uses `navigator.clipboard`; if it is unavailable or refused the toast says it could not copy (no false success).                                                                                                                                       | Honesty              |
| Status is shown with text and a dot, never colour alone; failed bars carry a "×" mark.                                                                                                                                                                                   | AGENTS.md section 10 |
| `?role=`, `?state=`, `?motion=` flags are not ported; `pages/monitor-page.tsx` is removed. The scan detail page is not touched (its prototype is a later phase).                                                                                                         | AGENTS.md section 4  |

## 4. File plan

```
entities/scan/model/scan-history.ts      filter + counts, finished-run selection, chart scale (max, y%), HTTP tone,
                                         response label, relative time, SLOW_MS = 2000, HISTORY_LIMIT = 50   (+ test)
entities/scan/ui/scan-row.tsx            history row (chip, HTTP badge, response, when, chevron, busy bar, flash)
features/monitors/model/use-monitor-scans.ts   list + trigger + polling while busy                              (+ test)
shared/lib/use-now.ts                    re-render every N ms (+ test)
widgets/monitor-detail/
  monitor-detail.tsx                     composes everything
  ui/monitor-crumbs.tsx, monitor-header.tsx, monitor-tiles.tsx, response-chart.tsx,
     scan-history.tsx, monitor-states.tsx (not found, skeleton)
pages/monitor/monitor-page.tsx, monitor-content.tsx (+ test); app/router/app-router.tsx import path
app/styles/globals.css                   keyframes: grow, glow-b, flash-n (only what is missing)
```

## 5. Parity checklist

Must match: 4-level breadcrumb, header (globe badge, host + protocol tag, path, Run scan or view-only note),
tiles (Target with copy button, Interval with seconds, Request "HTTP GET / Redirects are not followed", Added
"in <project>"), chart (grid lines at 0 / 1 s / 2 s with the amber 2 s line, bars with tooltip and focus,
failed marker, legend, x labels hidden below 640 px), history (header row, 5 columns, 2-column layout below
1,100 px, filter chips with counts, empty / filtered-empty panels, explanatory note), motion (bar grow, new-row
flash, busy bar), reduced motion. Deliberate differences: `statusCode` instead of `httpStatus`, latest 50
scans, real polling, Sonner toasts, role tone, clipboard failure handling.

## 6. Performance, accessibility, security

No per-scan requests; one list request per poll; chart is plain DOM/CSS (no chart library). Bars are focusable
with `role="img"` labels; the table uses table roles; filter chips use `aria-pressed`; live status text for the
run button. URLs rendered as text only.

## 7. Checks and manual steps

Typecheck, unit tests, coverage, Prettier, build, `git diff --check`; e2e skipped until the end (the
`monitoring-flow` spec does open this page and clicks `Run scan` and `Inspect`, so its selectors are kept or
updated, and it is run at the end). Screenshots against the prototype at 1440 / 1024 / 768 / 360 px. Manual:
open a monitor from the project page, run a scan and watch queued, running, result; failed target; MEMBER view;
filter chips; narrow viewport; reduced motion.
