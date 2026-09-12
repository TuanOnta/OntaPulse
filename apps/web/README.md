# Web application structure

The web client follows a feature-oriented structure. Keep route composition in
`pages`, user actions in `features`, domain representations in `entities`, and
cross-cutting code in `shared`.

```text
src/
  app/       Application composition: providers, routing, layouts, and styles
  pages/     Route-level composition only
  features/  User-facing business actions
  entities/  Workspace, project, monitor, scan, finding, and user modules
  widgets/   Reusable screen sections composed from features and entities
  shared/    Framework-agnostic UI, API transport, utilities, and configuration
```

The client uses React, Vite, Tailwind CSS, and shadcn/ui primitives. Keep
route-level composition in `pages`; do not move API transport or reusable UI
into route modules.
