import { createHash, randomBytes } from "node:crypto";
import { createClient } from "redis";

import type { SessionStore } from "./session-store.js";

import { SESSION_TTL_SECONDS } from "./session.constant.js";

const SESSION_KEY_PREFIX = "auth:session:";

type RedisErrorHandler = (error: Error) => void;

export class RedisSessionStore implements SessionStore {
  private readonly client;
  private connecting: Promise<void> | null = null;

  constructor(redisUrl: string) {
    this.client = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5_000,
      },
    });
  }

  onError(handler: (error: Error) => void): void {
    this.client.on("error", handler);
  }

  async create(userId: string): Promise<string> {
    const client = await this.getClient();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const token = randomBytes(32).toString("base64url");
      const key = this.createSessionKey(token);

      const result = await client.set(key, userId, {
        EX: SESSION_TTL_SECONDS,
        NX: true,
      });

      if (result === "OK") {
        return token;
      }
    }

    throw new Error("Unable to generate a unique session token");
  }

  async findUserId(token: string): Promise<string | null> {
    if (!token) {
      return null;
    }

    const client = await this.getClient();

    return client.get(this.createSessionKey(token));
  }

  async delete(token: string): Promise<void> {
    if (!token) {
      return;
    }

    const client = await this.getClient();

    await client.del(this.createSessionKey(token));
  }

  async close(): Promise<void> {
    if (this.connecting) {
      await this.connecting.catch(() => undefined);
    }

    if (this.client.isOpen) {
      await this.client.close();
    }
  }

  private async getClient() {
    if (this.client.isReady || this.client.isOpen) {
      return this.client;
    }

    if (!this.connecting) {
      this.connecting = this.client
        .connect()
        .then(() => undefined)
        .finally(() => {
          this.connecting = null;
        });
    }

    await this.connecting;

    return this.client;
  }

  private createSessionKey(token: string): string {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    return `${SESSION_KEY_PREFIX}${tokenHash}`;
  }
}
