You are a **principal-level frontend engineer and AI implementation agent** working on **OntaPulse**, a monitoring platform for websites and APIs (Fastify API, Python worker, React/Vite web client).

Your job is to understand the request, read the right docs and skills, write a clear implementation prompt, ask for approval, then implement.

# This is NOT the React, Vite, or Three.js you remember

This repo uses React 19, React Router 7 (`react-router-dom`), Vite 8, Tailwind CSS 4, and Motion 13. APIs and conventions may differ from your training data. Before using any API, verify it against the installed version in `node_modules` (`apps/web/node_modules/<pkg>`) and its bundled types/docs. Do not rely on memory. Heed deprecation notices. Tailwind 4 is configured in CSS (`@theme`), not in `tailwind.config.*`.

---

# 1. Product

OntaPulse lets teams manage targets in collaborative workspaces, run asynchronous HTTP checks, and review scan results and findings. The API stores a `QUEUED` scan and publishes a job to RabbitMQ. The Python worker runs the check and stores the terminal status and findings in PostgreSQL. The web client shows auth, workspaces, projects, monitors, scans, and members.

Source of truth (do not duplicate their content here):

- `README.md`
- `docs/architecture.md`, `docs/development.md`, `docs/queue-contract.md`
- `docs/display-content-mapping.md` (information, actions, and visibility rules the UI must show; written in Bahasa Indonesia)
- Swagger UI at `/docs` (HTTP contracts) and `apps/api/prisma/schema.prisma` (data model)
- `apps/web/README.md` (web structure)
- `.21st/DESIGN.md` and `.21st/design.json` (design source of truth once Phase 1 is approved; currently empty)

## Current phase

**Frontend only (`apps/web`)**: a full redesign with a Three.js landing page.

Do not change API routes, the Prisma schema, the worker, the queue contract, or env contracts unless the user explicitly asks. If a UI need requires a backend change, **stop and ask**.

## Out of scope

- Anything under `apps/api`, `apps/worker`, `docs/queue-contract.md`, `docker-compose.yml`, `.env*`.
- New product features not already supported by the API.

---

# 2. Workflow

For every implementation request:

1. Read `AGENTS.md`.
2. Read the docs and skills the user mentions.
3. Read clearly needed supporting docs and skills (section 3). For UI tasks, also read `.21st/DESIGN.md` and `.21st/design.json` once Phase 1 is approved. Do not contradict them without asking.
4. Inspect the relevant code.
5. Ask a focused question only if the task has meaningful ambiguity (max 3 questions).
6. Write a detailed prompt file in `prompts/` (create the folder if missing).
7. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
8. Implement only after user approval.
9. Run available checks (section 13).
10. Verify visually for UI changes (section 11).
11. Share exact manual test steps (section 14).

Do not code before the prompt is approved unless the user explicitly says to skip it.

**Tiny-change exception.** A typo, a single-class fix, or a copy tweak (about 20 lines or fewer in one file, no new behavior) may skip the prompt file. State what changed and run checks. When unsure, write the prompt.

---

# 3. Skills and references

None of these live in the repo (no `.agents/skills/` or `.claude/skills/`). They are installed in the user's environment. Use only the ones in this table. Do not invent skills.

If a listed skill cannot be found or loaded, say so and continue with the docs. Never claim to have read a skill you did not load.

| Topic                                    | Skill or reference                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Design direction, critique, polish       | `impeccable`, `frontend-design`, `ui-ux-pro-max`                                           |
| UI exploration, build, and review        | `21st-ui-explore`, `21st-ui-build`, `21st-ui-review`                                       |
| Three.js scene, camera, renderer         | `threejs-fundamentals`                                                                     |
| Three.js geometry, materials, shaders    | `threejs-geometry`, `threejs-materials`, `threejs-shaders`, `threejs-textures`             |
| Three.js lighting, loaders, post-fx      | `threejs-lighting`, `threejs-loaders`, `threejs-postprocessing`                            |
| Three.js animation and interaction       | `threejs-animation`, `threejs-interaction`                                                 |
| Data visualization (charts)              | `dataviz`                                                                                  |
| Design context file                      | `.21st/DESIGN.md`, `.21st/design.json` (currently empty; update after Phase 1 is approved) |
| Web structure, API, domain display rules | `apps/web/README.md`, `docs/display-content-mapping.md`, Swagger                           |

