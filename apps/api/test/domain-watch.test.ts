import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import type { ScanJob, ScanQueue } from "../src/infrastructure/queue/scan-queue.js";
import type { SessionStore } from "../src/infrastructure/session/session-store.js";
import {
  MAX_DNS_CHANGE_HISTORY,
  MAX_DNS_CHANGE_VALUES,
  MAX_DNS_CHANGES_PER_ENTRY,
  MAX_DNS_VALUES_PER_TYPE,
} from "../src/modules/domain-watch/domain-watch.constants.js";
import {
  sanitizeChanges,
  sanitizeSnapshot,
} from "../src/modules/domain-watch/domain-watch.service.js";
import {
  DNS_WATCH_MANUAL_COOLDOWN_SECONDS,
  DNS_WATCH_WORKSPACE_LIMIT_PER_HOUR,
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

const sessionStore = new TestSessionStore();
let app: FastifyInstance;

const SNAPSHOT = {
  host: {
    name: "www.example.com",
    A: ["93.184.216.34"],
    AAAA: [],
    CNAME: [],
    NS: [],
    MX: [],
    TXT: [],
  },
  organization: { name: "example.com", NS: ["a.iana-servers.net"], MX: ["0 ."] },
};
const CHANGE = { scope: "host", type: "A", added: ["93.184.216.35"], removed: ["93.184.216.34"] };

async function createFixture() {
  const [owner, admin, member, outsider] = await Promise.all(
    [
      ["Owner", "owner-dns@example.com"],
      ["Admin", "admin-dns@example.com"],
      ["Member", "member-dns@example.com"],
      ["Outsider", "outsider-dns@example.com"],
    ].map(([name, email]) =>
      prisma.user.create({ data: { name, email, passwordHash: "not-used-by-dns-tests" } }),
    ),
  );
  const [workspace, outsiderWorkspace] = await Promise.all([
    prisma.workspace.create({ data: { name: "DNS Workspace" } }),
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
    data: { workspaceId: workspace.id, name: "DNS Project" },
  });
  const monitor = await prisma.monitor.create({
    data: { projectId: project.id, name: "Main", targetUrl: "https://www.example.com" },
  });

  return {
    ownerCookie: sessionStore.add(owner.id),
    adminCookie: sessionStore.add(admin.id),
    memberCookie: sessionStore.add(member.id),
    outsiderCookie: sessionStore.add(outsider.id),
    workspaceId: workspace.id,
    projectId: project.id,
    monitorId: monitor.id,
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;

function enableDns(monitorId: string, cookie: string) {
  return app.inject({
    method: "PATCH",
    url: `/api/monitors/${monitorId}/check-settings`,
    headers: { cookie },
    payload: { dnsWatchEnabled: true },
  });
}

function triggerDns(fixture: Fixture, cookie: string, monitorId = fixture.monitorId) {
  return app.inject({
    method: "POST",
    url: `/api/monitors/${monitorId}/scans`,
    headers: { cookie },
    payload: { kind: "DNS_WATCH" },
  });
}

function get(path: string, cookie?: string) {
  return app.inject({ method: "GET", url: path, headers: cookie ? { cookie } : {} });
}

async function storeBaseline(monitorId: string, snapshot: unknown = SNAPSHOT) {
  const scan = await prisma.scan.create({
    data: { monitorId, kind: "DNS_WATCH", status: "SUCCEEDED", finishedAt: new Date() },
  });

  await prisma.dnsBaseline.create({
    data: {
      monitorId,
      scanId: scan.id,
      host: "www.example.com",
      organizationDomain: "example.com",
      snapshot: snapshot as never,
      observedAt: new Date("2026-10-20T10:00:00.000Z"),
    },
  });

  return scan.id;
}

async function storeChange(monitorId: string, observedAt: string, changes: unknown = [CHANGE]) {
  const scan = await prisma.scan.create({
    data: { monitorId, kind: "DNS_WATCH", status: "SUCCEEDED", finishedAt: new Date(observedAt) },
  });

  await prisma.dnsChange.create({
    data: {
      monitorId,
      scanId: scan.id,
      observedAt: new Date(observedAt),
      changes: changes as never,
    },
  });

  return scan.id;
}

describe("DNS watch API", () => {
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

  describe("triggering a DNS watch scan", () => {
    it.each(["ownerCookie", "adminCookie"] as const)("queues a scan for the %s", async (role) => {
      const fixture = await createFixture();
      await enableDns(fixture.monitorId, fixture.ownerCookie);

      const response = await triggerDns(fixture, fixture[role]);

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ kind: "DNS_WATCH", status: "QUEUED" });
      await expect(
        prisma.scanOutboxEvent.count({ where: { monitorId: fixture.monitorId } }),
      ).resolves.toBe(1);
    });

    it("is rejected with a DNS specific message while the check is disabled", async () => {
      const fixture = await createFixture();

      const response = await triggerDns(fixture, fixture.ownerCookie);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        code: "SECURITY_CHECKS_DISABLED",
        message: "DNS watch is not enabled for this monitor",
      });
      await expect(prisma.scan.count()).resolves.toBe(0);
    });

    it("does not treat the security posture switch as the DNS switch", async () => {
      const fixture = await createFixture();
      await app.inject({
        method: "PATCH",
        url: `/api/monitors/${fixture.monitorId}/check-settings`,
        headers: { cookie: fixture.ownerCookie },
        payload: { securityPostureEnabled: true },
      });

      const response = await triggerDns(fixture, fixture.ownerCookie);

      expect(response.statusCode).toBe(409);
    });

    it("keeps role and workspace checks ahead of the enabled check", async () => {
      const fixture = await createFixture();

      const member = await triggerDns(fixture, fixture.memberCookie);
      const outsider = await triggerDns(fixture, fixture.outsiderCookie);
      const missing = await triggerDns(fixture, fixture.ownerCookie, NON_EXISTENT_ID);

      expect(member.statusCode).toBe(403);
      expect(outsider.statusCode).toBe(404);
      expect(missing.statusCode).toBe(404);
      await expect(prisma.scan.count()).resolves.toBe(0);
    });

    it("rejects a second scan inside the cooldown with a retry hint, per kind", async () => {
      const fixture = await createFixture();
      await enableDns(fixture.monitorId, fixture.ownerCookie);
      await triggerDns(fixture, fixture.ownerCookie);

      const again = await triggerDns(fixture, fixture.ownerCookie);

      expect(again.statusCode).toBe(429);
      const { retryAfterSeconds } = again.json().details;
      expect(retryAfterSeconds).toBeGreaterThan(0);
      expect(retryAfterSeconds).toBeLessThanOrEqual(DNS_WATCH_MANUAL_COOLDOWN_SECONDS);
    });

    it("lets a DNS scan run right after a posture scan and the other way round", async () => {
      const fixture = await createFixture();
      await app.inject({
        method: "PATCH",
        url: `/api/monitors/${fixture.monitorId}/check-settings`,
        headers: { cookie: fixture.ownerCookie },
        payload: { securityPostureEnabled: true, dnsWatchEnabled: true },
      });

      const posture = await app.inject({
        method: "POST",
        url: `/api/monitors/${fixture.monitorId}/scans`,
        headers: { cookie: fixture.ownerCookie },
        payload: { kind: "SECURITY_POSTURE" },
      });
      const dns = await triggerDns(fixture, fixture.ownerCookie);

      expect(posture.statusCode).toBe(202);
      expect(dns.statusCode).toBe(202);
    });

    it("accepts a scan again once the cooldown has passed", async () => {
      const fixture = await createFixture();
      await enableDns(fixture.monitorId, fixture.ownerCookie);
      await prisma.scan.create({
        data: {
          monitorId: fixture.monitorId,
          kind: "DNS_WATCH",
          status: "SUCCEEDED",
          createdAt: new Date(Date.now() - (DNS_WATCH_MANUAL_COOLDOWN_SECONDS + 5) * 1_000),
        },
      });

      const response = await triggerDns(fixture, fixture.ownerCookie);

      expect(response.statusCode).toBe(202);
    });

    it("rejects a scan when the workspace reached its hourly limit", async () => {
      const fixture = await createFixture();
      await enableDns(fixture.monitorId, fixture.ownerCookie);
      const others = await Promise.all(
        Array.from({ length: DNS_WATCH_WORKSPACE_LIMIT_PER_HOUR }, (_, index) =>
          prisma.monitor.create({
            data: {
              projectId: fixture.projectId,
              name: `Other ${index}`,
              targetUrl: `https://other-${index}.example.com`,
            },
          }),
        ),
      );
      await prisma.scan.createMany({
        data: others.map((monitor) => ({
          monitorId: monitor.id,
          kind: "DNS_WATCH" as const,
          status: "SUCCEEDED" as const,
          createdAt: new Date(Date.now() - 10 * 60 * 1_000),
        })),
      });

      const response = await triggerDns(fixture, fixture.ownerCookie);

      expect(response.statusCode).toBe(429);
      expect(response.json()).toMatchObject({ code: "SCAN_RATE_LIMITED" });
    });

    it("leaves the HTTP probe trigger and its response shape unchanged", async () => {
      const fixture = await createFixture();

      const response = await app.inject({
        method: "POST",
        url: `/api/monitors/${fixture.monitorId}/scans`,
        headers: { cookie: fixture.ownerCookie },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toMatchObject({ kind: "HTTP_PROBE", status: "QUEUED" });
    });

    it("lets the scan list be filtered by kind", async () => {
      const fixture = await createFixture();
      await enableDns(fixture.monitorId, fixture.ownerCookie);
      await triggerDns(fixture, fixture.ownerCookie);

      const response = await get(
        `/api/monitors/${fixture.monitorId}/scans?kind=DNS_WATCH`,
        fixture.memberCookie,
      );

      expect(response.statusCode).toBe(200);
      expect(response.json().map((scan: { kind: string }) => scan.kind)).toEqual(["DNS_WATCH"]);
    });
  });

  describe("the latest DNS watch scan", () => {
    it("returns 404 NO_DNS_SCAN when the monitor has no finished DNS scan", async () => {
      const fixture = await createFixture();
      await prisma.scan.create({ data: { monitorId: fixture.monitorId, kind: "DNS_WATCH" } });
      await prisma.scan.create({
        data: { monitorId: fixture.monitorId, kind: "SECURITY_POSTURE", status: "SUCCEEDED" },
      });

      const response = await get(
        `/api/monitors/${fixture.monitorId}/dns-watch/latest`,
        fixture.memberCookie,
      );

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "NO_DNS_SCAN" });
    });

    it.each(["ownerCookie", "adminCookie", "memberCookie"] as const)(
      "returns the newest finished scan with findings and sub-checks to the %s",
      async (role) => {
        const fixture = await createFixture();
        await prisma.scan.create({
          data: {
            monitorId: fixture.monitorId,
            kind: "DNS_WATCH",
            status: "SUCCEEDED",
            createdAt: new Date(Date.now() - 60_000),
          },
        });
        const latest = await prisma.scan.create({
          data: {
            monitorId: fixture.monitorId,
            kind: "DNS_WATCH",
            status: "SUCCEEDED",
            subChecks: [
              { name: "dns_records", state: "ran", reason: null },
              { name: "dangling_cname", state: "skipped", reason: "connection_failed" },
              { name: "email_auth", state: "ran", reason: null },
            ],
          },
        });
        await prisma.scanFinding.create({
          data: {
            scanId: latest.id,
            code: "EMAIL_DMARC_MISSING",
            checkId: "EMAIL_DMARC_MISSING",
            category: "EMAIL_AUTH",
            confidence: null,
            title: "DMARC not observed",
            severity: "MEDIUM",
            description: "No DMARC record was observed.",
            evidence: { domain: "example.com" },
          },
        });

        const response = await get(
          `/api/monitors/${fixture.monitorId}/dns-watch/latest`,
          fixture[role],
        );

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({ id: latest.id, kind: "DNS_WATCH" });
        expect(body.findings).toHaveLength(1);
        expect(body.findings[0]).toMatchObject({
          checkId: "EMAIL_DMARC_MISSING",
          category: "EMAIL_AUTH",
        });
        expect(body.subChecks.map((item: { name: string }) => item.name)).toEqual([
          "dns_records",
          "dangling_cname",
          "email_auth",
        ]);
      },
    );

    it("returns 404 to a user outside the workspace, 400 for a bad id, and 401 without a session", async () => {
      const fixture = await createFixture();
      await prisma.scan.create({
        data: { monitorId: fixture.monitorId, kind: "DNS_WATCH", status: "SUCCEEDED" },
      });

      const outsider = await get(
        `/api/monitors/${fixture.monitorId}/dns-watch/latest`,
        fixture.outsiderCookie,
      );
      const missing = await get(
        `/api/monitors/${NON_EXISTENT_ID}/dns-watch/latest`,
        fixture.ownerCookie,
      );
      const invalid = await get(`/api/monitors/not-a-uuid/dns-watch/latest`, fixture.ownerCookie);
      const anonymous = await get(`/api/monitors/${fixture.monitorId}/dns-watch/latest`);

      expect(outsider.statusCode).toBe(404);
      expect(outsider.json()).toMatchObject({ code: "MONITOR_NOT_FOUND" });
      expect(missing.statusCode).toBe(404);
      expect(invalid.statusCode).toBe(400);
      expect(anonymous.statusCode).toBe(401);
    });
  });

  describe("the DNS baseline", () => {
    it("returns 404 NO_DNS_BASELINE before the first successful scan", async () => {
      const fixture = await createFixture();

      const response = await get(
        `/api/monitors/${fixture.monitorId}/dns-baseline`,
        fixture.ownerCookie,
      );

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: "NO_DNS_BASELINE" });
    });

    it.each(["ownerCookie", "adminCookie", "memberCookie"] as const)(
      "returns the snapshot and the changes, newest first, to the %s",
      async (role) => {
        const fixture = await createFixture();
        const scanId = await storeBaseline(fixture.monitorId);
        const older = await storeChange(fixture.monitorId, "2026-10-18T10:00:00.000Z");
        const newer = await storeChange(fixture.monitorId, "2026-10-19T10:00:00.000Z", [
          { scope: "organization", type: "NS", added: ["ns2.example.net"], removed: [] },
        ]);

        const response = await get(
          `/api/monitors/${fixture.monitorId}/dns-baseline`,
          fixture[role],
        );

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          monitorId: fixture.monitorId,
          scanId,
          host: "www.example.com",
          organizationDomain: "example.com",
          observedAt: "2026-10-20T10:00:00.000Z",
          snapshot: SNAPSHOT,
          changes: [
            {
              scanId: newer,
              observedAt: "2026-10-19T10:00:00.000Z",
              changes: [
                { scope: "organization", type: "NS", added: ["ns2.example.net"], removed: [] },
              ],
            },
            { scanId: older, observedAt: "2026-10-18T10:00:00.000Z", changes: [CHANGE] },
          ],
        });
      },
    );

    it("returns an empty change list when nothing ever changed", async () => {
      const fixture = await createFixture();
      await storeBaseline(fixture.monitorId);

      const response = await get(
        `/api/monitors/${fixture.monitorId}/dns-baseline`,
        fixture.memberCookie,
      );

      expect(response.json().changes).toEqual([]);
    });

    it("returns 404 to a user outside the workspace, 400 for a bad id, and 401 without a session", async () => {
      const fixture = await createFixture();
      await storeBaseline(fixture.monitorId);

      const outsider = await get(
        `/api/monitors/${fixture.monitorId}/dns-baseline`,
        fixture.outsiderCookie,
      );
      const missing = await get(
        `/api/monitors/${NON_EXISTENT_ID}/dns-baseline`,
        fixture.ownerCookie,
      );
      const invalid = await get(`/api/monitors/not-a-uuid/dns-baseline`, fixture.ownerCookie);
      const anonymous = await get(`/api/monitors/${fixture.monitorId}/dns-baseline`);

      expect(outsider.statusCode).toBe(404);
      expect(outsider.json()).toMatchObject({ code: "MONITOR_NOT_FOUND" });
      expect(missing.statusCode).toBe(404);
      expect(invalid.statusCode).toBe(400);
      expect(anonymous.statusCode).toBe(401);
    });

    it("passes through no unknown field, non-text value, or unknown change type", async () => {
      const fixture = await createFixture();
      await storeBaseline(fixture.monitorId, {
        host: { ...SNAPSHOT.host, secret: "x", A: ["1.1.1.1", 5, null] },
        organization: SNAPSHOT.organization,
        extra: true,
      });
      await storeChange(fixture.monitorId, "2026-10-19T10:00:00.000Z", [
        { scope: "host", type: "SOA", added: ["x"], removed: [] },
        { scope: "organization", type: "TXT", added: ["x"], removed: [] },
        { scope: "elsewhere", type: "A", added: ["x"], removed: [] },
        { ...CHANGE, secret: "y" },
      ]);

      const body = (
        await get(`/api/monitors/${fixture.monitorId}/dns-baseline`, fixture.memberCookie)
      ).json();

      expect(body.snapshot.host).toEqual({ ...SNAPSHOT.host, A: ["1.1.1.1"] });
      expect(body.snapshot).not.toHaveProperty("extra");
      expect(body.changes[0].changes).toEqual([CHANGE]);
    });

    it("removes the baseline and its history together with the monitor", async () => {
      const fixture = await createFixture();
      await storeBaseline(fixture.monitorId);
      await storeChange(fixture.monitorId, "2026-10-19T10:00:00.000Z");

      await prisma.monitor.delete({ where: { id: fixture.monitorId } });

      await expect(prisma.dnsBaseline.count()).resolves.toBe(0);
      await expect(prisma.dnsChange.count()).resolves.toBe(0);
    });

    it("limits the history it returns", async () => {
      const fixture = await createFixture();
      await storeBaseline(fixture.monitorId);
      for (let index = 0; index < MAX_DNS_CHANGE_HISTORY + 3; index += 1) {
        await storeChange(
          fixture.monitorId,
          new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
        );
      }

      const body = (
        await get(`/api/monitors/${fixture.monitorId}/dns-baseline`, fixture.ownerCookie)
      ).json();

      expect(body.changes).toHaveLength(MAX_DNS_CHANGE_HISTORY);
    });
  });
});

