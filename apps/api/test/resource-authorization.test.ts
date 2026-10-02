import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import type { ScanJob, ScanQueue } from "../src/infrastructure/queue/scan-queue.js";
import type { SessionStore } from "../src/infrastructure/session/session-store.js";
import { resetDatabase } from "./helpers/database.js";

const SESSION_COOKIE_NAME = "ontapulse_session";

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

class RecordingScanQueue implements ScanQueue {
  readonly jobs: ScanJob[] = [];

  async enqueue(job: ScanJob): Promise<void> {
    this.jobs.push(job);
  }

  async close(): Promise<void> {}

  reset(): void {
    this.jobs.length = 0;
  }
}

interface AuthorizationFixture {
  adminCookie: string;
  memberCookie: string;
  outsiderCookie: string;
  projectId: string;
  monitorId: string;
  scanId: string;
}

const sessionStore = new TestSessionStore();
const scanQueue = new RecordingScanQueue();
let app: FastifyInstance;

async function createFixture(): Promise<AuthorizationFixture> {
  const [owner, admin, member, outsider] = await Promise.all(
    [
      ["Owner", "owner-authz@example.com"],
      ["Admin", "admin-authz@example.com"],
      ["Member", "member-authz@example.com"],
      ["Outsider", "outsider-authz@example.com"],
    ].map(([name, email]) =>
      prisma.user.create({
        data: { name, email, passwordHash: "not-used-by-authorization-tests" },
      }),
    ),
  );

  const [workspace, outsiderWorkspace] = await Promise.all([
    prisma.workspace.create({ data: { name: "Protected Workspace" } }),
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
    data: { workspaceId: workspace.id, name: "Protected Project" },
  });
  const monitor = await prisma.monitor.create({
    data: { projectId: project.id, name: "Protected Monitor", targetUrl: "https://example.com" },
  });
  const scan = await prisma.scan.create({ data: { monitorId: monitor.id } });

  return {
    adminCookie: sessionStore.add(admin.id),
    memberCookie: sessionStore.add(member.id),
    outsiderCookie: sessionStore.add(outsider.id),
    projectId: project.id,
    monitorId: monitor.id,
    scanId: scan.id,
  };
}

