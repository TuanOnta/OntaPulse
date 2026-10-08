import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import {
  createProjectBodySchema,
  projectIdParamsSchema,
  updateProjectBodySchema,
  workspaceIdParamsSchema,
} from "./project.schema.js";
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

  update = async (request: FastifyRequest) => {
    const userId = getAuthenticatedUserId(request);
    const parsedParams = projectIdParamsSchema.safeParse(request.params);
    const parsedBody = updateProjectBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      throw new AppError("Request validation failed", 400, "VALIDATION_ERROR", {
        ...(parsedParams.success ? {} : parsedParams.error.flatten().fieldErrors),
        ...(parsedBody.success ? {} : parsedBody.error.flatten().fieldErrors),
      });
    }

    const project = await this.projectService.update(
      parsedParams.data.projectId,
      userId,
      parsedBody.data,
    );

    request.log.info({ projectId: project.id, userId }, "Project updated");

    return project;
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const parsedParams = projectIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedParams.error.flatten().fieldErrors,
      );
    }

    await this.projectService.delete(parsedParams.data.projectId, userId);

    request.log.info({ projectId: parsedParams.data.projectId, userId }, "Project deleted");

    return reply.status(204).send();
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
