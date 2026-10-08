# Phases 2–5 — Landing page with the 3D signal orb (combined)

Branch: `refactor/landing-page` (continues after phase 1, commit `347ae75`).

AGENTS.md section 2 says one build phase per prompt. The user asked to skip the static-only stage
and build the landing page with 3D directly, so phases 2 (static page), 3 (scene core), 4 (scroll
link) and 5 (performance/accessibility pass) are one prompt, executed in that order, as **one commit**
(user's choice). This is a deliberate deviation from AGENTS.md section 8.

## 1. Goal

Replace the current landing page (old hero + inline auth card) with a port of
`apps/web/references/landing-prototype.html`: five sections (`hero`, `how`, `result`, `features`,
`cta`), sticky header, no footer, and the imperative Three.js "signal orb" scene linked to scroll.
Visual parity with the prototype. Keep every other route working.

## 2. References read

- `AGENTS.md` (all; sections 4, 6, 8, 9, 10, 12, 14, 15 drive this prompt).
- `apps/web/references/landing-prototype.html`, fully read:
  - Header comment: porting map, URL flags, rules.
  - CSS (lines ~58-200): layout, type scale, components, 640 px and 960 px breakpoints.
  - HTML (lines ~230-345): copy for all five sections. Copy is ported verbatim.
  - JS: `SCENE_CONFIG` (keyframes, tiers, timings), `lifecycleWeights`, `sampleKeyframes`,
    `mulberry32`, shaders (`DOT_*`, `SPRITE_*`, `ARC_*`, core, atmosphere), `createLandingScene`
    (core, atmosphere, dots, beacons, pillars, rings, glow/packet sprites, arcs, orbit rings, dust,
    pulse slots, `simulate`, `placeOrb`, `tick`, resize/DPR, loop, reduced, dispose), and page glue
    (`computeF`, `syncLifecycleUI`, boot).
- Phase 1 tokens in `globals.css` (`--color-landing-*`, `--font-display`, `--font-landing-body`,
  `--font-mono`).
- `three` types for 0.170.0 must be read from `node_modules/three` and `@types/three` before writing
  scene code (AGENTS.md top section). Not yet done; first step of execution.

## 3. Existing code inspected

- `pages/landing-page.tsx`: old hero using `SignalField`, `BlurFade`, `LandingAuthPanel`.
- `features/auth/landing-auth-panel.tsx` (+ test) and `landing-auth-card.tsx`: login/register form,
  `AuthMode` `"login" | "register"`, on success navigates to `/dashboard`.
- `app/router/app-router.tsx`: `Home` shows `LandingPage` for guests, redirects users to
  `/dashboard`; `/login` and `/register` currently `<Navigate to="/" replace />`.
- `e2e/monitoring-flow.spec.ts`: starts at `/`, clicks "Create an account", fills the form.
- `SignalField` and `BlurFade` are also used by `app-shell` and `dashboard-page`: they stay.
- No `three`, no `@types/three`, no `widgets/landing-*` yet.

## 4. Decisions and assumptions

| Decision                                                                                                                                                             | Source                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Interim `/login` and `/register` pages reuse the existing `LandingAuthPanel`, replaced later by the user's auth prototype.                                           | User                   |
| Landing CTAs: "Sign in" -> `/login`; "Get started", "Start monitoring", "Create your workspace" -> `/register`; "See how it works" and nav items -> in-page anchors. | Derived from the above |
| `?debug` HUD and URL flags (`quality`, `motion`, `webgl`) only under `import.meta.env.DEV`.                                                                          | User                   |
| One commit for the whole work.                                                                                                                                       | User                   |
| `three` pinned exactly to `0.170.0` (the version the prototype was tested on).                                                                                       | AGENTS.md section 7    |
| Dark only; copy English, verbatim from the prototype.                                                                                                                | AGENTS.md section 8    |

Assumptions to flag:

- `@types/three@0.170.0` is needed for strict TypeScript (devDependency). Needs your approval (see 13).
- The scan card on the page stays static sample content labelled as a sample in code.
- Meta line, "Coming soon" tags and feature claims are ported as-is; I did not verify them against
  the API, only against README (retry delays 5/30/120 s, public-only targets, no redirects).

## 5. File plan

```
apps/web/src/
  pages/landing/
    landing-page.tsx            route composition only (replaces pages/landing-page.tsx)
    landing-page.test.tsx
  pages/auth/
    auth-page.tsx               interim /login, /register (mode prop), uses LandingAuthPanel
    auth-page.test.tsx
  widgets/landing-header/       sticky header, logo, nav
  widgets/landing-sections/     hero, how-it-works, scan-result, features, cta (+ copy constants)
  widgets/landing-scene/
    model/scene-config.ts       SCENE_CONFIG, tiers, keyframes, constants
    model/create-scene.ts       imperative scene, no React, no DOM except the given canvas
    model/shaders.ts            GLSL strings (documented uniforms)
    model/scroll-progress.ts    clamp/lerp/smooth, lifecycleWeights, sampleKeyframes, computeF
    model/scroll-progress.test.ts
    model/lifecycle-store.ts    tiny external store (active step key), + test
    model/use-scroll-progress.ts hook: measure sections, rAF-coalesced scroll -> setScroll + store
    ui/landing-scene.tsx        mount effect, canvas ref, lifecycle, StrictMode-safe
    ui/scene-fallback.tsx       static SVG (ported from #scene-fallback)
    index.ts
  app/router/app-router.tsx     lazy LandingPage import path, /login /register routes
e2e/monitoring-flow.spec.ts     entry point updated
```

Landing sections do not import from `pages`. `useLifecycle` consumers (step cards, pills) read the
store with `useSyncExternalStore`; they re-render only when the key changes (3 changes per scroll
pass), never per scroll event.

## 6. Implementation requirements

### 6.1 Static page (phase 2)

- Port the CSS to Tailwind classes using the `landing-*` tokens. No inline styles, no raw hex.
  Prototype sizes and clamps ported as named constants or arbitrary values documented once
  (`text-[clamp(44px,6.2vw,80px)]` etc.).
- Sections in order `hero`, `how`, `result`, `features`, `cta` with those exact ids. No footer.
- Header: sticky, blur, logo SVG, nav (How it works / Scan results / Features anchors, Sign in,
  Get started). Below 640 px hide the anchor links except the CTA ones, as in the prototype.
- Landmarks: `<header>`, `<nav aria-label="Primary">`, `<main id="top">`, `<section>` with headings.
  Skip link to `#top`.
- Fallback SVG layer always rendered first (`aria-hidden`), cross-fades out on `scene-ready`, no
  layout shift (fixed, `inset-0`).
- Landing wrapper applies `font-landing-body`, 17 px / 1.55, `bg-landing-bg`; it does not alter
  global `body`.
- Remove usage of `SignalField`, `BlurFade` and the auth card from the landing page only.

### 6.2 Scene core (phase 3)

- `pnpm add three@0.170.0 --save-exact` and `@types/three@0.170.0 -D`.
- Use **named imports** from `three` (not `import * as THREE`) to keep the chunk small.
- `createLandingScene(canvas, options)` returns `{ start, stop, resize, dispose, setReduced,
setScroll } | null`; null when WebGL is unavailable. Options: `tier`, `reduced`, `onFirstFrame`,
  `onContextLost`, optional dev `onStats`.
- Port: core, atmosphere, 14k/5.2k dots + ripple shader, beacons (hub + 14/8 targets), pillars and
  rings (InstancedMesh), glow and packet sprites, arcs, orbit rings, ticks, dust, pulse slots.
- Colors read from the `--color-landing-*` tokens at creation; the three scene tones (`dot`, `core`,
  `neutral`) stay in `scene-config.ts`.
- Gotchas from AGENTS.md section 9: `#include <colorspace_fragment>` on its own line;
  `frustumCulled = false` on moving geometry; recompute `uScalePx` on resize and DPR change;
  additive + `depthWrite = false` except the core.
- No allocations in the frame loop: the prototype's `arcPoint` helper and `.set([..])` array
  literals in `simulate` allocate; replace with scalar `Float32Array` writes and reused temporaries.
- Tiers chosen once: narrow (<768) or coarse pointer -> `low`. DPR cap 2 / 1.5 with adaptive drop
  (never below 1). Pointer parallax on `high` + fine pointer + not reduced.
- Reduced motion: single static frame; react to the media query change at runtime.
- Context lost -> `onContextLost` -> fallback visible again. `webglcontextrestored` is not handled
  (matches prototype); a reload restores it.
- `dispose()`: stop loop, remove listeners, dispose every geometry/material/texture, `renderer.dispose()`,
  `forceContextLoss()`. Idempotent.
- `landing-scene.tsx`: `lazy()` + dynamic `import("../model/create-scene")` inside the mount effect
  (so `three` is in its own chunk); cancelled-flag guard so a StrictMode double mount never leaves
  two canvases or two loops; cleanup disposes. Canvas `aria-hidden`, `pointer-events-none`,
  fixed, `z-0`. Coarse state only: `ready`, `unavailable`.
- `document.visibilitychange` pauses/resumes. Resize through `ResizeObserver` on `document.body`
  plus `window.resize` (as the prototype).

### 6.3 Scroll link (phase 4)

- `computeF`: center of viewport, section index + fraction, tops measured on resize, font load, and
  body `ResizeObserver`. Keyframes at f = 0.5…4.5 (`scene-config.ts`), horizon pose held from
  `result` to the end. Scroll-driven spin stops there (`min(f, 2.5)` as in the prototype).
- `lifecycleWeights` and `sampleKeyframes` are pure, tested.
- Hook pushes `f` to `scene.setScroll` on `requestAnimationFrame`-coalesced scroll events and writes
  the active key (`queued | running | done | ""`) to the lifecycle store.
- Step cards and status pills use `data-active` from the store; transitions as in the prototype
  (`border-color/transform .3s`, `background/color .3s`).
- Idle throttle: render at ~30 fps once `f > idleThrottleFrom` (3.0).
- When no scene exists (fallback only), the step highlighting still works from the same hook.

### 6.4 Interim auth pages

- `pages/auth/auth-page.tsx` renders the existing `LandingAuthPanel` centered on a plain
  `bg-canvas` page with a link back to `/`. No new design. Routes `/login` (mode login) and
  `/register` (mode register). Authenticated users are redirected to `/dashboard` as `Home` does.
- Mode toggle inside the card still works and does not change the URL (kept simple; the final auth
  prototype will decide).
- `e2e/monitoring-flow.spec.ts`: first steps change to `goto("/register")`; accessible names used by
  the test stay as they are.

### 6.5 Dev-only tooling

Under `import.meta.env.DEV`: `?debug` HUD (fps, dpr, tier, f, weights, draw calls, tris, points),
`?quality=low|high`, `?motion=reduce`, `?webgl=off`. Implemented in a separate module imported
dynamically only in DEV so it is absent from the production bundle (verified in the build).

### 6.6 Performance and accessibility pass (phase 5)

- Measure and report: 3D chunk gzip size (cap 250 KB), landing assets excluding JS (cap 2 MB),
  draw calls (cap 15), triangles and points per tier, fps (software GL only, see 15).
- Confirm non-landing routes do not load the 3D chunk (network check + build chunk graph).
- Keyboard order: skip link, logo, nav, CTAs, section content. Visible focus (token outline).
- Contrast already checked for tokens (phase 1); recheck text over the orb at 360/768 px with the
  prototype's overlay surfaces. No reduced text size or contrast to fit.
- `prefers-reduced-motion`: scene static; `scroll-behavior: auto`; step/pill transitions disabled;
  no entrance animations beyond the prototype.
- Status in the result card and pills never relies on color alone (text labels are in the copy).

## 7. Parity checklist

Must match: layout and spacing at 360/768/1024/1440; type scale and clamps; all colors via tokens;
copy verbatim; section order and ids; header behavior; orb poses at each section; QUEUED (neutral,
no packets) -> RUNNING (blue, packets) -> result colors in sync with cards and pills; horizon hold;
fallback cross-fade; reduced-motion static frame; low tier at narrow/coarse.

Deliberately different:

- Fonts self-hosted (variable) instead of Google Fonts; three from npm instead of CDN.
- Anchor CTAs ("Sign in", "Get started", "Start monitoring", "Create your workspace") route to
  `/login` and `/register` instead of `#cta`.
- Skip link, landmarks and focus handling added; no `getElementById` glue.
- DEV-only HUD/flags; sample scan card labelled in code.
- Zero allocations in the frame loop (behavior identical).

## 8. Performance requirements

Caps from AGENTS.md section 9: 13 draw calls (<=15), ~8.5k tris desktop / 7.5k low, ~14.4k points
desktop / 5.4k low, 3D chunk <= 250 KB gzip, landing assets <= 2 MB excluding JS, 60 fps desktop /
30 fps phone. Measured numbers are reported; if a cap fails I stop and ask before relaxing it.

## 9. Accessibility requirements

Canvas decorative (`aria-hidden`, not focusable). Everything meaningful is DOM. Semantic landmarks,
labelled nav and lifecycle list, keyboard reachable CTAs, AA contrast, reduced-motion respected.

## 10. Security requirements

No CDN or font host; no `dangerouslySetInnerHTML`; external links (none expected) use
`rel="noopener noreferrer"`; no logging of user data; no new `VITE_*`; nothing under `apps/api`,
`apps/worker`, `docker-compose.yml`, `.env*`, or `reference(s)/` is touched.

## 11. Acceptance criteria

1. `/` for guests shows the new landing (5 sections, no footer); authenticated users still redirect.
2. Scene loads lazily; `/dashboard` never requests the 3D chunk.
3. Exactly one canvas and one render loop in dev StrictMode; unmount disposes everything.
4. Scroll link, horizon hold, reduced motion, no-WebGL fallback and context-lost behavior work.
5. `/login` and `/register` render the existing auth panel and log in / register successfully.
6. All budgets in section 8 met or reported with numbers.
7. All checks in section 12 pass or failures are reported verbatim.

## 12. Checks to run

`pnpm install`; typecheck; unit tests (`pnpm test`) incl. new `scroll-progress`, lifecycle store,
landing and auth page tests; `pnpm format:check` on changed files (repo baseline has 23 unrelated
failures); `pnpm build` (check chunks, no `fonts.googleapis`/`cdn.jsdelivr`, no HUD in prod);
Playwright e2e (`pnpm test:e2e`, API is mocked in the spec) because routes and the auth entry point
change; coverage run (thresholds not lowered); `git diff --check`. `moon` is not installed in this
environment; equivalent pnpm scripts are used and that is reported.

## 13. Approvals needed

1. Add `three@0.170.0` (exact) as a dependency and `@types/three@0.170.0` as a devDependency.
2. Deviation from "one phase per prompt" (combined 2–5, one commit) — already requested by you.

## 14. Parity verification plan (AGENTS.md section 12)

- Screenshots with Playwright of the port at 360, 768, 1024, 1440 px for each of the five scroll
  positions (+ `?webgl=off` fallback and reduced motion at 1440).
- The prototype needs the three CDN and Google Fonts. The sandbox proxy may block them, so the plan
  is to serve the prototype's `three` import and fonts from local files via Playwright route
  interception (read-only use of `references/`). If that fails, parity is **not** claimed and the
  report says the side-by-side was not done.
- Software GL (SwiftShader) in headless Chromium renders the orb, but is not a real GPU.

## 15. Manual test steps (after implementation)

1. `docker compose up -d`, `docker compose ps`; `moon run api:dev`, `moon run worker:dev`,
   `moon run web:dev` (or `pnpm --filter @ontapulse/web dev`).
2. Open `http://localhost:5173/` (logged out): orb on the right, fallback fades out; compare with
   `references/landing-prototype.html` at the same width.
3. Scroll slowly through "How it works": neutral -> blue with packets -> result colors; matching
   step card and pill highlight in sync.
4. Scroll from "Scan results" to the end: the orb stays in the same lower pose.
5. DevTools Rendering -> emulate `prefers-reduced-motion`: one static frame, no packets/parallax.
6. `?webgl=off` (dev): SVG fallback only, all content intact. Lose the context in DevTools console
   (`WEBGL_lose_context`): returns to the fallback.
7. Network tab on `/dashboard`: no three chunk. Switch tabs: loop pauses (HUD fps stops in dev).
8. 360 and 768 px: no horizontal scroll, copy readable over the orb, scene alive (low tier).
9. `/register` -> create account -> `/dashboard`; `/login` -> sign in; `/login` while logged in
   -> `/dashboard`.
10. `?debug` in dev: HUD shows draw calls <= 15, tier, fps.

## 16. Not verifiable here

Real-device fps and thermal behavior; real mid-range phone; visual parity if the prototype cannot be
rendered offline; Node 24 / `moon` task runner.
