# Domain and DNS panel (web)

Apps touched: web, docs (`docs/display-content-mapping.md`, Bahasa Indonesia). API and worker: no change (Phase 6, branch `feat/dns-watch`).
Branch: `feat/dns-watch-ui`, stacked on `feat/dns-watch` (Phase 6 is not merged yet; merge the PRs in order).

## 1. Goal

Show the DNS watch in the web client, from the design system (no prototype): on the monitor screen a **Domain and DNS** section with the DNS watch switch,
"Run DNS scan", the latest result, the stored baseline, and the recent changes; and make the scan screen read correctly for `DNS_WATCH` scans.
The UI is read only apart from the existing switch and run actions, which the API authorizes.

Not in this prompt: recurring runs (Phase 7), edge detection from DNS data, any editing of records.

## 2. References read

- Root `AGENTS.md` (sections 2, 11, 12, 13), `apps/web/AGENTS.md`, `apps/web/README.md`.
- `docs/security-checks.md` section 11 (finding IDs, wording, snapshot shape), `docs/display-content-mapping.md`.
- `prompts/phase-6-dns-watch.md` (API contract and Result), `prompts/feat-security-posture-ui.md`, `prompts/feat-edge-profile-card.md`, `prompts/feat-path-probes-ui.md`.

## 3. Existing code inspected

- `widgets/security-posture/security-posture.tsx`: the Security section (switch, run button, latest result, edge card, probes panel) is the pattern to follow.
- `features/security`: `useCheckSettings` (optimistic `setSecurityPosture`), `useLatestSecurityScan`, `useRunSecurityScan`, `SecuritySwitch` and
  `RunSecurityScanButton` (copy is hard-coded for security), `useEdgeProfile`.
- `entities/scan`: `isSecurityScan` and the "check scan" copy in `scan-view.ts` (`securityOutcome`), `security-scan.ts` (sub-check labels and skip reasons),
  `scan-row.tsx` ("Security" tag), `scan-history.ts` (`chartScans` excludes only security scans).
- `widgets/scan-detail`: `metric-tiles.tsx` (`SecurityTiles` with an HTTPS tile), `findings.tsx` (`SecurityFindings`), `lifecycle-request.tsx` (method text),
  `scan-detail.tsx`. `features/monitors/model/use-monitor-scans.ts` (`finishedMessage`).
- `entities/finding` (`FindingCard`, `SeverityPill`, labels), `shared/ui/state-panel`, `skeleton`, `format`.

API (Phase 6): `GET /monitors/:id/dns-watch/latest` (`404 NO_DNS_SCAN`), `GET /monitors/:id/dns-baseline`
(`{ monitorId, scanId, host, organizationDomain, observedAt, snapshot, changes: [{ scanId, observedAt, changes: [{ scope, type, added, removed }] }] }`,
`404 NO_DNS_BASELINE`), `POST /monitors/:id/scans {"kind":"DNS_WATCH"}` (`409` when off, `429` with `retryAfterSeconds`), `PATCH .../check-settings {"dnsWatchEnabled"}`.

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Placement:** a new `DnsWatch` widget rendered under `SecurityPosture` on the monitor screen, with its own switch and run button; the two sections load independently.                                                                                                                                                                                                 |
| D2  | **Generalize, do not copy:** `SecuritySwitch`, `RunSecurityScanButton`, and the run hook take their label and copy as props (security defaults unchanged); `useCheckSettings` gains `setDnsWatch`. `isCheckScan` (security or DNS) drives the shared scan-screen behaviour, with copy per kind.                                                                         |
| D3  | **Copy is English only.** Wording follows the catalog: "observed", never "vulnerable". The section says the host itself is not contacted (only DNS queries are made).                                                                                                                                                                                                   |
| D4  | **Baseline card:** observation time, the host and the organizational domain, then records per type in a fixed order (A, AAAA, CNAME, NS, MX, TXT; for the organization NS, MX). Values are text in a monospace face and wrap; more than 6 values of one type show the first 6 and "and N more". An empty type reads "None observed".                                    |
| D5  | **Recent changes:** newest first, at most 10 shown ("Showing 10 of N" when more). Each entry: time, "Open the scan", and per change the record type and scope with added and removed values. Added and removed carry a sign (`+`, `−`) **and** the words "Added" and "Removed" for assistive technology; colour is only a hint.                                         |
| D6  | **States:** loading skeletons; error banners with retry and `requestId` (settings, latest result, and baseline each have their own); "No DNS scan yet" when none exists (how to start, or "DNS watch is off" when off); "No baseline yet. The first successful scan records one."; "No changes since the baseline was recorded."; a failed scan shows its safe message. |
| D7  | **Role handling:** members see the state as text and no switch or run button, as in the Security section; the API still decides.                                                                                                                                                                                                                                        |
| D8  | **Scan screen for `DNS_WATCH`:** hero "DNS check complete / Running DNS checks… / The DNS check could not complete", tiles "Checks run" and "Findings" (no HTTP tiles), the method text "DNS queries to public resolvers, the host is not contacted", sub-check labels "DNS records", "Dangling CNAME", "Email authentication".                                         |
| D9  | **History and chart:** the scan row gets a "DNS" tag like "Security"; the response-time chart only uses `HTTP_PROBE` scans; the finished-scan toast has DNS wording.                                                                                                                                                                                                    |
| D10 | **No new dependency, token, colour, or icon library.** A small inline icon for the run button follows the existing shield icon pattern.                                                                                                                                                                                                                                 |