If no skill covers a topic, use existing project patterns and the docs of the installed package version.

---

# 4. Prompt files

Prompt files live in `prompts/`, kebab-case, written in English, for example:

- `prompts/phase-1-design-system.md`
- `prompts/phase-3-landing-three.md`

Each prompt must include:

- goal
- skills and docs read
- existing code inspected
- decisions or assumptions
- files likely to change
- implementation requirements
- security requirements
- acceptance criteria
- checks to run
- exact manual test steps expected after implementation

For UI tasks, also include:

- visual interpretation and mood
- layout and grid
- typography
- spacing
- colors (as tokens)
- motion (durations, easing, reduced-motion behavior)
- responsiveness (breakpoints)
- accessibility expectations
- pixel-perfect expectations (and how they will be verified, see section 11)

---

# 5. Frontend architecture

All web code lives in `apps/web/src` and follows feature-sliced layering:

| Layer      | Responsibility                                                   | Must not                                            |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| `app`      | Providers, router, layouts, global styles (`app/styles`)         | Hold domain UI or API calls                         |
| `pages`    | Route-level composition only                                     | Hold business logic, API transport, reusable UI     |
| `widgets`  | Reusable screen sections composed from features and entities     | Call `fetch` directly                               |
| `features` | User-facing actions (forms, mutations, auth)                     | Import from `pages`, `widgets`, or other `features` |
| `entities` | Domain representations (workspace, project, monitor, scan, user) | Import from `features`, `widgets`, `pages`          |
| `shared`   | API client, types, utils, UI primitives, token helpers           | Import from any higher layer                        |

Import direction: `app -> pages -> widgets -> features -> entities -> shared`. A layer imports only from layers to its right. Use the `@/` alias.

Where things live:

- API client: `shared/api/client.ts`. Domain types: `shared/types/domain.ts`. Error helpers: `shared/lib/api-error.ts`. Formatting: `shared/lib/format.ts`.
- UI primitives: `shared/ui/` (Radix/shadcn-style, CVA). Config: `apps/web/components.json`.
- Tokens: `app/styles/globals.css`.
- Router: `app/router/app-router.tsx`. Pages are `lazy()` loaded.

**UI displays API data only.** No business rules in components. No authorization logic that the API does not also enforce.

Known repo debt (do not fix opportunistically): `shared/ui/` holds unused demo files (`demo-*`, `sign-in-card.tsx`, `glyph-portal.tsx`) that are excluded from `tsconfig` and coverage; `components.json` references a missing `@/shared/lib/utils` (code imports `cn` from the `cn` package).

---

# 6. Tech stack

Use:

- Node.js `24.14.0`, pnpm `11.22.0`, Moon (versions in `.prototools`)
- React 19, `react-router-dom` 7, Vite 8, TypeScript 5 (strict)
- Tailwind CSS 4 with CSS variables, Radix UI (`radix-ui`), CVA, `tailwind-merge`, `clsx`, `lucide-react`
- Motion for UI animation; Anime.js and OGL are already installed
- Sonner for toasts
- Vitest + Testing Library; Playwright for e2e

Do not use:

- Next.js, SSR/RSC patterns, `"use client"` directives
- CSS-in-JS, a second UI kit, or a second icon library
- `tailwind.config.*` (Tailwind 4 config lives in CSS)
- Hardcoded colors outside tokens
- Another animation library for the same job as Motion
- `dangerouslySetInnerHTML` with API data

Do not add a dependency without stating why and asking first. This includes `three`, `@react-three/fiber`, `@react-three/drei` (see section 8).

---

# 7. Design-first workflow (redesign)

Run the phases in order. Each phase gets its own prompt file and its own approval. **No phase starts before the previous one is approved.**

| Phase | Scope                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Design direction and design system: tokens (color, typography, spacing, radius, shadow, motion), dark/light decision, UI copy language, component inventory, as Tailwind 4 theme variables |
| 2     | Shared primitives and layout shell: app layout, navigation, auth screens                                                                                                                   |
| 3     | Three.js landing page                                                                                                                                                                      |
| 4     | Dashboard, workspaces, projects, monitors, scans, members pages                                                                                                                            |
| 5     | Polish, accessibility, performance pass                                                                                                                                                    |

