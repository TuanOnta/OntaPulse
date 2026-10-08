# Phase 7b — Dashboard workspace card v2 (generative banner)

Branch: `refactor/dashboard-page` (follow-up commit on top of phase 7; the prototype was updated in
commit `56d981a`, "feat(dashboard): add card color").

AGENTS.md section 8: "If the prototype changes after a phase is approved ... say what differs before
touching code." This prompt is that list plus the plan.

## 1. Goal

Port the "Workspace card v2" section of `apps/web/references/dashboard-prototype.html` to the dashboard
cards: a generative banner (cover) with a per-workspace tone and waveform, role pill with an icon, a
raised avatar mark, relative age next to the creation date, a 3D tilt on hover, a travelling border light
on hover, and a taller "create workspace" card.

## 2. What changed in the prototype (diff of `bc42619..56d981a`, one file, 91 insertions)

| Area           | Before (phase 7)                                | Now                                                                                                                                                                                                                                                                          |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card structure | flex column, padding 22, mark + role on top row | `.cover` (104 px banner) + `.body` (padding `0 22px 20px`); card padding 0, gap 0, min-height 0                                                                                                                                                                              |
| Tone           | none                                            | `tone-0..3` from a deterministic hash of `id + name`: 0 blue (`124,196,255`), 1 white (`232,241,236`), 2 amber (`255,180,84`), 3 green (`94,242,160`); drives border/shadow glow, cover gradient, dot grid, wave colours, mark tint                                          |
| Cover          | none                                            | radial + linear tinted gradient, dot grid masked to the top (shifts by `14px 7px` on hover), SVG waveform (viewBox 400x72, `preserveAspectRatio="none"`): static stroke + a glowing travelling segment (5 s loop, 2.2 s on hover, per-card negative delay `-((h % 50)/10)s`) |
| Waveform       | none                                            | `wavePath(seed)`: 15 points across 400 px, y = `36 + (r()-.5) * 46 * (i%4===2 ? 1.5 : .8)`, smoothed with cubic segments; seeded PRNG (FNV-1a hash -> mulberry-style `rng`) so each workspace keeps its look                                                                 |
| Role pill      | text pill in the top row                        | pill moved onto the cover (top-right), blurred dark background, with a role icon (crown / shield / person); role is also spoken for screen readers via an `sr-only` "(owner)" suffix in the link text, because the cover is `aria-hidden`                                    |
| Mark           | 46 px, neutral                                  | 52 px, overlaps the cover (`margin-top:-26px`), tone-tinted gradient and border, raised (`translateZ(24px)`), hover: scale 1.06 and rotate -3deg                                                                                                                             |
| Meta           | "Created <date>"                                | "Created <date> · <age>" with a 3 px dot; age = `today`, `Nd ago` (< 30 d), `N mo ago` (< 12 mo), `N yr ago`                                                                                                                                                                 |
| Footer         | no rule                                         | top border rule, padding-top 14 px                                                                                                                                                                                                                                           |
| Hover          | lift 4 px, spotlight                            | lift 4 px + tilt (`rotateX/rotateY`, up to 5 deg / 6 deg, from the pointer), tone-coloured border and glow shadow, conic border light (tone colour) orbiting at 4 s; tilt resets on `pointerleave`; `perspective: 1200px` on the grid                                        |
| Create card    | min-height 176                                  | min-height 260, padding 0 (inherits the v2 reset), no border light                                                                                                                                                                                                           |
| Reduced motion | animations off                                  | additionally `transform: none` on cards (no tilt, no lift)                                                                                                                                                                                                                   |

Not changed: stats, toolbar, states, shell, copy of the rest of the page.

## 3. Existing code inspected

`widgets/workspace-overview/ui/workspace-card.tsx`, `create-workspace-card.tsx`, `workspace-grid.tsx`
(grid is in `workspace-overview.tsx`), `entities/workspace/ui/workspace-role-badge.tsx`,
`shared/lib/pointer-spotlight.ts`, `globals.css` (dashboard keyframes), `pages/dashboard/dashboard-page.test.tsx`.

## 4. Decisions