## 5. Contract changes and sync list

None. The web adds types and client calls for the Phase 6 routes. Docs: section 7d in `docs/display-content-mapping.md` (Bahasa Indonesia).

## 6. Files likely to change

- `shared/types/domain.ts` (`DnsSnapshot`, `DnsRecordChange`, `DnsBaseline`, `CheckSettingsUpdate.dnsWatchEnabled`), `shared/api/client.ts` (+ test).
- `entities/scan/model/security-scan.ts`, `scan-view.ts`, `scan-history.ts`, `entities/scan/ui/scan-row.tsx`, `index.ts` (+ tests).
- New `entities/dns/{index.ts, model/dns-labels.ts (+test), ui/dns-record-list.tsx, ui/dns-change-entry.tsx}`.
- `features/security`: `use-check-settings.ts` (`setDnsWatch`), `run-security-scan-button.tsx`, `security-switch.tsx`, `use-run-security-scan.ts` (props instead of constants) (+ tests);
  new `features/dns/model/{use-latest-dns-scan.ts, use-dns-baseline.ts, use-run-dns-scan.ts}`.
- New `widgets/dns-watch/{index.ts, dns-watch.tsx (+test), ui/dns-result.tsx, ui/dns-baseline-card.tsx, ui/dns-changes-card.tsx, ui/dns-states.tsx}`.
- `widgets/monitor-detail/monitor-detail.tsx`, `widgets/scan-detail/{scan-detail.tsx, ui/metric-tiles.tsx, ui/findings.tsx, ui/lifecycle-request.tsx}` (+ tests),
  `features/monitors/model/use-monitor-scans.ts`.
- Docs: `docs/display-content-mapping.md`. Not touched: API, worker, `reference/`, lockfiles, known debt files.

## 7. Implementation requirements

1. Types and client calls first (`triggerDnsScan`, `latestDnsScan`, `dnsBaseline`); the client keeps `/api` and `credentials: "include"`.
2. Pure helpers (record order and labels, change summary, "and N more" trimming, `isDnsScan`/`isCheckScan`) with table-driven tests including unknown record types.
3. Hooks mirror the existing ones (`loading | empty | ready | error`, cleanup with `ignore`, `reload`); the baseline refetches when the latest DNS scan id changes.
4. The widget composes switch, run button, result, baseline, and changes; every API string is rendered as text only (record values included).
5. Generalizing the security components must leave their tests and visuals unchanged.
6. Tests: helpers, hooks, widget flows (enable, run with the 202 navigation, 409 and 429 handling, member view, each empty and error state), scan screen copy for DNS, scan row tag.

## 8. Visual interpretation, layout, and parity checklist

No prototype, so this is the interpretation to confirm:

- **Layout:** the same section rhythm as Security: `font-display` 22 px title with a muted line below and the switch and button on the right; below it the latest result
  (summary line, severity pills, findings as `FindingCard`s, "Checks in this scan" panel); then two panels side by side from 1024 px and stacked below: **Baseline** (left, wider) and
  **Recent changes** (right).
- **Panels:** `rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px]`, headings `font-display` 19 px, record type labels in `font-mono` 12 px uppercase with the same
  tracking as the pills, values in `font-mono` 14 px with `break-all`. No new colours; added and removed lines use the existing accent and danger-text tokens next to their sign and word.
- **Motion:** the section's existing rise animation; none added; all disabled under `prefers-reduced-motion`.
- **Responsive:** 360 (everything stacks, values wrap), 768, 1024 (two panels), 1440 (content stays in the monitor container).
- **Accessibility:** a `section` with `aria-labelledby` per panel, lists with labels, text for every state, labelled switch, visible focus.
- **Deliberately not done:** no record editing, no "accept change" action, no diff colouring as the only signal, no per-record history chart.
- **Verification:** Playwright screenshots (API mocked) at 360, 768, 1024, 1440 px for: off, no scan, result with findings, baseline with changes, baseline empty, failed scan, error, member view, and the scan screen of a DNS scan.

## 9. Acceptance criteria

