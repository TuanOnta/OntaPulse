import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { createProjectBodySchema, workspaceIdParamsSchema } from "./project.schema.js";
import { ProjectService } from "./project.service.js";

export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const parsedParams = workspaceIdParamsSchema.safeParse(request.params);
    const parsedBody = createProjectBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      const details = {
        ...(parsedParams.success ? {} : parsedParams.error.flatten().fieldErrors),
        ...(parsedBody.success ? {} : parsedBody.error.flatten().fieldErrors),
      };

      throw new AppError("Request validation failed", 400, "VALIDATION_ERROR", details);
    }

    const project = await this.projectService.create(
      parsedParams.data.workspaceId,
      userId,
      parsedBody.data,
    );

    request.log.info(
      { projectId: project.id, workspaceId: project.workspaceId, userId },
      "Project created",
    );

    return reply.status(201).send(project);
  };

  findAll = async (request: FastifyRequest) => {
    const userId = getAuthenticatedUserId(request);
    const parsedParams = workspaceIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedParams.error.flatten().fieldErrors,
      );
    }

    return this.projectService.findAll(parsedParams.data.workspaceId, userId);
  };
}

function getAuthenticatedUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  return request.userId;
}
