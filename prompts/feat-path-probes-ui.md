# Path probes control (web)

Apps touched: web, docs (`docs/display-content-mapping.md`, Bahasa Indonesia). API and worker: no change (Phase 5, PR #12).
Branch if approved: `feat/path-probes-ui`, cut from an up-to-date `main` **after PR #12 is merged** (the control needs the API change).

## 1. Goal

Let an `OWNER` or `ADMIN` turn on the opt-in exposed-file checks (Phase 5) from the monitor screen, with the required
acknowledgment that they are authorized to test the target. Everyone else sees the state as text. Also label the new
`exposed_files` sub-check.

Not in this prompt: DNS panel, a run button for probes (they run inside a security scan), any change to the scan result list.

## 2. References read

- Root `AGENTS.md` (sections 2, 11, 12, 13), `apps/web/AGENTS.md`, `apps/web/README.md`.
- `docs/security-checks.md` sections 7 and 8 (what is requested, the acknowledgment rule), `docs/display-content-mapping.md`.
- `prompts/phase-5-path-probes.md` (API contract), `prompts/feat-security-posture-ui.md`, `prompts/feat-edge-profile-card.md`.
- No reference prototype exists and none is required (AGENTS.md section 11, "Screens without a prototype").

## 3. Existing code inspected

- `widgets/security-posture/security-posture.tsx`: Security section header (title, `SecuritySwitch`, `RunSecurityScanButton`), then the result.
- `features/security/ui/security-switch.tsx`: Switch with label and On/Off text; members get read-only text.
- `features/security/model/use-check-settings.ts`: loads `GET /monitors/:id/check-settings`; `setSecurityPosture` is optimistic with
  rollback and a toast; only `securityPostureEnabled` is sent.
- `shared/api/client.ts` `updateCheckSettings(monitorId, { securityPostureEnabled })`; `shared/types/domain.ts` `CheckSettings`
  already has `pathProbesEnabled` and `pathProbesAcknowledgedAt`.
- `shared/ui/dialog.tsx` (Radix dialog) used by `delete-dialog.tsx` and `rename-dialog.tsx`; `shared/ui/switch.tsx`, `label.tsx`,
  `pill-button.tsx` (`ActionButton`). There is **no** checkbox primitive.
- `entities/scan/model/security-scan.ts`: `SUB_CHECK_LABELS` has no `exposed_files`; `not_enabled` skip text already exists.

API contract (Phase 5): `PATCH` with `{ pathProbesEnabled: true, pathProbesAcknowledged: true }` enables; `{ pathProbesEnabled: false }`
disables and clears the acknowledgment. Without the acknowledgment: `400 PATH_PROBE_ACKNOWLEDGMENT_REQUIRED`. `MEMBER`: `403`.

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Placement:** a compact panel "Exposed-file checks" directly under the Security header row and above the result, in `SecurityPosture`. The existing "Security checks" switch and "Run security scan" button stay as they are.                                                                                                                                                               |
| D2  | **Always shown, independent of the security switch.** The API does not require security checks to be on; the panel says "Runs with security scans." When security checks are off, the panel still shows its state but notes nothing runs until they are on.                                                                                                                                  |
| D3  | **Enable flow:** turning the switch on opens a confirmation dialog; nothing is sent until the user confirms. The dialog states exactly what happens (see D5) and has a required checkbox "I am authorized to test <host>." The confirm button stays disabled until it is checked. The request sends `pathProbesAcknowledged: true`.                                                          |
| D4  | **Disable flow:** switching off sends `{ pathProbesEnabled: false }` directly (no dialog, no acknowledgment needed), optimistic with rollback and a toast on failure, like the existing switch.                                                                                                                                                                                              |
| D5  | **Dialog copy (English):** title "Check for exposed files?"; body "OntaPulse will request three fixed paths on <host>: /.env, /.git/HEAD and /.git/config. It reads at most 4 KB of each response to match a known pattern. Only the path, the HTTP status and the pattern name are stored, never the content."; checkbox "I am authorized to test <host>."; buttons "Turn on" and "Cancel". |
| D6  | **State text:** off: "Off. Not requested."; on: "On. Acknowledged <formatFull(pathProbesAcknowledgedAt)>." Members see the same text and no switch (like `SecuritySwitch`).                                                                                                                                                                                                                  |
| D7  | **New primitive:** `shared/ui/checkbox.tsx` on Radix (`radix-ui` is already a dependency; export checked against the installed version before use), styled with existing tokens. Veto if a native checkbox is preferred.                                                                                                                                                                     |
| D8  | **Errors:** a failed enable keeps the dialog open with the API `message` inline (and `requestId` when present); `403` is shown the same way. The dialog never claims success before the API answers.                                                                                                                                                                                         |
| D9  | **Sub-check label:** add `exposed_files: "Exposed files"` to `SUB_CHECK_LABELS`.                                                                                                                                                                                                                                                                                                             |
| D10 | **Copy language is English only** (the user confirmed web copy stays English).                                                                                                                                                                                                                                                                                                               |
| D11 | **No new dependency, token, or colour.** The warning-style note in the dialog reuses the dialog panel styles already used by `delete-dialog.tsx`; the severity colours are not used for the opt-in itself.                                                                                                                                                                                   |

## 5. Contract changes and sync list

None. The route and shapes come from Phase 5. The web client types: `api.updateCheckSettings` input becomes a typed union of the
existing switch and the path-probe forms. Docs: add a section to `docs/display-content-mapping.md` (Bahasa Indonesia).

## 6. Files likely to change

- `shared/api/client.ts` (+ test), `shared/types/domain.ts` (only if a type is needed).
- `features/security/model/use-check-settings.ts` (+ test): `setPathProbes(enabled, acknowledged)`.
- New `features/security/ui/path-probes-panel.tsx`, `features/security/ui/path-probes-dialog.tsx`, `shared/ui/checkbox.tsx`.
- `widgets/security-posture/security-posture.tsx` (+ test); `entities/scan/model/security-scan.ts` (+ test).
- `docs/display-content-mapping.md`. Not touched: API, worker, `reference/`, lockfiles, known debt files.

## 7. Implementation requirements

1. Client and hook first: the hook exposes `setPathProbes`, optimistic only for disabling; enabling waits for the API answer.
2. `PathProbesDialog` (Radix `Dialog`): focus is trapped and returned by Radix, Escape and Cancel close it without a request, the
   checkbox is labelled, and the confirm button is `disabled` until checked. Busy state while the request runs.
3. `PathProbesPanel`: switch and label for `OWNER`/`ADMIN`, read-only text for `MEMBER`; shows the D6 state; the label of the switch
   is "Exposed-file checks".
4. All text from the API is rendered as text; the host comes from the monitor URL via the existing helper.
5. Every state is covered: loading (reuses the settings skeleton), error (existing settings banner), off, on, saving, dialog open,
   dialog error, role restricted.
6. Tests: hook (enable sends both fields, disable sends one, rollback on error, no request on cancel), dialog (button disabled until
   checked, Escape and Cancel send nothing, error shown inline, success closes), panel (roles, state text, security-off note), widget
   (still passes), and the sub-check label.

## 8. Visual interpretation, layout, and parity checklist

No prototype, so this is the interpretation to confirm:

- **Layout:** a bordered panel in the same style as "Checks in this scan" (`rounded-[22px] border border-landing-border
bg-landing-surface/[.72] p-[22px]`). Left: heading "Exposed-file checks" (`font-display`, 19 px) and one muted line "Requests three fixed
  paths on this host and matches a known pattern. Runs with security scans." Right: the switch with its label and On/Off text, then the
  state line below on narrow screens. On 360 px everything stacks.
- **Dialog:** the existing dialog look (`delete-dialog.tsx`): `font-display` title, a muted body, a bordered note listing the three paths
  in `font-mono`, the checkbox row, and `ActionButton` primary and ghost buttons right-aligned (stacked on 360 px).
- **Colours and type:** existing `@theme` tokens only; no severity colours.
- **Motion:** the section's existing rise animation and the dialog's existing open animation; all disabled under `prefers-reduced-motion`.
- **Accessibility:** labelled switch and checkbox, dialog title and description, visible focus, disabled confirm announced.
- **Deliberately not done:** no "Run probes" button, no list of paths as links, no scary red styling for an opt-in the user chose.
- **Verification:** Playwright screenshots (API mocked) at 360, 768, 1024, 1440 px for: off, on with acknowledgment, dialog open,
  dialog with the checkbox checked, dialog error, and the member view. Reported with what I saw; the user reviews them.

## 9. Acceptance criteria

- An `OWNER`/`ADMIN` can turn the checks on only through the dialog, with the checkbox; the request carries both fields.
- Turning off sends one field and needs no dialog.
- A `MEMBER` sees the state as text and no control; the API would refuse anyway.
- The "Exposed files" label appears for the sub-check, and `SEC_EXPOSED_*` findings already render with their category.
- Failed requests show the API message; cancelling sends nothing; no state claims success early.
- No raw `fetch`, no new colour or dependency, text only for API data.

## 10. Checks to run

`moon run web:typecheck`, `moon run web:test`, `moon run web:build`, `pnpm format:check` for touched files, `git diff --check`.
`moon run web:test-e2e` only if the existing spec needs the new request mocked. Playwright screenshots for the visual pass.

## 11. Manual test steps

1. Merge PR #12, restart `moon run api:dev` and `moon run worker:dev`; `moon run web:dev`; open `http://localhost:5173`.
2. As `OWNER`, open a monitor of a host you own: in Security, find "Exposed-file checks", off.
3. Switch it on: the dialog opens; the confirm button is disabled; check "I am authorized to test <host>."; click "Turn on".
4. Expect "On. Acknowledged <time>." Run a security scan: "Exposed files" appears in "Checks in this scan" as "Ran".
5. Switch off: no dialog; "Off. Not requested."; run a scan again: "Exposed files: Skipped: not enabled".
6. As `MEMBER`: the state is text with no switch. API stopped: the settings error banner with retry.
7. 360 px: the panel and the dialog stack without overflow.
8. Only on a host you own with a harmless `/.env` test file, confirm a `SEC_EXPOSED_ENV_FILE` finding shows path, status and signature name only.

## 12. Security requirements

API data is rendered as text. The acknowledgment is explicit and never pre-checked; nothing is sent before the user confirms. No new
request beyond `PATCH /monitors/:id/check-settings`. No secrets, no storage of the acknowledgment on the client.

## 13. Open questions for you

1. D2: show the panel even when "Security checks" is off (the API allows it), or hide it until security checks are on?
2. D7: add a Radix checkbox primitive, or use a native styled checkbox?

## Result

Implemented on branch `feat/path-probes-ui`. PR #12 (Phase 5) was not merged yet, so this branch is stacked on `feat/path-probes` instead of `main`; merge #12 first, or the PR will also show the Phase 5 commits. Not committed, not pushed. Answers used for the open questions: the panel is always shown (D2) and the checkbox is a Radix primitive (D7).

What changed:

- `shared/ui/checkbox.tsx` (Radix `Checkbox`, export checked against the installed `radix-ui`), `shared/types/domain.ts` (`CheckSettingsUpdate`), `shared/api/client.ts` (`updateCheckSettings` takes it).
- `features/security/model/use-check-settings.ts`: `enablePathProbes` (waits for the API, throws the error for the dialog) and `disablePathProbes` (optimistic, rolls back with a toast), plus `probesSaving`.
- `features/security/ui/path-probes-dialog.tsx` (confirmation with the required, never pre-checked authorization box) and `path-probes-panel.tsx`; `SecurityPosture` renders the panel under the header once the settings loaded.
- `entities/scan/model/security-scan.ts`: `exposed_files` is labelled "Exposed files".
- `test/setup.ts`: a `ResizeObserver` stub for jsdom (Radix Checkbox measures its element).
- `docs/display-content-mapping.md` section 7c (Bahasa Indonesia).

Checks run: `web:typecheck` pass; `web:test` 44 files, 347 tests pass (new: dialog, panel, widget flows for enable, cancel, API refusal, disable, rollback, member, security-off, settings error; sub-check label); `web:build` pass; prettier clean on the new and edited files.

Visual pass (no prototype; Playwright with the API mocked) at 360, 768, 1024, and 1440 px for: off, on with acknowledgment, member view, dialog open, dialog with the box checked, and dialog with an API error. Observed by me: the panel matches the neighbouring panels; the dialog matches the delete dialog look; on 360 px the buttons stack with the primary first; no overflow at any width; no severity colours. The temporary spec and screenshots were deleted; the user still reviews the result visually.

Not verified:

- The flow against the real API and worker (needs PR #12 merged, a restart of both, and a host you own). Only mocked responses were used.
- `web:test-e2e` was not run for this change (the existing spec does not cover the Security section).
- Reduced-motion behaviour was not exercised in a browser; the panel reuses the section's rise animation class with `motion-reduce:animate-none`.
