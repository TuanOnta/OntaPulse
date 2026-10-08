# Phase 7 — Dashboard page and the shared app shell

Branch: `refactor/dashboard-page` (from `master` at `7f6fb3e`: landing, auth and the dashboard
prototype are already merged).

## 1. Goal

Port `apps/web/references/dashboard-prototype.html` to `/dashboard`, and build its app shell
(sidebar, mobile top bar and drawer, ambient background) once so every authenticated screen uses it.

## 2. References read

- `AGENTS.md` (sections 4, 6, 10, 11, 12, 14, 16) and `README.md` (web routes table: `/dashboard` is
  "Overview of the user's workspaces"; limitations: no uptime/SLA/incident/response-time aggregates).
- `apps/web/references/dashboard-prototype.html`, fully read:
  - header comment: data source is `GET /api/workspaces` only (`id`, `name`, `role`, `createdAt`);
    summary counts are derived from the list; query flags `?state=full|loading|empty|error`,
    `?motion=reduce`; the app shell is "built once in `widgets/app-shell`" and reused by every later
    screen;
  - tokens (same set as landing/auth, plus `--sidebar-w: 264px`), ambient background, grid layout,
    sidebar, mobile bar and drawer (<= 959 px), head, heartbeat trace, stats, toolbar (role chips +
    search), workspace cards (spotlight, role badge, hover), "create workspace" card, skeleton, empty /
    no-results panel, error banner with retry, entrance and count-up motion, reduced motion;
  - glue: filter and search logic, initials, greeting (first name), drawer open/close with focus and
    Escape.

## 3. Existing code inspected

- `pages/dashboard-page.tsx`: old hero card, three metrics ("Workspaces", "Managed by you",
  "Access protected"), a "Queue operations" panel (OWNER only, `api.queueHealth`), workspace cards,
  Sonner toast on error.
- `app/layouts/app-shell.tsx` (old `AppShell` + `Crumbs`, uses `SignalField`, a "Signal rule" card) and
  `widgets/workspaces/workspace-navigation.tsx`; both are used by `workspace`, `project`, `monitor`,
  `scan` and `workspace-create` pages (`AppShell` wraps their content; `Crumbs` is imported too).
  `scan-page.test.tsx` mocks `@/app/layouts/app-shell`.
- `shared/api/client.ts` (`api.workspaces()`, `ApiError`), `shared/types/domain.ts` (`Workspace`: `role?`,
  `createdAt`, `joinedAt?`), `shared/lib/format.ts`, `shared/ui/skeleton|empty-state|button`, the auth
  provider (`user`, `logout`), `e2e/monitoring-flow.spec.ts` (clicks the workspace link by its name).

## 4. Decisions (veto any)

| Decision                                                                                                                                                                                                                                                                                                                                                                                                                          | Source               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| The new shell replaces the old one for **all** authenticated pages. `app/layouts/app-shell.tsx` keeps exporting `AppShell` and `Crumbs` with the same props so no other page import changes; page contents are not touched until their prototypes exist.                                                                                                                                                                          | User                 |
| The "Queue operations" panel is removed from the dashboard (prototype has no such panel). `api.queueHealth` stays in the client, unused by the UI.                                                                                                                                                                                                                                                                                | User                 |
| Dashboard data: `GET /api/workspaces` only. Counts: Workspaces = total, "You own" = role `OWNER`, "Shared with you" = total - owned (prototype formulas). The old "Access protected / Always" metric and the "Command center online" hero copy go away.                                                                                                                                                                           | Prototype            |
| Layers: `entities/workspace` (`useWorkspaces` hook, `WorkspaceRoleBadge`), `widgets/app-shell` (frame, sidebar, mobile bar, drawer), `widgets/workspace-overview` (stats, toolbar, grid, empty/error/no-results), `pages/dashboard` (composition). `app/layouts/app-shell.tsx` is a thin wrapper that supplies the user, sign-out and workspaces to `widgets/app-shell` (widgets get data through props, not from the app layer). | AGENTS.md section 6  |
| Sidebar and dashboard each call `GET /api/workspaces` (same as today: two calls per dashboard visit). A shared store is a possible follow-up, not part of this phase.                                                                                                                                                                                                                                                             | Keep small           |
| Mobile drawer is custom, as in the prototype (`aria-expanded`, scrim, Escape, focus to the first link on open and back to the menu button on close), plus: the closed drawer is `invisible` so keyboard focus cannot reach it, and a route change closes it. Radix Dialog is not used because the same sidebar is persistent on desktop.                                                                                          | Prototype + a11y     |
| Prototype tokens keep the `--color-landing-*` names (shared with landing and auth). A rename to neutral names is a separate follow-up. New tokens: `--color-landing-border-hover` exists; added here: none unless the port needs one (to be listed in the result).                                                                                                                                                                | Consistency          |
| `?state=` and `?motion=` preview flags only under `import.meta.env.DEV`, same as landing and auth.                                                                                                                                                                                                                                                                                                                                | Earlier decision     |
| Dates use the user's locale and time zone (`Intl.DateTimeFormat(undefined, { dateStyle: "medium" })`) instead of the prototype's fixed `en-US`; a missing `role` shows no badge and counts as "shared".                                                                                                                                                                                                                           | AGENTS.md section 10 |

