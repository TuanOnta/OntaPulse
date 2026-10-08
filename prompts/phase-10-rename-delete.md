# Phase 10 — Rename and delete for workspaces and projects (API + web)

Branch: `refactor/rename-delete` (from `refactor/project-page`, which now also contains the updated
`references/workspace-prototype.html` and `references/project-prototype.html` and `origin/master`).

## 1. Goal

Add the "..." manage menu, the rename dialog and the delete-with-confirmation dialog to the workspace hero and
the project header, as designed in the two prototypes. The prototypes mark this feature as ASSUMED: the API has
no such routes, so this phase **also adds the API routes**. This is a backend change, which `AGENTS.md`
forbids unless the user asks; the user asked for it ("Saya tambahkan endpoint" option, answered "ya").

## 2. References read

- `AGENTS.md`; both prototypes' header notes and the new CSS / dialogs / glue (`CFG`, manage menu, rename
  dialog, delete dialog with typed confirmation, "Workspace deleted" / "Project deleted" panels).
- API: `workspace.routes.ts` (only members have PATCH / DELETE), `project.routes.ts` (create, list only),
  `project.service.ts`, `workspace-access.service.ts` (`requireRole`, `requireMember`), `project.schema.ts`,
  `prisma/schema.prisma` (Project, Monitor, Scan, ScanFinding, ScanOutboxEvent cascade on delete; to be
  re-checked for `OperationsAuditLog`), existing tests in `apps/api/test`.

## 3. Assumed rules (from the prototypes; veto any)

|                 | Workspace                                                                 | Project                                                           |
| --------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Rename          | OWNER and ADMIN (name 1-120)                                              | OWNER and ADMIN (name 1-120, description <= 500, empty clears it) |
| Delete          | OWNER only                                                                | OWNER and ADMIN                                                   |
| Cascade         | projects, monitors, scans, findings, outbox, members                      | monitors, scans, findings, outbox                                 |
| Confirmation    | type the exact name                                                       | type the exact name                                               |
| MEMBER          | no "..." menu                                                             | no "..." menu                                                     |
| Workspace ADMIN | sees the menu, Delete disabled with "Only owners can delete a workspace." | full menu                                                         |

The API is authoritative (`403` for a role that cannot, `404` outside the user's workspaces). The typed-name
confirmation is UI only.

## 4. API plan (`apps/api`)

- `PATCH /api/workspaces/:workspaceId` body `{ name }`; `DELETE /api/workspaces/:workspaceId` (204).
- `PATCH /api/projects/:projectId` body `{ name?, description? }` (at least one); `DELETE /api/projects/:projectId`
  (204). Projects are addressed by id, so the service loads the project, then `requireRole(project.workspaceId,
...)` the same way the monitor service does (404 when the user is not a member).
- New zod schemas, OpenAPI route schemas, controller methods, service methods, repository methods. No Prisma
  schema change expected (relations already cascade); verify, and if `OperationsAuditLog` or the broker have
  rows keyed by the deleted ids, say so before deleting. Queued jobs for deleted scans must be harmless to the
  worker (check `docs/queue-contract.md`; do not change it, report if it is a problem).
- Tests in `apps/api/test` (workspace and projects): rename ok / validation / 403 for MEMBER / 404 for a
  stranger, delete ok with cascade counts, OWNER-only for workspace delete, ADMIN may delete a project.
- Docs: README capability and limitation lines and the API section are updated because behaviour changes.

## 5. Web plan (`apps/web`)

- `shared/api/client.ts`: `renameWorkspace`, `deleteWorkspace`, `updateProject`, `deleteProject`.
- Shared UI: `shared/ui/manage-menu.tsx` (button + menu: Radix `DropdownMenu` from the installed `radix-ui`
  package, to be verified in `node_modules`; disabled item with the reason text), `RenameDialog` and
  `DeleteDialog` built on the Radix `Dialog` (the typed-name check and the "danger solid" button).
- Features: `features/workspaces/manage-workspace` and `features/projects/manage-project` (rename + delete with
  API calls, toasts, error text), no feature-to-feature imports.
- Widgets: `workspace-hero` and `project-header` get the "..." button after the primary actions (48 px square
  ghost button, `aria-label="Workspace settings"` / `"Project settings"`).
- Behaviour after success: rename updates the page and the sidebar (`useWorkspacesContext.reload` /
  `useProjects.reload`); delete shows the "deleted" panel from the prototype and reloads the sidebar list; the
  panel links back to the dashboard / workspace.
- Tokens only; keyframes `pop` reuse; reduced motion respected. Role colours unchanged.

## 6. Parity checklist

Must match: icon button, menu (232 px, rename, separator, delete, disabled reason), rename dialog (name
counter, description for projects), delete dialog (warning box, typed confirmation, disabled solid red button
until the name matches), deleted panels, toasts. Deliberate differences: Radix menu and dialogs, Sonner toasts,
real API errors, the plain Radix overlay.

## 7. Checks and acceptance

Acceptance: roles behave as in the table against the real API; delete cascades; the sidebar updates.
Checks: API typecheck / lint / tests (needs the docker database; reported if it cannot run), web typecheck,
unit tests, coverage, Prettier, build, `git diff --check`. e2e is skipped until the end of the whole effort, as
the user asked. Manual: infra, API, worker, web; as OWNER rename and delete a project then a workspace; as
ADMIN rename a workspace, see Delete disabled, delete a project; as MEMBER no menu; wrong typed name keeps the
button disabled; API stopped gives an error toast.
