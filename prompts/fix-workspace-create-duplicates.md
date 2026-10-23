# Fix: New workspace dialog and duplicate workspace names

## Goal

Three problems show up when creating a workspace:

1. The "New workspace" dialog stays open after a successful create (by button or by Enter).
2. A second Enter, while the request is running or while the dialog is still open, creates another workspace.
3. Nothing stops two workspaces with the same name, so the sidebar can show the same name twice. Deleting one then looks
   like "the deleted workspace is still in the sidebar".

Fix the dialog, make a double submit harmless, and make the API refuse a duplicate name (decision: option B, an API rule).

## References read

- `AGENTS.md` (sections 2, 9 intro on cross-service order, 12 roles, 13 Git, 14 checks), `apps/api/AGENTS.md`, `apps/web/AGENTS.md`
- `docs/display-content-mapping.md` (Bahasa Indonesia; a rule line is added there)
- `apps/api/prisma/schema.prisma` (`Workspace`, `WorkspaceMember`)

## Existing code inspected

- Web: `features/workspaces/new-workspace-dialog.tsx`, `new-workspace-context.tsx`, `model/use-create-workspace.ts`,
  `first-workspace-form.tsx`, `manage-workspace.tsx`, `entities/workspace/model/use-workspaces.ts`,
  `pages/workspace/workspace-content.tsx`, `app/layouts/app-shell.tsx`, `shared/ui/rename-dialog.tsx`.
- API: `modules/workspaces/workspace.service.ts`, `workspace.repository.ts` (`createWithOwner`, `update`),
  `workspace.schema.ts`, `workspace.routes.ts`, the existing `test/workspace.test.ts`.

## Findings

- The dialog state `open` lives in `NewWorkspaceProvider`. After `create()` succeeds the hook only calls `navigate(...)`; nothing
  calls `onOpenChange(false)`, so the dialog (which sits above the routes) stays open. This is bug 1.
- `submit` in the dialog has no guard on `busy`. The button is disabled while busy, but pressing Enter in the input submits the form
  again, so a quick second Enter, or an Enter in the still-open dialog, creates a second workspace. This is bug 2.
- `Workspace` has no unique constraint on `name`, and neither `createWithOwner` nor `update` check one. This is bug 3.
- The delete flow was checked in the browser with a mocked API: the sidebar updates correctly after a delete. The reported
  "still in the sidebar" is most likely a duplicate-named workspace created through bugs 1 and 2. If it reproduces with a single
  workspace, that is a separate bug and is investigated separately.
- Ownership never changes (the owner role cannot be changed or removed), so the owner of a workspace is a stable key.

## Decisions and assumptions (please confirm the first two)

1. **Scope of uniqueness: per owner.** A user may not own two workspaces whose names are equal after trimming and ignoring case
   (`"Acme"`, `"acme "`, and `"ACME"` are the same). A workspace the user was invited to does not count, and two different
   users may each own an "Acme". Reason: it is the only scope a database constraint can enforce without touching invitations,
   and the message "You already have a workspace with this name" is true for the workspaces the user owns.
   Alternative: all workspaces the user belongs to. That needs a check in `addMember` too (an invitation could create a clash)
   and cannot be a database constraint.
2. **Existing duplicates are kept, not renamed.** The migration never changes a name. For each (owner, name key) group the oldest
   workspace gets the name key and is constrained; the others keep a `NULL` key and stay as they are. Anyone can still rename
   or delete them. A user who wants a legacy duplicate to join the rule renames it.
3. Rename is covered by the same rule. Renaming a workspace to its own current name, or only changing case or surrounding spaces,
   succeeds. An ADMIN renaming a workspace is checked against the owner's other workspaces, because the rule is per owner.
