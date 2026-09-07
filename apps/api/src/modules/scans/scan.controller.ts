import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { monitorIdParamsSchema, scanIdParamsSchema } from "./scan.schema.js";
import { ScanService } from "./scan.service.js";

export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  trigger = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const parsedParams = monitorIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedParams.error.flatten().fieldErrors,
      );
    }

    const scan = await this.scanService.trigger(parsedParams.data.monitorId, userId);

    request.log.info(
      {
        scanId: scan.id,
        monitorId: scan.monitorId,
      },
      "Scan queued",
    );

    return reply.status(202).send(scan);
  };

  findAll = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const parsedParams = monitorIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedParams.error.flatten().fieldErrors,
      );
    }

    const scans = await this.scanService.findAll(parsedParams.data.monitorId, userId);

    return reply.send(scans);
  };

  findById = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const parsedParams = scanIdParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        parsedParams.error.flatten().fieldErrors,
      );
    }

    const scan = await this.scanService.findById(parsedParams.data.scanId, userId);

    return reply.send(scan);
  };
}

function getAuthenticatedUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  return request.userId;
}
