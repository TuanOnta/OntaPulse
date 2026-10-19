import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { monitorIdParamsSchema, updateCheckSettingsBodySchema } from "./check-settings.schema.js";
import { CheckSettingsService } from "./check-settings.service.js";

export class CheckSettingsController {
  constructor(private readonly service: CheckSettingsService) {}

  get = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const params = parse(monitorIdParamsSchema, request.params);

    return reply.send(await this.service.get(params.monitorId, userId));
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = getAuthenticatedUserId(request);
    const params = parse(monitorIdParamsSchema, request.params);
    const body = parse(updateCheckSettingsBodySchema, request.body);

    return reply.send(await this.service.update(params.monitorId, userId, body));
  };
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(
      "Request validation failed",
      400,
      "VALIDATION_ERROR",
      result.error.flatten().fieldErrors,
    );
  }

  return result.data;
}

function getAuthenticatedUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
  }

  return request.userId;
}
