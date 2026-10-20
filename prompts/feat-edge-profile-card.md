# Edge profile card (web, build phase 8+ item "edge profile card")

Apps touched: web, docs (`docs/display-content-mapping.md`, Bahasa Indonesia). API and worker: no change (the route shipped in Phase 4).
Branch if approved: `feat/edge-profile-card`, cut from an up-to-date `main`.

## 1. Goal

Let the user see the Phase 4 result in the web client: which CDN, WAF, and anti-bot layers were observed in front of a
monitor. A card in the existing **Security** section of the monitor screen, below the latest scan result, reading
`GET /api/monitors/:monitorId/edge-profile`. Also label the new `edge` sub-check in the scan screens (today it would show
as the raw word "edge").

Not in this prompt: domain and DNS panel, path-probe controls, any run/schedule action. The card is read only.

## 2. References read

- Root `AGENTS.md` (sections 11, 12, 13, as updated: screens without a prototype are built from the design system),
  `apps/web/AGENTS.md`, `apps/web/README.md`.
- `docs/security-checks.md` section 10 (observation shape, wording "observed", weak/strong signals, vendors detected),
  `docs/display-content-mapping.md`.
- `prompts/feat-security-posture-ui.md` (how the Security section was built), `prompts/phase-4-edge-detection.md` (Result).
- No reference prototype exists for this card, and none is required (AGENTS.md section 11, "Screens without a prototype").

## 3. Existing code inspected

- `widgets/security-posture/security-posture.tsx`: composes `useCheckSettings`, `useLatestSecurityScan`, `useRunSecurityScan`;
  renders `SecurityResult` or `SecurityEmpty`/`SecuritySkeleton`/`LoadErrorBanner`. Used by the monitor screen.
- `widgets/security-posture/ui/security-result.tsx`: the panel style for "Checks in this scan"
  (`rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px]`, `font-display` heading) which the card reuses.
- `features/security/model/use-latest-security-scan.ts`: hook pattern (`loading | empty | ready | error`, 404 code ->
  empty, `reload`).
- `shared/api/client.ts` (`api.*`, the only place that calls `fetch`), `shared/types/domain.ts`, `shared/ui/state-panel`
  (`PANEL`, `PANEL_TITLE`, `PANEL_TEXT`, `LoadErrorBanner`), `shared/ui/skeleton.tsx`, `shared/ui/badge.tsx`,
  `entities/finding/ui/severity-pill.tsx`.
- `entities/scan/model/security-scan.ts`: `SUB_CHECK_LABELS` has no `edge` entry.
- Neighbouring screens for visual language: monitor screen, scan detail (security section).

