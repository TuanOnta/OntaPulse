import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import type { SessionStore } from "../src/infrastructure/session/session-store.js";

import type { OutgoingHttpHeaders } from "node:http";

class FakeSessionStore implements SessionStore {
  private readonly sessions = new Map<string, string>();
  private sequence = 0;

  async create(userId: string): Promise<string> {
    this.sequence += 1;
    const token = `test-session-${this.sequence}`;
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

const validRegistration = {
  name: "Dzaki",
  email: "dzaki@example.com",
  password: "PasswordAman123!",
};

function getSessionCookie(headers: OutgoingHttpHeaders): string {
  const header = headers["set-cookie"];
  const setCookie = Array.isArray(header) ? header[0] : header;

  if (typeof setCookie !== "string") {
    throw new Error("Session cookie was not returned");
  }

  expect(setCookie).toContain("ontapulse_session=");
  expect(setCookie).toContain("HttpOnly");

  return setCookie.split(";", 1)[0];
}

async function clearDatabase(): Promise<void> {
  await prisma.scanFinding.deleteMany();
  await prisma.scan.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

describe("authentication", () => {
  const sessionStore = new FakeSessionStore();
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ sessionStore });
    await app.ready();
  });

  beforeEach(async () => {
    sessionStore.reset();
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
    await app.close();
  });

  it("registers a user, workspace, owner membership, and session", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: validRegistration,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    const cookie = getSessionCookie(response.headers);

    expect(body).toMatchObject({
      user: { name: "Dzaki", email: "dzaki@example.com" },
      workspace: { name: "Dzaki's Workspace" },
    });
    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body).not.toHaveProperty("sessionToken");

    const user = await prisma.user.findUnique({
      where: { email: "dzaki@example.com" },
      include: { workspaceMemberships: true },
    });

    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe(validRegistration.password);
    expect(user!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user!.workspaceMemberships).toHaveLength(1);
    expect(user!.workspaceMemberships[0].role).toBe("OWNER");
    expect(await sessionStore.findUserId(cookie.split("=")[1])).toBe(user!.id);
  });

  it("rejects invalid registration input", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "D", email: "invalid", password: "short" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await prisma.user.count()).toBe(0);
  });

  it("rejects duplicate email registration", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: validRegistration });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { ...validRegistration, name: "Another User" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "EMAIL_ALREADY_REGISTERED" });
    expect(await prisma.user.count()).toBe(1);
  });

  it("logs in with valid credentials", async () => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: validRegistration });
    sessionStore.reset();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "DZAKI@example.com", password: validRegistration.password },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { name: "Dzaki", email: "dzaki@example.com" } });
    expect(response.json().user).not.toHaveProperty("passwordHash");
    getSessionCookie(response.headers);
  });

  it.each([
    ["unknown@example.com", "PasswordAman123!"],
    ["dzaki@example.com", "WrongPassword123!"],
  ])("rejects invalid credentials for %s", async (email, password) => {
    await app.inject({ method: "POST", url: "/api/auth/register", payload: validRegistration });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("returns the current user for a valid session", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: validRegistration,
    });
    const cookie = getSessionCookie(registerResponse.headers);
    const response = await app.inject({ method: "GET", url: "/api/auth/me", headers: { cookie } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: {
        name: "Dzaki",
        email: "dzaki@example.com",
        workspaceMemberships: [{ role: "OWNER", workspace: { name: "Dzaki's Workspace" } }],
      },
    });
    expect(response.json().user).not.toHaveProperty("passwordHash");
  });

  it("rejects access to the current user without a session", async () => {
    const response = await app.inject({ method: "GET", url: "/api/auth/me" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("logs out and invalidates the current session", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: validRegistration,
    });
    const cookie = getSessionCookie(registerResponse.headers);
    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie },
      payload: {},
    });

    expect(logoutResponse.statusCode).toBe(204);
    expect(logoutResponse.headers["set-cookie"]).toContain("ontapulse_session=");

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie },
    });

    expect(meResponse.statusCode).toBe(401);
    expect(meResponse.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
