import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import type { ScanJob, ScanQueue } from "../src/infrastructure/queue/scan-queue.js";
import type { SessionStore } from "../src/infrastructure/session/session-store.js";
import {
  MAX_EDGE_DETECTIONS,
  MAX_EDGE_SIGNALS_PER_DETECTION,
} from "../src/modules/edge-profile/edge-profile.constants.js";
import { sanitizeDetections } from "../src/modules/edge-profile/edge-profile.service.js";
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

const CLOUDFLARE_DETECTION = {
  vendor: "CLOUDFLARE",
  layer: "CDN",
  confidence: "HIGH",
  signals: [
    { type: "HEADER_NAME", name: "cf-ray" },
    { type: "HEADER_NAME", name: "cf-cache-status" },
  ],
};

async function createFixture() {
  const [owner, admin, member, outsider] = await Promise.all(
    [
      ["Owner", "owner-edge@example.com"],
      ["Admin", "admin-edge@example.com"],
      ["Member", "member-edge@example.com"],
      ["Outsider", "outsider-edge@example.com"],
    ].map(([name, email]) =>
      prisma.user.create({ data: { name, email, passwordHash: "not-used-by-edge-tests" } }),
    ),
  );
  const [workspace, outsiderWorkspace] = await Promise.all([
    prisma.workspace.create({ data: { name: "Edge Workspace" } }),
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
    data: { workspaceId: workspace.id, name: "Edge Project" },
  });
  const monitor = await prisma.monitor.create({
    data: { projectId: project.id, name: "Main", targetUrl: "https://example.com" },
  });

  return {
    ownerCookie: sessionStore.add(owner.id),
    adminCookie: sessionStore.add(admin.id),
    memberCookie: sessionStore.add(member.id),
    outsiderCookie: sessionStore.add(outsider.id),
    monitorId: monitor.id,
  };
}

async function storeProfile(monitorId: string, detections: unknown, challengeObserved = false) {
  const scan = await prisma.scan.create({
    data: { monitorId, kind: "SECURITY_POSTURE", status: "SUCCEEDED" },
  });

  await prisma.monitorEdgeProfile.create({
    data: {
      monitorId,
      scanId: scan.id,
      challengeObserved,
      detections: detections as never,
      observedAt: new Date("2026-10-20T10:00:00.000Z"),
    },
  });

  return scan.id;
}

function read(monitorId: string, cookie?: string) {
  return app.inject({
    method: "GET",
    url: `/api/monitors/${monitorId}/edge-profile`,
    headers: cookie ? { cookie } : {},
  });
}