## 5. File plan

```
apps/web/src/
  entities/workspace/
    model/use-workspaces.ts        status idle|loading|ready|error, workspaces, error {message, requestId}, reload  (+ test)
    model/workspace-stats.ts       counts, role filter + search, initials, greeting name   (+ test)
    ui/workspace-role-badge.tsx    OWNER / ADMIN / MEMBER pill (text, never color alone)
  widgets/app-shell/
    ui/app-shell-frame.tsx         grid, ambient background, drawer state, scrim
    ui/sidebar.tsx                 logo, main nav, workspaces list (loading/empty/error), user block, sign out
    ui/mobile-bar.tsx
    ui/ambient-background.tsx
    model/use-drawer.ts            open/close, Escape, focus handling, close on route change   (+ test)
  widgets/workspace-overview/
    ui/overview-stats.tsx, workspace-toolbar.tsx, workspace-card.tsx, create-workspace-card.tsx,
       workspace-grid-skeleton.tsx, overview-empty.tsx, overview-no-results.tsx, overview-error.tsx,
       heartbeat-divider.tsx, workspace-overview.tsx   (+ test of the states)
  pages/dashboard/dashboard-page.tsx      (replaces pages/dashboard-page.tsx) + test
  shared/lib/use-count-up.ts, use-pointer-spotlight.ts   (rAF / CSS-variable helpers, reduced-motion aware)
  shared/lib/format.ts            + formatDay
  app/layouts/app-shell.tsx       thin wrapper, `Crumbs` kept
  app/router/app-router.tsx       new dashboard import path
  app/styles/globals.css          dashboard keyframes (drift, ping, travel, sheen, drop, art ring/pulse)
  e2e/monitoring-flow.spec.ts     workspace link name
```

Removed: `widgets/workspaces/workspace-navigation.tsx`, `pages/dashboard-page.tsx`. Not touched:
`shared/ui/signal-field.tsx` and other demo/debt files (still imported elsewhere or known debt).

## 6. Implementation requirements

### Shell (parity)

- Grid `264px | 1fr` (`min-height: 100svh`); sidebar sticky, full height, `bg landing-bg-2/82`, blur,
  right border; sections: logo, main nav (Dashboard, New workspace), "Workspaces" label + scrollable
  list (dot + truncated name; `aria-current="page"` gets surface-2 background and the 3 px accent
  marker with glow), user block (initials avatar, name, mono email, sign-out icon button, 44 px).
- <= 959 px: single column; sidebar fixed, `min(300px, 86vw)`, slides in (`.35s`), scrim `bg-black/60`;
  mobile bar sticky at the top (menu button, small logo, spacer).
- Ambient layer: fixed grid lines masked to the top right, blue radial blob drifting (`14s`).
- Content: `max-w-[1160px]`, padding `44/40/72` desktop and `28/16/56` mobile.
- Sign out: `logout()` then navigate to `/` (current behavior).

### Dashboard

- Head: eyebrow with pulsing live dot ("Dashboard"), `h1` "Welcome back, <first name>", subtitle, primary
  "New workspace" button (`/workspaces/new`, shine on hover); full width at <= 520 px.
