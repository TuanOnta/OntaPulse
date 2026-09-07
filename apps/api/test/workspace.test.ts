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
    const token = `workspace-test-session-${this.sequence}`;

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

function createUser(name: string, email: string) {
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash: "test-password-hash",
    },
  });
}

async function createWorkspace(ownerId: string, name: string) {
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: { name },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: ownerId,
        role: "OWNER",
      },
    });

    return workspace;
  });
}

function addWorkspaceMember(workspaceId: string, userId: string, role: "ADMIN" | "MEMBER") {
  return prisma.workspaceMember.create({
    data: {
      workspaceId,
      userId,
      role,
    },
  });
}

async function createAuthenticatedCookie(
  sessionStore: FakeSessionStore,
  userId: string,
): Promise<string> {
  const token = await sessionStore.create(userId);

  return `${SESSION_COOKIE_NAME}=${token}`;
}

describe("Workspace API", () => {
  const sessionStore = new FakeSessionStore();
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ sessionStore });
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

  describe("authentication", () => {
    it("rejects listing workspaces without authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/workspaces",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        statusCode: 401,
        code: "UNAUTHENTICATED",
      });
    });

    it("rejects creating a workspace without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/workspaces",
        payload: {
          name: "Unauthorized Workspace",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        statusCode: 401,
        code: "UNAUTHENTICATED",
      });

      expect(await prisma.workspace.count()).toBe(0);
    });
  });

  describe("POST /api/workspaces", () => {
    it("creates a workspace and assigns the authenticated user as OWNER", async () => {
      const user = await createUser("Dzaki", "dzaki@example.com");
      const cookie = await createAuthenticatedCookie(sessionStore, user.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/workspaces",
        headers: { cookie },
        payload: {
          name: "OntaPulse Team",
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body).toMatchObject({
        name: "OntaPulse Team",
        role: "OWNER",
      });

      expect(body.id).toEqual(expect.any(String));
      expect(body.joinedAt).toEqual(expect.any(String));
      expect(body.createdAt).toEqual(expect.any(String));
      expect(body.updatedAt).toEqual(expect.any(String));

      const workspace = await prisma.workspace.findUnique({
        where: { id: body.id },
      });

      expect(workspace).not.toBeNull();
      expect(workspace!.name).toBe("OntaPulse Team");

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: body.id,
            userId: user.id,
          },
        },
      });

      expect(membership).not.toBeNull();
      expect(membership!.role).toBe("OWNER");

      const ownerCount = await prisma.workspaceMember.count({
        where: {
          workspaceId: body.id,
          role: "OWNER",
        },
      });

      expect(ownerCount).toBe(1);
    });

    it("trims the workspace name before saving", async () => {
      const user = await createUser("Dzaki", "dzaki@example.com");
      const cookie = await createAuthenticatedCookie(sessionStore, user.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/workspaces",
        headers: { cookie },
        payload: {
          name: "   OntaPulse Team   ",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        name: "OntaPulse Team",
        role: "OWNER",
      });
    });

    it.each([
      [{}],
      [{ name: "" }],
      [{ name: "   " }],
      [{ name: "a".repeat(121) }],
      [{ name: 123 }],
      [{ name: "Valid Workspace", unexpected: true }],
    ])("rejects invalid workspace input %#", async (payload) => {
      const user = await createUser("Dzaki", "dzaki@example.com");
      const cookie = await createAuthenticatedCookie(sessionStore, user.id);

      const response = await app.inject({
        method: "POST",
        url: "/api/workspaces",
        headers: { cookie },
        payload,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });

      expect(await prisma.workspace.count()).toBe(0);
    });
  });

  describe("GET /api/workspaces", () => {
    it("returns only workspaces belonging to the authenticated user", async () => {
      const user = await createUser("Dzaki", "dzaki@example.com");
      const otherUser = await createUser("Other User", "other@example.com");

      const ownedWorkspace = await createWorkspace(user.id, "Dzaki Workspace");
      await createWorkspace(otherUser.id, "Other Workspace");

      const cookie = await createAuthenticatedCookie(sessionStore, user.id);

      const response = await app.inject({
        method: "GET",
        url: "/api/workspaces",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        id: ownedWorkspace.id,
        name: "Dzaki Workspace",
        role: "OWNER",
      });

      expect(body[0].joinedAt).toEqual(expect.any(String));
      expect(body[0].createdAt).toEqual(expect.any(String));
      expect(body[0].updatedAt).toEqual(expect.any(String));
    });

    it("returns the authenticated user's role in each workspace", async () => {
      const owner = await createUser("Owner", "owner@example.com");
      const member = await createUser("Member", "member@example.com");
      const workspace = await createWorkspace(owner.id, "Shared Workspace");

      await addWorkspaceMember(workspace.id, member.id, "MEMBER");

      const cookie = await createAuthenticatedCookie(sessionStore, member.id);

      const response = await app.inject({
        method: "GET",
        url: "/api/workspaces",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        expect.objectContaining({
          id: workspace.id,
          name: "Shared Workspace",
          role: "MEMBER",
        }),
      ]);
    });

    it("returns an empty array when the user has no workspace memberships", async () => {
      const user = await createUser("No Workspace", "no-workspace@example.com");
      const cookie = await createAuthenticatedCookie(sessionStore, user.id);

      const response = await app.inject({
        method: "GET",
        url: "/api/workspaces",
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });
  });

  describe("Project workspace authorization", () => {
    it("allows an OWNER to create a project", async () => {
      const owner = await createUser("Owner", "owner@example.com");
      const workspace = await createWorkspace(owner.id, "Owner Workspace");
      const cookie = await createAuthenticatedCookie(sessionStore, owner.id);

      const response = await app.inject({
        method: "POST",
        url: `/api/workspaces/${workspace.id}/projects`,
        headers: { cookie },
        payload: {
          name: "Owner Project",
          description: "Created by the workspace owner",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        workspaceId: workspace.id,
        name: "Owner Project",
        description: "Created by the workspace owner",
      });

      const project = await prisma.project.findFirst({
        where: {
          workspaceId: workspace.id,
          name: "Owner Project",
        },
      });

      expect(project).not.toBeNull();
    });

    it("allows an ADMIN to create a project", async () => {
      const owner = await createUser("Owner", "owner@example.com");
      const admin = await createUser("Admin", "admin@example.com");
      const workspace = await createWorkspace(owner.id, "Admin Workspace");

      await addWorkspaceMember(workspace.id, admin.id, "ADMIN");

      const cookie = await createAuthenticatedCookie(sessionStore, admin.id);

      const response = await app.inject({
        method: "POST",
        url: `/api/workspaces/${workspace.id}/projects`,
        headers: { cookie },
        payload: {
          name: "Admin Project",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        workspaceId: workspace.id,
        name: "Admin Project",
      });
    });

    it("rejects project creation by a MEMBER", async () => {
      const owner = await createUser("Owner", "owner@example.com");
      const member = await createUser("Member", "member@example.com");
      const workspace = await createWorkspace(owner.id, "Member Workspace");

      await addWorkspaceMember(workspace.id, member.id, "MEMBER");

      const cookie = await createAuthenticatedCookie(sessionStore, member.id);

      const response = await app.inject({
        method: "POST",
        url: `/api/workspaces/${workspace.id}/projects`,
        headers: { cookie },
        payload: {
          name: "Forbidden Project",
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        statusCode: 403,
        code: "INSUFFICIENT_WORKSPACE_ROLE",
      });

      expect(await prisma.project.count()).toBe(0);
    });

    it("returns 404 when an outsider attempts to create a project", async () => {
      const owner = await createUser("Owner", "owner@example.com");
      const outsider = await createUser("Outsider", "outsider@example.com");
      const workspace = await createWorkspace(owner.id, "Private Workspace");
      const cookie = await createAuthenticatedCookie(sessionStore, outsider.id);

      const response = await app.inject({
        method: "POST",
        url: `/api/workspaces/${workspace.id}/projects`,
        headers: { cookie },
        payload: {
          name: "Unauthorized Project",
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        statusCode: 404,
        code: "WORKSPACE_NOT_FOUND",
      });

      expect(await prisma.project.count()).toBe(0);
    });

    it("allows a MEMBER to list projects in their workspace", async () => {
      const owner = await createUser("Owner", "owner@example.com");
      const member = await createUser("Member", "member@example.com");
      const workspace = await createWorkspace(owner.id, "Shared Workspace");

      await addWorkspaceMember(workspace.id, member.id, "MEMBER");

      const project = await prisma.project.create({
        data: {
          workspaceId: workspace.id,
          name: "Visible Project",
          description: "Visible to workspace members",
        },
      });

      const cookie = await createAuthenticatedCookie(sessionStore, member.id);

      const response = await app.inject({
        method: "GET",
        url: `/api/workspaces/${workspace.id}/projects`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([
        expect.objectContaining({
          id: project.id,
          workspaceId: workspace.id,
          name: "Visible Project",
        }),
      ]);
    });

    it("does not allow a user to list projects from another workspace", async () => {
      const firstOwner = await createUser("First Owner", "first-owner@example.com");
      const secondOwner = await createUser("Second Owner", "second-owner@example.com");

      const firstWorkspace = await createWorkspace(firstOwner.id, "First Workspace");
      const secondWorkspace = await createWorkspace(secondOwner.id, "Second Workspace");

      await prisma.project.create({
        data: {
          workspaceId: firstWorkspace.id,
          name: "First Project",
        },
      });

      await prisma.project.create({
        data: {
          workspaceId: secondWorkspace.id,
          name: "Secret Project",
        },
      });

      const cookie = await createAuthenticatedCookie(sessionStore, firstOwner.id);

      const ownResponse = await app.inject({
        method: "GET",
        url: `/api/workspaces/${firstWorkspace.id}/projects`,
        headers: { cookie },
      });

      expect(ownResponse.statusCode).toBe(200);
      expect(ownResponse.json()).toHaveLength(1);
      expect(ownResponse.json()[0]).toMatchObject({
        workspaceId: firstWorkspace.id,
        name: "First Project",
      });

      const otherResponse = await app.inject({
        method: "GET",
        url: `/api/workspaces/${secondWorkspace.id}/projects`,
        headers: { cookie },
      });

      expect(otherResponse.statusCode).toBe(404);
      expect(otherResponse.json()).toMatchObject({
        statusCode: 404,
        code: "WORKSPACE_NOT_FOUND",
      });
    });

    it("rejects project routes without authentication", async () => {
      const owner = await createUser("Owner", "owner@example.com");
      const workspace = await createWorkspace(owner.id, "Protected Workspace");

      const listResponse = await app.inject({
        method: "GET",
        url: `/api/workspaces/${workspace.id}/projects`,
      });

      const createResponse = await app.inject({
        method: "POST",
        url: `/api/workspaces/${workspace.id}/projects`,
        payload: {
          name: "Unauthenticated Project",
        },
      });

      expect(listResponse.statusCode).toBe(401);
      expect(listResponse.json()).toMatchObject({
        code: "UNAUTHENTICATED",
      });

      expect(createResponse.statusCode).toBe(401);
      expect(createResponse.json()).toMatchObject({
        code: "UNAUTHENTICATED",
      });
    });
  });
});
