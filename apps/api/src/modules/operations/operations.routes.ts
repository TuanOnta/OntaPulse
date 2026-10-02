import type { FastifyPluginAsync } from "fastify";

import type { ScanQueueOperations } from "../../infrastructure/queue/scan-queue.js";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { OperationsController } from "./operations.controller.js";
import { queueHealthRouteSchema, redriveDeadLetterRouteSchema } from "./operations.openapi.js";
import { OperationsRepository } from "./operations.repository.js";
import { OperationsService } from "./operations.service.js";

interface OperationsRoutesOptions {
  queueOperations: ScanQueueOperations;
}

export const operationsRoutes: FastifyPluginAsync<OperationsRoutesOptions> = async (
  app,
  options,
) => {
  app.addHook("preHandler", app.authenticate);
  const service = new OperationsService(
    new OperationsRepository(),
    options.queueOperations,
    new WorkspaceAccessService(new WorkspaceRepository()),
  );
  const controller = new OperationsController(service);

  app.get(
    "/workspaces/:workspaceId/operations/queue-health",
    { schema: queueHealthRouteSchema },
    controller.health,
  );
  app.post(
    "/workspaces/:workspaceId/operations/dlq/:scanId/redrive",
    { schema: redriveDeadLetterRouteSchema },
    controller.redrive,
  );
};
