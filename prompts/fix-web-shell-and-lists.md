# Fix: shared workspace list, persistent app shell, and other frontend rough edges

## Goal

Creating a workspace does not open it, and the new workspace does not show in the sidebar or on the dashboard. The report also
asked for a wider pass over the frontend. This prompt fixes the cause of the reported problem and the related data-flow and
shell problems found in an audit of `apps/web`. Web only; no API, schema, queue, or worker change.

## References read

- `AGENTS.md` (sections 2, 11, 12, 13, 14), `apps/web/AGENTS.md` rules (FSD layering, `api.*` only, tokens only)
- `docs/display-content-mapping.md` (copy and visibility rules; no change expected)
- Existing screens and primitives as the design reference. No prototype exists for these behaviors and no visual change is intended.

## Existing code inspected

- `app/router/app-router.tsx`, `app/layouts/app-shell.tsx`, `app/providers/auth-provider.tsx`
- `entities/workspace/model/use-workspaces.ts`, `workspaces-context.tsx`
- `features/workspaces/model/use-create-workspace.ts`, `new-workspace-dialog.tsx`, `new-workspace-context.tsx`,
  `first-workspace-form.tsx`, `manage-workspace.tsx`
- `pages/*/…-page.tsx` and `…-content.tsx` for dashboard, workspace, project, monitor, scan
- `entities/project/model/use-projects.ts`, `entities/monitor/model/use-monitors.ts`,
  `features/projects/create-project-dialog.tsx`, `features/monitors/create-monitor-dialog.tsx`
- `shared/api/client.ts`, `apps/web/index.html`
- The six signed-in screens were also opened in a browser with a mocked API at 360, 768, and 1440 px: no horizontal overflow, no
  page errors, and the layouts hold with long workspace, project, and URL names. The audit did not cover the auth screen, the
  landing page, keyboard-only use of each dialog, or real network failure modes.

## Findings