API route (shipped): `GET /api/monitors/:monitorId/edge-profile` returns
`{ monitorId, scanId, challengeObserved, observedAt, detections: [{ vendor, layer, confidence, signals: [{ type, name }] }] }`,
`404 NO_EDGE_PROFILE` before the first posture scan, `404 MONITOR_NOT_FOUND` outside the workspace. Any member may read.

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Placement:** inside the existing `SecurityPosture` widget, under the latest result, as `EdgeProfileCard`. It loads on its own (own hook, own skeleton/error), so a failure never hides the security result, and the reverse.                                                                                                                                                                                                 |
| D2  | **FSD:** `shared/types` (types) + `shared/api` (`api.edgeProfile`), `entities/edge-profile` (labels, sorting, row UI), `features/security/model/use-edge-profile.ts` (hook), `widgets/security-posture/ui/edge-profile-card.tsx`. Import direction unchanged.                                                                                                                                                                  |
| D3  | **Refresh:** the hook refetches when the latest security scan id changes, so the card follows a newly finished scan without a page reload. No polling of its own.                                                                                                                                                                                                                                                              |
| D4  | **Copy is English** (the Security section is English). Veto if the app copy should be Bahasa Indonesia; the display mapping doc stays Indonesian as the repo rule says.                                                                                                                                                                                                                                                        |
| D5  | **Wording, per AGENTS.md:** informational, never a defect. Heading "Edge layers"; subtitle "CDN, WAF, and anti-bot services observed in front of this host. This is information, not a finding." Per row: vendor name, layer label ("CDN", "WAF", "Anti-bot"), confidence as text ("High/Medium/Low confidence"), and the supporting signals as plain text such as "Header: cf-ray". "Observed" wording, never "protected by". |
| D6  | **Not colour only:** layer and confidence are text labels; any pill is neutral/accent, never the red/amber severity colours used for findings.                                                                                                                                                                                                                                                                                 |
| D7  | **States:** loading (skeleton), empty = `404 NO_EDGE_PROFILE` ("No edge profile yet. It appears after the first security scan."), empty result = `detections: []` ("No CDN, WAF, or anti-bot layer was observed in the last scan."), error (`LoadErrorBanner` with retry and `requestId`).                                                                                                                                     |
| D8  | **Challenge:** when `challengeObserved` is true show a note: "A challenge page was served to the scanner. Security findings from that response were skipped." (matches the worker behaviour and catalog section 9).                                                                                                                                                                                                            |
| D9  | **Coverage note:** a small line "Detects Cloudflare, Amazon CloudFront, AWS WAF, Vercel, Fastly, DataDome, and HUMAN." derived from the label map, so an empty result is not read as "no protection exists". Akamai and Imperva are not detected yet (no primary source), so they are not listed.                                                                                                                              |
| D10 | **Time:** "Observed <formatFull(observedAt)>" in the user's timezone via the existing `formatFull`. The scan id is not shown as primary content; a link "Open the scan" reuses the existing scan route.                                                                                                                                                                                                                        |
| D11 | **Unknown values degrade:** an unknown vendor, layer, signal type, or confidence from a newer API is shown as readable text (underscores replaced), never hidden, never throws.                                                                                                                                                                                                                                                |
| D12 | **Sub-check label:** add `edge: "Edge detection"` to `SUB_CHECK_LABELS` so the scan screens and the "checks ran" list read correctly. The skip reasons already exist.                                                                                                                                                                                                                                                          |
| D13 | **No new dependency, token, font, colour, or icon library.** Reuse `lucide-react` icons only if the neighbouring screens already do; otherwise text only.                                                                                                                                                                                                                                                                      |
| D14 | **Role handling:** read only for every role; nothing to hide. The API still decides (`404` outside the workspace shows the normal error banner).                                                                                                                                                                                                                                                                               |

## 5. Contract changes and sync list

None. The route and shape come from Phase 4; the web adds types and a client call for it. Docs: add a section for the edge
profile to `docs/display-content-mapping.md` (Bahasa Indonesia).

## 6. Files likely to change

- `shared/types/domain.ts` (`EdgeLayer`, `EdgeConfidence`, `EdgeSignal`, `EdgeDetection`, `EdgeProfile`),
  `shared/api/client.ts` (`edgeProfile`) and `client.test.ts`.
- New `entities/edge-profile/{index.ts, model/edge-profile-labels.ts (+test), ui/edge-detection-row.tsx}`.
- New `features/security/model/use-edge-profile.ts`.
- New `widgets/security-posture/ui/edge-profile-card.tsx`; edit `security-posture.tsx` and its test.
- Edit `entities/scan/model/security-scan.ts` (+ test) for the `edge` label.
- Docs: `docs/display-content-mapping.md`. Not touched: API, worker, `reference/`, lockfiles, known debt files.

## 7. Implementation requirements

1. Types and client call first; the client keeps the `/api` prefix and `credentials: "include"`.
2. Pure label helpers (vendor name, layer, confidence text, signal text, sort by layer then vendor) with table-driven tests
   including unknown values.
3. Hook mirrors `useLatestSecurityScan` (404 `NO_EDGE_PROFILE` -> `empty`), cleans up with `ignore`, exposes `reload`,
   refetches when the latest scan id changes.
