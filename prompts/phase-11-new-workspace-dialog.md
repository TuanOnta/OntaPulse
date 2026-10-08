# Phase 11 — "New workspace" dialog (replaces the /workspaces/new page)

Branch: `refactor/workspace-create-dialog` (from `master` at `0d9ce1c`, plus the dashboard prototype update
`24e92b2` merged from `origin/refactor/project-page`).

## 1. Goal

Port the creation flow in `references/dashboard-prototype.html` (commit `24e92b2`, "workspace add card"):
create a workspace in a dialog instead of on its own page. Web only; `POST /api/workspaces` is unchanged.

## 2. References read

- `AGENTS.md`; the new header note, CSS and glue of `references/dashboard-prototype.html`: dialog `#ws-dialog`
  (title, lead, "Workspace name" with `0 / 120` counter, hint, error, Cancel / Create workspace), inline form in
  the first-run state, bottom sheet below 640 px, `nameError` messages, `createWorkspace`, the `data-new-ws`
  triggers (sidebar link, header button), the dashed create card, toast text.
- Web code: `pages/workspace-create-page.tsx`, `features/workspaces/create-workspace-form.tsx`,
  `widgets/workspace-overview/ui/{create-workspace-card,overview-head,state-panels,workspace-overview}.tsx`,
  `widgets/app-shell/ui/sidebar.tsx`, `app/layouts/app-shell.tsx`, `app/router/app-router.tsx`, README route table.

## 3. Decisions (answered by the user)

| Decision                                                                                                                                                                                                                                                                                     | Source                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Card tone stays **gold = OWNER, blue = ADMIN, white = MEMBER**. The prototype's new map (owner white, member grey) is NOT followed; no tone code changes.                                                                                                                                    | User                             |
| The route `/workspaces/new` is **removed** (no redirect). The page, its test and the README row go away; every link to it opens the dialog instead.                                                                                                                                          | User                             |
| The dialog is one component with several triggers: sidebar "New workspace", dashboard header button, dashed "Create workspace" card, and the first-run empty state (inline name field + button, no dialog).                                                                                  | Prototype                        |
| On success: toast `Workspace “<name>” created. Opening it…`, close the dialog, `navigate("/workspaces/:id")`. API errors (message from `ApiError`) are shown under the field.                                                                                                                | Prototype + AGENTS.md section 11 |
| Validation as the prototype: required (`Workspace name is required.`), max 120 (`Use 120 characters or fewer.`); the API limit is 1-120, verified in `workspace.schema.ts`. The inline first-run input has `maxLength` 120 instead of the prototype's 200 so it cannot exceed the API limit. | API                              |
| The prototype's `?new=1` preview flag is not ported.                                                                                                                                                                                                                                         | AGENTS.md section 4              |
| Radix `Dialog` (focus trap, Escape, focus return) styled like the other dialogs; below 640 px it is a bottom sheet (full width, rounded top, slide-up) and the buttons share the row.                                                                                                        | Prototype + AGENTS.md section 10 |

## 4. File plan

```
features/workspaces/
  new-workspace-dialog.tsx       dialog + form (validation, create, navigate)       (+ test)
  new-workspace-context.tsx      provider that owns the dialog and exposes openNewWorkspace()
  first-workspace-form.tsx       inline form of the empty state                     (+ test)
app/layouts/app-shell.tsx        wraps the shell in the provider, passes onNewWorkspace to the sidebar
widgets/app-shell/ui/sidebar.tsx "New workspace" becomes a button (prop onNewWorkspace), closes the drawer first
widgets/workspace-overview/ui/   overview-head (button), create-workspace-card (button, same card look),
                                 state-panels OverviewEmpty (inline form)
shared/ui/dialog.tsx             untouched; the sheet classes live in the new dialog
pages/workspace-create-page.tsx, features/workspaces/create-workspace-form.tsx (+ test)   removed
app/router/app-router.tsx        route removed
README.md                        web route table row removed, create flow described as a dialog
pages/dashboard/*.test.tsx       updated and extended
```

## 5. Parity checklist

Must match: dialog copy and layout (title, lead, counter, hint, buttons), inline first-run form (row, column
below 640 px), create card, sheet below 640 px, toast, validation messages. Deliberate differences: Radix
dialog, Sonner toast, real API, tone map kept as gold / blue / white, no `?new=1`, 120-character input limit.

## 6. Accessibility, security, performance

Labelled input with `aria-invalid` and error id, `role="alert"` on errors, focus to the field on open and to the
first invalid field on error, Escape and overlay close, focus returns to the trigger, reduced motion removes the
sheet animation, 44 px+ targets. Names are rendered as text. No new dependency; no extra request until submit.

## 7. Checks and manual steps

Typecheck, unit tests, coverage, Prettier, build, `git diff --check`; e2e is skipped until the end, as agreed
(`monitoring-flow` does not use this flow). Screenshots of the dialog and the sheet against the prototype at
1440 and 360 px. Manual: dashboard header button, sidebar link (also on mobile drawer), dashed card, empty
account (inline form), empty / 121-character name, API down, success redirects to the new workspace, old URL
`/workspaces/new` now shows the not-found / fallback route.