1. **The workspace list is loaded once and never updated by a create.** `WorkspacesProvider` fetches `GET /workspaces` when the
   shell mounts. `useCreateWorkspace` creates the workspace and calls `navigate(...)`, but nothing adds the new workspace to that
   list. The workspace page looks the id up in the list, does not find it, and shows "Workspace not found" (visible behind the
   dialog in the report's screenshot). The sidebar and the dashboard cards read the same stale list. This is the reported bug.
2. **Every route builds its own app shell.** Each page component wraps its content in `<AppShell>`, and each route renders a
   different page, so the whole shell (provider, sidebar, dialogs, drawer) is unmounted and mounted on every navigation. Effects:
   the workspace list is fetched again on every page change, the sidebar flashes its loading state, scroll and drawer state reset,
   and the new-workspace dialog is torn down. Finding 1 is made worse by this: the data is stale within a page but refetched
   between pages, so the symptom looks random.
3. **The Suspense fallback replaces the whole screen.** The lazy page chunk is awaited at the root, so the first visit to a page
   swaps the entire UI, sidebar included, for a centered "Loading..." text.
4. **Creating a project or a monitor flips the list to a skeleton.** `reload()` sets the loading state, so the list the user is
   looking at is replaced by a skeleton and then redrawn. The data is correct; the experience is a flash.
5. **The browser tab title is always "OntaPulse".** No screen sets `document.title`, so tabs, history, and screen-reader page
   announcements cannot tell screens apart.
6. **An expired session is not handled.** The session is read once at startup. When it expires, every later request answers
   `401 UNAUTHENTICATED` and each screen shows its own "Couldn’t load" banner with a retry that can never work, instead of sending
   the user to sign in.

Smaller things noted and left out unless asked: breadcrumb items wrap awkwardly at 360 px when a workspace name is long; two
unlabeled small buttons on the monitor screen (the switches are 28 px high, above the 24 px minimum); the catch-all route sends
unknown URLs to `/` without a message.

## Decisions and assumptions (please confirm the first two)

1. **Order of work.** The branch `fix/workspace-create-duplicates` (API name rule, dialog closing, one request per submit) changes the
   same hook (`use-create-workspace.ts`). It should be merged first; this work then starts from the updated `main`. Otherwise the two
   conflict in that file.
2. **Scope.** All six findings in one branch, each as its own commit and its own tests, so any can be dropped in review. If you want
   a smaller first step, findings 1 to 3 are the ones tied to the report; 4 to 6 are independent.
3. A new workspace is added to the shared list from the `POST /workspaces` response, which already carries `role` and `joinedAt`. No
   extra fetch is needed after a create.
4. If the workspace page cannot find an id in a list it loaded earlier (for example after an invitation or a create in another tab), it
   refreshes the list once, silently, before showing "not found". "Not found" is shown only after a fresh answer.
5. Page titles use the pattern `<screen> · OntaPulse`, in English, from data already on the screen (workspace, project, host names).
   Names are set as text only.
6. For an expired session the user is sent to `/login` with one toast, "Your session expired. Sign in again.". Only `401` on
   non-auth requests triggers it; the login and register calls keep showing their own errors. Unsaved dialog input is not preserved.

## Contract changes

None. No schema, route, payload, queue, or error-shape change. Sync list: web only.

## Files likely to change (apps/web/src)

- `app/router/app-router.tsx`: one layout route (`Protected` plus the shell plus an `Outlet`), with the page routes as children; the
  Suspense boundary moves inside the layout around the `Outlet` so only the content area shows a loading state.
- `app/layouts/app-shell.tsx`: becomes the layout element; `pages/*/…-page.tsx` stop wrapping themselves in `<AppShell>` and render
  their content only.
- `entities/workspace/model/use-workspaces.ts`, `workspaces-context.tsx`: `addWorkspace`, silent `refresh`, keep `replaceWorkspace` and
  `removeWorkspace`.
- `features/workspaces/model/use-create-workspace.ts`: add the created workspace to the shared list before navigating.
- `pages/workspace/workspace-content.tsx`: one silent refresh before "not found".
- `entities/project/model/use-projects.ts`, `entities/monitor/model/use-monitors.ts`, `features/projects/create-project-dialog.tsx`,
  `features/monitors/create-monitor-dialog.tsx`, and where they are used: refresh without the skeleton; keep `reload` for the explicit
  retry button.
- `shared/lib/use-document-title.ts` (new) and one call in each page content.
- `shared/api/client.ts` plus `app/providers/auth-provider.tsx`: a single place where a `401` on a non-auth request signs the user out
  and navigates to `/login`.
- Tests next to each changed file, and the e2e flow in `apps/web/e2e` if it relies on the old structure.

## Implementation requirements

- No visual redesign. Tokens, shared primitives, spacing, and motion stay as they are; the only visible changes are the absence of
  flashes and reloads, a loading state that keeps the shell, and the tab titles.
- The shell is mounted once per signed-in session. Opening the drawer, scrolling the sidebar, or having the new-workspace dialog open
  survives navigation. The mobile drawer closes on navigation as it does today.
- Pages keep their own data hooks (projects, monitors, scans); only the workspace list is shared, as now.
- After a create: the dialog closes, the workspace opens on the first render (no "not found" frame), the sidebar and the dashboard
  show it without a reload, and the toast stays.
- Lists refresh in place: the current rows stay visible and the new row appears; an error shows the existing error banner without
  erasing the rows already on screen.
- Titles update on route change and when the data arrives (a screen first titled by its type, then by its name). Reduced motion and
  focus behavior are unchanged.
- The 401 handler runs once per expiry (not once per failing request), ignores requests made while already signed out, and never loops.
- Every effect cleans up what it creates; no `localStorage` or `sessionStorage` for session data; no raw `fetch` outside the client.

## Acceptance criteria

- Create a workspace from the sidebar, the dashboard header, the empty dashboard form, and the create card: each opens the new workspace
  at once, with its name in the sidebar and on the dashboard, and without a reload.
- Navigating between the six signed-in screens does not refetch `GET /workspaces` (one request per session unless a retry or a
  refresh is requested), does not flash the sidebar, and keeps the sidebar scroll position.
- The first visit to a lazy screen shows the shell with a loading area, not a blank full-screen text.
- Creating a project or a monitor keeps the list on screen and adds the new row.
- Each screen has a distinct tab title; the title contains no HTML and no unescaped content issue (it is plain text).
- With an expired session, the next request sends the user to `/login` with one toast; signing in again returns to the dashboard.
- Existing role rules, 404 isolation, and the permission-based hiding of controls are unchanged.
- No new dependency.

## Checks to run

`moon run web:typecheck`, `moon run web:test`, `moon run web:build` (routing changed), `moon run web:test-e2e` if the services are up,
`pnpm format:check` on changed files, `git diff --check`. Browser check with a mocked API at 360, 768, 1024, and 1440 px for the six
screens plus the create flow, and a request-count check for navigation. State what could not be run.

## Exact manual test steps expected after implementation

1. `docker compose up -d`, wait for healthy. `moon run api:dev`, `moon run web:dev`. Open `http://localhost:5173`, sign in.
2. Open the network tab. Navigate dashboard, a workspace, a project, a monitor, a scan, and back. Expect one `GET /api/workspaces`
   in total and a steady sidebar.
3. Create a workspace from each entry point. Expect the dialog to close, the new workspace to open at once, and its name in the sidebar
   and on the dashboard.
4. Add a project, then a monitor. Expect the list to stay and the new row to appear without a skeleton.
5. Look at the tab title on each screen.
6. Delete the session cookie in the browser tools (or let it expire), then click anything that loads data. Expect one toast and the
   login screen.
7. Repeat the create flow as a `MEMBER` of another workspace and with a long name, at 360 px.
8. Watch the console and the network tab for errors.

## Security requirements

- No change to authorization: the API still decides, `404` for outsiders, roles unchanged.
- The 401 handler clears only in-memory user state and navigates; it stores nothing and does not read or log cookies or headers.
- Titles and toasts render names as text. No `dangerouslySetInnerHTML`.

## Result

Branch: `fix/web-shell-and-lists`, cut from `fix/workspace-create-duplicates` after merging `main` into it (PR #15 holds that branch; until it merges, this
branch also carries its commits). Not committed yet.

Done, all six findings:

1. The shared list gets the created workspace (`addWorkspace`) before the app navigates; the workspace page looks the list up once more,
   silently, before it says "not found" (`refresh`).
2. One layout route (`AppLayout`: `Protected`, `AppShell`, `Outlet`); the page components no longer wrap themselves in the shell.
3. The Suspense fallback for lazy screens now sits inside the shell, so the sidebar stays while a screen loads.
4. Adding a project or a monitor refreshes the list in place (`refresh` on both hooks); a failed refresh falls back to the normal load and its
   error banner.
5. `useDocumentTitle`: Dashboard, workspace name, project name, host, Scan, each as `<name> · OntaPulse`.
6. `onUnauthenticated` in the API client plus a handler in `AuthProvider`: a `401 UNAUTHENTICATED` on a non-auth request signs the user out
   in memory, shows "Your session expired. Sign in again." once, and goes to `/login`.

Differences from the plan:

- The page tests now wrap each page in `AppShell`, because the shell moved from the pages to the layout route.
- The scan screen is titled "Scan" only; it does not use the scan's host.
- The "not found" recheck falls back to the normal load (and its error banner) when the refresh itself fails, so a network error is not
  reported as "not found".

Checks run: `web:typecheck`; `web:test` (449 pass, 20 new: layout and create flow, recheck before not found, 401 in the client and in the
provider, titles, `addWorkspace` and `refresh`, project and monitor refresh); `web:build`; Prettier on changed files. In a browser with a mocked
API at 1440 px: titles per screen; one list request for three screens (two in dev because of React StrictMode); create with Enter pressed twice
sends one POST, closes the dialog, opens the new workspace with no "not found" frame, and lists it in the sidebar; an expired session sends the
user to `/login` with one toast.

Not verified:

- `web:test-e2e` was not run (needs the API and infrastructure up); it may depend on the old per-page shell.
- The real API was not used; the browser check used a mocked API. No check of the create flow at 360, 768, and 1024 px, and no keyboard-only pass.
- The project and monitor create flows were verified by hook and page tests, not in a browser.
- The smaller items listed under Findings (breadcrumb wrapping at 360 px, unlabeled small buttons, the silent catch-all redirect) were left as they are.