4. Card renders every state of D7/D8; all API data is rendered as text (no `dangerouslySetInnerHTML`).
5. Layout: a panel in the same style as "Checks in this scan"; vendor rows in a list (`ul`), one row per detection with
   layer/confidence labels and a signal line; on 360 px the row stacks, on wider screens the labels sit on the right.
   Spacing, type scale, and tokens come from the neighbouring panels; motion reuses the section's rise animation and
   respects `motion-reduce`.
6. Tests: label helpers, hook (loading, ready, empty, error, refetch on scan change), card (each state, empty
   detections, challenge note, unknown vendor, signals as text, no HTML injection), the `SecurityPosture` widget still
   passes, and the `edge` sub-check label.

## 8. Visual interpretation, layout, and parity checklist

No prototype, so this is the design interpretation to confirm:

- **Layout:** a full-width panel under the latest result. Header row: title "Edge layers" with the subtitle; right side
  "Observed <time> · Open the scan". Body: list of detections; each is a bordered row (`border-landing-border`,
  `bg-landing-surface/[.72]`, radius matching the panel) with the vendor name in `font-display`, a layer label and a
  confidence label as small neutral pills, and a muted line "Signals: Header cf-ray, Header cf-cache-status". Footer
  muted line with the coverage note (D9).
- **Typography, spacing, colour:** the same classes and `@theme` tokens as `security-result.tsx`; no new colour. Pills use
  the neutral/accent look of `Badge`, not severity colours.