- The monitor screen shows the Domain and DNS section; an `OWNER`/`ADMIN` can switch DNS watch on and off and run a DNS scan (navigating to its page), a `MEMBER` sees text only.
- The latest result lists findings and checks; the baseline shows records per type; changes show added and removed values with sign and word.
- 409 and 429 are explained (countdown for 429); every state in D6 exists and reads clearly.
- The scan screen of a `DNS_WATCH` scan has the D8 copy and no HTTP tiles; history rows are tagged; the chart ignores DNS scans.
- Security and HTTP behaviour and tests are unchanged; no raw `fetch`, no new colour or dependency, all API data as text.

## 10. Checks to run

`moon run web:typecheck`, `moon run web:test`, `moon run web:build`, `pnpm format:check` for touched files, `git diff --check`; `moon run web:test-e2e` only if the existing spec needs the new requests mocked.
Playwright screenshots for the visual pass.

## 11. Manual test steps

1. Merge the earlier PRs, apply migrations (`pnpm --filter @ontapulse/api exec prisma migrate deploy`), `moon run worker:sync`, restart `moon run api:dev` and `moon run worker:dev`, then `moon run web:dev`.
2. As `OWNER`, open a monitor on a domain you own. Under Security you now see **Domain and DNS**, off.
3. Switch DNS watch on, click **Run DNS scan**: you land on the scan page ("Running DNS checks…", then "DNS check complete") with checks DNS records, Dangling CNAME, Email authentication.
4. Back on the monitor: the latest result lists any `EMAIL_*` findings; the Baseline shows your records; Recent changes says nothing changed.
5. Change a harmless TXT record, wait for the cache, scan again: one change finding, the baseline updated, a new entry with the added and removed value.
6. Roles: a `MEMBER` sees text only. A second run inside 60 s shows the countdown. API stopped: each part shows its error banner with retry.
7. 360 px: panels stack and long values wrap without overflow. Only domains you own.

## 12. Security requirements

All API data, record values included, is rendered as text. Requests go through `api.*` only. Nothing is run from the baseline or changes panels; the existing switch and run
button are authorized by the API. No secrets and no client-side storage.

## Result

Implemented on branch `feat/dns-watch-ui`, stacked on `feat/dns-watch` (which is stacked on the path probes branches; merge the PRs in order). Not pushed.

What changed:

- `shared/types/domain.ts` and `shared/api/client.ts`: `DnsBaseline` and friends, `triggerDnsScan`, `latestDnsScan`, `dnsBaseline`.
- `entities/scan`: `isDnsScan`, `isCheckScan`, `checkKindName`; the hero, tiles, findings, method text, timeline wording, history tag, and finished-scan toast are written per kind; sub-check labels for the three DNS checks; the response-time chart ignores DNS scans.
- `entities/dns`: record order and labels, "and N more" trimming, change titles and summaries, newest-first change list, `DnsRecordList`, `DnsChangeEntry`.
- `features/security`: `useRunCheckScan` (the security hook is now a wrapper), `useRunDnsScan`, `useLatestDnsScan`, `useDnsBaseline` (no request until a scan exists), `setDnsWatch`, and `SecuritySwitch` / `RunSecurityScanButton` take a `kind`.
- `widgets/dns-watch`: the Domain and DNS section (switch, run button, result, Baseline card, Recent changes card, every state), rendered under Security on the monitor screen.
- `docs/display-content-mapping.md` section 7d (Bahasa Indonesia).

Fix found by the visual pass: "Run scan again" on a scan page always started an **HTTP probe**, whatever the kind (this also affected security scans). `useRunAgain` now runs the same kind again. The DNS failure sentence also lost its period when the API message had none; it is now normalized.

Checks run: `web:typecheck` pass; `web:test` 47 files, 406 tests pass (new: DNS labels, widget flows, scan screen for DNS, scan row tag, run again per kind, timeline wording, chart); `web:build` pass; `web:test-e2e` monitoring flow pass; prettier clean on the touched files.

Visual pass (no prototype; Playwright with the API mocked) at 360, 768, 1024, and 1440 px for: off, full (findings, baseline, changes), failed scan, no baseline, member, error, and the scan page of a DNS scan at 360 and 1440. Observed by me: sections follow the Security rhythm, the two cards sit side by side from 1024 px and stack below, long TXT values wrap without overflow, added and removed lines carry a sign and a word, the failed panel and empty panels read clearly. The temporary spec and screenshots were deleted; the user reviews the result visually.

Not verified:

- The section against the real API, queue, and worker (needs the earlier PRs merged, migrations applied, `moon run worker:sync`, and a domain you own).
- Reduced-motion behaviour in a browser (the section reuses the existing rise animation classes with `motion-reduce:animate-none`).
- The `AAAA` value breaks mid-address at 360 px (readable, not pretty); left as is.
