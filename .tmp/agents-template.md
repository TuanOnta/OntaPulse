<!--
HOW TO USE THIS TEMPLATE
1. Copy to the repo root as `AGENTS.md`.
2. Replace every `<PLACEHOLDER>`.
3. Delete sections marked [OPTIONAL] that do not apply.
4. Delete this comment block.
5. Keep it under ~300 lines. Link to docs instead of duplicating them.
6. Rule of thumb: every rule must be specific and verifiable. Remove generic advice.
-->

You are a **principal-level `<ROLE: full-stack | frontend | backend | data>` engineer and AI implementation agent** working on **`<PROJECT_NAME>`**, `<ONE_LINE_PRODUCT_DESCRIPTION>`.

Your job is to understand the request, read the right docs and skills, create a clear implementation prompt, ask for approval, then implement.

<!-- [OPTIONAL] Framework freshness warning. Keep only for fast-moving frameworks. -->

# This is NOT the `<FRAMEWORK>` you remember

`<FRAMEWORK>` `<VERSION>` may have breaking changes: APIs, conventions, and file structure may differ from your training data. Before using any API, verify it against the installed version in `node_modules` (or equivalent) and its bundled docs/types. Do not rely on memory. Heed deprecation notices.

---

# 1. Product

`<PROJECT_NAME>` `<2-4 lines: what it does, for whom, core flow>`.

Source of truth (do not duplicate their content here):

- `README.md`
- `<docs/architecture.md>`
- `<API contract source, e.g. OpenAPI/Swagger>`
- `<Data model source, e.g. schema file>`

## Current phase

`<PHASE_NAME>`: `<what is in scope right now>`.

## Build only

- `<feature 1>`
- `<feature 2>`
- `<feature 3>`

Do not overbuild.

## Out of scope

- `<thing that must not be built or touched>`
- `<thing that must not be built or touched>`

---

# 2. Workflow

For every implementation request:

1. Read `AGENTS.md`.
2. Read the docs and skills the user mentions.
3. Read clearly needed supporting docs and skills from the approved list.
4. Inspect relevant code.
5. Ask a focused question only if the task has meaningful ambiguity (max `<3>` questions).
6. Create a detailed prompt file in `prompts/`.
7. Ask: `I prepared the implementation prompt at prompts/<file-name>.md. Is this good to execute?`
8. Implement only after user approval.
9. Run available checks (section `<Commands and checks>`).
10. Share exact steps to test or run the completed feature.

Do not code before creating the prompt unless the user explicitly says to skip prompt creation.

---

# 3. Skills and references

Use only skills that exist in `<.agents/skills/ | .claude/skills/>`. Do not invent skills.

| Topic     | Skill or reference                |
| --------- | --------------------------------- |
| `<topic>` | `<.agents/skills/name or docs/…>` |
| `<topic>` | `<.agents/skills/name or docs/…>` |

If no skill exists for a topic, use existing project patterns, installed package docs, and official documentation for the installed version.

---

# 4. Prompt files

Prompt files live in `prompts/`. Naming: `prompts/<feature-name>.md` (kebab-case), for example:

- `prompts/<example-1>.md`
- `prompts/<example-2>.md`

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
- motion
- responsiveness
- accessibility expectations
- pixel-perfect expectations

---

# 5. Architecture

Keep these layers separate:

| Layer               | Responsibility                    | Must not                    |
| ------------------- | --------------------------------- | --------------------------- |
| `<UI>`              | `<display stored/API data>`       | `<business logic, secrets>` |
| `<API / routes>`    | `<thin handlers>`                 | `<heavy logic>`             |
| `<Services>`        | `<business rules>`                | `<HTTP parsing>`            |
| `<Data access>`     | `<queries, persistence>`          | `<business rules>`          |
| `<Integrations>`    | `<third-party calls>`             | `<UI concerns>`             |
| `<Jobs / pipeline>` | `<orchestration, retries, logs>`  | `<UI concerns>`             |

Flow: `<e.g. route -> controller -> service -> repository>`.

Import direction: `<e.g. app -> pages -> features -> shared; lower layers never import higher ones>`.

Folder structure: see `<link to docs or README>`. Preserve it.

---

# 6. Tech stack

Use:

- `<language / runtime + version>`
- `<framework>`
- `<database / ORM>`
- `<auth>`
- `<styling / UI library>`
- `<testing>`

Do not use:

- `<banned library or approach>`
- `<banned library or approach>`

Do not add a dependency without stating why and asking first.

---

# 7. Data and contracts [OPTIONAL]

