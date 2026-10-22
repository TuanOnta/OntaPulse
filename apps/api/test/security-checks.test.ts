import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import type { ScanJob, ScanQueue } from "../src/infrastructure/queue/scan-queue.js";
import type { SessionStore } from "../src/infrastructure/session/session-store.js";
import {
  SECURITY_POSTURE_MANUAL_COOLDOWN_SECONDS,
  SECURITY_POSTURE_SCHEDULE_MIN_INTERVAL_SECONDS,
  SECURITY_POSTURE_WORKSPACE_LIMIT_PER_HOUR,
} from "../src/modules/scans/scan-kinds.js";
import { resetDatabase } from "./helpers/database.js";

const SESSION_COOKIE_NAME = "ontapulse_session";
const NON_EXISTENT_ID = "00000000-0000-4000-8000-000000000000";

class TestSessionStore implements SessionStore {
  private readonly sessions = new Map<string, string>();

  add(userId: string): string {
    const token = `session-${userId}`;
    this.sessions.set(token, userId);
    return `${SESSION_COOKIE_NAME}=${token}`;
  }

  async create(userId: string): Promise<string> {
    const token = `session-${userId}`;
    this.sessions.set(token, userId);
    return token;
  }

  async findUserId(token: string): Promise<string | null> {
    return this.sessions.get(token) ?? null;
  }

  async delete(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async close(): Promise<void> {}

  reset(): void {
    this.sessions.clear();
  }
}

class NoopQueue implements ScanQueue {
  async enqueue(_job: ScanJob): Promise<void> {}
  async close(): Promise<void> {}
}

interface Fixture {
  ownerCookie: string;
  adminCookie: string;
  memberCookie: string;
  outsiderCookie: string;
  workspaceId: string;
  monitorId: string;
  otherMonitorId: string;
}

const sessionStore = new TestSessionStore();
let app: FastifyInstance;

async function createFixture(): Promise<Fixture> {
  const [owner, admin, member, outsider] = await Promise.all(
    [
      ["Owner", "owner-sec@example.com"],
      ["Admin", "admin-sec@example.com"],
      ["Member", "member-sec@example.com"],
      ["Outsider", "outsider-sec@example.com"],
    ].map(([name, email]) =>
      prisma.user.create({ data: { name, email, passwordHash: "not-used-by-security-tests" } }),
    ),
  );
  const [workspace, outsiderWorkspace] = await Promise.all([
    prisma.workspace.create({ data: { name: "Security Workspace" } }),
    prisma.workspace.create({ data: { name: "Outsider Workspace" } }),
  ]);

  await prisma.workspaceMember.createMany({
    data: [
      { workspaceId: workspace.id, userId: owner.id, role: "OWNER" },
      { workspaceId: workspace.id, userId: admin.id, role: "ADMIN" },
      { workspaceId: workspace.id, userId: member.id, role: "MEMBER" },
      { workspaceId: outsiderWorkspace.id, userId: outsider.id, role: "OWNER" },
    ],
  });

  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: "Security Project" },
  });
  const [monitor, otherMonitor] = await Promise.all([
    prisma.monitor.create({
      data: { projectId: project.id, name: "Main", targetUrl: "https://example.com" },
    }),
    prisma.monitor.create({
      data: { projectId: project.id, name: "Other", targetUrl: "https://other.example.com" },
    }),
  ]);

  return {
    ownerCookie: sessionStore.add(owner.id),
    adminCookie: sessionStore.add(admin.id),
    memberCookie: sessionStore.add(member.id),
    outsiderCookie: sessionStore.add(outsider.id),
    workspaceId: workspace.id,
    monitorId: monitor.id,
    otherMonitorId: otherMonitor.id,
  };
}

function trigger(fixture: Fixture, cookie: string, monitorId = fixture.monitorId) {
  return app.inject({
    method: "POST",
    url: `/api/monitors/${monitorId}/scans`,
    headers: { cookie },
    payload: { kind: "SECURITY_POSTURE" },
  });
}

function enable(monitorId: string, cookie: string) {
  return app.inject({
    method: "PATCH",
    url: `/api/monitors/${monitorId}/check-settings`,
    headers: { cookie },
    payload: { securityPostureEnabled: true },
  });
}

