# Phase 8 — Workspace page

Branch: `refactor/workspace-page` (from `claude/hopeful-cray-1jq7qg`, which already contains the merged
dashboard refactor and the app shell).

## 1. Goal

Port `apps/web/references/workspace-prototype.html` to `/workspaces/:workspaceId` (hero, Projects tab,
Members tab, create-project dialog, remove-member dialog, loading / error / not-found / empty states), reusing
the app shell and tokens built in phase 7.

## 2. References read

- `AGENTS.md` (sections 2, 4, 5, 6, 10, 11, 12, 14, 16) and the capability table in section 10.
- `apps/web/references/workspace-prototype.html`, fully read:
  - header comment: APIs used are `GET/POST /workspaces/:id/projects` (name 1-120, description <= 500),
    `GET/POST /workspaces/:id/members`, `PATCH/DELETE .../members/:userId`. Rename/delete workspace or
    project and per-project monitor counts are **not** designed. The hero wave is decoration, not data.
    Query flags `?role=`, `?tab=`, `?state=`, `?motion=` are prototype-only;
  - CSS: crumbs, hero (cover with dot grid + seeded wave + travelling glow, role badge, 72 px mark overlapping
    the cover, meta line, actions / view-only note), tabs (underline scales in), project grid and card
    (pointer spotlight, lift, arrow slide, dashed "New project" card), add-member bar, member list
    (3 columns >= 960 px, 2 below), native `<dialog>`s, toasts, banner, panels, skeleton, reduced motion,
    breakpoints 959 / 520 px;
  - glue: permission rules (`canManage`, `canChange`, `canRemove`), member sort (OWNER, ADMIN, MEMBER, name),
    email validation messages, project validation messages and counters, tab keyboard handling
    (ArrowLeft / ArrowRight), "Add member" button jumps to the Members tab and focuses the email field.

## 3. Existing code inspected

- `pages/workspace-page.tsx` (old UI: `PageHeading`, card grid, `CreateProjectForm` side card,
  `WorkspaceMembers` below; loads `api.workspaces()` + `api.projects()` itself and toasts on error).
- `features/projects/create-project-form.tsx` (+ test), `features/workspaces/workspace-members.tsx` (no test).
- `shared/api/client.ts` (`projects`, `createProject`, `workspaceMembers`, `addWorkspaceMember`,
  `updateWorkspaceMemberRole`, `removeWorkspaceMember`), `shared/types/domain.ts` (`Project`,
  `WorkspaceMember`, `WorkspaceRole`).
- Phase 7 pieces to reuse: `widgets/app-shell`, `entities/workspace` (`useWorkspacesContext`,
  `WorkspaceRoleBadge`, `workspaceLook`, `initials`), `widgets/workspace-overview` (heartbeat divider, state
  art, state panels, buttons, `rise`), `shared/lib/pointer-spotlight`, `reduced-motion`, `shared/ui/dialog`
  (Radix), `select`, `input`, `textarea`, `label`.
- `app/layouts/app-shell.tsx` (`AppShell`, `Crumbs`), `e2e/monitoring-flow.spec.ts` (opens
  `/workspaces/workspace-1`, mocks projects and members).

## 4. Decisions and assumptions (veto any)