| Decision                                                                                                                                                                                                                                                                       | Reason                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Tone/waveform/age logic lives in `entities/workspace/model/workspace-look.ts` as pure, tested functions (`hashString`, `createRng`, `workspaceTone`, `wavePath`, `formatAge`). The algorithms are ported exactly so the same workspace gets the same look as in the prototype. | Determinism + unit tests         |
| Tone colours come from the existing tokens (`landing-info`, `landing-text`, `landing-warn`, `landing-accent`) through a `--t` custom property and `color-mix(in srgb, var(--t) N%, transparent)`, instead of raw `rgba(124,196,255,..)` triplets.                              | AGENTS.md: no hard-coded colours |
| `formatAge` takes `now` as an argument (default `Date.now()`), so tests are deterministic. A missing/invalid date renders no age.                                                                                                                                              | Testability, null safety         |
| The role icon is part of `WorkspaceRoleBadge` (entity UI), used on the cover.                                                                                                                                                                                                  | Reuse                            |
| Tilt is written with CSS variables from the pointer handler (no React state per move); `pointerleave` resets it. Under `prefers-reduced-motion` the handler does nothing and the cards have no transform.                                                                      | Prototype + AGENTS.md            |
| The conic border uses a registered `@property` and a mask, so it stays a small block of CSS in `globals.css` (components layer), like the auth panel border.                                                                                                                   | Not expressible in Tailwind      |
| Role pill text stays visible text (never colour only); the link name becomes "Open workspace <name>" (unchanged) and its visible text gains the `sr-only` "(role)".                                                                                                            | a11y                             |

## 5. Files

```
entities/workspace/model/workspace-look.ts (+ test)
entities/workspace/ui/workspace-role-badge.tsx       icon + on-cover styling
entities/workspace/index.ts                          exports
widgets/workspace-overview/ui/workspace-card.tsx     cover/body structure
widgets/workspace-overview/ui/workspace-cover.tsx    banner, dot grid, waveform
widgets/workspace-overview/ui/create-workspace-card.tsx  taller, no border light
widgets/workspace-overview/ui/workspace-overview.tsx grid perspective
shared/lib/pointer-spotlight.ts                      tilt variables + reset (+ test)
app/styles/globals.css                               card border light, wave keyframes
pages/dashboard/dashboard-page.test.tsx              age / role text / tone assertions
```

## 6. Parity checklist

Must match: cover height and gradient, dot grid, waveform shape per workspace (same hash -> same path),
tone per workspace, role pill position and icon, mark size and overlap, meta line with the age, footer
rule, card heights, create card height, hover (lift, tilt, glow, border light), reduced motion.

Deliberately different: tone colours expressed with tokens and `color-mix` (visually the same);
`Date.now()` driven age text (the prototype's demo dates produce the same words only on the day it was
written, so the parity comparison freezes the clock); no unused `.cover .fill` rule; real routing.

## 7. Performance, accessibility, security

- Waveform paths are computed once per workspace (`useMemo`), not per render; 5 s loop animations are CSS
  and off under reduced motion. Per-card SVG is tiny. No new dependency.
- Cover is `aria-hidden`; role stays available as text; contrast of the role pill on the blurred cover is
  checked (>= 4.5:1); focus ring on the stretched link unchanged.
- Names are rendered as text; nothing new is stored or logged.

## 8. Acceptance criteria

1. Cards match the updated prototype in all states and at 360 / 768 / 1024 / 1440 px (differences listed).
2. The same workspace always gets the same tone and waveform; four sample workspaces show the four tones.
3. Hover tilt, lift, glow and border light work and are disabled under reduced motion.
4. Role and age are visible; screen-reader name of the card link unchanged.
5. Checks pass; e2e still finds `Open workspace <name>`.

## 9. Checks

`pnpm typecheck`, `pnpm test`, `pnpm coverage` (thresholds not lowered), Prettier, `pnpm build`,
e2e `monitoring-flow` through the sandbox Chromium config, `git diff --check` (`moon` is not installed
here).

## 10. Parity verification

Same harness as phase 7: serve the prototype with local fonts, mock the API in the port, freeze the clock
in both (`page.clock`), reduced motion on, 1440 / 1024 / 768 / 360, states full / admin filter / no
results. Extra: hover screenshots (tilt, border light) in both with motion enabled, compared visually
(not numerically).

## 11. Manual test steps

1. `moon run web:dev`, sign in, open `/dashboard`.
2. Each card shows a banner with a waveform, role pill with icon, raised avatar, "Created <date> · <age>".
3. Hover a card: it lifts and tilts toward the pointer, glows in its tone, border light orbits; leave:
   tilt resets. The create card has no border light and is taller.
4. Reload: every workspace keeps the same tone and wave.
5. DevTools reduced motion: no tilt, lift or animation.
6. 360 / 768 px: one or two columns, no horizontal scroll.