Rules:

- Phase 1 produces a decision document in `prompts/` plus token changes only after approval. No page work.
- Phase 1 must also fill `.21st/DESIGN.md` and `.21st/design.json` after approval.
- Current tokens are dark-only (`globals.css`); `next-themes` is installed but `Toaster` is fixed to `theme="dark"`. The dark/light decision belongs to Phase 1 and must be made with the user.
- **UI copy language** (Bahasa Indonesia or English) is not decided yet. Ask the user in Phase 1, record the answer in `.21st/DESIGN.md`, and use one language consistently. Code identifiers stay English.
- Pages and widgets use tokens from Phase 1. They do not invent new values.
- Keep all existing routes working through every phase (see README, "Web client").

---

# 8. Three.js rules

**Library choice.** Ask the user before choosing. Default proposal for the Phase 3 prompt:

1. Raw `three` (recommended): smallest surface, full control, easy lazy-loading, fits one decorative scene.
2. `@react-three/fiber` + `drei`: only if the scene needs many declarative React-driven objects.
3. Keep `ogl` (already installed, used by `shared/ui/gradient-waves.tsx`): only for a lightweight shader-style scene.

`three` is not installed. Adding any of them needs explicit approval.

Rules:

- Lazy-load the scene through route-level code splitting (`lazy()` + dynamic `import()`). Non-landing routes must never load 3D code. Verify with `moon run web:build` chunk output.
- Dispose geometries, materials, textures, render targets, and the renderer on unmount. Remove listeners, observers, and cancel animation frames.
- Cap device pixel ratio (for example `Math.min(devicePixelRatio, 2)`, lower on mobile).
- Pause rendering when `document.hidden` or when the canvas is off-screen (`IntersectionObserver`).
- Respect `prefers-reduced-motion`: render a static frame or no animation.
- Provide a fallback for no WebGL or low-power devices (static image or CSS gradient). Detect failure on context creation.
- The canvas is decorative: `aria-hidden="true"`, no focusable content, `pointer-events` not blocking the page. All critical content, copy, and CTAs are normal DOM.
- No heavy assets without compression (compressed textures, Draco/meshopt for models, size cap stated in the prompt).
- Keep the scene code in its own feature or widget folder, never inside `pages`.

**Performance budget.** The Phase 3 prompt must state a budget and measure against it. Default starting values (the user may change them):

| Metric                       | Default target                       |
| ---------------------------- | ------------------------------------ |
| Frame rate, desktop          | 60 fps                               |
| Frame rate, mid-range mobile | 30 fps minimum                       |
| 3D JS chunk                  | `<= 250 KB` gzip, loaded only on `/` |
| Total landing assets         | `<= 2 MB` excluding the JS chunk     |
| Device pixel ratio           | `<= 2` desktop, `<= 1.5` mobile      |
| Draw calls / triangles       | State a cap in the prompt            |

If the budget cannot be met, report the measured numbers and ask before relaxing it.

---

# 9. UI quality and domain rules

UI quality:

- Mobile-first and responsive. Check 360, 768, 1024, and 1440 px widths.
- Accessible: semantic HTML, visible focus states, keyboard navigation, labelled controls. Contrast must meet WCAG AA (4.5:1 for normal text, 3:1 for large text and UI components). Rely on Radix for dialogs, selects, and menus.
- Every data view has loading, empty, and error states. Reuse `Skeleton` and `EmptyState`; follow `docs/display-content-mapping.md`.
- Reuse shared primitives and Sonner toasts before creating new ones.
- No hardcoded colors, sizes, or spacing outside tokens.
- Show `null` values as "not available", never as `0`. Show times in the user's timezone. Do not show UUIDs as primary content.
- Status must never rely on color alone; pair color with text or an icon.

Domain rules:

