# Monitor page: unified Checks strip and tabs

## Goal

The monitor screen stacks Security, Exposed-file checks, and Domain and DNS as three long sections, each with its own
switch and Run button. Moving between them means scrolling and relearning three layouts. Replace that with one
**Checks strip** (three cards: Availability, Security, Domain & DNS). Each card shows live status, owns the on/off
switch and the Run button, and is also the tab that selects the panel below. Exposed-file checks move inside the
Security panel as a row. Web only; no contract change.

## References read

- `AGENTS.md`, `apps/web/AGENTS.md` rules (FSD layering, `api.*` only, tokens only, no second UI kit)
- `reference/monitor-prototype.html` (the visual and behavioral design; header comment has the porting map and URL flags)
- `docs/display-content-mapping.md`: re-check the visibility rules for security and DNS results before coding (not yet re-read for this prompt)

## Existing code inspected

- `pages/monitor/monitor-content.tsx`, `widgets/monitor-detail/monitor-detail.tsx` and `ui/*` (header, tiles, chart, history)
- `widgets/security-posture/security-posture.tsx`, `widgets/dns-watch/dns-watch.tsx` (each owns switch + run + states)
- `features/security/ui/{security-switch,run-security-scan-button,path-probes-panel,path-probes-dialog}.tsx`
- `features/security/model/*` (`use-check-settings`, `use-latest-security-scan`, `use-latest-dns-scan`, `use-run-*`)
- `features/monitors/model/use-monitor-scans.ts`, `entities/scan/model/scan-history.ts`, `shared/ui/switch.tsx`
- `radix-ui` ^1.6.7 is installed, so `Tabs` is available without a new dependency.

## Decisions and assumptions

- Tab state lives in the URL (`?tab=overview|security|dns`, default `overview`) so a link opens a tab. Invalid value falls back to `overview`.
- Cards are the tablist. Controls inside a card (switch, Run) must not change the tab. Implement with Radix `Tabs.Trigger` as a sibling-overlay pattern or a roving-focus tablist where the card body is the trigger and the controls sit outside the trigger element, so no button is nested in a button.
- Data hooks lift to `MonitorDetail` (or a small `use-monitor-checks` hook) so the cards and panels share one `useCheckSettings`, one latest-scan hook per kind, and one run hook per kind. Today each widget calls its own `useCheckSettings`; sharing avoids duplicate fetches.
- The existing widgets (`SecurityPosture`, `DnsWatch`) lose their header, switch and Run (they move to the cards) and keep result rendering, states and the exposed-file row.
- Hero "Run scan" becomes "Run all checks" (runs availability plus every enabled check). `MEMBER` sees no Run buttons and a read-only on/off text; this matches the current role rules, the API still decides.
- Scan history gets a kind filter (All / Availability / Security / DNS). The existing status filter stays; both apply together.
- Copy stays English as in the existing screens and the prototype. Copy not in the prototype or existing screens is not added.
- "Overall" pill in the hero is derived from stored findings only (non-LOW findings count). It is a summary of stored data, not a health claim; wording stays "N findings need a look" / "All checks healthy" only if confirmed (see open question).

## Open question

- "All checks healthy" is a stronger claim than passive "observed" wording. Proposed: "No findings observed" / "N findings observed". Confirm or change.

## Contract changes

None. No API, schema, queue, or worker change.

## Files likely to change (apps/web/src)

- `widgets/monitor-detail/monitor-detail.tsx`: tabs state, shared hooks, layout
- `widgets/monitor-detail/ui/check-tabs.tsx` (new): the strip, one card per check
- `widgets/monitor-detail/ui/check-card.tsx` (new): card with status summary, switch, Run
- `widgets/monitor-detail/ui/monitor-header.tsx`: "Run all checks", overall pill
- `widgets/monitor-detail/ui/scan-history.tsx`, `entities/scan/model/scan-history.ts`: kind filter, kind label per row (+ tests)
- `widgets/security-posture/security-posture.tsx`, `widgets/dns-watch/dns-watch.tsx`: remove header/switch/Run, keep results and states
- `features/security/ui/path-probes-panel.tsx`: becomes the row inside the Security panel (same dialog)
- `features/security/ui/security-switch.tsx`, `run-security-scan-button.tsx`: reused by the cards (compact variant)
- Tests next to each changed file

## Implementation requirements

