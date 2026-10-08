# Phase 1 — Tokens and fonts (landing refactor)

Branch: `refactor/landing-page`
Scope: AGENTS.md section 8, phase 1. No pages, no components, no scene.

## 1. Goal

Make the landing prototype's design tokens and typography available to the web app as Tailwind 4
`@theme` tokens and self-hosted fonts, so phases 2+ can build the landing page with tokens only.
Existing app screens (dashboard, workspace, project, monitor, scan) must look unchanged.

## 2. References read

- `AGENTS.md` (sections 4, 6, 7, 8, 10, 13, 14, 16).
- `apps/web/references/landing-prototype.html`
  - header comment (porting map, rules): `:root` -> Tailwind 4 `@theme` in `app/styles/globals.css`.
  - `:root` block (lines ~58-74): 12 colors + 3 font families.
  - Hard-coded one-off colors in the prototype CSS (status/finding/severity tints, see 5.3).
  - Body defaults: `font-size: 17px`, `line-height: 1.55`, dark only.
- `apps/web/README.md`, `docs/display-content-mapping.md` were not needed for this phase (no data UI).

Path note: AGENTS.md says `reference/`, the file lives at `apps/web/references/`. Decision from the
user: keep it there. AGENTS.md path references need a separate correction (not part of this phase).

## 3. Existing code inspected

- `apps/web/src/app/styles/globals.css`: Tailwind 4, `@theme inline` mapping to oklch CSS vars in
  `:root` (`--background`, `--primary`, `--surface`, `--border`, ...). `--color-signal`,
  `--color-warning`, `--color-info`, `--color-danger` etc. are already used by app screens.
- `apps/web/src/main.tsx` imports `globals.css` once. No font packages are installed; fonts
  currently fall back to Tailwind's default `font-sans`.
- `apps/web/index.html`: `theme-color` is `#07111f`, no font links.
- `pages/landing-page.tsx` still the old hero (uses `SignalField`, `BlurFade`, `LandingAuthPanel`).
- Installed: React 19.3, Vite 8.3, Tailwind 4.3. No `three`, no `@fontsource`.

## 4. Decisions and assumptions

| Decision | Source |
| --- | --- |
| Prototype tokens are added as **separate, landing-scoped** tokens. Existing oklch tokens are not changed or removed. | User (Q2) |
| Prototype path stays `apps/web/references/`. | User (Q3) |
| Auth moves to `/login` and `/register` in a later phase (phase 2). Not touched here. | User (Q1) |
| Dark only; no light theme. | AGENTS.md section 8 |
| Self-hosted fonts via `@fontsource`; no Google Fonts link. | AGENTS.md sections 4, 7, 13 |

Assumption to confirm during execution: prefer **variable** font packages if they cover the
prototype's axes (Bricolage opsz 12..96 + wght 500/700; Instrument Sans wght 400-600; JetBrains Mono
wght 400/500). If a variable package lacks `opsz`, use the `opsz` css entry of the package or fall
back to static weights. Verify in `node_modules/<pkg>` (package.json `exports`, css files) before
importing; do not rely on memory.

## 5. Implementation requirements

### 5.1 Dependencies (needs your approval, see section 11)

Add to `apps/web` only (exact versions pinned by the lockfile; `npm view` showed 5.3.0 for these):

- `@fontsource-variable/bricolage-grotesque` (display)
- `@fontsource-variable/instrument-sans` (body)  — or `@fontsource/instrument-sans` if the variable package is unavailable
- `@fontsource-variable/jetbrains-mono` (data)

No `three` in this phase. No other dependency.

### 5.2 Font loading

- Import the font CSS from `src/main.tsx` (or from `globals.css` via `@import`), whichever works with
  Vite 8 + Tailwind 4 without a second pipeline. Only the weights/axes the prototype uses.
- Latin subset only unless the package forces otherwise (copy is English).
- `font-display: swap` (package default). No `<link>` to Google Fonts, no preconnect to third parties.

