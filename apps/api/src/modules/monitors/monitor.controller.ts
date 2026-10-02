import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { createMonitorBodySchema, monitorIdParamsSchema, projectIdParamsSchema, updateMonitorBodySchema } from "./monitor.schema.js";
import { MonitorService } from "./monitor.service.js";

export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const params = projectIdParamsSchema.safeParse(request.params);
    const body = createMonitorBodySchema.safeParse(request.body);

    if (!params.success || !body.success) {
      throw new AppError("Request validation failed", 400, "VALIDATION_ERROR", {
        params: params.success ? undefined : params.error.flatten(),
        body: body.success ? undefined : body.error.flatten(),
      });
    }

    const monitor = await this.monitorService.create(params.data.projectId, userId, body.data);

    return reply.status(201).send(monitor);
  };

  findAll = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const params = projectIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        params.error.flatten(),
      );
    }

    const monitors = await this.monitorService.findAll(params.data.projectId, userId);

    return reply.send(monitors);
  };

  update = async (request: FastifyRequest) => {
    const userId = getAuthenticatedUserId(request);
    const params = monitorIdParamsSchema.parse(request.params);
    const body = updateMonitorBodySchema.parse(request.body);
    return this.monitorService.update(params.monitorId, userId, body);
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const params = monitorIdParamsSchema.parse(request.params);
    await this.monitorService.delete(params.monitorId, userId);
    return reply.status(204).send();
  };
}

function getAuthenticatedUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  return request.userId;
}
