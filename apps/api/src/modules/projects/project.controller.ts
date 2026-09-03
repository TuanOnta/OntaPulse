import type { FastifyReply, FastifyRequest } from "fastify";
import { createProjectBodySchema } from "./project.schema.js";
import { ProjectService } from "./project.service.js";
import { AppError } from "../../infrastructure/errors/app-error.js";

export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedBody = createProjectBodySchema.safeParse(request.body);

    request.log.info(`new project creation request: ${JSON.stringify(request.body)}`);

    if (!parsedBody.success) {
      request.log.error({
        err: parsedBody.error,
        requestId: request.id,
      }, "Request validation failed");
      
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedBody.error.flatten().fieldErrors,
      );
    }

    const project = await this.projectService.create(parsedBody.data);

    return reply.status(201).send(project);
  };

  findAll = async () => {
    return this.projectService.findAll();
  };
}