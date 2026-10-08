# Phase 13 — Scan page

Branch: `refactor/scan-page`, stacked on `refactor/monitor-page` (PR #6 is open; this page reuses its scan
helpers, `ScanChip`, `formatClock`, `useNow`). Merge PR #6 first, or merge them together.

## 1. Goal

Port `references/scan-prototype.html` to `/workspaces/:workspaceId/projects/:projectId/monitors/:monitorId/scans/:scanId`
and the direct route `/scans/:scanId`: a hero with an animated status orb, three metric tiles (HTTP status,
response time with a 2 s meter, findings with severity counts), the lifecycle timeline, the request details,
and the findings (or the waiting / failed / no-findings panels). Web only.

## 2. References read

- `AGENTS.md`; `references/scan-prototype.html` in full: header note (API fields to verify, polling, direct
  route degrades, copy keyed by finding `code`), CSS (hero tones and orb animations, tiles and meter, timeline,
  key / value list, finding cards, good / fail / waiting boxes, breakpoints 1,100 and 640 px), glue (view model,
  timeline, findings, run again, states).
- Code: `pages/scan-page.tsx` and its test (old page), router (both scan routes), `shared/api/client.ts`
  (`scan`, `triggerScan`), `ScanDetail` / `Finding` types, `apps/api` Prisma `ScanFinding`, the worker's finding
  policies (`apps/worker/.../policies.py`), the monitor page code from PR #6.

## 3. Verified API facts and decisions (veto any)

| Decision                                                                                                                                                                                                                                                                                                                                                                                                                   | Source                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `GET /scans/:id` returns `status`, `statusCode` (not `httpStatus`), `responseTimeMs`, `errorMessage` (a string, **no error code**), `createdAt`, `startedAt`, `finishedAt`, `monitorId` and `findings[{code,title,severity,description,recommendation,evidence}]`. It does **not** return the monitor, project or workspace.                                                                                               | API verified                     |
| Nested route: workspace, project and monitor (host, URL) come from the existing hooks (`useWorkspacesContext`, `useProjects`, `useMonitors`). Direct route `/scans/:id` has no context: the breadcrumb is `Dashboard / Scan`, the host is omitted from the hero, the Target row says "Not available", "Run scan again" is hidden (the role is unknown; the API would still decide) and "not found" links to the dashboard. | Prototype header + API           |
| Finding title and explanation use the prototype's copy keyed by `code` (HTTP_CLIENT_ERROR, HTTP_SERVER_ERROR, SLOW_RESPONSE) filled with the scan's HTTP status and response time. An unknown code falls back to the API's own `title` and `description`, not to generic text.                                                                                                                                             | Prototype + API                  |
| The API's `recommendation` text (shown by the old page) is **not** in the prototype, so it is not shown. This drops information the old page had; adding a "Recommended" line to the finding card is a prototype change for the design chat.                                                                                                                                                                               | Prototype                        |
| Failed scan: the box heading is `errorMessage`; the prototype's error `code` chip is omitted because the API has no code. A failed scan without a message says "The check could not complete."                                                                                                                                                                                                                             | API                              |
| "Run scan again" (OWNER and ADMIN): `POST` (202), toast `Scan queued for <host>.`, then navigate to the new scan's page (same route shape), which polls.                                                                                                                                                                                                                                                                   | Prototype + AGENTS.md section 11 |
| Polling `GET /scans/:id` every 2 s while QUEUED or RUNNING, stopped on a terminal status and on unmount; a toast `Scan finished.` / `Scan failed.` only when this page saw the transition.                                                                                                                                                                                                                                 | Prototype header                 |
| Header tint: the hero colour follows the scan result (grey queued, blue running, green ok, amber findings below HIGH, red failed or HIGH and above), as in the prototype; it is not the workspace tone.                                                                                                                                                                                                                    | Prototype                        |
| Times use the user's locale and time zone; durations are computed from `createdAt`, `startedAt`, `finishedAt`; a missing timestamp collapses the step to status only.                                                                                                                                                                                                                                                      | Prototype header                 |
| `?scan=`, `?then=`, `?role=`, `?state=`, `?motion=` flags are not ported. `pages/scan-page.tsx` and its test are replaced.                                                                                                                                                                                                                                                                                                 | AGENTS.md section 4              |

## 4. File plan

```
entities/scan/model/scan-view.ts   outcome (tone, orb, title, sub), HTTP status text, severity rank / sort / counts,
                                   finding copy, durations, timeline steps, meter percent, constants (METER_MAX_MS)  (+ test)
entities/scan/ui/scan-orb.tsx      the six orb animations
features/scans/model/use-scan.ts   load + 404 detection + polling + transition toast                              (+ test)
features/scans/run-again.tsx       hook + button action (trigger, toast, navigate)
widgets/scan-detail/               scan-detail.tsx, ui/{scan-crumbs,scan-hero,metric-tiles,lifecycle,request-box,
                                   findings,scan-states}.tsx
pages/scan/scan-page.tsx, scan-content.tsx (+ test); router import path; old scan-page.tsx and test removed
app/styles/globals.css             orb keyframes (draw, spin, halo, shake, ring) and the meter / finding rise
e2e/monitoring-flow.spec.ts        the final assertions (heading, response text) updated, not run
```

## 5. Parity checklist

Must match: breadcrumb, hero (orb, status chip, title, sub, host and start time, action), metric tiles, meter
with the 2 s tick, lifecycle timeline states, request box with copy buttons, findings (sorted by severity, left
accent bar, severity pill, code chip), waiting / failed / no-findings boxes, loading, error and not-found,
two-column layout below 1,100 px, mobile rules below 640 px, reduced motion (orb and meter static).
Deliberate differences: `statusCode`, no error code chip, no recommendation, direct-route degradation,
navigation after "Run scan again", Sonner toasts, locale dates.

## 6. Accessibility, security, performance

Orb is decorative (`aria-hidden`) with the status in text; the lifecycle is an ordered list; meter has a text
equivalent ("Above / Under the 2,000 ms slow threshold"); copy buttons are labelled and report failure honestly;
severity is a word, not colour only. Evidence is not rendered. Polling is cleaned up; one request per tick.

## 7. Checks and manual steps

Typecheck, unit tests, coverage, Prettier, build, `git diff --check`; e2e updated but not run until the end.
Screenshots against the prototype scenarios (ok, findings, failed, running, queued) at 1440 / 1024 / 768 /
360 px. Manual: open a scan from the monitor page; run again and watch queued, running, result; failed target;
MEMBER; the direct `/scans/:id` URL; reduced motion.
