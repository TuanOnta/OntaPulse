import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { monitorIdParamsSchema } from "./domain-watch.schema.js";
import { DomainWatchService } from "./domain-watch.service.js";

export class DomainWatchController {
  constructor(private readonly service: DomainWatchService) {}

  findBaseline = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) {
      throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    }

    const params = monitorIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw new AppError(
        "Request validation failed",
        400,
        "VALIDATION_ERROR",
        params.error.flatten().fieldErrors,
      );
    }

    return reply.send(await this.service.findBaseline(params.data.monitorId, request.userId));
  };
}
