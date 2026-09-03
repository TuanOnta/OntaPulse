import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../infrastructure/database/prisma.js";

import {
  healthSchema,
  databaseReadySchema,
} from "./health.openapi.js"

export const healthPlugin: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: healthSchema
    },
    async () => ({ status: "ok" }),
  );

  app.get(
    "/ready",
    {
      schema: databaseReadySchema,
    },
    async (_request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;

        return { status: "ready" };
      } catch (error) {
        app.log.error(error, "Database readiness check failed");

        return reply.status(503).send({
          status: "not_ready",
        });
      }
    },
  );
};
