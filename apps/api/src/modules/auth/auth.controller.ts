import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../../config/env.js";
import { AppError } from "../../infrastructure/errors/app-error.js";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "../../infrastructure/session/session.constant.js";
import { AuthService } from "./auth.service.js";
import { registerBodySchema } from "./auth.schema.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = registerBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedBody.error.flatten().fieldErrors,
      );
    }

    const { sessionToken, user, workspace } = await this.authService.register(parsedBody.data);

    reply.setCookie(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    request.log.info(
      {
        userId: user.id,
        workspaceId: workspace.id,
      },
      "User registered",
    );

    return reply.status(201).send({
      user,
      workspace,
    });
  };
}
