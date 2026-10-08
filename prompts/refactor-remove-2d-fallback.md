# Remove the 2D SVG fallback from the landing and auth pages

Branch: `feat/auth-page` (follow-up commit; this branch has no PR yet and already holds both pages).
This is not a build phase from AGENTS.md section 8; it is a deliberate change to an approved
prototype, requested by the user.

## 1. Goal

Remove the flat 2D "wireframe orb" (the `#scene-fallback` SVG) from the landing page and the auth
page. Only the 3D orb remains. The orb already fades in on its own (`introT` opacity ramp in the
scene), so there is no cross-fade to the SVG anymore.

## 2. Conflict with existing rules (decision recorded)

AGENTS.md section 9 says "No WebGL or context creation failure: keep the SVG fallback. A lost context
returns to the fallback." and section 15 tests it. The user asked for the 2D model to go and chose:
**remove it completely; with no WebGL (or after a lost context) the pages show their content over the
plain dark background, with no orb.** AGENTS.md is updated in the same commit so the rules do not
contradict the code (section 9 bullet, section 15 bullet, phase table wording).

## 3. References and code read

- `apps/web/references/landing-prototype.html` and `auth-prototype.html`: `#scene-fallback`, the
  `.scene-ready` toggling, `?webgl=off` flag. These parts of the prototypes are intentionally not
  followed any more (listed in the parity section).
- `widgets/landing-scene` (`ui/scene-fallback.tsx`, `ui/landing-scene.tsx`, `index.ts`),
  `pages/landing/landing-page.tsx`, `pages/auth/auth-page.tsx`, `pages/landing/landing-page.test.tsx`.
- Grep for "fallback": the only other hits are unrelated (`glyph-portal` demo, API error helper, router
  `Suspense`).

## 4. Implementation

- Delete `ui/scene-fallback.tsx`; remove the `SceneFallback` / `FallbackSide` exports and the
  `fallbackSide` prop.
- `LandingScene`: drop the `ready` state (the component no longer holds any React state); the canvas
  stays `opacity-0` until the scene writes its own opacity. On context loss the canvas is hidden
  (opacity 0), as now. `onFirstFrame` stays an optional scene option but is unused by the component.
- Landing and auth pages: `Suspense fallback={null}` around the scene.
- `?webgl=off` (DEV) now means "no orb at all", useful to check the no-WebGL layout.
- Tests: replace "shows the fallback first" with a check that the canvas is decorative
  (`aria-hidden`, not focusable) and that the page renders all content without any SVG orb.
- AGENTS.md: update section 9 (no-WebGL bullet), section 15 (WebGL test step) and the phase 2/3 table
  wording. No other file in the docs mentions the SVG.
- Prompt files from earlier phases are not rewritten (AGENTS.md section 5).

## 5. Parity checklist

Deliberately different from both prototypes: no `#scene-fallback` SVG; nothing is drawn behind the
content before the first WebGL frame (the orb fades in over about 1 s once drawn) and when WebGL is
unavailable. Everything else is unchanged; the screenshot comparison from the earlier phases is repeated
for the text/layout metrics (the orb region is expected to differ only before the first frame).

## 6. Performance / accessibility / security

- Slightly less DOM and one fewer component; no new dependencies; no network changes.
- Content stays in normal DOM with unchanged contrast; with WebGL off the page is readable on `bg`.
- Nothing security-related changes.

## 7. Checks

`pnpm typecheck`, `pnpm test`, `pnpm coverage`, Prettier on changed files, `pnpm build`
(`git grep -i scene-fallback` must find nothing in `src`), e2e (`monitoring-flow`) through the sandbox
Chromium config, `git diff --check`. Browser check with Playwright: orb renders at 1440/360 on both
pages; with `?webgl=off` and with context loss no orb and no console errors; layout metrics unchanged.

## 8. Manual test steps

1. `moon run web:dev`, open `/` and `/login`: before the orb appears the left/right area is empty
   (dark), then the 3D orb fades in; there is no flat wireframe sphere at any time.
2. Add `?webgl=off` (dev): content only, no orb, no errors.
3. In DevTools console run `document.querySelector("canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()`: the orb disappears, the page keeps working.
4. 360 px and reduced motion: unchanged apart from the missing SVG.

## Result

Executed on `feat/auth-page`.

- Deleted `widgets/landing-scene/ui/scene-fallback.tsx`; removed the `SceneFallback` export, the
  `fallbackSide` prop and the `ready` state from `LandingScene` (it now holds no React state). Both pages
  use `Suspense fallback={null}`. `git grep -i scenefallback -- src` finds nothing; the only remaining
  `scene-fallback` string is a test assertion that the test id no longer exists.
- `AGENTS.md`: section 9 no-WebGL bullet, section 15 no-WebGL step, and phase 2/3 table wording updated;
  Prettier re-aligned the tables (10 lines changed in total).
- Landing test now checks the canvas is `aria-hidden` / `tabindex=-1`, and that no `scene-fallback`
  element and no 2D orb SVG are rendered.

Checks (pnpm from `apps/web`; `moon` not installed, Node 22.22.0): typecheck pass; 13 files / 55 tests
pass; coverage thresholds pass (31.0 / 27.3 / 38.9 / 31.4); Prettier pass; `pnpm build` pass (3D chunk
126.95 KB gzip, unchanged); `git diff --check` clean; e2e `monitoring-flow` passes (sandbox Chromium,
temporary config).

Browser (dev server, software GL): `/`, `/login`, `/register` at 1440 and 360 px have one canvas, no
`svg circle[r=262]` at 120 ms or later, no horizontal scroll, no console errors. `?webgl=off` on the
landing and the auth page leaves all content visible with the canvas never drawn. After
`WEBGL_lose_context` the canvas opacity becomes 0 and the login form stays usable.

Not verified: the pixel parity comparison against the prototypes was not repeated (the orb area now
differs by design before the first frame); real-GPU behavior of the fade-in; `moon`/Node 24.
