# OntaPulse TODO

Priorities are ordered by risk to data reliability and operations, followed by
product feature completeness.

## P0 -- Required before relying on the scheduler in a shared environment

1. [x] Make test database migrations a mandatory CI step before API tests.
   - Run `pnpm --filter @ontapulse/api test:db:migrate` before Vitest.
   - Goal: prevent failures such as the `Monitor.nextScheduledAt` column being
     missing from the test database.
2. [x] Add scheduler integration tests with isolated local PostgreSQL and
       RabbitMQ instances.
   - Prove that scheduler jobs can actually be consumed by the worker and reach
     a terminal status.
   - Test recovery when the broker or database is temporarily unavailable.
3. [x] Add scheduler observability.
   - Structured logs and metrics for the number of due monitors, scans created,
     enqueue failures, a single cycle's duration, and monitors that fail to be
     claimed.
4. [x] Define and document the scheduler policy for enqueue failures.
   - Ensure that the next schedule neither skips monitors nor creates unwanted
     duplicate scans.

## P1 -- Close testing and contract gaps

5. [x] Add frontend tests.
   - Unit/component tests for auth, workspace, project, monitor, and scan forms,
     plus error/loading states.
   - E2E tests for register/login -> create monitor -> trigger scan -> view result.
6. [x] Test endpoints that are not yet covered directly.
   - `GET /ready` for database-ready and database-unavailable conditions.
   - `GET /workspaces/:workspaceId/members`, including roles and access
     isolation.
7. [x] Run worker infrastructure tests on a schedule in CI using isolated
       PostgreSQL and RabbitMQ instances.
8. [x] Add coverage reports and minimum thresholds for the API, worker, and web.
9. [x] Update `docs/display-content-mapping.md` to match the available workspace
       member-management endpoints.

## P2 -- Queue system reliability

10. [x] Implement a transactional outbox between PostgreSQL and RabbitMQ.
    - Scan and event are committed together; leased events are confirmed before
      they become `PUBLISHED`, and failed/expired leases return to `PENDING`.
11. [x] Create a safe, authorized, and auditable DLQ redrive procedure and tool.
12. [x] Add an operational dashboard for queue backlog, retries, the DLQ, scans
        stuck in `QUEUED`/`RUNNING`, and recent failed scans.

## P3 -- Missing core features

13. Add update/delete operations for workspaces, projects, and monitors.
14. Add monitor pause/resume through `isActive`, including schedule resetting when
    a monitor is reactivated.
15. Add project and monitor detail endpoints, plus a latest-scan summary.
16. Build an aggregate dashboard: uptime, SLA/SLO, response-time trends, and
    incident history.
17. Add a finding lifecycle: acknowledge, resolve, assign, comments, and change
    history.
