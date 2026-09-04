import Fastify from "fastify";
import { prisma } from "./infrastructure/database/prisma.js";
import { NoopScanQueue } from "./infrastructure/queue/noop-scan-queue.js";
import type { ScanQueue } from "./infrastructure/queue/scan-queue.js";

// routes
import { projectRoutes } from "./modules/projects/project.routes.js";
import { monitorRoutes } from "./modules/monitors/monitor.routes.js";
import { scanRoutes } from "./modules/scans/scan.routes.js";

// swagger
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

// logger
import { loggerOptions } from "./infrastructure/logger/logger.js";

// plugins
import { healthPlugin } from "./plugins/health.js";
import { registerErrorHandlers } from "./plugins/error-handler.js";

interface BuildAppOptions {
  scanQueue?: ScanQueue;
}

export function buildApp(options: BuildAppOptions = {}) {
  const scanQueue = options.scanQueue ?? new NoopScanQueue();

  const app = Fastify({
    logger: loggerOptions,

    ajv: {
      customOptions: {
        coerceTypes: false,
        removeAdditional: false,
      },
    },
  });

  registerErrorHandlers(app);

  void app.register(swagger, {
    openapi: {
      info: {
        title: "OntaPulse API",
        description: "Website and API monitoring platform.",
        version: "0.1.0",
      },
    },
  });

  void app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  void app.register(healthPlugin);

  // register routes
  void app.register(projectRoutes, { prefix: "/api" });
  void app.register(monitorRoutes, { prefix: "/api" });
  void app.register(scanRoutes, { prefix: "/api", scanQueue });

  // Gracefully disconnect from the database when the application is shutting down
  app.addHook("onClose", async () => {
    await Promise.all([scanQueue.close(), prisma.$disconnect()]);
  });

  return app;
}