describe("resource authorization", () => {
  beforeAll(async () => {
    app = buildApp({ sessionStore, scanQueue });
    await app.ready();
  });

  beforeEach(async () => {
    sessionStore.reset();
    scanQueue.reset();
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await app.close();
  });

  it("allows an ADMIN to create monitors and trigger scans", async () => {
    const fixture = await createFixture();
    const monitorResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${fixture.projectId}/monitors`,
      headers: { cookie: fixture.adminCookie },
      payload: { name: "Admin Monitor", targetUrl: "https://admin.example.com" },
    });
    const scanResponse = await app.inject({
      method: "POST",
      url: `/api/monitors/${fixture.monitorId}/scans`,
      headers: { cookie: fixture.adminCookie },
    });

    expect(monitorResponse.statusCode).toBe(201);
    expect(scanResponse.statusCode).toBe(202);
    await expect(
      prisma.scanOutboxEvent.findUnique({ where: { scanId: scanResponse.json().id as string } }),
    ).resolves.toMatchObject({ monitorId: fixture.monitorId, status: "PENDING" });
  });

  it("rejects monitor and scan writes by a MEMBER", async () => {
    const fixture = await createFixture();
    const monitorCount = await prisma.monitor.count();
    const scanCount = await prisma.scan.count();
    const monitorResponse = await app.inject({
      method: "POST",
      url: `/api/projects/${fixture.projectId}/monitors`,
      headers: { cookie: fixture.memberCookie },
      payload: { name: "Member Monitor", targetUrl: "https://member.example.com" },
    });
    const scanResponse = await app.inject({
      method: "POST",
      url: `/api/monitors/${fixture.monitorId}/scans`,
      headers: { cookie: fixture.memberCookie },
    });

    expect(monitorResponse.statusCode).toBe(403);
    expect(monitorResponse.json()).toMatchObject({ code: "INSUFFICIENT_WORKSPACE_ROLE" });
    expect(scanResponse.statusCode).toBe(403);
    expect(scanResponse.json()).toMatchObject({ code: "INSUFFICIENT_WORKSPACE_ROLE" });
    expect(await prisma.monitor.count()).toBe(monitorCount);
    expect(await prisma.scan.count()).toBe(scanCount);
    expect(scanQueue.jobs).toHaveLength(0);
  });

  it("allows a MEMBER to read monitors and scans in their workspace", async () => {
    const fixture = await createFixture();
    const monitorsResponse = await app.inject({
      method: "GET",
      url: `/api/projects/${fixture.projectId}/monitors`,
      headers: { cookie: fixture.memberCookie },
    });
    const scansResponse = await app.inject({
      method: "GET",
      url: `/api/monitors/${fixture.monitorId}/scans`,
      headers: { cookie: fixture.memberCookie },
    });
    const scanResponse = await app.inject({
      method: "GET",
      url: `/api/scans/${fixture.scanId}`,
      headers: { cookie: fixture.memberCookie },
    });

    expect(monitorsResponse.statusCode).toBe(200);
    expect(scansResponse.statusCode).toBe(200);
    expect(scanResponse.statusCode).toBe(200);
  });

  it("hides monitor and scan resources from workspace outsiders", async () => {
    const fixture = await createFixture();
    const monitorCount = await prisma.monitor.count();
    const scanCount = await prisma.scan.count();
    const responses = await Promise.all(
      [
        {
          response: app.inject({
            method: "POST",
            url: `/api/projects/${fixture.projectId}/monitors`,
            headers: { cookie: fixture.outsiderCookie },
            payload: { name: "Outsider Monitor", targetUrl: "https://outsider.example.com" },
          }),
          code: "PROJECT_NOT_FOUND",
        },
        {
          response: app.inject({
            method: "GET",
            url: `/api/projects/${fixture.projectId}/monitors`,
            headers: { cookie: fixture.outsiderCookie },
          }),
          code: "PROJECT_NOT_FOUND",
        },
        {
          response: app.inject({
            method: "POST",
            url: `/api/monitors/${fixture.monitorId}/scans`,
            headers: { cookie: fixture.outsiderCookie },
          }),
          code: "MONITOR_NOT_FOUND",
        },
        {
          response: app.inject({
            method: "GET",
            url: `/api/monitors/${fixture.monitorId}/scans`,
            headers: { cookie: fixture.outsiderCookie },
          }),
          code: "MONITOR_NOT_FOUND",
        },
        {
          response: app.inject({
            method: "GET",
            url: `/api/scans/${fixture.scanId}`,
            headers: { cookie: fixture.outsiderCookie },
          }),
          code: "SCAN_NOT_FOUND",
        },
      ].map(async ({ response, code }) => ({ response: await response, code })),
    );

    for (const { response, code } of responses) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code });
    }
    expect(await prisma.monitor.count()).toBe(monitorCount);
    expect(await prisma.scan.count()).toBe(scanCount);
    expect(scanQueue.jobs).toHaveLength(0);
  });

  it("rejects every monitor and scan route without a session", async () => {
    const fixture = await createFixture();
    const monitorCount = await prisma.monitor.count();
    const scanCount = await prisma.scan.count();
    const responses = await Promise.all([
      app.inject({
        method: "POST",
        url: `/api/projects/${fixture.projectId}/monitors`,
        payload: { name: "Anonymous Monitor", targetUrl: "https://anonymous.example.com" },
      }),
      app.inject({
        method: "GET",
        url: `/api/projects/${fixture.projectId}/monitors`,
      }),
      app.inject({
        method: "POST",
        url: `/api/monitors/${fixture.monitorId}/scans`,
      }),
      app.inject({
        method: "GET",
        url: `/api/monitors/${fixture.monitorId}/scans`,
      }),
      app.inject({
        method: "GET",
        url: `/api/scans/${fixture.scanId}`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
    }
    expect(await prisma.monitor.count()).toBe(monitorCount);
    expect(await prisma.scan.count()).toBe(scanCount);
    expect(scanQueue.jobs).toHaveLength(0);
  });
});
