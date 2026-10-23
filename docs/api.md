# API reference

Swagger UI at `/docs` and the route schemas are the source of truth for request and response contracts. This page summarizes them.

## Workspace permissions

Roles apply per workspace rather than globally. The same user may be an `OWNER` in one workspace and a `MEMBER` in another.

| Capability                                | OWNER | ADMIN | MEMBER |
| ----------------------------------------- | :---: | :---: | :----: |
| View joined workspaces                    |  Yes  |  Yes  |  Yes   |
| Create a new workspace                    |  Yes  |  Yes  |  Yes   |
| View workspace members                    |  Yes  |  Yes  |  Yes   |
| Add a registered member                   |  Yes  |  Yes  |   No   |
| Change another member's role              |  Yes  |  No   |   No   |
| Remove a `MEMBER`                         |  Yes  |  Yes  |   No   |
| Remove an `ADMIN`                         |  Yes  |  No   |   No   |
| Change or remove the `OWNER`              |  No   |  No   |   No   |
| Read projects, monitors, and scans        |  Yes  |  Yes  |  Yes   |
| Create projects and monitors              |  Yes  |  Yes  |   No   |
| Trigger scans (any kind)                  |  Yes  |  Yes  |   No   |
| Enable or disable security and DNS checks |  Yes  |  Yes  |   No   |
| Enable path probes (with acknowledgment)  |  Yes  |  Yes  |   No   |
| Read security, DNS, and edge results      |  Yes  |  Yes  |  Yes   |
| Queue health and dead-letter redrive      |  Yes  |  No   |   No   |

Resources outside a user's workspaces return `404`, preventing the API from disclosing whether those resources exist.

## API overview

All business endpoints use the `/api` prefix. Health endpoints and Swagger UI are served at the root. Swagger UI and route schemas are the source of truth for request and response contracts.

### Authentication

| Method | Endpoint             | Access            | Purpose                                                            |
| ------ | -------------------- | ----------------- | ------------------------------------------------------------------ |
| `POST` | `/api/auth/register` | Public            | Creates a user, initial workspace, `OWNER` membership, and session |
| `POST` | `/api/auth/login`    | Public            | Creates a session from an email address and password               |
| `GET`  | `/api/auth/me`       | Active session    | Returns the current user                                           |
| `POST` | `/api/auth/logout`   | Public/idempotent | Deletes the session when present                                   |

Primary registration rules:

- name: 2-80 characters after trimming;
- email: valid and normalized to lowercase;
- password: 12-128 characters.

Sessions last seven days and are sent through the `ontapulse_session` cookie.

### Workspaces and members

| Method   | Endpoint                                       | Access             | Purpose                                      |
| -------- | ---------------------------------------------- | ------------------ | -------------------------------------------- |
| `GET`    | `/api/workspaces`                              | Authenticated user | Lists the user's workspaces                  |
| `POST`   | `/api/workspaces`                              | Authenticated user | Creates a workspace with the user as `OWNER` |
| `PATCH`  | `/api/workspaces/:workspaceId`                 | OWNER/ADMIN        | Renames a workspace                          |
| `DELETE` | `/api/workspaces/:workspaceId`                 | OWNER              | Deletes a workspace and everything in it     |
| `GET`    | `/api/workspaces/:workspaceId/members`         | Any member         | Lists workspace members                      |
| `POST`   | `/api/workspaces/:workspaceId/members`         | OWNER/ADMIN        | Adds an already registered user              |
| `PATCH`  | `/api/workspaces/:workspaceId/members/:userId` | OWNER              | Changes a role to `ADMIN` or `MEMBER`        |
| `DELETE` | `/api/workspaces/:workspaceId/members/:userId` | OWNER/ADMIN        | Removes a member according to role rules     |

A workspace name must contain 1-120 characters. Deleting a workspace permanently removes its members, projects, monitors, scans, and findings. A member email address must be valid, contain no more than 320 characters, and belong to a registered user.

### Projects

| Method   | Endpoint                                | Access      | Purpose                                                 |
| -------- | --------------------------------------- | ----------- | ------------------------------------------------------- |
| `GET`    | `/api/workspaces/:workspaceId/projects` | Any member  | Lists projects in a workspace                           |
| `POST`   | `/api/workspaces/:workspaceId/projects` | OWNER/ADMIN | Creates a project                                       |
| `PATCH`  | `/api/projects/:projectId`              | OWNER/ADMIN | Renames a project or changes its description            |
| `DELETE` | `/api/projects/:projectId`              | OWNER/ADMIN | Deletes a project and its monitors, scans, and findings |