describe("sanitizeSnapshot and sanitizeChanges", () => {
  it("returns empty shapes for a value that is not an object or list", () => {
    expect(sanitizeSnapshot(null).host.A).toEqual([]);
    expect(sanitizeSnapshot("text").organization.name).toBe("");
    expect(sanitizeChanges(null)).toEqual([]);
    expect(sanitizeChanges({})).toEqual([]);
  });

  it("caps the number and the length of values", () => {
    const many = Array.from(
      { length: MAX_DNS_VALUES_PER_TYPE + 5 },
      (_, index) => `10.0.0.${index}`,
    );
    const snapshot = sanitizeSnapshot({
      host: { name: "h".repeat(400), A: many, TXT: ["t".repeat(1000)] },
      organization: {},
    });

    expect(snapshot.host.A).toHaveLength(MAX_DNS_VALUES_PER_TYPE);
    expect(snapshot.host.name).toHaveLength(255);
    expect(snapshot.host.TXT[0]).toHaveLength(512);
  });

  it("drops the long lists of an oversized snapshot but keeps the names", () => {
    const big = Array.from({ length: MAX_DNS_VALUES_PER_TYPE }, () => "v".repeat(512));
    const snapshot = sanitizeSnapshot({
      host: { name: "www.example.com", A: big, AAAA: big, CNAME: big, NS: big, MX: big, TXT: big },
      organization: { name: "example.com", NS: big, MX: big },
    });

    expect(snapshot.host.name).toBe("www.example.com");
    expect(snapshot.host.A).toEqual([]);
    expect(snapshot.organization.name).toBe("example.com");
  });

  it("caps changes per entry and values per change", () => {
    const changes = Array.from({ length: MAX_DNS_CHANGES_PER_ENTRY + 4 }, () => ({
      scope: "host",
      type: "A",
      added: Array.from({ length: MAX_DNS_CHANGE_VALUES + 5 }, (_, index) => `v${index}`),
      removed: [],
    }));

    const result = sanitizeChanges(changes);

    expect(result).toHaveLength(MAX_DNS_CHANGES_PER_ENTRY);
    expect(result[0]?.added).toHaveLength(MAX_DNS_CHANGE_VALUES);
  });
});
