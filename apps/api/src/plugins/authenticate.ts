import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../infrastructure/errors/app-error.js";
import { SESSION_COOKIE_NAME } from "../infrastructure/session/session.constant.js";
import type { SessionStore } from "../infrastructure/session/session-store.js";

type Authenticate = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module "fastify" {
  interface FastifyInstance {
    authenticate: Authenticate;
  }

  interface FastifyRequest {
    userId: string | null;
  }
}

export function registerAuthentication(app: FastifyInstance, sessionStore: SessionStore): void {
  app.decorateRequest("userId", null);

  app.decorate("authenticate", async (request: FastifyRequest) => {
    const sessionToken = request.cookies[SESSION_COOKIE_NAME];

    if (!sessionToken) {
      throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }

    const userId = await sessionStore.findUserId(sessionToken);

    if (!userId) {
      throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }

    request.userId = userId;
  });
}
