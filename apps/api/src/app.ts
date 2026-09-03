import Fastify from "fastify";
import { prisma } from "./infrastructure/database/prisma.js";

// routes
import { projectRoutes } from "./modules/projects/project.routes.js";
import { monitorRoutes } from "./modules/monitors/monitor.routes.js";

// swagger
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

// logger
import { loggerOptions } from "./infrastructure/logger/logger.js";

// plugins
import { healthPlugin } from "./plugins/health.js";
import { registerErrorHandlers } from "./plugins/error-handler.js";

export function buildApp() {
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
  void app.register(projectRoutes, { prefix: "/api/projects" });
  void app.register(monitorRoutes, { prefix: "/api" });

  // Gracefully disconnect from the database when the application is shutting down
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}