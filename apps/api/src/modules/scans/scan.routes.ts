import type { FastifyPluginAsync } from "fastify";

import type { ScanQueue } from "../../infrastructure/queue/scan-queue.js";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { ScanController } from "./scan.controller.js";
import {
  findAllScansRouteSchema,
  findScanByIdRouteSchema,
  triggerScanRouteSchema,
} from "./scan.openapi.js";
import { ScanRepository } from "./scan.repository.js";
import { ScanService } from "./scan.service.js";

interface ScanRoutesOptions {
  scanQueue: ScanQueue;
}

export const scanRoutes: FastifyPluginAsync<ScanRoutesOptions> = async (app, options) => {
  app.addHook("preHandler", app.authenticate);

  const workspaceRepository = new WorkspaceRepository();
  const workspaceAccessService = new WorkspaceAccessService(workspaceRepository);
  const scanRepository = new ScanRepository();
  const scanService = new ScanService(scanRepository, options.scanQueue, workspaceAccessService);
  const scanController = new ScanController(scanService);

  app.post(
    "/monitors/:monitorId/scans",
    {
      schema: triggerScanRouteSchema,
    },
    scanController.trigger,
  );

  app.get(
    "/monitors/:monitorId/scans",
    {
      schema: findAllScansRouteSchema,
    },
    scanController.findAll,
  );

  app.get(
    "/scans/:scanId",
    {
      schema: findScanByIdRouteSchema,
    },
    scanController.findById,
  );
};