4. The error is `409 WORKSPACE_NAME_TAKEN` with the message `You already have a workspace with this name.`. For an ADMIN who
   renames, the same message is used (it names the owner's namespace plainly enough; wording can change on request).
5. The check runs in the service for a clear message, and the database unique index is the real guard: a unique violation from a
   race is mapped to the same `409`.
6. A deleted workspace frees its name (the row is gone, the key goes with it).
7. The web does not duplicate the rule. It shows the API message under the field. Only the dialog behavior is fixed in the web.

## Contract changes

Additive, with one tightening the user chose: `POST /api/workspaces` and `PATCH /api/workspaces/:workspaceId` can now answer
`409 WORKSPACE_NAME_TAKEN` for input they accepted before. Request and response bodies are unchanged. No queue, worker, or
payload change.

Sync list (docs, then API, then web, in one branch):

| App    | Change                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------ |
| docs   | `display-content-mapping.md`: workspace names are unique per owner, the message, rename rule           |
| api    | migration (owner and name key columns, unique index, backfill), service and repository, OpenAPI, tests |
| worker | none                                                                                                   |
| web    | dialog closes on success, double submit guard, tests; error text comes from the API                    |

## Files likely to change

- `apps/api/prisma/schema.prisma` and a new migration `apps/api/prisma/migrations/<timestamp>_add_workspace_name_key/migration.sql`:
  `Workspace.ownerId UUID?` (FK to `User`, `onDelete: SetNull`), `Workspace.nameKey String?`,
  `@@unique([ownerId, nameKey])`. Regenerate the client (`src/generated/` is tracked).
- `apps/api/src/modules/workspaces/workspace.repository.ts`: set `ownerId` and `nameKey` in `createWithOwner`; recompute
  `nameKey` in `update`; helper to find a clash; map `P2002` for this index to a typed result.
- `apps/api/src/modules/workspaces/workspace.service.ts`, `workspace.openapi.ts`: the `409`, the documented response.
- A small shared `workspaceNameKey(name)` (trim, Unicode `NFKC`, lower case) next to the schema, used by both paths and tests.
- `apps/api/test/workspace.test.ts` (or a new test file beside it), and any seed or test helper that creates workspaces directly.
- `docs/display-content-mapping.md`.
- Web: `features/workspaces/new-workspace-dialog.tsx`, `model/use-create-workspace.ts`, their tests.

## Implementation requirements

- **API**
  - Normalization is one function. Name key = `name.trim().normalize("NFKC").toLowerCase()`; the stored `name` keeps what the
    user typed (trimmed, as the schema does today).
  - `createWithOwner` and `update` run the clash check and the write in one transaction; a unique violation on
    `(ownerId, nameKey)` becomes `AppError("You already have a workspace with this name.", 409, "WORKSPACE_NAME_TAKEN")`.
  - `update` compares against the workspace's `ownerId`; it ignores the workspace itself.
  - Registration still creates its first workspace through the same repository path.
  - Existing routes, shapes, and error contract (`statusCode`, `code`, `message`, `requestId`) stay as they are; 404 isolation for
    workspaces outside the user's memberships stays.
  - Migration adds nullable columns, backfills them, then creates the unique index. Backfill: `ownerId` from the `OWNER`
    membership; `nameKey = lower(btrim(name))` only for the oldest row of each (owner, key) group (by `createdAt`, then `id`);
    others stay `NULL`. Verify the SQL lower-casing matches the JavaScript key for ASCII names; for names where it can differ,
    the index still protects new writes and the service check uses the JavaScript key.
- **Web**
  - After a successful create the dialog closes (`onOpenChange(false)`), then the existing toast and navigation happen. Closing must
    not depend on the route.
  - `create` ignores a call while one is in flight (a ref, not only `busy`, so two submits in the same tick are one request).
    The submit button stays disabled while busy, and Enter while busy does nothing.
  - A failed create keeps the dialog open, shows the API message in the existing `role="alert"` line, and focuses the field.
  - Reopening the dialog starts from an empty field (the form is already rebuilt on every open; keep that).
  - The first-workspace form shares the hook and gets the same guard and error text.
- No new dependency, no new env var, no new color or primitive.

## Acceptance criteria

- Creating a workspace closes the dialog and opens the new workspace; the sidebar shows it once.
- Pressing Enter twice quickly, or Enter again with the dialog still open, never creates a second workspace.
- Creating `Acme`, then `acme`, `Acme`, or `ACME` as the same owner returns `409 WORKSPACE_NAME_TAKEN` and the dialog shows
  "You already have a workspace with this name." Another user can still create `Acme`.
- Two simultaneous creates of the same name produce exactly one workspace and one `409`.
- Renaming to another of the owner's names is `409`; renaming to the same name or changing only the case succeeds; an ADMIN
  renaming into a clash gets `409`.
- Deleting a workspace frees its name.
- Legacy duplicates stay listed and can be renamed or deleted; the oldest of each group is constrained.
- Roles are unchanged: `MEMBER` still cannot rename; a user outside the workspace still gets `404`.

## Checks to run

`pnpm --filter @ontapulse/api test:db:migrate`, `moon run api:typecheck`, `moon run api:test`, `moon run api:coverage` (report
the result as is; it was below threshold before this change on a different part of the code), `moon run web:typecheck`,
`moon run web:test`, `moon run web:build` (the dialog is not routing, but the check is cheap), `pnpm format:check` on changed
files, `git diff --check`. `worker:test` is not needed (no worker change).

## Exact manual test steps expected after implementation

1. `docker compose up -d`, wait for healthy. Apply the migration. `moon run api:dev`, `moon run web:dev`.
2. Before the migration, on a scratch database only, create two workspaces with the same name for one owner; apply the migration and
   confirm both survive, the older has a name key and the newer has `NULL`.
3. Open `http://localhost:5173`, sign in, open the New workspace dialog, type a name, press Enter once. Expected: the dialog closes,
   the new workspace opens, the sidebar shows it once.
4. Open the dialog again, type the same name in another case and press Enter. Expected: the dialog stays open and shows
   "You already have a workspace with this name."; the sidebar is unchanged.
5. Press Enter several times quickly with a new name. Expected: one workspace.
6. Rename a workspace to another of yours: error. Rename to its own name in a different case: allowed.
7. Delete a workspace, then create one with the same name: allowed.
8. Sign in as a second user and create the same name: allowed. As an `ADMIN` of someone else's workspace, rename into a clash: `409`.
9. Watch the network tab (one POST per submit) and the API terminal (no unexpected errors).

State what could not be verified at the end.

## Security requirements

- Authorization is unchanged and stays in the API. For create, the check is scoped to the caller's own workspaces. For an
  authorized ADMIN rename, a `409` tells the admin that the owner has another workspace with that name; that is a small, accepted
  disclosure to a person who already administers one of the owner's workspaces. If it is not acceptable, rename by an ADMIN
  can skip the check and the database index alone refuses (same `409`, same disclosure), so the only way to avoid it is to
  restrict the rule to create and to OWNER rename. Say so if you prefer that.
- No new data is exposed. The name key is internal and is not returned.

## Result

Branch: `fix/workspace-create-duplicates` (from `main` at `035a7dd`). Not committed or pushed yet.

Implemented as planned. Docs: the unique-per-owner rule, the `409` message, and the dialog behavior in `display-content-mapping.md`.
API: migration `20261023100000_add_workspace_name_key` (`ownerId`, `nameKey`, unique index, backfill), `workspace-name.ts`
(key, error, unique-violation check), create and rename in the workspace repository, the first workspace made at registration,
OpenAPI `409`. Web: the dialog closes after a successful create, one request per submit (a ref lock that stays set after
success and is released on failure), the API message shown on a refused name.

Differences from the prompt:

- The service layer is unchanged; the clash check and the unique-violation mapping live in the repository transaction, next to
  the write they protect.
- `src/generated/prisma/` is tracked, so the regenerated client is part of the change. It also drops one stray exported type
  (`NullableStringFieldUpdateOperationsInput` in `Project.ts`) that the checked-in files had and the generator no longer emits.
- No separate web pre-check was added; the API message is shown as decided.

Checks run: `api:typecheck` (pass); `prisma migrate diff` (only differences are the two columns of the unmerged Phase 7
migration, which the local test database already has); API tests 247 pass (15 new in `workspace-names.test.ts`); backfill SQL
verified in a rolled-back transaction with an Acme / " acme " / ACME / Solo set (oldest keeps the key, newer duplicates stay
`NULL`, all get an owner); `web:typecheck`, `web:test` (429 pass, 5 new), `web:build`; Prettier on changed files.

Not verified:

- `api:coverage` fails the global 90% threshold (statements 78.7%, lines 79.5%). This branch is `main` plus this change and
  does not contain the Phase 7 work, so the shortfall exists on `main`; the workspaces module itself is at 97%.
- Not run in a browser against the real API: the dialog behavior is covered by component tests only.
- The rule was not exercised against a database that already holds real duplicate workspaces, only the backfill SQL on a
  synthetic set in a rolled-back transaction.
- Merge order with the Phase 7 branch: both change `schema.prisma` and the tracked generated client, so the second one merged
  will conflict in `src/generated/` and must regenerate it (`prisma generate`).
- The reported "deleted workspace still in the sidebar" was not reproducible with a mocked API; it is expected to be gone once
  duplicates can no longer be created, but that was not confirmed with a real account that has duplicates.