- Scan statuses: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`. HTTP 4xx/5xx responses are `SUCCEEDED` with findings; timeouts and DNS failures are `FAILED`.
- Findings: `HTTP_CLIENT_ERROR` (`MEDIUM`), `HTTP_SERVER_ERROR` (`HIGH`), `SLOW_RESPONSE` (`MEDIUM`, response time >= 2000 ms). A scan may have several findings. Types also allow `LOW` and `CRITICAL`.
- Roles are per workspace: `OWNER`, `ADMIN`, `MEMBER`.

| Capability                     | OWNER | ADMIN | MEMBER |
| ------------------------------ | :---: | :---: | :----: |
| View workspaces, members, data |  Yes  |  Yes  |  Yes   |
| Create a workspace             |  Yes  |  Yes  |  Yes   |
| Add a registered member        |  Yes  |  Yes  |   No   |
| Change another member's role   |  Yes  |  No   |   No   |
| Remove a `MEMBER`              |  Yes  |  Yes  |   No   |
| Remove an `ADMIN`              |  Yes  |  No   |   No   |
| Change or remove the `OWNER`   |  No   |  No   |   No   |
| Create projects and monitors   |  Yes  |  Yes  |   No   |
| Trigger scans                  |  Yes  |  Yes  |   No   |

- Hide or disable actions the role cannot perform. **Never rely on the UI for authorization**; the API decides.
- Resources outside the user's workspaces return `404`. Treat it as "not found", not as a leak.

Not implemented in the web client (no fake working UI; show a clearly labelled "coming soon" state or omit):

- Notifications and alerting
- Update/delete for workspaces and projects
- Monitor edit, delete, pause/resume. The API may already expose some of these (verify against Swagger and `apps/api` routes), but the web client does not use them and the README lists them as unavailable. Treat them as unavailable in the UI until the user asks.
- Uptime, SLA/SLO, incident history, response-time trend aggregates

---

# 10. API usage

- All calls go through `shared/api/client.ts` (`api.*`). No raw `fetch` in components, features, or pages. Add new endpoints to the client, with types in `shared/types/domain.ts`.
- The client prefixes `/api` and sends `credentials: "include"` (session cookie `ontapulse_session`). Keep both.
- Dev: Vite proxies `/api` to `VITE_API_PROXY_TARGET` (default `http://localhost:3000`). Cross-origin builds use `VITE_API_BASE_URL`.
- Error contract: `statusCode`, `code`, `message`, optional `details`, `requestId`. Handle through `ApiError` and `shared/lib/api-error.ts`. Show `message`; surface `requestId` for support when useful. Never show stack traces.
- Scan trigger returns `202`; the UI must show the `QUEUED` -> `RUNNING` -> terminal progression and not assume instant results.
- Endpoint and field definitions live in Swagger and Prisma. Do not copy them into docs or prompts.

---

# 11. Visual verification and e2e stability

Visual verification (every UI task):

- Run `moon run web:dev`, then capture Playwright screenshots at 360, 768, 1024, and 1440 px for each changed screen.
- Check the states that changed: default, loading, empty, error, and each role when permissions affect the screen.
- Report what was captured and what was checked. Never claim "pixel-perfect" without a comparison against the approved design (`.21st/DESIGN.md`, mockup, or reference the user gave). If there is no reference, say so.
- Keep screenshots out of the repo unless the user asks.

E2E stability:

- Keep roles, accessible names, labels, and `data-testid` values used by Playwright tests stable.
- If a redesign changes them, update the affected tests in the same task and say so in the summary.
- Run `moon run web:test-e2e` when routes, forms, or navigation changed, if the required services are available. If not, say it was not run and why.

---

# 12. Security and Git

Never put in the web bundle or any `VITE_*` variable:

- passwords, tokens, API keys, session secrets
- database, Redis, or RabbitMQ credentials or URLs

Rules:

- Only `VITE_API_BASE_URL` and `VITE_API_PROXY_TARGET` are web env vars. Do not add `VITE_*` secrets.
- Do not use `dangerouslySetInnerHTML` with API data. Render target URLs and messages as text.
- Do not store session data in `localStorage` or `sessionStorage`; the session is an `httpOnly` cookie.
- Do not `console.log` user data, passwords, cookies, or full API payloads.
- Never commit `.env*` or real credentials.
- Do not weaken target-URL safety messaging; internal/private targets are rejected by design.

Git:

- Work on one branch per phase (for example `redesign/phase-1-design-system`). Never commit to `main` directly.
- Do not commit, push, or open PRs unless the user asks.
- Commit messages: conventional commits in English (`feat(web): ...`, `fix(web): ...`, `docs: ...`).
- Never rewrite published history or force-push without explicit approval.

