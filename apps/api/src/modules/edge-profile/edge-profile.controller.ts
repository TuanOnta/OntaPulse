import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { monitorIdParamsSchema } from "./edge-profile.schema.js";
import { EdgeProfileService } from "./edge-profile.service.js";

export class EdgeProfileController {
  constructor(private readonly service: EdgeProfileService) {}

  findByMonitorId = async (request: FastifyRequest, reply: FastifyReply) => {
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

    return reply.send(await this.service.findByMonitorId(params.data.monitorId, request.userId));
  };
}
