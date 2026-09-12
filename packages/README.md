# Internal packages

Create an internal package only after it has a real consumer in at least two
applications. This avoids turning `packages` into a dumping ground for code
that belongs to one application.

- `api-client`: typed HTTP client and the stable API error contract for web or
  future TypeScript consumers.
- `ui`: framework-specific design-system primitives shared by more than one
  frontend.
- `shared-types`: stable cross-application TypeScript types and constants;
  never place API business rules here.

Each package will receive its own `package.json`, TypeScript configuration, and
public `src/index.ts` only when it is implemented. The directories below are
placeholders, so the workspace does not acquire empty packages prematurely.
