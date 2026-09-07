import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { createWorkspaceBodySchema } from "./workspace.schema.js";
import { WorkspaceService } from "./workspace.service.js";

export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const parsedBody = createWorkspaceBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedBody.error.flatten().fieldErrors,
      );
    }

    const workspace = await this.workspaceService.create(userId, parsedBody.data);

    request.log.info({ workspaceId: workspace.id, userId }, "Workspace created");

    return reply.status(201).send(workspace);
  };

  findAll = async (request: FastifyRequest) => {
    const userId = getAuthenticatedUserId(request);

    return this.workspaceService.findAll(userId);
  };
}

function getAuthenticatedUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  return request.userId;
}
