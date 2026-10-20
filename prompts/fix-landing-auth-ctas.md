# Landing: one clear path to the auth screen

Apps touched: web only. API, worker, docs: none.
Branch if approved: `fix/landing-auth-ctas`, cut from an up-to-date `main` (see D5).

## 1. Goal

Today the landing page has two header actions that open the same auth screen on different tabs ("Sign in" -> `/login`,
"Get started" -> `/register`), and the hero "Start monitoring" button opens the Create account tab. The user finds this
confusing and wants the call-to-action buttons to open the **Sign in** tab directly, with one header action instead of two.

## 2. References read

- Root `AGENTS.md` (sections 2, 11, 12), `apps/web/AGENTS.md`.
- `reference/landing-prototype.html` is the approved landing design; this change deliberately differs from it (see section 8).
- Screenshots from the user: the auth screen on the Create account tab, and the header with "Sign in" plus "Get started".

## 3. Existing code inspected

- `widgets/landing-sections/landing-header.tsx`: nav links, a text link "Sign in" (`/login`) and a primary button
  "Get started" (`/register`).
- `widgets/landing-sections/hero-section.tsx`: primary `LinkButton` to `AUTH_ROUTES.register` ("Start monitoring").
- `widgets/landing-sections/cta-section.tsx`: primary "Create your workspace" -> `/register`, ghost "Sign in" -> `/login`.
- `widgets/landing-sections/landing-ui.tsx`: `AUTH_ROUTES = { login: "/login", register: "/register" }`.
- `pages/auth/auth-page.tsx` and `widgets/auth-panel`: one screen, two tabs ("Sign in", "Create account"); `/login` and
  `/register` select the tab. New users reach registration through the tab.
- Tests: `pages/landing/landing-page.test.tsx` (lines 59 to 69) and `e2e/monitoring-flow.spec.ts` (clicks "Get started").

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Header:** one action only. The plain "Sign in" text link is removed and the primary pill becomes "Sign in" -> `/login`. "Get started" is removed (it led to the same screen).                     |
| D2  | **Hero "Start monitoring"** -> `/login` (the Sign in tab). Label unchanged.                                                                                                                         |
| D3  | **Bottom CTA section** unchanged: "Create your workspace" stays an explicit create action to `/register`, and "Sign in" stays `/login`. Veto if it should also open Sign in.                        |
| D4  | **New users** still register through the "Create account" tab on the auth screen. No change to the auth screen, routes, or copy there.                                                              |
| D5  | **Git:** the working tree is on `feat/edge-profile-card` with uncommitted work. Per AGENTS.md I stop and ask before switching branches (commit that branch first, or stash).                        |
| D6  | **Prototype deviation:** the prototype has both header actions; this removes one by the user's request. The prototype file is not edited; the user decides whether to update it in the design chat. |

## 5. Contract changes and sync list

None. Routes, API, and auth behaviour are unchanged.

## 6. Files likely to change

- `widgets/landing-sections/landing-header.tsx`, `widgets/landing-sections/hero-section.tsx`.
- `pages/landing/landing-page.test.tsx`, `e2e/monitoring-flow.spec.ts` (the flow clicks "Sign in", then the "Create account" tab).

## 7. Implementation requirements

1. Header shows a single primary pill "Sign in" linking to `/login`; keep the nav anchors, spacing, and min tap height (44 px).
2. Hero primary button links to `/login`.
3. Update the landing tests to the new links, and the e2e flow to open Sign in then switch to Create account.
4. No new colours, copy outside the two labels, or dependencies.

## 8. Visual interpretation and parity

- **Layout:** the header right side goes from `[text link] [pill]` to a single pill; nav anchors keep their gap. On 360 px
  the nav wraps as before, with one fewer item.
- **Deliberate differences from the prototype:** one header action instead of two; hero CTA target.
- **Motion, typography, colour:** unchanged (existing `LinkButton` primary variant).
- **Verification:** Playwright screenshots of the header at 360, 768, 1024, 1440 px; click-through of header and hero buttons
  landing on the Sign in tab.

## 9. Acceptance criteria

- Header has one action, "Sign in", opening `/login` with the Sign in tab active.
- "Start monitoring" opens `/login`. "Create your workspace" still opens `/register`.
- Registration still works from the Create account tab.
- Landing tests and the e2e flow pass.

## 10. Checks to run

`moon run web:typecheck`, `moon run web:test`, `moon run web:test-e2e` (routes and navigation changed), `moon run web:build`,
`pnpm format:check` for touched files, `git diff --check`.

## 11. Manual test steps

1. `moon run web:dev`, open `http://localhost:5173`.
2. Header shows only "Sign in"; click it -> `/login`, Sign in tab active.
3. Back to `/`, click "Start monitoring" -> `/login`, Sign in tab active.
4. On the auth screen switch to "Create account" and register a test user -> dashboard.
5. Scroll to the bottom CTA: "Create your workspace" -> Create account tab; "Sign in" -> Sign in tab.
6. Narrow viewport (360 px): header wraps without overflow.

## 12. Security requirements

No change to authentication, sessions, or API calls.

## Result

Implemented on branch `fix/landing-auth-ctas`, cut from an up-to-date `main`. D5: the work on `feat/edge-profile-card` was not committed; it was saved with `git stash` (entry "wip: edge profile card"), so it can be restored with `git stash pop` after switching back to that branch. Not committed, not pushed.

What changed:

- Header: the text link "Sign in" and the pill "Get started" were replaced by one primary pill "Sign in" -> `/login`.
- Hero "Start monitoring" -> `/login`. The bottom CTA section is unchanged (D3).
- `landing-page.test.tsx` updated (one "Sign in" in the nav, no "Get started", hero -> `/login`). `e2e/monitoring-flow.spec.ts` now clicks "Sign in", switches to the "Create account" tab, and registers.
- Unrelated fix in the same e2e spec: `getByText("No findings")` matched two elements (strict mode violation) and was changed to the heading role. It was failing before this change.

Checks run: `web:typecheck` pass; landing and auth page tests pass; `web:test-e2e` (monitoring flow) pass; full `web:test` and `web:build` listed below.

Visual check: header screenshots at 360, 768, 1024, 1440 px reviewed by me: one pill at every width, no overflow; at 360 px the pill wraps under the logo as the previous two actions did. Screenshots were temporary and deleted.

Not verified: the visual result was checked only on the header, not the full landing page; the prototype file was not updated (D6).
