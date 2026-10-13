# OntaPulse web (`apps/web`)

React 19 + React Router 7 + Vite 8 + Tailwind CSS 4 + Motion 13. The full rules for this app (reference-prototype porting, FSD layering, landing scene maintenance, API usage, parity checks, domain and permission rules) live in the root [AGENTS.md](../../AGENTS.md), sections 11 to 13. **Read it first. It applies here in full and is not repeated below.**

This file is a short local index so an agent working inside `apps/web` does not miss the essentials.

## Hard rules (see root sections in brackets)

- Port approved prototypes from `../../reference/*.html` (read-only). No prototype, no screen. Do not redesign. [§2, §11]
- Screens for the security features (monitor security tab, domain and DNS panel, edge profile card) are **blocked until their prototypes exist** in `reference/`. Do not start them from the API shape alone. [§9, §11]
- Layers: `app -> pages -> widgets -> features -> entities -> shared`. Import only from the right; use `@/`. [§11]
- All API calls go through `src/shared/api/client.ts`. No raw `fetch`. Keep `/api` prefix and `credentials: "include"`. New endpoints and types go to the client and `shared/types/domain.ts`. [§13]
- Tokens live in `src/app/styles/globals.css` (`@theme`). No `tailwind.config.*`, no hardcoded colors. [§6, §12]
- UI shows stored API data only. It never runs, schedules, or mutates a check, and the API decides authorization. Hide or disable actions the role cannot perform. [§5, §12]
- Security results are rendered as text. No `dangerouslySetInnerHTML`; hostnames, paths, header values, and evidence are never injected as HTML. [§6, §11]
- Severity and status never rely on color alone. `null` is "not available", never `0`. Show confidence when the API provides it, word passive results as "observed", and present an edge profile (WAF, CDN, anti-bot) as information, not as a defect. [§11]
- Three.js is vanilla and imperative, pinned, lazy-loaded, and fully disposed on unmount. No React Three Fiber. The 3D chunk loads only on `/`. [§11]
- No secrets in `VITE_*`. Only `VITE_API_BASE_URL` and `VITE_API_PROXY_TARGET` exist. [§13]
- Verify any package API against `node_modules` before using it. [top of root file]
- Do not touch the known repo debt files (`shared/ui/demo-*`, `sign-in-card.tsx`, `glyph-portal.tsx`). [§16]

## Local layout

```text
src/
  app/       providers, router (app/router/app-router.tsx), layouts, styles
  pages/     route composition only, lazy() loaded
  widgets/   screen sections (landing-scene, scan-detail; later: security-posture,
             dns-watch, edge-profile, after their prototypes are approved)
  features/  user actions (auth, forms, mutations; later: enable-security-checks,
             acknowledge-path-probes)
  entities/  workspace, project, monitor, scan, finding, edge-profile, dns-baseline, user
  shared/    api, types, lib (api-error, format), ui primitives
e2e/         Playwright specs
test/        Vitest setup
```

Structure notes: [README.md](README.md). Display rules: `../../docs/display-content-mapping.md`. Check IDs, severities, and the wording of findings: `../../docs/security-checks.md`.

## Security-feature UI notes

- Finding display copy is keyed by `checkId`. Keep one lookup in `entities/finding`; do not scatter strings across widgets. Unknown IDs fall back to a generic label so a newer API never breaks an older client.
- Path probes (exposed files) need an explicit acknowledgment step before enabling. The control is shown only to `OWNER` and `ADMIN`; the API rejects everyone else regardless.
- Every data view has loading, empty, and error states. A monitor with no security scan yet shows an empty state that explains how a scan starts, not a score of zero.
- Scan progress follows `QUEUED -> RUNNING -> terminal`. Never assume instant results.

## Commands (repo root)

| Task         | Command                                |
| ------------ | -------------------------------------- |
| Dev (5173)   | `moon run web:dev`                     |
| Type-check   | `moon run web:typecheck`               |
| Unit tests   | `moon run web:test`                    |
| Coverage     | `moon run web:coverage`                |
| E2E          | `moon run web:test-e2e`                |
| Build        | `moon run web:build`                   |
| Preview      | `pnpm --filter @ontapulse/web preview` |
| Format check | `pnpm format:check`                    |
| Whitespace   | `git diff --check`                     |

Coverage thresholds are in `vite.config.ts`; do not lower them. Keep Playwright roles, labels, and `data-testid` values stable, and update affected e2e tests in the same task. Report real output; say plainly what was not run or not visually verified.

## Language

Reply to the user in Bahasa Indonesia. Code, comments, commits, and prompt files in English. UI copy follows the reference prototype.