describe("security posture API", () => {
  beforeAll(async () => {
    app = buildApp({ sessionStore, scanQueue: new NoopQueue() });
    await app.ready();
  });

  beforeEach(async () => {
    sessionStore.reset();
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await app.close();
  });

  describe("check settings", () => {
    it("reports every check as disabled when nothing is stored", async () => {
      const fixture = await createFixture();

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/check-settings`,
        headers: { cookie: fixture.memberCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        monitorId: fixture.monitorId,
        securityPostureEnabled: false,
        dnsWatchEnabled: false,
        pathProbesEnabled: false,
        pathProbesAcknowledgedAt: null,
      });
    });

    it.each(["ownerCookie", "adminCookie"] as const)(
      "lets the %s change settings",
      async (role) => {
        const fixture = await createFixture();

        const response = await enable(fixture.monitorId, fixture[role]);

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
          securityPostureEnabled: true,
          dnsWatchEnabled: false,
        });

        const second = await app.inject({
          method: "PATCH",
          url: `/api/monitors/${fixture.monitorId}/check-settings`,
          headers: { cookie: fixture[role] },
          payload: { dnsWatchEnabled: true },
        });

        expect(second.json()).toMatchObject({
          securityPostureEnabled: true,
          dnsWatchEnabled: true,
        });
      },
    );

    it("rejects a change by a MEMBER but lets them read", async () => {
      const fixture = await createFixture();

      const patch = await enable(fixture.monitorId, fixture.memberCookie);
      const read = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/check-settings`,
        headers: { cookie: fixture.memberCookie },
      });

      expect(patch.statusCode).toBe(403);
      expect(patch.json()).toMatchObject({ code: "INSUFFICIENT_WORKSPACE_ROLE" });
      expect(read.statusCode).toBe(200);
      await expect(prisma.monitorCheckSettings.count()).resolves.toBe(0);
    });

    it("returns 404 to a user outside the workspace and for a missing monitor", async () => {
      const fixture = await createFixture();

      const responses = await Promise.all([
        app.inject({
          method: "GET",
          url: `/api/monitors/${fixture.monitorId}/check-settings`,
          headers: { cookie: fixture.outsiderCookie },
        }),
        enable(fixture.monitorId, fixture.outsiderCookie),
        enable(NON_EXISTENT_ID, fixture.ownerCookie),
      ]);

      for (const response of responses) {
        expect(response.statusCode).toBe(404);
        expect(response.json()).toMatchObject({ code: "MONITOR_NOT_FOUND" });
      }
      await expect(prisma.monitorCheckSettings.count()).resolves.toBe(0);
    });

    it.each([
      {},
      { pathProbesAcknowledged: true },
      { securityPostureEnabled: "yes" },
      { pathProbesEnabled: "yes" },
      { pathProbesEnabled: true, pathProbesAcknowledged: "yes" },
      { pathProbesEnabled: true, pathProbesAcknowledgedById: "x" },
    ])("rejects the invalid body %j", async (payload) => {
      const fixture = await createFixture();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/monitors/${fixture.monitorId}/check-settings`,
        headers: { cookie: fixture.ownerCookie },
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    });

    describe("path probes", () => {
      function patch(monitorId: string, cookie: string, payload: Record<string, unknown>) {
        return app.inject({
          method: "PATCH",
          url: `/api/monitors/${monitorId}/check-settings`,
          headers: { cookie },
          payload,
        });
      }

      it.each(["ownerCookie", "adminCookie"] as const)(
        "lets the %s enable them with the acknowledgment and stores who and when",
        async (role) => {
          const fixture = await createFixture();
          const before = Date.now();

          const response = await patch(fixture.monitorId, fixture[role], {
            pathProbesEnabled: true,
            pathProbesAcknowledged: true,
          });

          expect(response.statusCode).toBe(200);
          const body = response.json();
          expect(body.pathProbesEnabled).toBe(true);
          expect(new Date(body.pathProbesAcknowledgedAt).getTime()).toBeGreaterThanOrEqual(
            before - 1000,
          );
          const stored = await prisma.monitorCheckSettings.findUniqueOrThrow({
            where: { monitorId: fixture.monitorId },
          });
          expect(stored.pathProbesEnabled).toBe(true);
          expect(stored.pathProbesAcknowledgedById).toBe(
            (
              await prisma.user.findUniqueOrThrow({
                where: {
                  email: role === "ownerCookie" ? "owner-sec@example.com" : "admin-sec@example.com",
                },
              })
            ).id,
          );
          // The read route reports the same state.
          const read = await app.inject({
            method: "GET",
            url: `/api/monitors/${fixture.monitorId}/check-settings`,
            headers: { cookie: fixture.memberCookie },
          });
          expect(read.json()).toMatchObject({ pathProbesEnabled: true });
          expect(read.json().pathProbesAcknowledgedAt).not.toBeNull();
        },
      );

      it.each([
        { pathProbesEnabled: true },
        { pathProbesEnabled: true, pathProbesAcknowledged: false },
      ])("refuses to enable them without the acknowledgment: %j", async (payload) => {
        const fixture = await createFixture();

        const response = await patch(fixture.monitorId, fixture.ownerCookie, payload);

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({ code: "PATH_PROBE_ACKNOWLEDGMENT_REQUIRED" });
        await expect(prisma.monitorCheckSettings.count()).resolves.toBe(0);
      });

      it("rejects a MEMBER even with the acknowledgment, and answers 404 outside the workspace", async () => {
        const fixture = await createFixture();
        const payload = { pathProbesEnabled: true, pathProbesAcknowledged: true };

        const member = await patch(fixture.monitorId, fixture.memberCookie, payload);
        const outsider = await patch(fixture.monitorId, fixture.outsiderCookie, payload);
        const missing = await patch(NON_EXISTENT_ID, fixture.ownerCookie, payload);

        expect(member.statusCode).toBe(403);
        expect(outsider.statusCode).toBe(404);
        expect(missing.statusCode).toBe(404);
        await expect(prisma.monitorCheckSettings.count()).resolves.toBe(0);
      });

      it("checks the role before the acknowledgment", async () => {
        const fixture = await createFixture();

        const response = await patch(fixture.monitorId, fixture.memberCookie, {
          pathProbesEnabled: true,
        });

        expect(response.statusCode).toBe(403);
      });

      it("clears the acknowledgment when disabled, and enabling again needs a fresh one", async () => {
        const fixture = await createFixture();
        await patch(fixture.monitorId, fixture.ownerCookie, {
          pathProbesEnabled: true,
          pathProbesAcknowledged: true,
        });

        const disabled = await patch(fixture.monitorId, fixture.adminCookie, {
          pathProbesEnabled: false,
        });

        expect(disabled.statusCode).toBe(200);
        expect(disabled.json()).toMatchObject({
          pathProbesEnabled: false,
          pathProbesAcknowledgedAt: null,
        });
        const stored = await prisma.monitorCheckSettings.findUniqueOrThrow({
          where: { monitorId: fixture.monitorId },
        });
        expect(stored.pathProbesAcknowledgedById).toBeNull();

        const again = await patch(fixture.monitorId, fixture.ownerCookie, {
          pathProbesEnabled: true,
        });
        expect(again.statusCode).toBe(400);
      });

      it("keeps the acknowledgment when only another switch changes", async () => {
        const fixture = await createFixture();
        await patch(fixture.monitorId, fixture.ownerCookie, {
          pathProbesEnabled: true,
          pathProbesAcknowledged: true,
        });

        const response = await enable(fixture.monitorId, fixture.ownerCookie);

        expect(response.json()).toMatchObject({
          securityPostureEnabled: true,
          pathProbesEnabled: true,
        });
        expect(response.json().pathProbesAcknowledgedAt).not.toBeNull();
      });

      it("records the newest acknowledgment when the user acknowledges again", async () => {
        const fixture = await createFixture();
        const payload = { pathProbesEnabled: true, pathProbesAcknowledged: true };
        const first = await patch(fixture.monitorId, fixture.ownerCookie, payload);

        await new Promise((resolve) => setTimeout(resolve, 15));
        const second = await patch(fixture.monitorId, fixture.adminCookie, payload);

        expect(new Date(second.json().pathProbesAcknowledgedAt).getTime()).toBeGreaterThan(
          new Date(first.json().pathProbesAcknowledgedAt).getTime(),
        );
      });
    });

    it("requires a session", async () => {
      const fixture = await createFixture();

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/check-settings`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("triggering a security posture scan", () => {
    it("is rejected while the check is disabled", async () => {
      const fixture = await createFixture();

      const response = await trigger(fixture, fixture.adminCookie);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: "SECURITY_CHECKS_DISABLED" });
      await expect(prisma.scan.count()).resolves.toBe(0);
      await expect(prisma.scanOutboxEvent.count()).resolves.toBe(0);
    });

    it.each(["ownerCookie", "adminCookie"] as const)("queues a scan for the %s", async (role) => {
      const fixture = await createFixture();
      await enable(fixture.monitorId, fixture[role]);

      const response = await trigger(fixture, fixture[role]);

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ kind: "SECURITY_POSTURE", status: "QUEUED" });
      await expect(prisma.scanOutboxEvent.count()).resolves.toBe(1);
    });

    it("keeps role and workspace checks ahead of the enabled check", async () => {
      const fixture = await createFixture();

      const member = await trigger(fixture, fixture.memberCookie);
      const outsider = await trigger(fixture, fixture.outsiderCookie);

      expect(member.statusCode).toBe(403);
      expect(outsider.statusCode).toBe(404);
      await expect(prisma.scan.count()).resolves.toBe(0);
    });

    it("rejects a second scan inside the manual cooldown with a retry hint", async () => {
      const fixture = await createFixture();
      await enable(fixture.monitorId, fixture.adminCookie);

      const first = await trigger(fixture, fixture.adminCookie);
      const second = await trigger(fixture, fixture.adminCookie);

      expect(first.statusCode).toBe(202);
      expect(second.statusCode).toBe(429);
      expect(second.json()).toMatchObject({ code: "SCAN_RATE_LIMITED" });
      expect(second.json().details.retryAfterSeconds).toBeGreaterThan(0);
      expect(second.json().details.retryAfterSeconds).toBeLessThanOrEqual(
        SECURITY_POSTURE_MANUAL_COOLDOWN_SECONDS,
      );
      await expect(prisma.scan.count({ where: { kind: "SECURITY_POSTURE" } })).resolves.toBe(1);
    });

    it("accepts a manual scan again once the cooldown has passed, well before an hour", async () => {
      const fixture = await createFixture();
      await enable(fixture.monitorId, fixture.adminCookie);
      await prisma.scan.create({
        data: {
          monitorId: fixture.monitorId,
          kind: "SECURITY_POSTURE",
          status: "SUCCEEDED",
          createdAt: new Date(Date.now() - (SECURITY_POSTURE_MANUAL_COOLDOWN_SECONDS + 5) * 1_000),
        },
      });

      const response = await trigger(fixture, fixture.adminCookie);

      expect(response.statusCode).toBe(202);
    });

    it("keeps the hourly minimum for scheduled runs only, not for manual ones", () => {
      expect(SECURITY_POSTURE_SCHEDULE_MIN_INTERVAL_SECONDS).toBe(3_600);
      expect(SECURITY_POSTURE_MANUAL_COOLDOWN_SECONDS).toBeLessThan(
        SECURITY_POSTURE_SCHEDULE_MIN_INTERVAL_SECONDS,
      );
    });

    it("rejects a scan when the workspace reached its hourly limit", async () => {
      const fixture = await createFixture();
      await enable(fixture.monitorId, fixture.adminCookie);
      await prisma.scan.createMany({
        data: Array.from({ length: SECURITY_POSTURE_WORKSPACE_LIMIT_PER_HOUR }, () => ({
          monitorId: fixture.otherMonitorId,
          kind: "SECURITY_POSTURE" as const,
          status: "SUCCEEDED" as const,
        })),
      });

      const response = await trigger(fixture, fixture.adminCookie);

      expect(response.statusCode).toBe(429);
      expect(response.json()).toMatchObject({ code: "SCAN_RATE_LIMITED" });
      expect(response.json().details.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("does not rate limit HTTP_PROBE triggers", async () => {
      const fixture = await createFixture();

      const first = await app.inject({
        method: "POST",
        url: `/api/monitors/${fixture.monitorId}/scans`,
        headers: { cookie: fixture.adminCookie },
      });
      const second = await app.inject({
        method: "POST",
        url: `/api/monitors/${fixture.monitorId}/scans`,
        headers: { cookie: fixture.adminCookie },
      });

      expect(first.statusCode).toBe(202);
      expect(second.statusCode).toBe(202);
      expect(first.json()).toMatchObject({ kind: "HTTP_PROBE" });
    });

    it("lets only one of two concurrent triggers through", async () => {
      const fixture = await createFixture();
      await enable(fixture.monitorId, fixture.adminCookie);

      const responses = await Promise.all([
        trigger(fixture, fixture.adminCookie),
        trigger(fixture, fixture.adminCookie),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([202, 429]);
      await expect(prisma.scan.count({ where: { kind: "SECURITY_POSTURE" } })).resolves.toBe(1);
    });
  });

  describe("reading results", () => {
    it("returns 404 NO_SECURITY_SCAN when the monitor has no finished scan", async () => {
      const fixture = await createFixture();
      await prisma.scan.create({
        data: { monitorId: fixture.monitorId, kind: "SECURITY_POSTURE" },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/security-posture/latest`,
        headers: { cookie: fixture.memberCookie },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "NO_SECURITY_SCAN" });
    });

    it("returns the newest finished posture scan with findings and sub-checks", async () => {
      const fixture = await createFixture();
      const older = await prisma.scan.create({
        data: {
          monitorId: fixture.monitorId,
          kind: "SECURITY_POSTURE",
          status: "SUCCEEDED",
          createdAt: new Date(Date.now() - 60_000),
        },
      });
      const latest = await prisma.scan.create({
        data: {
          monitorId: fixture.monitorId,
          kind: "SECURITY_POSTURE",
          status: "SUCCEEDED",
          subChecks: [
            { name: "headers", state: "ran", reason: null },
            { name: "redirect", state: "skipped", reason: "connection_failed" },
          ],
        },
      });
      await prisma.scan.create({
        data: { monitorId: fixture.monitorId, kind: "HTTP_PROBE", status: "SUCCEEDED" },
      });
      await prisma.scanFinding.create({
        data: {
          scanId: latest.id,
          code: "SEC_HDR_CSP_MISSING",
          checkId: "SEC_HDR_CSP_MISSING",
          category: "HEADERS",
          title: "Content-Security-Policy not observed",
          severity: "MEDIUM",
          description: "No Content-Security-Policy header was observed.",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/security-posture/latest`,
        headers: { cookie: fixture.memberCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe(latest.id);
      expect(response.json().id).not.toBe(older.id);
      expect(response.json().subChecks).toEqual([
        { name: "headers", state: "ran", reason: null },
        { name: "redirect", state: "skipped", reason: "connection_failed" },
      ]);
      expect(response.json().findings[0]).toMatchObject({
        checkId: "SEC_HDR_CSP_MISSING",
        category: "HEADERS",
        confidence: null,
      });
    });

    it("serializes TLS findings and the tls sub-check", async () => {
      const fixture = await createFixture();
      const scan = await prisma.scan.create({
        data: {
          monitorId: fixture.monitorId,
          kind: "SECURITY_POSTURE",
          status: "SUCCEEDED",
          subChecks: [
            { name: "tls", state: "ran", reason: null },
            { name: "headers", state: "skipped", reason: "connection_failed" },
          ],
        },
      });
      await prisma.scanFinding.create({
        data: {
          scanId: scan.id,
          code: "SEC_TLS_CERT_EXPIRES_SOON_14",
          checkId: "SEC_TLS_CERT_EXPIRES_SOON_14",
          category: "TLS",
          title: "TLS certificate expires within 14 days",
          severity: "HIGH",
          description: "The server certificate expires within 14 days.",
          evidence: { subjectCn: "example.com", daysRemaining: 9 },
        },
      });
      await prisma.scanFinding.create({
        data: {
          scanId: scan.id,
          code: "SEC_TLS_CHAIN_INVALID",
          checkId: "SEC_TLS_CHAIN_INVALID",
          category: "TLS",
          confidence: "MEDIUM",
          title: "TLS certificate chain is not trusted",
          severity: "HIGH",
          description: "The certificate chain did not validate against the trust store.",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/security-posture/latest`,
        headers: { cookie: fixture.memberCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().subChecks[0]).toEqual({ name: "tls", state: "ran", reason: null });
      expect(response.json().findings).toHaveLength(2);
      expect(response.json().findings[0]).toMatchObject({
        checkId: "SEC_TLS_CERT_EXPIRES_SOON_14",
        category: "TLS",
        severity: "HIGH",
        confidence: null,
        evidence: { subjectCn: "example.com", daysRemaining: 9 },
      });
      expect(response.json().findings[1]).toMatchObject({
        category: "TLS",
        confidence: "MEDIUM",
      });
    });

    it("returns 404 to a user outside the workspace", async () => {
      const fixture = await createFixture();

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/security-posture/latest`,
        headers: { cookie: fixture.outsiderCookie },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "MONITOR_NOT_FOUND" });
    });

    it("filters the scan list by kind and keeps HTTP_PROBE scans without sub-checks", async () => {
      const fixture = await createFixture();
      await prisma.scan.create({
        data: { monitorId: fixture.monitorId, kind: "HTTP_PROBE", status: "SUCCEEDED" },
      });
      await prisma.scan.create({
        data: { monitorId: fixture.monitorId, kind: "SECURITY_POSTURE", status: "SUCCEEDED" },
      });

      const all = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/scans`,
        headers: { cookie: fixture.memberCookie },
      });
      const filtered = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/scans?kind=SECURITY_POSTURE`,
        headers: { cookie: fixture.memberCookie },
      });
      const invalid = await app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/scans?kind=NOPE`,
        headers: { cookie: fixture.memberCookie },
      });

      expect(all.json()).toHaveLength(2);
      expect(filtered.json()).toHaveLength(1);
      expect(filtered.json()[0]).toMatchObject({ kind: "SECURITY_POSTURE", subChecks: null });
      expect(invalid.statusCode).toBe(400);
    });
  });
});
