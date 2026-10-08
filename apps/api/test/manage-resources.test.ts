import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { SESSION_COOKIE_NAME } from "../src/infrastructure/session/session.constants.js";
import type { SessionStore } from "../src/infrastructure/session/session-store.js";
import { resetDatabase } from "./helpers/database.js";

class FakeSessionStore implements SessionStore {
  private readonly sessions = new Map<string, string>();
  private sequence = 0;

  async create(userId: string): Promise<string> {
    this.sequence += 1;
    const token = `manage-test-session-${this.sequence}`;
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
    this.sequence = 0;
  }
}

const UNKNOWN_ID = "20000000-0000-4000-8000-000000000999";

describe("Rename and delete workspaces and projects", () => {
  const sessionStore = new FakeSessionStore();
  let app: FastifyInstance;

  let owner: { id: string; cookie: string };
  let admin: { id: string; cookie: string };
  let member: { id: string; cookie: string };
  let stranger: { id: string; cookie: string };
  let workspaceId: string;
  let projectId: string;
  let otherProjectId: string;

  async function createUser(name: string) {
    const user = await prisma.user.create({
      data: { name, email: `${name.toLowerCase()}@example.com`, passwordHash: "x" },
    });
    const token = await sessionStore.create(user.id);
    return { id: user.id, cookie: `${SESSION_COOKIE_NAME}=${token}` };
  }

  async function seedProjectWithScan(name: string) {
    const project = await prisma.project.create({ data: { workspaceId, name } });
    const monitor = await prisma.monitor.create({
      data: { projectId: project.id, name: "m", targetUrl: `https://${name}.example.com` },
    });
    const scan = await prisma.scan.create({ data: { monitorId: monitor.id, status: "SUCCEEDED" } });
    await prisma.scanFinding.create({
      data: {
        scanId: scan.id,
        code: "HTTP_SERVER_ERROR",
        title: "Server error",
        severity: "HIGH",
        description: "d",
      },
    });
    return project.id;
  }

  const counts = async () => ({
    workspaces: await prisma.workspace.count(),
    members: await prisma.workspaceMember.count(),
    projects: await prisma.project.count(),
    monitors: await prisma.monitor.count(),
    scans: await prisma.scan.count(),
    findings: await prisma.scanFinding.count(),
  });

  beforeAll(async () => {
    app = buildApp({ sessionStore });
    await app.ready();
  });

  beforeEach(async () => {
    sessionStore.reset();
    await resetDatabase();
    owner = await createUser("Owner");
    admin = await createUser("Admin");
    member = await createUser("Member");
    stranger = await createUser("Stranger");
    const workspace = await prisma.workspace.create({ data: { name: "Platform" } });
    workspaceId = workspace.id;
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId, userId: owner.id, role: "OWNER" },
        { workspaceId, userId: admin.id, role: "ADMIN" },
        { workspaceId, userId: member.id, role: "MEMBER" },
      ],
    });
    projectId = await seedProjectWithScan("core");
    otherProjectId = await seedProjectWithScan("docs");
  });

  afterAll(async () => {
    await resetDatabase();
    await app.close();
  });

  const call = (
    method: "PATCH" | "DELETE",
    url: string,
    cookie?: string,
    payload?: Record<string, unknown>,
  ) => app.inject({ method, url, payload, headers: cookie ? { cookie } : {} });

  describe("PATCH /api/workspaces/:workspaceId", () => {
    it.each([
      ["owner", () => owner, "OWNER"],
      ["admin", () => admin, "ADMIN"],
    ])("lets the %s rename the workspace", async (_label, who, role) => {
      const response = await call("PATCH", `/api/workspaces/${workspaceId}`, who().cookie, {
        name: "  Renamed  ",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: workspaceId, name: "Renamed", role });
      expect((await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).name).toBe(
        "Renamed",
      );
    });

    it("rejects a member, hides the workspace from strangers and requires a session", async () => {
      const body = { name: "Nope" };
      const asMember = await call("PATCH", `/api/workspaces/${workspaceId}`, member.cookie, body);
      expect(asMember.statusCode).toBe(403);
      const asStranger = await call(
        "PATCH",
        `/api/workspaces/${workspaceId}`,
        stranger.cookie,
        body,
      );
      expect(asStranger.statusCode).toBe(404);
      const anonymous = await call("PATCH", `/api/workspaces/${workspaceId}`, undefined, body);
      expect(anonymous.statusCode).toBe(401);
      expect((await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).name).toBe(
        "Platform",
      );
    });

    it("validates the name", async () => {
      for (const name of ["", "   ", "x".repeat(121)]) {
        const response = await call("PATCH", `/api/workspaces/${workspaceId}`, owner.cookie, {
          name,
        });
        expect(response.statusCode).toBe(400);
      }
    });
  });

  describe("DELETE /api/workspaces/:workspaceId", () => {
    it("lets only the owner delete, and removes everything inside", async () => {
      const asAdmin = await call("DELETE", `/api/workspaces/${workspaceId}`, admin.cookie);
      expect(asAdmin.statusCode).toBe(403);
      const asMember = await call("DELETE", `/api/workspaces/${workspaceId}`, member.cookie);
      expect(asMember.statusCode).toBe(403);
      const asStranger = await call("DELETE", `/api/workspaces/${workspaceId}`, stranger.cookie);
      expect(asStranger.statusCode).toBe(404);
      const anonymous = await call("DELETE", `/api/workspaces/${workspaceId}`);
      expect(anonymous.statusCode).toBe(401);
      expect((await counts()).workspaces).toBe(1);

      const response = await call("DELETE", `/api/workspaces/${workspaceId}`, owner.cookie);
      expect(response.statusCode).toBe(204);
      expect(await counts()).toEqual({
        workspaces: 0,
        members: 0,
        projects: 0,
        monitors: 0,
        scans: 0,
        findings: 0,
      });
      expect(await prisma.user.count()).toBe(4);
    });

    it("answers 404 for a workspace that no longer exists", async () => {
      await call("DELETE", `/api/workspaces/${workspaceId}`, owner.cookie);
      const again = await call("DELETE", `/api/workspaces/${workspaceId}`, owner.cookie);
      expect(again.statusCode).toBe(404);
    });
  });

  describe("PATCH /api/projects/:projectId", () => {
    it("lets an admin rename and change the description", async () => {
      const response = await call("PATCH", `/api/projects/${projectId}`, admin.cookie, {
        name: "Core API v2",
        description: "New text",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: projectId,
        workspaceId,
        name: "Core API v2",
        description: "New text",
      });
    });

    it("changes only what is sent and clears the description with an empty string", async () => {
      await call("PATCH", `/api/projects/${projectId}`, owner.cookie, { description: "Keep me" });
      const renamed = await call("PATCH", `/api/projects/${projectId}`, owner.cookie, {
        name: "Only name",
      });
      expect(renamed.json()).toMatchObject({ name: "Only name", description: "Keep me" });

      const cleared = await call("PATCH", `/api/projects/${projectId}`, owner.cookie, {
        description: "",
      });
      expect(cleared.statusCode).toBe(200);
      expect(cleared.json()).toMatchObject({ name: "Only name", description: null });
    });

    it("validates the body", async () => {
      for (const payload of [
        {},
        { name: "" },
        { name: "x".repeat(121) },
        { description: "d".repeat(501) },
      ]) {
        const response = await call("PATCH", `/api/projects/${projectId}`, owner.cookie, payload);
        expect(response.statusCode).toBe(400);
      }
    });

    it("rejects a member, hides the project from strangers and unknown ids", async () => {
      const body = { name: "Nope" };
      expect(
        (await call("PATCH", `/api/projects/${projectId}`, member.cookie, body)).statusCode,
      ).toBe(403);
      expect(
        (await call("PATCH", `/api/projects/${projectId}`, stranger.cookie, body)).statusCode,
      ).toBe(404);
      expect(
        (await call("PATCH", `/api/projects/${UNKNOWN_ID}`, owner.cookie, body)).statusCode,
      ).toBe(404);
      expect((await call("PATCH", `/api/projects/not-a-uuid`, owner.cookie, body)).statusCode).toBe(
        400,
      );
      expect((await call("PATCH", `/api/projects/${projectId}`, undefined, body)).statusCode).toBe(
        401,
      );
    });
  });

  describe("DELETE /api/projects/:projectId", () => {
    it("lets an admin delete the project with its monitors, scans and findings only", async () => {
      const response = await call("DELETE", `/api/projects/${projectId}`, admin.cookie);
      expect(response.statusCode).toBe(204);
      expect(await prisma.project.findUnique({ where: { id: projectId } })).toBeNull();
      expect(await prisma.project.findUnique({ where: { id: otherProjectId } })).not.toBeNull();
      expect(await counts()).toMatchObject({
        workspaces: 1,
        members: 3,
        projects: 1,
        monitors: 1,
        scans: 1,
        findings: 1,
      });
    });

    it("rejects a member, hides the project from strangers and unknown ids", async () => {
      expect((await call("DELETE", `/api/projects/${projectId}`, member.cookie)).statusCode).toBe(
        403,
      );
      expect((await call("DELETE", `/api/projects/${projectId}`, stranger.cookie)).statusCode).toBe(
        404,
      );
      expect((await call("DELETE", `/api/projects/${UNKNOWN_ID}`, owner.cookie)).statusCode).toBe(
        404,
      );
      expect((await call("DELETE", `/api/projects/${projectId}`)).statusCode).toBe(401);
      expect((await counts()).projects).toBe(2);
    });
  });
});
