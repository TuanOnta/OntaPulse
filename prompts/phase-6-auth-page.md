# Phase 6 — Auth page (sign in / create account) wired into the landing page

Branch: `feat/auth-page` (from `master` at `ee3531b`, which already contains the merged landing page,
PR #1, and the auth prototype).

## 1. Goal

Port `apps/web/references/auth-prototype.html` to the real app and connect it to the landing page:

- `/login` and `/register` render the approved auth screen (3D orb on the left, animated panel with
  "Sign in" / "Create account" tabs) instead of the interim page and the old `LandingAuth*` card.
- Every landing CTA already points at these routes; they must now land on the correct tab.
- Real auth through `AuthProvider` / `api.login` / `api.register`; errors come from the API contract.

## 2. References read

- `AGENTS.md` (sections 4, 6, 9, 10, 11, 12, 14, 16).
- `apps/web/references/auth-prototype.html`, fully read:
  - header comment: URL flags, demo behavior, porting map, validation rules, card motion list,
    "deliberately not designed" list (no forgot-password, social sign-in, email verification, terms);
  - CSS: tokens (adds `--surface-2` and `--danger-text` to the landing tokens), layout (`.shell`,
    `.topbar`, `.stage`, `.side-note`), panel, tabs, fields, banner, submit, success, card motion,
    reduced-motion rules;
  - HTML: panel markup, copy, ARIA (tablist/tab/tabpanel, `role="alert"` banner, `role="status"`
    done view), field icons, password meter;
  - JS: scene config (single pose, `SCENE_IDLE = 0.5`, `SCENE_BUSY = 1.5`), form logic, validators,
    preview flags.
- Scene module in the auth prototype is **byte-identical** to the landing prototype (diffed): only
  `SCENE_CONFIG.keyframes` differ. The existing port in `widgets/landing-scene` is reused.
- API contract: `apps/api/src/modules/auth/auth.schema.ts` (register: name 2-80 trimmed, email valid
  trimmed+lowercased, password 12-128; login: email valid, password 1-128), `README.md` auth section,
  error shape `ApiErrorShape` (`message`, `code`, `statusCode`, optional `details`, `requestId`).

## 3. Existing code inspected

- `pages/auth/auth-page.tsx` (interim, merged in PR #1) and `app/router/app-router.tsx` (`GuestOnly`
  wrapper, `/login` and `/register` routes).
- `features/auth/landing-auth-panel.tsx`, `landing-auth-card.tsx` + test: old inline card with toast
  errors. To be replaced and removed (they are used only by the interim page).
- `app/providers/auth-provider.tsx`: `login` / `register` set `user` as soon as the request resolves.
- `shared/api/client.ts`, `shared/lib/api-error.ts`, `shared/ui/input.tsx` (generic shadcn input,
  does not match the prototype field), `widgets/landing-scene` (scene, `SceneFallback`, progress bus,
  dev flags), landing CTAs (`/login`, `/register`), `e2e/monitoring-flow.spec.ts`.

## 4. Decisions and assumptions (veto any of these)

| Decision                                                                                                                                                                                                                                                                                        | Reason                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Two URLs, one page. `/login` and `/register` both render the same `AuthPage`; the active tab comes from the URL and switching tabs navigates with `replace`. The page, panel and scene stay mounted (pathless layout route).                                                                    | Landing CTAs already deep-link; keeps the 3D scene from restarting on tab switch. |
| Reuse `createLandingScene`; add an optional `keyframes` option (default = landing keyframes) and an `AUTH_KEYFRAMES` constant (the prototype's single pose).                                                                                                                                    | Scene code is identical in both prototypes.                                       |
| The 3D chunk therefore loads on `/`, `/login`, `/register` and nowhere else. AGENTS.md section 9 says non-landing routes never load 3D; the auth prototype explicitly shares the scene, so this is an approved exception. AGENTS.md is not edited here.                                         | Prototype header.                                                                 |
| While a request is in flight the orb shows RUNNING (`setScroll(1.5)`), then returns to `0.5` (finished look).                                                                                                                                                                                   | Prototype behavior.                                                               |
| After success, show the "You're in." / "Your workspace is ready." view for the prototype's redirect timing (~2.6 s: 0.4 s delay + 2.2 s fill), then navigate to `/dashboard`. A ref blocks the "already signed in" redirect during that window, because `AuthProvider` sets `user` immediately. | Prototype; `GuestOnly` would otherwise skip the view.                             |
| Errors show in the panel banner (`ApiError.message`, plus `Request ID: <requestId>` when present) instead of Sonner toasts. Non-API errors use a generic message.                                                                                                                               | Prototype + AGENTS.md section 11.                                                 |
| Client validation mirrors the API (table in section 6.3). Field errors on blur/input as in the prototype; first invalid field gets focus and the card shakes.                                                                                                                                   | Prototype + API schema.                                                           |
| URL preview flags (`?tab=`, `?state=error\|loading\|success`, `?motion=reduce`, `?debug`, `?quality=`, `?webgl=off`) work only under `import.meta.env.DEV` (same rule as the landing flags).                                                                                                    | Earlier decision for the landing page.                                            |
| Old `LandingAuthPanel` / `LandingAuthCard` and their test are deleted. `shared/ui` demo files (`sign-in-card`, `glyph-portal`, ...) stay (known debt).                                                                                                                                          | Dead after this change.                                                           |
| Existing code imports `useAuth` from `@/app/providers/auth-provider` inside features (an upward import). The new hook keeps that pattern; not refactored here.                                                                                                                                  | Known repo pattern, out of scope.                                                 |

## 5. File plan

```
apps/web/src/
  features/auth/
    model/validation.ts           rules (constants), validators, password meter helpers  (+ test)
    model/use-auth-submit.ts      submit state (idle|busy|done), ApiError -> banner, redirect guard  (+ test)
    ui/login-form.tsx             fields, submit button, spinner/progress               (+ test)
    ui/register-form.tsx          + live rule text and meter                             (+ test)
    ui/auth-field.tsx             label, icon, input, inline error, focus line
    index.ts
  shared/ui/password-input.tsx    input + Show/Hide toggle (aria-pressed, aria-controls)  (+ test)
  widgets/auth-panel/
    ui/auth-panel.tsx             panel chrome: trace, tablist (sliding thumb, arrow keys), banner, done view
    ui/heartbeat-trace.tsx, ui/done-view.tsx
    model/use-panel-motion.ts     shake + pointer spotlight (ref + CSS variables, no React state per move)
  widgets/landing-scene/          + AUTH_KEYFRAMES, `keyframes` option, `side` prop on SceneFallback,
                                  `progress` / `keyframes` props on LandingScene; export createProgressBus
  pages/auth/auth-page.tsx        shell: scene, topbar (logo, "Back to home"), side note, panel
  app/router/app-router.tsx       pathless layout route for /login and /register
  app/styles/globals.css          tokens --surface-2, --danger-text (+ auth status tints), keyframes
  e2e/monitoring-flow.spec.ts     new labels and redirect timing
```

Removed: `features/auth/landing-auth-panel.tsx`, `landing-auth-card.tsx`, `landing-auth-panel.test.tsx`.

## 6. Implementation requirements

### 6.1 Layout (parity)

- `.shell` (`min-h-[100svh]`, column, above the fixed scene), `.topbar` (logo link to `/`, "← Back to
  home" link to `/`), `.stage` (panel right-aligned, `clamp(24px, 8vw, 120px)` side padding, centered
  below 960 px), `.side-note` (mono 13 px, hidden below 960 px), panel `max-w-[460px]`, `rounded-[28px]`,
  `p-8` (`p-6` and `rounded-[22px]` at <= 480 px).
- Fallback SVG: left side (`pl-[3vw]`, `w-[min(700px,56vw)]`); below 960 px centered, `opacity .3`.
- Prototype's `body` line-height here is 1.5 (landing uses 1.55); applied on the auth page wrapper.
  Note: the landing prototype's cut-off selector (stacked `main`/`header` padding) does **not** exist
  in this prototype; the auth topbar uses `px-8 py-[18px]` as written.

### 6.2 Components and behavior

- Tabs: `role="tablist"`, roving tabindex, Left/Right/Home/End keys, sliding thumb
  (`translateX(calc(100% + 4px))` on register).
- Panels: sign-in (email, password), register (name, email, password + meter + "N / 128" count).
  Copy, placeholders, `autocomplete`, `inputmode`, `spellcheck` exactly as in the prototype.
- Field icons and the focus line animate on focus. `aria-invalid` + inline error with `aria-describedby`.
- Password toggle "Show"/"Hide" (`aria-pressed`), rule text switches "At least 12 characters" /
  "✓ Long enough" / "Too long (128 max)"; meter states default / ok / over. Never color only.
- Submit: spinner + "Signing in…" / "Creating account…", `disabled` + `aria-busy`, indeterminate bar.
- Banner (`role="alert"`) with icon, message and `Request ID` line; card shakes once.
- Done view (`role="status"`): drawn check, two rings, title, "Taking you to your dashboard…",
  progress bar, `/dashboard` path line.
- Entrance and stagger animations restart when the tab changes (keyed remount of the view).
- Motion is CSS (theme keyframes + a small block of CSS for `@property --angle` conic border mask,
  which Tailwind cannot express). Everything is disabled under `prefers-reduced-motion` and the DEV
  `reduce-motion` class; final states stay visible.

### 6.3 Validation (single source in `validation.ts`)

| Field                        | Rule                                                  | Message                                                    |
| ---------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| login email / register email | `^[^\s@]+@[^\s@]+\.[^\s@]+$` on trimmed value, <= 320 | Enter a valid email address.                               |
| login password               | non-empty                                             | Enter your password.                                       |
| register name                | 2-80 after trim                                       | Enter your name (2 to 80 characters).                      |
| register password            | 12-128 (not trimmed)                                  | Use at least 12 characters. / Use 128 characters or fewer. |

Submit sends the trimmed name and email (the API trims/lowercases too) and the password unchanged.

### 6.4 Wiring

- `AuthPage`: reads the mode from `useLocation()`; guests only. If a session already exists on
  arrival, redirect to `/dashboard`. The submit ref guard keeps the page during the done view.
- `Home` (landing) is unchanged; CTAs: "Sign in" -> `/login`, "Get started" / "Start monitoring" /
  "Create your workspace" -> `/register`. A test asserts the CTA hrefs still match the route table.
- Dev flags module is shared with the landing scene (`readDevFlags`), extended with `tab` and `state`.

### 6.5 Scene integration

`AuthPage` creates its own progress bus (`createProgressBus(0.5)`), passes it and `AUTH_KEYFRAMES` to
`LandingScene`, and sets `1.5` while the form is busy. No scroll hook on this page.

## 7. Parity checklist

Must match: layout and spacing at 360/768/1024/1440, type scale, tokens, copy, tab/field/banner/done
views, all listed card motion, orb pose (left, large; centered and dimmed below 960 px), orb RUNNING
while submitting, reduced-motion behavior.

Deliberately different:

- Real API instead of the fake 1.4 s submit; real error messages and `requestId`.
- URL-synced tabs (`/login`, `/register`); prototype keeps one URL.
- Hash `href="#"` links become router links to `/`.
- Preview flags only in DEV; HUD only in DEV; fonts and three self-hosted/bundled.
- Tokens `--surface-2`, `--danger-text` and the few one-off tints added to the landing token block.
- Pointer spotlight uses a ref and CSS variables (same visual).

## 8. Performance requirements

Same scene budget as the landing page (13 draw calls, no frame-loop allocations, DPR caps). Scene
chunk lazy; auth JS chunk small. No layout shift when the fallback fades out. Pointer-move handler
does not set React state.

## 9. Accessibility requirements

Tab pattern with arrow keys, labelled inputs, `aria-invalid`/`aria-describedby`, banner `role="alert"`,
done view `role="status"`, focus moves to the first invalid field on a failed submit, focus stays on
the active tab after switching, visible focus rings (prototype outline `text` token), 44 px min
targets, contrast per the phase 1 report (plus `danger-text` on `surface` and `muted` on `bg-2` to be
checked), reduced motion honored, status never color-only. Decorative canvas `aria-hidden`.

## 10. Security requirements

No `dangerouslySetInnerHTML`; API messages rendered as text; never log passwords or payloads; no
credentials in `localStorage`/`sessionStorage` (session is the `httpOnly` cookie); `autocomplete`
attributes as prototype so password managers work; no new `VITE_*`; no API, worker or env changes;
UI does not decide authorization.

## 11. Acceptance criteria

1. `/login` shows the sign-in tab, `/register` the create-account tab; tab switch updates the URL
   without restarting the scene.
2. Successful login/register shows the done view, then lands on `/dashboard` after ~2.6 s.
3. Invalid input shows inline errors and does not call the API; API errors show the banner with
   `Request ID` when present; the card shakes; the orb returns to the finished look.
4. Orb runs RUNNING while the request is in flight.
5. Landing CTAs open the right tab; signed-in users hitting `/login` or `/register` go to `/dashboard`.
6. Reduced motion, `?webgl=off` fallback and 360/768/1024/1440 widths match the prototype per section 7.
7. Checks in section 12 pass or failures are reported verbatim.

## 12. Checks to run

`pnpm install`; typecheck; unit tests (validation, password input, forms, submit hook, panel, page,
router/CTA test); `pnpm coverage` (thresholds not lowered); `pnpm format:check` on changed files;
`pnpm build` (check chunks: 3D chunk only reachable from the landing and auth chunks; no
`fonts.googleapis`/`cdn.jsdelivr`; DEV flags absent); Playwright e2e (`monitoring-flow` updated;
run through the sandbox Chromium with a temporary config because the repo config wants a browser
build that is not installed); `git diff --check`. `moon` is not installed here: equivalent pnpm
scripts are used and reported as such.

## 13. Parity verification plan (AGENTS.md section 12)

Serve the auth prototype with `three` and fonts from local files via Playwright route interception,
screenshot it and the port at 360/768/1024/1440 for: sign-in, register, `?state=error`,
`?state=loading`, `?state=success`, reduced motion, `?webgl=off`. Compare section by section (layout
metrics first, then pixel diff in reduced-motion mode where both scenes are static). Report every
difference; do not claim "pixel-perfect". Screenshots stay out of the repo.

## 14. Manual test steps (after implementation)

1. `docker compose up -d`, `docker compose ps`; `moon run api:dev`, `moon run worker:dev`,
   `moon run web:dev`.
2. `http://localhost:5173/` -> "Sign in" opens `/login`; "Get started" opens `/register`.
3. Register with a new email (password >= 12 chars): the orb turns blue while the button shows
   "Creating account…", then the done view, then `/dashboard`.
4. Log out, sign in with a wrong password: banner "Invalid email or password." with a Request ID;
   the card shakes; the orb returns to normal.
5. Try an invalid email, a short name and an 11-character password: inline errors, no request in the
   Network tab.
6. Keyboard: Tab through the page; Left/Right on the tabs; Show/Hide toggle.
7. DevTools reduced motion; `?webgl=off` (dev); 360 and 768 px; open `/dashboard` and confirm no 3D
   chunk is requested.
8. Signed in, open `/login`: redirect to `/dashboard`.

## 15. Not verifiable here (expected)

Real GPU frame rate, real mobile device, Node 24 / `moon`, a live API/worker run end to end (unit and
mocked e2e only unless the services can be started).
