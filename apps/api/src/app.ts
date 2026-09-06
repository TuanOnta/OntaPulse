import Fastify from "fastify";
import cookie from "@fastify/cookie";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { prisma } from "./infrastructure/database/prisma.js";
import { loggerOptions } from "./infrastructure/logger/logger.js";

import { NoopScanQueue } from "./infrastructure/queue/noop-scan-queue.js";
import type { ScanQueue } from "./infrastructure/queue/scan-queue.js";

import { NoopSessionStore } from "./infrastructure/session/noop-session-store.js";
import type { SessionStore } from "./infrastructure/session/session-store.js";

import { authRoutes } from "./modules/auth/auth.routes.js";
import { projectRoutes } from "./modules/projects/project.routes.js";
import { monitorRoutes } from "./modules/monitors/monitor.routes.js";
import { scanRoutes } from "./modules/scans/scan.routes.js";

import { healthPlugin } from "./plugins/health.js";
import { registerErrorHandlers } from "./plugins/error-handler.js";

interface BuildAppOptions {
  scanQueue?: ScanQueue;
  sessionStore?: SessionStore;
}

export function buildApp(options: BuildAppOptions = {}) {
  const scanQueue = options.scanQueue ?? new NoopScanQueue();

  const sessionStore = options.sessionStore ?? new NoopSessionStore();

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

  void app.register(cookie);

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

  void app.register(authRoutes, { prefix: "/api", sessionStore });
  void app.register(projectRoutes, { prefix: "/api" });
  void app.register(monitorRoutes, { prefix: "/api" });
  void app.register(scanRoutes, { prefix: "/api", scanQueue });

  app.addHook("onClose", async () => {
    await Promise.all([scanQueue.close(), sessionStore.close(), prisma.$disconnect()]);
  });

  return app;
}