A project name must contain 1-120 characters. Its optional description may contain up to 500 characters; an empty description on update clears it. Deleting a project permanently removes its monitors, scans, and findings. Scan jobs already queued for deleted scans are rejected by the worker and end up in the dead-letter queue.

### Monitors

| Method   | Endpoint                            | Access      | Purpose                                                 |
| -------- | ----------------------------------- | ----------- | ------------------------------------------------------- |
| `GET`    | `/api/projects/:projectId/monitors` | Any member  | Lists monitors in a project                             |
| `POST`   | `/api/projects/:projectId/monitors` | OWNER/ADMIN | Creates a monitor                                       |
| `PATCH`  | `/api/monitors/:monitorId`          | OWNER/ADMIN | Updates the name, URL, interval, or `isActive` flag     |
| `DELETE` | `/api/monitors/:monitorId`          | OWNER/ADMIN | Deletes a monitor and its scans, findings, and DNS data |

A monitor accepts an `http` or `https` URL. `intervalSeconds` must be an integer from 60 through 86,400 and defaults to 300. A target URL must be unique within its project. The web client does not expose monitor update or delete yet.

### Check settings and security results

| Method  | Endpoint                                           | Access      | Purpose                                                                             |
| ------- | -------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `GET`   | `/api/monitors/:monitorId/check-settings`          | Any member  | Returns which checks are enabled and the path-probe acknowledgment                  |
| `PATCH` | `/api/monitors/:monitorId/check-settings`          | OWNER/ADMIN | Switches security, DNS, and path-probe checks; probes need `pathProbesAcknowledged` |
| `GET`   | `/api/monitors/:monitorId/security-posture/latest` | Any member  | Latest security posture scan with its findings and sub-check results                |
| `GET`   | `/api/monitors/:monitorId/dns-watch/latest`        | Any member  | Latest DNS watch scan with its findings and sub-check results                       |
| `GET`   | `/api/monitors/:monitorId/dns-baseline`            | Any member  | Current DNS baseline and recent changes                                             |
| `GET`   | `/api/monitors/:monitorId/edge-profile`            | Any member  | Latest CDN, WAF, and anti-bot detections                                            |

Security and DNS checks are off until an `OWNER` or `ADMIN` enables them. Path probes also need an acknowledgment that the user is authorized to test the target; it is stored with the user and time. Disabling probes clears the acknowledgment.

### Scans

| Method | Endpoint                         | Access      | Purpose                                                                                                    |
| ------ | -------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/monitors/:monitorId/scans` | OWNER/ADMIN | Creates and publishes a scan job; the optional body `kind` defaults to `HTTP_PROBE`; success returns `202` |
| `GET`  | `/api/monitors/:monitorId/scans` | Any member  | Lists recent scans for a monitor; the optional query `kind` filters them                                   |
| `GET`  | `/api/scans/:scanId`             | Any member  | Returns a scan, its findings, and its sub-check results                                                    |

Scan kinds are `HTTP_PROBE`, `SECURITY_POSTURE`, and `DNS_WATCH`. A security or DNS scan can only be triggered when that check is enabled for the monitor; otherwise the API returns `409 SECURITY_CHECKS_DISABLED`. Manual runs have a 60 second cooldown per monitor and kind, and each workspace is limited to 60 security scans and 60 DNS scans per hour. The values live in `apps/api/src/modules/scans/scan-kinds.ts`.

### Operations

| Method | Endpoint                                                      | Access | Purpose                                                      |
| ------ | ------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| `GET`  | `/api/workspaces/:workspaceId/operations/queue-health`        | OWNER  | Broker counts and workspace-scoped outbox and scan counts    |
| `POST` | `/api/workspaces/:workspaceId/operations/dlq/:scanId/redrive` | OWNER  | Republishes one dead-lettered scan; every request is audited |

These endpoints are not used by the web client. See [docs/queue-contract.md](docs/queue-contract.md) for the redrive rules.

### Health

| Method | Endpoint  | Purpose                                                          |
| ------ | --------- | ---------------------------------------------------------------- |
| `GET`  | `/health` | Liveness; returns `{"status":"ok"}`                              |
| `GET`  | `/ready`  | Database readiness; returns `503` when PostgreSQL is unavailable |

### Error contract

API errors use this general shape:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": {},
  "requestId": "req-1"
}
```

`details` is optional. Internal errors must not expose stack traces, credentials, or sensitive payloads to clients.