- Match `reference/monitor-prototype.html`: layout, spacing, type scale, tokens, copy, timings. Numbers go to named constants. No inline styles except `riseStyle`.
- Card summary per state: loading skeleton, error ("Couldn't load" + retry in panel), off, no scan yet (role-aware text), ready (severity pills with text and icon, never color alone).
- Run button reasons are written text, not only a tooltip: off, queued, rate-limit wait (`formatWait`), as in `RunSecurityScanButton`.
- Selected card connects to the panel (arrow notch, hidden below 960 px). Cards stack at < 960 px.
- Keyboard: arrows, Home, End move between tabs; Enter/Space selects; controls inside cards are separately focusable.
- Panels render stored data as text only. `null` shows "not available".
- Reduced motion: no entrance rise, no ping, no transitions (`motion-reduce:`).
- Every effect cleans up; polling behavior of `useMonitorScans` is unchanged.

## Acceptance criteria

- One strip, three cards, one click switches panel; URL reflects the tab; reload keeps it.
- Switch and Run exist once per check, on the card only. No duplicate controls in panels.
- Exposed-file toggle is inside the Security panel, with the same authorization dialog and "On. Acknowledged <time>." text.
- `MEMBER`: no Run, no switches, no exposed-file toggle, read-only state text. Non-member gets 404 as before.
- Existing routes, scan detail page, polling and toasts unchanged. `HTTP_PROBE` behavior untouched.
- All four widths (360, 768, 1024, 1440) have no horizontal scroll and no clipped controls.

## Parity checklist (vs prototype)

Must match: hero, tiles, strip layout and card anatomy, selected-card treatment, panel cards, pills, states, dialog.
Deliberately different: real data and times, Radix Switch/Dialog/Tabs instead of hand-built, Sonner toasts instead of the prototype toast, fonts via `@fontsource`, `Skeleton`/`EmptyState` primitives for states, edge profile uses the existing `EdgeProfileCard`.

## Visual interpretation

Prototype is the design. Tokens are `landing-*` from `app/styles/globals.css`; surfaces `bg-landing-surface/[.72]`, radii 18/22/26 px, display font for titles, mono for keys and ids. Motion: `animate-dash-rise` with `riseStyle`, panel fade-in, `animate-dash-ping` dot; all disabled under reduced motion.

## Security requirements

Display only. No new request types; scans are triggered through the existing API routes, which authorize by role. Evidence and header values render as text. No cookie values, bodies, or tokens are shown or logged. Safety review: not applicable (no scanner change).

## Checks to run

`moon run web:typecheck`, `moon run web:test`, `moon run web:build`, `moon run web:test-e2e` (if services up), `pnpm format:check`, `git diff --check`. Update or add e2e for tab switching if an e2e for the monitor page exists.

## Manual test steps expected after implementation

1. `docker compose up -d`, `moon run api:dev`, `moon run worker:dev`, `moon run web:dev`.
2. Open `http://localhost:5173`, sign in, workspace, project, monitor.
3. Expect hero, tiles, Checks strip with three cards, Availability tab selected.
4. Click Security, then Domain & DNS: panel changes, URL gets `?tab=`, reload keeps it. Arrow keys move tabs.
5. Toggle Security on/off on the card; click Run; card shows Scanning, then the result. Same for DNS.
6. In Security panel, turn on Exposed-file checks: dialog needs the checkbox; state text shows acknowledgment time.
7. History: filter by kind and by status.
8. Roles: `MEMBER` sees no controls; `ADMIN` and `OWNER` do. Empty, loading, API-down states. Widths 360, 768, 1024, 1440.
9. Watch console, network tab, API and worker logs.

## Result

Branch: `feat/monitor-checks-tabs` (created after committing the DNS watch UI as `2406e86` on `feat/dns-watch-ui`).

Implemented: Checks strip with three cards that are also Radix tabs (`?tab=` in the URL), switch and Run on the cards, exposed-file row inside the Security panel, kind filter in scan history, header summary line.

Differences from the plan and the prototype:

- No "Run all checks". Security and DNS runs navigate to their scan page, so a combined run would fight over navigation. The Availability card has its own "Run scan"; the header keeps the view-only note for members.
- Header summary uses "No findings observed" / "N findings observed" (the open question, resolved as proposed), and shows nothing while results load or when no check has a result.
- Cards stack in one column below 1280 px (three columns were cramped at 1024 and 768 px with the sidebar). The prototype's three-column layout applies at 1280 px and up.
- Overview panel has no panel heading; it shows the response chart and scan history directly.
- Shared data hook is `features/security/model/use-monitor-checks.ts` (not in the widget) so both panels can import its type without widget-to-widget imports.

Checks run: `web:typecheck`, `web:test` (424 tests), `web:build`, prettier on changed files. `pnpm format:check` for the whole repo reports 146 files, all pre-existing line-ending noise outside this change.

Visual check: Playwright screenshots at 360, 768, 1024, 1440 px for each tab with mocked API (owner role), no horizontal overflow. Not compared pixel for pixel against the prototype, not checked with the real API and worker, and the member role, loading and error states were verified by tests only, not by eye.
