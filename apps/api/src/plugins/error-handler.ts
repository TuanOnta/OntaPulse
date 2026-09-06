import type { FastifyError, FastifyInstance } from "fastify";

import { AppError } from "../infrastructure/errors/app-error.js";

type ValidationFastifyError = FastifyError & {
  validation?: unknown;
};

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        err: error,
        requestId: request.id,
      },
      "Request failed",
    );

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: request.id,
      });
    }

    const fastifyError = error as ValidationFastifyError;

    if (fastifyError.validation || fastifyError.code === "FST_ERR_VALIDATION") {
      return reply.status(400).send({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: fastifyError.validation,
        requestId: request.id,
      });
    }

    const frameworkStatusCode =
      typeof fastifyError.statusCode === "number" &&
      fastifyError.statusCode >= 400 &&
      fastifyError.statusCode < 500
        ? fastifyError.statusCode
        : null;

    if (frameworkStatusCode) {
      request.log.warn({ err: error, requestId: request.id }, "Request rejected");

      return reply.status(frameworkStatusCode).send({
        statusCode: frameworkStatusCode,
        code: typeof fastifyError.code === "string" ? fastifyError.code : "REQUEST_ERROR",
        message: fastifyError.message,
        requestId: request.id,
      });
    }

    return reply.status(500).send({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      requestId: request.id,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      statusCode: 404,
      code: "ROUTE_NOT_FOUND",
      message: "Route not found",
      requestId: request.id,
    });
  });
}
