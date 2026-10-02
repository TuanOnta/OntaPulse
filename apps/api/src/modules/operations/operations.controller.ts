import type { FastifyReply, FastifyRequest } from "fastify";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { redriveDeadLetterParamsSchema, workspaceIdParamsSchema } from "./operations.schema.js";
import { OperationsService } from "./operations.service.js";

export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  health = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const params = workspaceIdParamsSchema.parse(request.params);
    return reply.send(await this.service.health(params.workspaceId, userId));
  };

  redrive = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getUserId(request);
    const params = redriveDeadLetterParamsSchema.parse(request.params);
    return reply.send(await this.service.redrive(params.workspaceId, params.scanId, userId));
  };
}

function getUserId(request: FastifyRequest) {
  if (!request.userId) throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  return request.userId;
}