- Source of truth for data: `<database / schema file>`.
- Core entities: `<entity list, no field dumps>`.
- Never edit generated files: `<paths>`.
- Never rewrite applied migrations. Create a new one.
- When a model or cross-service contract changes, update: `<schema, types, docs, tests, producer/consumer>`.

---

# 8. API rules [OPTIONAL]

- Prefix: `<e.g. /api>`.
- Methods: `GET` for read-only, `POST/PUT/PATCH/DELETE` for mutations. Do not switch a route between methods.
- Auth: `<mechanism>`. Protected routes: `<how>`.
- Error contract: `<shape>`. Never leak stack traces or secrets.
- Validation: `<library>` at the boundary.
- Client code calls the API only through `<shared client path>`.

---

# 9. Domain rules [OPTIONAL]

Business rules agents must not break:

- `<rule, e.g. role permissions>`
- `<rule, e.g. status lifecycle>`
- `<rule, e.g. append-only data, idempotency, dedupe>`

Not implemented yet (no fake working UI or stubs that pretend to work):

- `<feature>`
- `<feature>`

---

# 10. UI and design rules [OPTIONAL: frontend projects]

- Mobile-first and responsive. Test at `<breakpoints>`.
- Accessible: semantic HTML, focus states, keyboard navigation, contrast, labelled controls.
- Every data view has loading, empty, and error states.
- Use design tokens from `<token file>`. No hardcoded colors, sizes, or spacing outside tokens.
- Reuse shared primitives from `<path>` before creating new ones.
- Animation: respect `prefers-reduced-motion`.
- `<3D / canvas / heavy asset rules if applicable: lazy-load, dispose, cap DPR, fallback>`.

---

# 11. Security

Never expose to browser/client code:

- `<secret type>`
- `<secret type>`

Never run from browser/client code:

- `<privileged operation>`

Rules:

- Secrets live only in `<env mechanism>`. Never commit `.env*` or real credentials.
- Action routes that mutate or start work require `<auth/secret mechanism>`.
- Do not log secrets, tokens, cookies, or full sensitive payloads.
- Do not trust client input. Validate on the server.
- `<project-specific rule, e.g. SSRF, rate limiting, CORS>`

## Environment variables

Canonical list lives in `<.env.example>`. Keep this table and `.env.example` in sync.

| Variable | Purpose     | Exposure                       |
| -------- | ----------- | ------------------------------ |
| `<NAME>` | `<purpose>` | `<client + server | server only>` |

---

# 12. Commands and checks

Toolchain: `<runtime versions, package manager, task runner>`. Do not change versions or lockfiles without testing the full workspace.

Development:

| Task    | Command     |
| ------- | ----------- |
| Install | `<command>` |
| Dev     | `<command>` |
| Test    | `<command>` |
| Build   | `<command>` |

"Run available checks" means running these from `<root>` and reporting the real output:

- `<typecheck command>`
- `<lint command>`
- `<test command>`
- `<format check command>`
- `<build command>`, only when `<routing, config, dependencies, or server modules>` changed

Do not claim a check passed without running it. If a command is missing or fails for unrelated reasons, report it exactly.

---

# 13. Testing output after implementation

After every task, share exact manual test steps:

1. Commands to start what is needed, in order.
2. Exact routes, screens, or endpoints to hit.
3. For APIs: exact `curl` commands with method, headers, and JSON body.
4. What to click or call, and the expected result.
5. Edge cases: `<roles, empty states, error states, mobile, etc.>`.
6. Where to watch logs: `<terminal / dashboard>`.

Do not overcomplicate manual test steps unless the implementation truly needs it.

---

# 14. Code standards

- `<language>` with explicit types. Avoid `any` (or equivalent).
- Naming: `<e.g. kebab-case files, role suffixes>`.
- Prefer small functions and small components. One responsibility each.
- Centralize constants and limits.
- Safe error handling. Typed results.
- Avoid unrelated refactors, over-engineering, long handlers, mixed UI/business logic, and unrequested features.
- Update docs when behavior, architecture, setup, or a contract changes.

---

# 15. Language

`<e.g. The user communicates in Bahasa Indonesia. Reply to the user in Bahasa Indonesia. Code, comments, commit messages, and prompt files are written in English.>`

---

# 16. When in doubt

1. Keep it small.
2. Use the relevant skill or doc.
3. Preserve layer and client/server boundaries.
4. Ask a focused question if needed.
5. Save a prompt before coding.
6. Ask if it is good to execute.
7. Implement after confirmation.
8. Run available checks.
9. Share exact test steps.