| Decision                                                                                                                                                                                                                                                                                                                                                   | Source                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Page folder `pages/workspace/` (page + content + test), replaces `pages/workspace-page.tsx`; router import updated. `AppShell` wrapper unchanged.                                                                                                                                                                                                          | Dashboard pattern                      |
| Workspace name / role / createdAt come from the shared workspaces context (`GET /api/workspaces`, already loaded for the sidebar); there is no `GET /workspaces/:id` call. If the id is not in the list after load, or `GET .../projects` returns 404, show the **not found** panel.                                                                       | API + AGENTS.md section 10             |
| Data hooks: `entities/project` gets `useProjects(workspaceId)` (status loading / ready / error + `reload`) and the `ProjectCard`; `entities/workspace` keeps role helpers. Members logic stays in `features/workspaces` (rewritten as `members-pane`), project creation in `features/projects` (dialog form). Widgets compose; no `fetch` outside `api.*`. | AGENTS.md section 6                    |
| Layer rule: `features` must not import other features; the page / widget composes `CreateProjectDialog` and `MembersPane`. Cross-links ("Add member" in the hero) go through callbacks from the page.                                                                                                                                                      | AGENTS.md section 6                    |
| Permission helpers (`canManage`, `canChangeRole`, `canRemove`) live as pure functions in `entities/workspace/model/member-permissions.ts` with unit tests; they mirror the README table and only hide UI, the API decides.                                                                                                                                 | AGENTS.md section 10                   |
| Project dialog and remove dialog use the Radix `Dialog` already in `shared/ui` (focus trap, Escape, restore focus) instead of native `<dialog>`; looks like the prototype. Role select uses Radix `Select` as today (prototype uses a native select; visuals matched).                                                                                     | AGENTS.md section 10 ("rely on Radix") |
| Validation messages and counters (0 / 120, 0 / 500) copy the prototype; server errors (`404` for unknown email, `409` for duplicate) show the API `message` inline for email and as a Sonner toast otherwise. Success toasts keep Sonner (prototype toast replaced by the shared one).                                                                     | Prototype + AGENTS.md section 10       |
| "You" tag uses the current user id from the auth provider compared to the member `id`. Self row has no role select or remove.                                                                                                                                                                                                                              | Prototype                              |
| New members join as `MEMBER` (API behavior); copy as in prototype.                                                                                                                                                                                                                                                                                         | Prototype                              |
| Project card links to `/workspaces/:id/projects/:projectId`, name via `aria-label="Open project <name>"` stretch link; no per-project counts (not in API). Description empty shows the italic "No description".                                                                                                                                            | Prototype                              |
| Dates use `formatDate` (user's locale) instead of the fixed `en-US`; `null` created date is not expected.                                                                                                                                                                                                                                                  | AGENTS.md section 10                   |
| `?role=`, `?tab=`, `?state=`, `?motion=` flags are dropped except `?tab=members` which stays as the real URL search param (`useSearchParams`) so the tab is linkable; role/state previews are not ported.                                                                                                                                                  | AGENTS.md section 4                    |
| Out of scope: project page, monitor page, rename/delete, backend changes. Sidebar current-workspace highlight already exists from phase 7 (verify).                                                                                                                                                                                                        | Prototype header                       |

## 5. File plan

```
apps/web/src/
  entities/project/
    model/use-projects.ts            loading|ready|error|notfound + reload (+ test)
    ui/project-card.tsx              article, stretch link, spotlight, "No description"
    index.ts
  entities/workspace/
    model/member-permissions.ts      canManage, canChangeRole, canRemove, sortMembers (+ test)
    ui/member-avatar.tsx             initials circle (reuses `initials`)
  features/projects/
    create-project-dialog.tsx        replaces create-project-form.tsx (+ updated test)
  features/workspaces/
    members-pane.tsx                 add bar, list, role select, remove dialog (replaces workspace-members.tsx) (+ test)
  widgets/workspace-detail/
    ui/workspace-hero.tsx            cover wave + glow, mark, meta, actions / view-only note
    ui/workspace-tabs.tsx            tablist with arrow-key navigation, counts
    ui/projects-pane.tsx             grid, add card, empty panel, skeleton
    ui/workspace-not-found.tsx, workspace-error-banner.tsx, workspace-detail-skeleton.tsx
    ui/crumbs (reuse `Crumbs`)
    workspace-detail.tsx             composes hero + tabs + panes + dialogs
    index.ts
  pages/workspace/workspace-page.tsx (+ test: states, roles, tab switch, create project, add / remove member)
  app/router/app-router.tsx          import path
  app/styles/globals.css             keyframes: wave-travel, leave, flash (only what is missing)
  e2e/monitoring-flow.spec.ts        update only if accessible names change
```

Old files deleted: `pages/workspace-page.tsx`, `features/projects/create-project-form.tsx`,
`features/workspaces/workspace-members.tsx` (their tests move with them).

## 6. Implementation requirements

- Tokens only (`landing-*` colors from `globals.css`), no raw hex; new numbers (wave size, glow timing,
  row grid widths 170 / 150 px, limits 120 / 500 / 320) go into named constants.
- Limits: name <= 120, description <= 500, email <= 320 characters; trim before submit; send an empty
  description as omitted / empty exactly as `api.createProject` does today.
- Hero wave: reuse `wavePath` / `hashString` seed from `entities/workspace/model/workspace-look.ts`
  (add a hero-sized variant if the 600 x 88 viewBox differs; keep deterministic per workspace).
- After create-project success: close dialog, switch to Projects, reload the list, toast. After add member:
  append, re-sort, flash row (`added`), toast. After remove: leave animation, then drop row, toast.
- No `dangerouslySetInnerHTML`; names and emails rendered as text. No new dependencies.
- States: loading skeleton (hero + 3 cards), error banner with Try again + request ID, not found panel,
  empty projects panel (owner / admin: CTA; member: "An owner or admin needs to create the first project"),
  members loading skeleton and members error row with retry.

## 7. Parity checklist

Must match: breadcrumb, hero layout / spacing / role badge on cover / mark overlap, meta line copy
("Created <date> · N members · N projects", singular handled), tabs with counts, project card (icon, title,
2-line clamp, footer, arrow), dashed add card, add-member bar copy, member table (3 columns, 2 below 960 px),
role pill vs select vs "Fixed" lock hint, view-only notes, dialog copy, empty and error copy, hover and entrance
motion, reduced motion, breakpoints 959 / 520.

Deliberate differences: Radix dialogs and select instead of native elements; Sonner toasts instead of the
prototype toast; locale-aware dates; real URL tab param; Google Fonts replaced by self-hosted fonts (already
done in phase 1); no `?role` / `?state` preview flags; demo sample data removed.

## 8. Performance, accessibility, security

- Performance: no new heavy deps; pointer spotlight uses the existing CSS-variable helper; animations are
  transform / opacity only; page chunk stays lazy.
- Accessibility: tablist roles with roving tabindex and ArrowLeft / ArrowRight (Home / End added), `aria-live`
  announcements via Sonner, labelled inputs with `aria-invalid` + `aria-describedby` error ids, focus moved to
  the first invalid field, focus returned to the trigger when dialogs close, roles never conveyed by color
  alone, 44 px targets, reduced motion disables wave / glow / rise / leave / flash.
- Security: UI hides actions by role but the API decides; 404 shown as "not found"; no data in logs; no
  storage use.

## 9. Acceptance criteria

1. `/workspaces/:id` matches the prototype at 360 / 768 / 1024 / 1440 px for hero, both tabs, dialogs and
   all states, apart from the listed differences.
2. OWNER, ADMIN, MEMBER each see exactly the actions allowed by the capability table (including no controls
   on the OWNER row and on self).
3. Create project, add member, change role and remove member work against the real API and reflect results
   without a full reload; API errors show `message` (+ `requestId` on the error banner).
4. Unknown workspace shows the not-found panel; API down shows the error banner with retry.
5. Existing routes and the e2e flow keep working.

## 10. Checks to run

From `apps/web` (moon is not installed in this sandbox; `pnpm` equivalents will be reported as such):
typecheck, unit tests, coverage thresholds, `pnpm format:check`, build, `git diff --check`, and the
Playwright `monitoring-flow` spec if Chromium is available. Parity: Playwright screenshots of prototype vs
port at the four widths, compared and reported.

## 11. Manual test steps (after implementation)

1. `docker compose up -d`, `moon run api:dev`, `moon run worker:dev`, `moon run web:dev`.
2. Open `http://localhost:5173`, sign in, `/dashboard` -> open a workspace.
3. Compare with `apps/web/references/workspace-prototype.html` (`?tab=members`, `?state=empty|error|notfound`).
4. As OWNER: create a project (empty name, 121 chars, valid), add a member (invalid, unknown, duplicate,
   valid), change a role, remove a member. As ADMIN: no role select, can remove only MEMBER. As MEMBER:
   view-only notes, no add / remove / new project.
5. Stop the API and reload for the error banner; visit `/workspaces/does-not-exist` for not found.
6. Narrow viewport (360 px), reduced motion in DevTools, keyboard-only pass through tabs and dialogs.

## Result

Implemented on branch `refactor/workspace-page`.

Deviations from the file plan:

- Pill buttons, `StateArt` and `riseStyle` moved to `shared/ui/pill-button.tsx`, `shared/ui/state-art.tsx`,
  `shared/lib/rise.ts` (features and entities cannot import the overview widget). The old widget paths
  re-export them, so the dashboard is untouched. Added a `danger` pill variant, `SMALL_PILL` and a
  `trackPointer` (spotlight without tilt) helper.
- Members data lives in `entities/workspace` (`useWorkspaceMembers`) because the hero and tab counts need it
  before the Members tab opens; `MembersPane` receives it through props.
- `ProjectCard` is in `entities/project`; the hero, tabs, panes and states are in `widgets/workspace-detail`.
- Sidebar: the current workspace dot is now blue with a glow (`group-aria-[current=page]`), as in the
  workspace prototype.
- `e2e/monitoring-flow.spec.ts` now opens the New project dialog (names: "New project", "Name",
  "Create project").
- The hero wave reuses the dashboard waveform generator (stretched), so it is deterministic per workspace but
  not the prototype's demo wave (deliberate).

Checks (pnpm from `apps/web`; `moon` is not installed, Node 22.22.0): typecheck pass; 25 files / 132 tests
pass; coverage thresholds pass (47.7 / 43.6 / 59.6 / 48.2); Prettier pass for everything touched (the 27
files flagged by `pnpm format:check` at the root are pre-existing: generated Prisma, prototypes, lockfile);
`pnpm build` pass (workspace chunk 10.1 KB gzip, no 3D reference); `git diff --check` clean; e2e
`monitoring-flow` passes (installed Chromium through a temporary config, removed afterwards).

Parity (headless Chromium, reduced motion, owner role, prototype with the demo data, port with a mocked API):
1440 / 1024 / 768 / 360 px, Projects and Members tabs. Share of pixels differing by more than 40/255:
3.0 to 3.7 % at 1440 / 1024 / 768, 6.0 % (Projects) and 7.9 % (Members) at 360. Page heights match within
4 px at 1440 / 1024, within about 20 px at 768 / 360. The differences I looked at are the font (the prototype
could not load Google Fonts offline, so it used the system fallback; the port uses the self-hosted fonts),
the waveform, and a 2 px offset from the title line height. A narrow-width bug found this way (add-member bar
stretching at 360 px) and the select height were fixed.

Not verified: dialogs, hover and motion frames, error, loading, not-found and empty states and the ADMIN /
MEMBER roles in a browser (covered by unit tests only); Radix Select role change by interaction (unit tests
only check that it renders for the right roles); real devices; `moon`, Node 24; a run against the real API.