describe("edge profile API", () => {
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

  it.each(["ownerCookie", "adminCookie", "memberCookie"] as const)(
    "lets the %s read the profile",
    async (role) => {
      const fixture = await createFixture();
      const scanId = await storeProfile(fixture.monitorId, [CLOUDFLARE_DETECTION], true);

      const response = await read(fixture.monitorId, fixture[role]);

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        monitorId: fixture.monitorId,
        scanId,
        challengeObserved: true,
        observedAt: "2026-10-20T10:00:00.000Z",
        detections: [CLOUDFLARE_DETECTION],
      });
    },
  );

  it("returns an empty detection list as a result", async () => {
    const fixture = await createFixture();
    await storeProfile(fixture.monitorId, []);

    const response = await read(fixture.monitorId, fixture.memberCookie);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ detections: [], challengeObserved: false });
  });

  it("returns 404 NO_EDGE_PROFILE before the first posture scan", async () => {
    const fixture = await createFixture();

    const response = await read(fixture.monitorId, fixture.ownerCookie);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "NO_EDGE_PROFILE" });
  });

  it("returns 404 MONITOR_NOT_FOUND to a user outside the workspace", async () => {
    const fixture = await createFixture();
    await storeProfile(fixture.monitorId, [CLOUDFLARE_DETECTION]);

    const response = await read(fixture.monitorId, fixture.outsiderCookie);

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "MONITOR_NOT_FOUND" });
  });

  it("returns 404 for an unknown monitor, 400 for a bad id, and 401 without a session", async () => {
    const fixture = await createFixture();

    const unknown = await read(NON_EXISTENT_ID, fixture.ownerCookie);
    const invalid = await read("not-a-uuid", fixture.ownerCookie);
    const anonymous = await read(fixture.monitorId);

    expect(unknown.statusCode).toBe(404);
    expect(unknown.json()).toMatchObject({ code: "MONITOR_NOT_FOUND" });
    expect(invalid.statusCode).toBe(400);
    expect(anonymous.statusCode).toBe(401);
  });

  it("passes through no unknown vendor, unknown field, or extra signal", async () => {
    const fixture = await createFixture();
    await storeProfile(fixture.monitorId, [
      { ...CLOUDFLARE_DETECTION, secret: "cookie-value" },
      { vendor: "NOT_A_VENDOR", layer: "CDN", confidence: "HIGH", signals: [] },
    ]);

    const response = await read(fixture.monitorId, fixture.memberCookie);

    expect(response.json().detections).toEqual([CLOUDFLARE_DETECTION]);
  });

  it("does not change after a monitor without a profile is read twice (read only)", async () => {
    const fixture = await createFixture();

    await read(fixture.monitorId, fixture.ownerCookie);
    await read(fixture.monitorId, fixture.ownerCookie);

    await expect(prisma.monitorEdgeProfile.count()).resolves.toBe(0);
  });

  it("removes the profile together with its monitor", async () => {
    const fixture = await createFixture();
    await storeProfile(fixture.monitorId, [CLOUDFLARE_DETECTION]);

    await prisma.monitor.delete({ where: { id: fixture.monitorId } });

    await expect(prisma.monitorEdgeProfile.count()).resolves.toBe(0);
  });
});

describe("sanitizeDetections", () => {
  it("returns an empty list for a value that is not a list", () => {
    expect(sanitizeDetections(null)).toEqual([]);
    expect(sanitizeDetections({ vendor: "CLOUDFLARE" })).toEqual([]);
    expect(sanitizeDetections("text")).toEqual([]);
  });

  it("drops items and signals that do not match the stored shape", () => {
    const result = sanitizeDetections([
      null,
      "x",
      { vendor: "VERCEL", layer: "NOPE", confidence: "LOW", signals: [] },
      { vendor: "VERCEL", layer: "CDN", confidence: "LOW", signals: "none" },
      {
        vendor: "VERCEL",
        layer: "CDN",
        confidence: "LOW",
        signals: [null, { type: "OTHER", name: "x" }, { type: "HEADER_NAME", name: 5 }],
      },
    ]);

    expect(result).toEqual([{ vendor: "VERCEL", layer: "CDN", confidence: "LOW", signals: [] }]);
  });

  it("caps detections, signals per detection, and the signal name length", () => {
    const signals = Array.from({ length: MAX_EDGE_SIGNALS_PER_DETECTION + 3 }, () => ({
      type: "HEADER_NAME",
      name: "h".repeat(500),
    }));
    const many = Array.from({ length: MAX_EDGE_DETECTIONS + 4 }, () => ({
      vendor: "FASTLY",
      layer: "CDN",
      confidence: "MEDIUM",
      signals: signals.slice(0, 1),
    }));

    const capped = sanitizeDetections(many);
    const [first] = sanitizeDetections([
      { vendor: "FASTLY", layer: "CDN", confidence: "MEDIUM", signals },
    ]);

    expect(capped.length).toBeLessThanOrEqual(MAX_EDGE_DETECTIONS);
    expect(first?.signals).toHaveLength(MAX_EDGE_SIGNALS_PER_DETECTION);
    expect(first?.signals[0]?.name).toHaveLength(100);
  });
});
