# Web application structure

The web client follows a feature-oriented structure. Keep route composition in
`pages`, user actions in `features`, domain representations in `entities`, and
cross-cutting code in `shared`.

```text
src/
  app/       Application composition: providers, routing, layouts, and styles
  pages/     Route-level composition only
  features/  User-facing business actions
  entities/  Workspace, project, monitor, scan, finding, edge profile, DNS, and user modules
  widgets/   Reusable screen sections composed from features and entities
  shared/    Framework-agnostic UI, API transport, utilities, and configuration
```

Monitor screens compose the `monitor-detail`, `security-posture`, and `dns-watch` widgets, which show
stored results from the API. The client never runs or schedules a check itself.

The client uses React, Vite, Tailwind CSS, and shadcn/ui primitives. Keep
route-level composition in `pages`; do not move API transport or reusable UI
into route modules.