- Heartbeat divider (static line + travelling beam).
- Stats: 3 cards with a coloured top rule (width = share), mono label, display number with count-up
  (700 ms ease-out, skipped under reduced motion or when 0). At <= 959 px they stay three columns.
- Toolbar: role chips with counts (`aria-pressed`) and a search field (`type="search"`, labelled for
  screen readers); filters combine; the "create workspace" card shows only with no filter and no query.
- Cards: initials mark, role badge, name (wraps anywhere), "Created <date>", "Open workspace →", whole
  card is one link (`aria-label="Open workspace <name>"`) to `/workspaces/:id`, hover lift and pointer
  spotlight (CSS variables, no React state per move).
- States: loading (4 skeleton cards, `aria-busy`, sidebar "Loading…"), empty ("Create your first
  workspace" panel + CTA), error (banner `role="alert"`: "Couldn't load your workspaces." + request id +
  "Try again" that refetches; sidebar "Unavailable."), no results (panel + "Clear filters").
  The results region is `aria-live="polite"`.
- Copy verbatim from the prototype; the prototype's curly apostrophes stay.
- Error messages: `ApiError.message` is not shown in the banner title (prototype title is fixed); the
  message and `requestId` go in the small line when present, otherwise only the request id.

## 7. Parity checklist

Must match at 360 / 768 / 1024 / 1440: shell layout and drawer, spacing, type scale, tokens, copy, stats,
toolbar, cards, create card, skeleton, empty, no-results and error panels, motion list, reduced motion.

Deliberately different: real data and routing (links instead of `#`); dates in the user's locale; role
badge omitted when the API sends no role; preview flags and `html.reduce-motion` class only via real
`prefers-reduced-motion` (class not ported, as in the auth phase); `aria` additions (drawer focus and
`invisible`, labelled search); no Queue operations panel; old hero, "Access protected" metric and
"Signal rule" card removed; fonts self-hosted.

## 8. Performance requirements

No new dependencies. No per-pointer-move React state. Count-up and spotlight are cleaned up on unmount.
Dashboard chunk stays small; no 3D code on this route (verified in the build graph).

## 9. Accessibility requirements

Landmarks (`aside` with `aria-label`, `nav`, `main`), skip link to the content, `aria-current` on active
links, drawer button `aria-expanded` / `aria-controls`, focus management as in section 4, chips use
`aria-pressed`, banner `role="alert"`, visible focus rings (text-colour outline from the prototype),
44 px targets, status never colour-only (role is text), contrast per the phase 1 report (plus
`landing-danger-text` on `surface` and `muted` on `bg-2/82`, to be re-checked), reduced motion honoured.

## 10. Security requirements

Names and messages are rendered as text only. No new storage, no logging of user data, no change to
the API client contract (`credentials: "include"` untouched). Sign-out and routing do not decide access:
the API does. Nothing outside `apps/web` is touched.

## 11. Acceptance criteria

1. `/dashboard` matches the prototype in all four states and at the four widths (differences listed).
2. Other authenticated pages render inside the new shell with their content unchanged and still work.
3. Filtering, search, clear, retry, drawer, sign-out and card links behave as in section 6.
4. Queue panel gone; `api.queueHealth` untouched in the client.
5. Checks in section 12 pass or failures are reported verbatim; e2e still passes.

## 12. Checks to run

`pnpm typecheck`; `pnpm test`; `pnpm coverage` (thresholds not lowered); Prettier on changed files;
`pnpm build` (chunk graph: no 3D on `/dashboard`); Playwright e2e `monitoring-flow` through the sandbox
Chromium config (the repo config wants an uninstalled browser build); `git diff --check`. `moon` is not
installed here; equivalent pnpm scripts are used and reported as such.

## 13. Parity verification plan (AGENTS.md section 12)

Serve the dashboard prototype with local fonts (Playwright route interception; it needs no three) and
screenshot prototype and port at 360 / 768 / 1024 / 1440 for `full`, `loading`, `empty`, `error`, the
"no results" view (search for a missing name), a role filter, and the open mobile drawer. The port uses a
mocked API (Playwright route) with the prototype's four sample workspaces and user. Compare layout
metrics first (element boxes), then pixel diff with reduced motion on in both. Report every difference;
no "pixel-perfect" claim. Screenshots stay out of the repo.

## 14. Manual test steps