- **Motion:** the existing rise animation, disabled under `prefers-reduced-motion`. No new motion.
- **Responsive:** 360 (rows stack, pills wrap), 768, 1024, 1440 (content stays within the monitor screen's container).
- **Accessibility:** `section` with `aria-labelledby`, list semantics, visible focus on the link, text for every state,
  contrast from existing tokens.
- **Deliberately not done:** no scores, no "protected" badge, no red/amber styling, no action buttons.
- **Verification:** Playwright screenshots of the card at 360, 768, 1024, 1440 px in loading, ready, empty-result,
  no-profile, challenge, and error states (API mocked in the test), reported with what was seen. If the browser cannot be
  opened, the Result says the visual result was not checked.

## 9. Acceptance criteria

- With a scanned monitor the card lists each observed vendor with layer and confidence text and the signal names.
- Before the first scan: "No edge profile yet" empty state. After a scan with no signals: the empty-result text.
- `challengeObserved` shows the note; findings skipped note matches the sub-check list.
- Unknown vendor/layer/confidence/signal renders as readable text and does not throw.
- A failing edge request shows its own banner and leaves the security result visible.
- The scan screens label the sub-check "Edge detection".
- No raw `fetch`, no new colour/dependency, no hidden status relying on colour alone.
- Existing web tests pass unchanged except where they enumerate sub-check labels or the widget's children.

## 10. Checks to run

`moon run web:typecheck`, `moon run web:test`, `moon run web:build` (new files in a routed widget), `pnpm format:check` for
touched files, `git diff --check`. `moon run web:test-e2e` only if the existing security e2e spec needs the new request
mocked; it is run if services are available, otherwise reported as not run. Playwright screenshots for the parity pass.

## 11. Manual test steps

1. `docker compose up -d`, `docker compose ps`; apply the migration if needed:
   `pnpm --filter @ontapulse/api exec prisma migrate deploy`.
2. `moon run api:dev`, `moon run worker:dev`, `moon run web:dev`; open `http://localhost:5173`.
3. Log in as `OWNER`, open a workspace -> project -> a monitor whose URL is a public site you own, ideally behind a CDN.
4. In **Security**: turn the switch on, click "Run security scan", wait for the result. The new **Edge layers** card appears
   under the result.
5. Expect: the detected vendor(s) with layer and confidence text and signal names; a site with no known edge shows the
   "none observed" text; before any scan the "No edge profile yet" text.
6. Open the scan from the card link: the checks list now reads "Edge detection".
7. Roles: a `MEMBER` sees the card (read only); a user outside the workspace gets the normal not-found screen.
8. Narrow viewport (360 px): rows stack, nothing overflows. API stopped: the card shows its error banner with retry.
9. Not verifiable without a real target: the challenge note on a real challenge page.

## 12. Security requirements

All API data is rendered as text. No new request except `GET .../edge-profile` through `api.*`. Nothing is run, scheduled,
or mutated from the card. No cookie or header values are available to display (the API sends names only). Errors show
`message` and `requestId`, never stack traces.

## Result

Implemented on branch `feat/edge-profile-card`, cut from an up-to-date `main` (which already contains Phase 4). Not committed, not pushed. Answer given: web copy is English only.

What changed:

- `shared/types/domain.ts` (`EdgeProfile` and friends), `shared/api/client.ts` (`api.edgeProfile`).
- New `entities/edge-profile` (label helpers with unknown-value fallbacks, `EdgeDetectionRow`), `features/security/model/use-edge-profile.ts`, `widgets/security-posture/ui/edge-profile-card.tsx`; the card sits under the latest result in `SecurityPosture` and is rendered only after a security scan exists, so it never asks for a profile on a monitor with no scan.
- The `edge` sub-check is labelled "Edge detection" in the scan screens.
- `docs/display-content-mapping.md` section 7b (Bahasa Indonesia).

Checks run: `web:typecheck` pass; `web:test` 42 files, 318 tests pass; `web:build` pass; prettier clean on the new and edited files; `git diff --check` clean for the changed files. The existing monitor page and e2e tests needed no change.

Visual pass (no prototype, so this is a self-check against the neighbouring panels): Playwright screenshots with the API mocked, in the states ready with challenge note, empty result, no profile, error, and loading, at 360, 768, 1024, and 1440 px. Observed: the card reuses the "Checks in this scan" panel look; rows stack on 360 px with the pills under the signals; no overflow at any width; pills are neutral, with no severity colours; the error banner and skeleton match the rest of the section. The temporary Playwright spec and screenshots were deleted afterwards; the shots were reviewed by me, not by the user.

Not verified:

- A real scan end to end against a live site in the browser (only the mocked API was used for the screenshots).
- `web:test-e2e` was not run (the existing spec does not cover the monitor screen's Security section).
- Reduced-motion behaviour was not exercised in a browser; the card reuses the section's existing motion classes and adds none.

### Addendum: scan page

After the first review the user noted the card was missing on the scan screen. It was added there too (a scope extension of D1, requested in chat):

- `EdgeProfileCard` moved to `features/security/ui` so both the monitor screen and the scan screen can use it without a widget importing a widget.
- On the scan screen it renders below the findings for a finished `SECURITY_POSTURE` scan, with `onlyForScan`: the edge profile is the monitor's current one, so it is shown only when `profile.scanId` equals the scan on screen. An older scan page shows nothing rather than a profile that belongs to a later scan; "no profile" also shows nothing there, and a failed request still shows its banner with retry.
- Tests added in `scan-detail-security.test.tsx` (matching scan, replaced by a later scan, no profile, HTTP probe or unfinished scan, failed request). `web:test` now 323 passing; typecheck passing.
- A scan made by a worker that was not restarted after Phase 4 has no `edge` sub-check and produces no profile, so no card appears for it; rerun the scan after restarting the worker.

### Addendum: copy and link review

After seeing the card in the browser the user pointed out two things, both applied:

- On the scan page "Open the scan" pointed at the page itself. The link now appears only on the monitor screen (`scanHref` is optional and unused with `onlyForScan`); the scan page shows just "Observed <time>".
- The generic subtitle ("CDN, WAF, and anti-bot services observed ... not a finding") and the always-on coverage footer carried no useful information and were removed. The coverage note now appears only when no layer was observed, where it matters: "Recognised services: ... A host behind any other edge service shows nothing here."

`web:test` 323 passing. `docs/display-content-mapping.md` section 7b updated to match.
