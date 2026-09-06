import type { SessionStore } from "./session-store.js";

export class NoopSessionStore implements SessionStore {
  async create(): Promise<string> {
    throw new Error("Session store is not configured");
  }

  async findUserId(): Promise<null> {
    return null;
  }

  async delete(): Promise<void> {}

  async close(): Promise<void> {}
}
