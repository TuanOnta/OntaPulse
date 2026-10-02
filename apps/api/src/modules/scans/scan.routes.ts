import type { FastifyPluginAsync } from "fastify";

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

export const scanRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const workspaceRepository = new WorkspaceRepository();
  const workspaceAccessService = new WorkspaceAccessService(workspaceRepository);
  const scanRepository = new ScanRepository();
  const scanService = new ScanService(scanRepository, workspaceAccessService);
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
