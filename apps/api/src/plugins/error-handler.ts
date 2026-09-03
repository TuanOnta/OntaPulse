import type { FastifyInstance } from "fastify";

import { env } from "../config/env.js";
import { AppError } from "../infrastructure/errors/app-error.js";

function hasValidationDetails(
  error: unknown,
): error is { validation: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "validation" in error
  );
}

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

    if (hasValidationDetails(error)) {
      return reply.status(400).send({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.validation,
        requestId: request.id,
      });
    }

    return reply.status(500).send({
      statusCode: 500,
      code: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred",
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