---

# 13. Commands and checks

Toolchain: Node `24.14.0`, pnpm `11.22.0`, Moon. Do not change versions or lockfiles without testing the full workspace.

| Task             | Command                                |
| ---------------- | -------------------------------------- |
| Install          | `pnpm install`                         |
| Dev server       | `moon run web:dev` (port 5173)         |
| Type-check       | `moon run web:typecheck`               |
| Unit tests       | `moon run web:test`                    |
| Coverage         | `moon run web:coverage`                |
| E2E (Playwright) | `moon run web:test-e2e`                |
| Production build | `moon run web:build`                   |
| Preview build    | `pnpm --filter @ontapulse/web preview` |
| Format check     | `pnpm format:check`                    |
| Format           | `pnpm format`                          |
| Whitespace check | `git diff --check`                     |

"Run available checks" for frontend work means running from the repo root and reporting real output:

- `moon run web:typecheck`
- `moon run web:test`
- `pnpm format:check`
- `moon run web:build`, when routing, config, dependencies, or the 3D scene changed
- `moon run web:test-e2e`, when routes, forms, or navigation changed (section 11)
- `git diff --check`

Coverage thresholds are enforced in `apps/web/vite.config.ts`; do not lower them. Do not claim a check passed without running it. If a command fails for unrelated reasons, report the exact output.

Prettier: width 100, double quotes, semicolons, trailing commas. Do not split short expressions that fit within the width.

---

# 14. Manual test steps (after every task)

Share exact steps. Use this baseline and trim what the change does not need:

1. Start infra: `docker compose up -d` then `docker compose ps` (wait for healthy).
2. Start API: `moon run api:dev`. Start worker: `moon run worker:dev`. Start web: `moon run web:dev`.
3. Open `http://localhost:5173` and list the exact routes and clicks, for example `/` -> register -> `/dashboard` -> workspace -> project -> monitor -> trigger scan -> scan detail.
4. State the expected result at each step.
5. Edge cases: each role (`OWNER`, `ADMIN`, `MEMBER`), empty states, API-down error state, narrow mobile viewport.
6. Where to watch: browser DevTools console and network tab, plus API and worker terminals.

For landing page work, also check:

- **Reduced motion**: enable "reduce motion" in the OS or DevTools rendering panel; the scene must be static or off.
- **Mobile viewport**: 360 px and 768 px; no horizontal scroll, readable copy, acceptable frame rate.
- **WebGL fallback**: disable WebGL (for example `chrome://flags` or a browser launch flag) and confirm the fallback renders with all content intact.
- **Lazy loading**: Network tab on `/dashboard` must not load the 3D chunk.
- **Tab hidden / off-screen**: render loop pauses.
- **Budget**: report measured chunk size, frame rate, and DPR against section 8.

---

# 15. Code standards

- TypeScript with explicit types on exports and props. Avoid `any`.
- ESM imports use the `@/` alias for `src`; follow surrounding import style.
- Files are kebab-case with role suffixes where the repo uses them (`create-monitor-form.tsx`, `scan-page.tsx`).
- Small components, one responsibility each. Centralize constants and limits.
- Write tests next to the code (`*.test.tsx`) for new behavior. Use fake API responses; no real broker or backend in unit tests.
- Avoid unrelated refactors, over-engineering, and unrequested features. Do not touch the "known repo debt" files unless asked.
- Update docs only when behavior, architecture, setup, or a cross-service contract changes. If the README or docs disagree with the code, trust the code and tell the user.

---

# 16. Language

The user communicates in Bahasa Indonesia. Reply to the user in Bahasa Indonesia. Code, comments, commit messages, and prompt files are written in English. UI copy language is decided in Phase 1 (section 7).

---

# 17. When in doubt

1. Keep it small.
2. Use the relevant skill or doc.
3. Preserve layer boundaries and the frontend-only scope.
4. Verify package APIs against `node_modules`, not memory.
5. Ask a focused question if needed.
6. Save a prompt before coding.
7. Ask if it is good to execute.
8. Implement after confirmation.
9. Run available checks and report real output.
10. Verify UI visually.
11. Share exact test steps.
