import type { FastifyReply, FastifyRequest } from "fastify";
import { createProjectBodySchema, workspaceIdParamsSchema } from "./project.schema.js";
import { ProjectService } from "./project.service.js";
import { AppError } from "../../infrastructure/errors/app-error.js";

export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedParams = workspaceIdParamsSchema.safeParse(request.params);
    const parsedBody = createProjectBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      const details = {
        ...(parsedParams.success ? {} : parsedParams.error.flatten().fieldErrors),
        ...(parsedBody.success ? {} : parsedBody.error.flatten().fieldErrors),
      };

      request.log.error(
        {
          validationErrors: details,
          requestId: request.id,
        },
        "Request validation failed",
      );

      throw new AppError("Request validation failed", 400, "VALIDATION_ERROR", details);
    }

    request.log.info({ projectName: parsedBody.data.name }, "New project creation request");

    const project = await this.projectService.create(
      parsedParams.data.workspaceId,
      parsedBody.data,
    );

    return reply.status(201).send(project);
  };

  findAll = async (request: FastifyRequest) => {
    const parsedParams = workspaceIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedParams.error.flatten().fieldErrors,
      );
    }

    return this.projectService.findAll(parsedParams.data.workspaceId);
  };
}
