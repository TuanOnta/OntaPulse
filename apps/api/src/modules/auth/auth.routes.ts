import type { FastifyPluginAsync } from "fastify";

import type { SessionStore } from "../../infrastructure/session/session-store.js";
import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";

interface AuthRoutesOptions {
  sessionStore: SessionStore;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (app, options) => {
  const authRepository = new AuthRepository();

  const authService = new AuthService(authRepository, options.sessionStore);

  const authController = new AuthController(authService);

  app.post("/auth/register", authController.register);
};