### 5.3 Tokens in `app/styles/globals.css`

Add a second `@theme` block (not `inline`, so utilities and `var()` both work) with landing tokens.
Names use a `landing-` prefix to avoid colliding with existing `--color-surface`, `--color-info`,
`--color-warning`, `--color-danger`, `--color-border`, `--color-accent`:

| Prototype var | Value | New token |
| --- | --- | --- |
| `--bg` | `#0A0E0D` | `--color-landing-bg` |
| `--bg-2` | `#0D1311` | `--color-landing-bg-2` |
| `--surface` | `#111715` | `--color-landing-surface` |
| `--border` | `#22302B` | `--color-landing-border` |
| `--border-strong` | `#2E4039` | `--color-landing-border-strong` |
| `--text` | `#E8F1EC` | `--color-landing-text` |
| `--text-2` | `#B6C6BE` | `--color-landing-text-2` |
| `--muted` | `#93A59C` | `--color-landing-muted` |
| `--accent` | `#5EF2A0` | `--color-landing-accent` |
| `--accent-ink` | `#04140C` | `--color-landing-accent-ink` |
| `--info` | `#7CC4FF` | `--color-landing-info` |
| `--warn` | `#FFB454` | `--color-landing-warn` |
| `--danger` | `#FF7A6B` | `--color-landing-danger` |
| `--font-display` | Bricolage Grotesque | `--font-display` |
| `--font-body` | Instrument Sans | `--font-landing-body` (see note) |
| `--font-mono` | JetBrains Mono | `--font-mono` |

Notes:

- Prototype one-off tints that appear only in the SUCCEEDED/FAILED pills, finding borders, and
  severity chips (`#1F5A3D`, `#7FF0B0`, `#5A2B25`, `#FF9A8D`, `#3A2420`, `#3A2F1A`, `#5A4520`,
  `#FFC879`) also become tokens (`--color-landing-status-*`, `--color-landing-sev-*`), because
  AGENTS.md forbids raw hex in components. Group them in one commented block. Translucent rgba
  surfaces (`rgba(10,14,13,.72)` etc.) are expressed as token + opacity modifier in phase 2.
- `--font-body` is landing-only: the app screens keep their current body font. Do **not** change
  `body { font-family }` globally. Landing wrapper (phase 2) applies the landing body font.
  `--font-display` and `--font-mono` have no existing conflict; check `font-mono` usage in app
  screens first (Tailwind `font-mono` utility will change if `--font-mono` is overridden) and use
  `--font-landing-mono` instead if the app uses `font-mono`.
- Scene colors (`dot #3F6B5B`, `core #040807`, `neutral #4A5A54`) are scene config, not CSS tokens
  (AGENTS.md section 9). Not part of this phase.
- No change to existing `:root`, `body`, `.signal-*` utilities, or reduced-motion rules.

### 5.4 Not in this phase

Type scale utilities (h1 clamp sizes etc.), `.btn`/`.chip` components, layout, routing, auth routes,
landing page markup. Those are phase 2.

## 6. Files likely to change

- `apps/web/package.json`, `pnpm-lock.yaml` (3 font packages)
- `apps/web/src/main.tsx` (font CSS imports) or `app/styles/globals.css`
- `apps/web/src/app/styles/globals.css` (landing `@theme` block)
- `prompts/phase-1-tokens-and-fonts.md` (this file: "Result" section after execution)

No other file. `reference/` files untouched.

## 7. Parity checklist

Must match the prototype: all 13 colors by exact hex, 3 font families and the weights/axes used
(Bricolage 500/700 with opsz, Instrument Sans 400/500/600, JetBrains Mono 400/500).

Deliberately different: token names (`landing-` prefix, Tailwind namespaces); fonts self-hosted
instead of Google Fonts; `--font-body` not applied globally; hex one-offs promoted to tokens.

