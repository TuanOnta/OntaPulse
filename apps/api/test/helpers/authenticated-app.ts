import { buildApp } from "../../src/app.js";
import { SESSION_COOKIE_NAME } from "../../src/infrastructure/session/session.constant.js";
import type { SessionStore } from "../../src/infrastructure/session/session-store.js";
import { TEST_USER_ID } from "./database.js";

const TEST_SESSION_TOKEN = "api-test-session";

class TestSessionStore implements SessionStore {
  async create(): Promise<string> {
    return TEST_SESSION_TOKEN;
  }

  async findUserId(token: string): Promise<string | null> {
    return token === TEST_SESSION_TOKEN ? TEST_USER_ID : null;
  }

  async delete(): Promise<void> {}

  async close(): Promise<void> {}
}

export function buildAuthenticatedApp(options: Parameters<typeof buildApp>[0] = {}) {
  const app = buildApp({ ...options, sessionStore: new TestSessionStore() });

  app.addHook("onRequest", async (request) => {
    request.cookies[SESSION_COOKIE_NAME] = TEST_SESSION_TOKEN;
  });

  return app;
}
