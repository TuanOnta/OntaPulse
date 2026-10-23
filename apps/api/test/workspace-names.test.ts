import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { SESSION_COOKIE_NAME } from "../src/infrastructure/session/session.constants.js";
import type { SessionStore } from "../src/infrastructure/session/session-store.js";
import { workspaceNameKey } from "../src/modules/workspaces/workspace-name.js";
import { resetDatabase } from "./helpers/database.js";

class FakeSessionStore implements SessionStore {
  private readonly sessions = new Map<string, string>();
  private sequence = 0;

  async create(userId: string): Promise<string> {
    this.sequence += 1;
    const token = `workspace-name-session-${this.sequence}`;
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

const TAKEN = {
  statusCode: 409,
  code: "WORKSPACE_NAME_TAKEN",
  message: "You already have a workspace with this name.",
};

describe("Workspace names", () => {
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

  async function user(name: string, email: string) {
    const created = await prisma.user.create({
      data: { name, email, passwordHash: "test-password-hash" },
    });
    const token = await sessionStore.create(created.id);

    return { id: created.id, cookie: `${SESSION_COOKIE_NAME}=${token}` };
  }

  /** A workspace written directly, the way the API stores it: owner and name key set. */
  async function workspaceOf(ownerId: string, name: string) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name, ownerId, nameKey: workspaceNameKey(name) },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: ownerId, role: "OWNER" },
      });
      return workspace;
    });
  }

  const post = (cookie: string, name: string) =>
    app.inject({ method: "POST", url: "/api/workspaces", headers: { cookie }, payload: { name } });
  const rename = (cookie: string, workspaceId: string, name: string) =>
    app.inject({
      method: "PATCH",
      url: `/api/workspaces/${workspaceId}`,
      headers: { cookie },
      payload: { name },
    });

  describe("workspaceNameKey", () => {
    it("ignores case, surrounding spaces, and Unicode compatibility forms", () => {
      expect(workspaceNameKey("  ACME Platform ")).toBe("acme platform");
      expect(workspaceNameKey("ＡＣＭＥ")).toBe("acme");
    });
  });

  describe("create", () => {
    it.each(["Acme", "acme", "  ACME  ", "aCmE"])(
      "rejects %j when the owner already has Acme",
      async (name) => {
        const owner = await user("Owner", "owner@example.com");
        expect((await post(owner.cookie, "Acme")).statusCode).toBe(201);

        const response = await post(owner.cookie, name);

        expect(response.statusCode).toBe(409);
        expect(response.json()).toMatchObject(TAKEN);
        await expect(prisma.workspace.count()).resolves.toBe(1);
      },
    );

    it("lets two different users own a workspace with the same name", async () => {
      const first = await user("First", "first@example.com");
      const second = await user("Second", "second@example.com");

      expect((await post(first.cookie, "Acme")).statusCode).toBe(201);
      expect((await post(second.cookie, "Acme")).statusCode).toBe(201);
    });

    it("does not count a workspace the user was only invited to", async () => {
      const first = await user("First", "first@example.com");
      const second = await user("Second", "second@example.com");
      const theirs = await workspaceOf(first.id, "Acme");
      await prisma.workspaceMember.create({
        data: { workspaceId: theirs.id, userId: second.id, role: "MEMBER" },
      });

      expect((await post(second.cookie, "Acme")).statusCode).toBe(201);
    });

    it("creates exactly one workspace when requests with the same name race", async () => {
      const owner = await user("Owner", "owner@example.com");

      const responses = await Promise.all([
        post(owner.cookie, "Race"),
        post(owner.cookie, "race"),
        post(owner.cookie, "RACE "),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409, 409]);
      await expect(prisma.workspace.count()).resolves.toBe(1);
      await expect(prisma.workspaceMember.count()).resolves.toBe(1);
    });

    it("frees the name when the workspace is deleted", async () => {
      const owner = await user("Owner", "owner@example.com");
      const created = await post(owner.cookie, "Temporary");
      await app.inject({
        method: "DELETE",
        url: `/api/workspaces/${created.json().id}`,
        headers: { cookie: owner.cookie },
      });

      expect((await post(owner.cookie, "Temporary")).statusCode).toBe(201);
    });

    it("does not expose the owner or the name key", async () => {
      const owner = await user("Owner", "owner@example.com");

      const created = (await post(owner.cookie, "Hidden")).json();
      const listed = (
        await app.inject({
          method: "GET",
          url: "/api/workspaces",
          headers: { cookie: owner.cookie },
        })
      ).json();

      for (const item of [created, listed[0]]) {
        expect(item).not.toHaveProperty("nameKey");
        expect(item).not.toHaveProperty("ownerId");
      }
    });

    it("gives a registered user a first workspace that takes part in the rule", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Dana", email: "dana@example.com", password: "a-long-test-password-1" },
      });

      expect(response.statusCode).toBe(201);
      const cookie = String(response.headers["set-cookie"]).split(";")[0]!;
      expect((await post(cookie, "DANA'S WORKSPACE")).statusCode).toBe(409);
    });
  });

  describe("rename", () => {
    it("rejects a name another workspace of the owner has, in any case", async () => {
      const owner = await user("Owner", "owner@example.com");
      await workspaceOf(owner.id, "Acme");
      const other = await workspaceOf(owner.id, "Other");

      const response = await rename(owner.cookie, other.id, " ACME ");

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject(TAKEN);
      await expect(
        prisma.workspace.findUniqueOrThrow({ where: { id: other.id } }),
      ).resolves.toMatchObject({ name: "Other" });
    });

    it("allows renaming to its own name, and changing only the case", async () => {
      const owner = await user("Owner", "owner@example.com");
      const workspace = await workspaceOf(owner.id, "Acme");

      expect((await rename(owner.cookie, workspace.id, "Acme")).statusCode).toBe(200);
      const changed = await rename(owner.cookie, workspace.id, "ACME");

      expect(changed.statusCode).toBe(200);
      expect(changed.json().name).toBe("ACME");
      expect((await post(owner.cookie, "acme")).statusCode).toBe(409);
    });

    it("frees the old name", async () => {
      const owner = await user("Owner", "owner@example.com");
      const workspace = await workspaceOf(owner.id, "Old");
      await rename(owner.cookie, workspace.id, "New");

      expect((await post(owner.cookie, "Old")).statusCode).toBe(201);
    });

    it("checks an admin's rename against the owner's workspaces", async () => {
      const owner = await user("Owner", "owner@example.com");
      const admin = await user("Admin", "admin@example.com");
      await workspaceOf(owner.id, "Acme");
      const shared = await workspaceOf(owner.id, "Shared");
      await prisma.workspaceMember.create({
        data: { workspaceId: shared.id, userId: admin.id, role: "ADMIN" },
      });

      const clash = await rename(admin.cookie, shared.id, "acme");
      const free = await rename(admin.cookie, shared.id, "Renamed by admin");

      expect(clash.statusCode).toBe(409);
      expect(clash.json()).toMatchObject(TAKEN);
      expect(free.statusCode).toBe(200);
    });

    it("keeps the role and isolation rules", async () => {
      const owner = await user("Owner", "owner@example.com");
      const member = await user("Member", "member@example.com");
      const outsider = await user("Outsider", "outsider@example.com");
      const workspace = await workspaceOf(owner.id, "Acme");
      await prisma.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: member.id, role: "MEMBER" },
      });

      expect((await rename(member.cookie, workspace.id, "Other")).statusCode).toBe(403);
      expect((await rename(outsider.cookie, workspace.id, "Other")).statusCode).toBe(404);
    });
  });

  describe("workspaces from before the rule", () => {
    it("leaves a duplicate without a key listed, renameable, and out of the way of the rule", async () => {
      const owner = await user("Owner", "owner@example.com");
      const older = await workspaceOf(owner.id, "Legacy");
      // A newer row of a legacy duplicate: same name, owner known, no name key.
      const newer = await prisma.workspace.create({
        data: { name: "Legacy", ownerId: owner.id },
      });
      await prisma.workspaceMember.create({
        data: { workspaceId: newer.id, userId: owner.id, role: "OWNER" },
      });

      const listed = await app.inject({
        method: "GET",
        url: "/api/workspaces",
        headers: { cookie: owner.cookie },
      });

      expect(listed.json().map((item: { id: string }) => item.id)).toEqual(
        expect.arrayContaining([older.id, newer.id]),
      );
      // The oldest of the group is the constrained one.
      expect((await post(owner.cookie, "legacy")).statusCode).toBe(409);
      // The legacy duplicate can still be renamed to a free name.
      expect((await rename(owner.cookie, newer.id, "Legacy renamed")).statusCode).toBe(200);
      await expect(prisma.workspace.count({ where: { ownerId: owner.id } })).resolves.toBe(2);
    });
  });
});