1. `docker compose up -d`, `docker compose ps`; `moon run api:dev`, `moon run worker:dev`,
   `moon run web:dev`; open `http://localhost:5173`, sign in (`/login`).
2. `/dashboard`: greeting uses your first name; stats count up; cards link to each workspace; the sidebar
   lists the same workspaces and highlights the open one on `/workspaces/:id`.
3. Role chips and search: counts per role, "No matching workspaces" + "Clear filters".
4. New account with no workspaces (the API creates one on register; delete not available, so use dev
   `?state=empty`): "Create your first workspace" panel.
5. Stop the API: reload `/dashboard` -> error banner with "Try again"; start the API, click it.
6. 360 / 768 px: hamburger opens the drawer (focus moves in, Escape or scrim closes it, focus returns).
7. Open `/workspaces/:id`, a project, a monitor, a scan: new shell, unchanged content.
8. Reduced motion (DevTools): no count-up, drift, beam or card lift. Sign out returns to `/`.

## 15. Not verifiable here (expected)

A live API/worker run, real devices, `moon` / Node 24, and pixel parity for the animated (non-reduced)
frames.

## Result

Executed on `refactor/dashboard-page`.

Implemented per the file plan, with these changes from the prompt:

- **One workspace request instead of two.** `AppShell` now wraps its children in a `WorkspacesProvider`
  (`entities/workspace`), and the dashboard reads the list through `useWorkspacesContext()`. The sidebar
  and the page share the same data, and "Try again" refreshes both (with two independent requests the
  sidebar kept saying "Unavailable." after a successful retry; a test covers the fix). The dashboard body
  is therefore a child component (`pages/dashboard/dashboard-content.tsx`) rendered inside `AppShell`.
- **No `?state=` / `?motion=` preview flags.** Every state is reachable by mocking the API, which is
  how the parity check was done; nothing dev-only was added to the page. Reduced motion follows the real
  `prefers-reduced-motion` query.
- **Error banner shows the API message too.** The title is fixed as in the prototype; under it the API
  `message` and the `Request ID` each get a line (the prototype has only the request id line), so the
  banner is 17 px taller than the prototype's. The generic message (non-API errors) is "Check your
  connection and try again."
- No new design tokens were needed (`landing-*` set from the earlier phases was enough). New motion
  keyframes (`dash-*`) are in `globals.css`.
- `SignalField` / `BorderBeam` (`shared/ui/signal-field.tsx`) are no longer imported anywhere; the file was
  left in place (known-debt rule). `BlurFade` is unchanged.

Checks (pnpm from `apps/web`; `moon` not installed, Node 22.22.0): typecheck pass; 19 files / 84 tests
pass; coverage thresholds pass (38.9 / 34.9 / 51.5 / 39.2); Prettier on `src`, `e2e`, `package.json` pass;
`pnpm build` pass; `git diff --check` clean; e2e `monitoring-flow` passes through the sandbox Chromium with
a temporary config (it now clicks the card named "Open workspace <name>"). In the build graph the 3D
chunk is imported only by the landing-scene chunk; the dashboard chunk (4.9 KB gzip) and the app-shell
chunk (4.1 KB gzip) contain no 3D reference.

Parity (headless Chromium, reduced motion in both, prototype served with local fonts, port with a mocked
API using the prototype's four workspaces and user), 1440 / 1024 / 768 / 360 px:

- Main-column height and total page height are identical for full, loading and empty at every width;
  error differs only by the extra banner line above.
- Share of pixels differing by more than 40/255: full 0.00 %, admin filter 0.00 %, mobile drawer open
  0.00 %, loading 0.00-0.08 %, empty 0.07-0.19 %, "no results" 0.03-0.08 %, error 0.33-0.85 % (banner
  line). Two spacing issues found by the first comparison were fixed (gap inside the workspace list,
  line-height of the e-mail line).
- Also viewed: full dashboard at 1440 and the workspace page inside the new shell (content unchanged,
  it keeps its old card styling next to the new sidebar).

Not verified: the animated frames (count-up, drift, beam, card lift, spotlight were only checked for
absence of errors), a live API and worker run, real devices, `moon` / Node 24, and the other
authenticated pages beyond the e2e path and one screenshot of the workspace page (their own prototypes
do not exist yet, so their old styling now sits inside the new shell).
