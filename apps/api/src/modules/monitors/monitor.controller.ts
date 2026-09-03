import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import {
  createMonitorBodySchema,
  projectIdParamsSchema,
} from "./monitor.schema.js";
import { MonitorService } from "./monitor.service.js";

export class MonitorController {
  constructor(private readonly monitorService: MonitorService) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = projectIdParamsSchema.safeParse(request.params);
    const body = createMonitorBodySchema.safeParse(request.body);

    if (!params.success || !body.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        {
          params: params.success ? undefined : params.error.flatten(),
          body: body.success ? undefined : body.error.flatten(),
        },
      );
    }

    const monitor = await this.monitorService.create(
      params.data.projectId,
      body.data,
    );

    return reply.status(201).send(monitor);
  };

  findAll = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = projectIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        params.error.flatten(),
      );
    }

    const monitors = await this.monitorService.findAll(params.data.projectId);

    return reply.send(monitors);
  };
}