No visible screen changes are expected in this phase.

## 8. Performance requirements

- Font payload for the landing: woff2 only, latin subset, no unused weights. Report the emitted font
  file sizes from `moon run web:build` (landing total assets cap is 2 MB excluding JS, AGENTS.md
  section 9).
- No render-blocking third-party requests.
- Optional follow-up for phase 2/5: `<link rel="preload">` for the display font used above the fold.

## 9. Accessibility requirements

Contrast of the token pairs (WCAG AA, 4.5:1 normal text, 3:1 large/UI) is checked and reported for:
`text`/`bg`, `text-2`/`bg`, `muted`/`bg`, `accent`/`bg`, `accent-ink`/`accent`, `info`, `warn`,
`danger` on `bg`, and the status/severity chips on their backgrounds. Any pair below AA is reported to
you, not silently changed (tokens are the approved design values).

## 10. Security requirements

- No third-party font host or CDN in production; verify the built `dist/` and `index.html` contain no
  `fonts.googleapis.com` / `fonts.gstatic.com` / `cdn.jsdelivr.net`.
- No `VITE_*` additions. No secrets.

## 11. Approvals needed from you

1. Approve adding the three `@fontsource*` packages (AGENTS.md section 7 says phase 1 prompt carries
   this approval).
2. Confirm the commit plan: one commit `feat(web): add landing design tokens and self-hosted fonts`
   on `refactor/landing-page` (AGENTS.md section 13: no commit/push unless you ask).

## 12. Acceptance criteria

- `globals.css` contains the landing tokens above; values match the prototype `:root` exactly.
- Fonts load from the app origin only; the three families render when applied to a test element.
- No change to any existing screen (spot check `/dashboard`, `/workspaces/new` in dev).
- All checks in section 13 pass or failures are reported verbatim.

## 13. Checks to run

From repo root, real output reported:

- `pnpm install`
- `moon run web:typecheck`
- `moon run web:test`
- `pnpm format:check`
- `moon run web:build` (config + dependencies changed; also inspect emitted font assets)
- `git diff --check`
- `moon run web:test-e2e` is **not** required (no routes/forms changed); will state it was not run.

## 14. Manual test steps (after implementation)

1. `docker compose up -d`, `docker compose ps` (wait for healthy). Start `moon run api:dev`,
   `moon run worker:dev`, `moon run web:dev`.
2. Open `http://localhost:5173/`: the old landing still renders as before (phase 1 changes nothing
   visible). Log in and open `/dashboard`: unchanged.
3. DevTools -> Network -> filter `font`: only same-origin `.woff2` requests appear once a landing
   token/font is used; no requests to `fonts.googleapis.com` or `fonts.gstatic.com` at any time.
4. DevTools -> Elements -> `:root` computed styles: the `--color-landing-*` and font variables exist
   with the prototype hex values.
5. Temporarily apply `font-display` / `font-mono` classes to an element in DevTools and confirm the
   rendered face is Bricolage Grotesque / JetBrains Mono (Computed -> Rendered Fonts).
6. `pnpm --filter @ontapulse/web preview` after `moon run web:build`: repeat step 3 on the production
   build.

## 15. Not verifiable in this phase

Visual parity (no screen is ported yet); real-device performance; the e2e suite (not required here).

## 16. Roadmap after phase 1 (separate prompts, each needs approval)

- Phase 2: landing without 3D (hero, how, result, features, cta; static SVG fallback; five sections in
  order, no footer). Includes `/login` and `/register` routes hosting `LandingAuthPanel` (currently
  both redirect to `/`), CTA wiring, removal of old hero (`SignalField`, `BlurFade` usage on landing),
  and updating `e2e/monitoring-flow.spec.ts` if the auth entry point moves.
- Phase 3: scene core (`three@0.170.0` pinned). Phase 4: scroll link. Phase 5: perf + a11y pass.
