import type { FastifyPluginAsync } from "fastify";

import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { MonitorController } from "./monitor.controller.js";
import { createMonitorRouteSchema, findAllMonitorsRouteSchema } from "./monitor.openapi.js";
import { MonitorRepository } from "./monitor.repository.js";
import { MonitorService } from "./monitor.service.js";

export const monitorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const workspaceRepository = new WorkspaceRepository();
  const workspaceAccessService = new WorkspaceAccessService(workspaceRepository);
  const monitorRepository = new MonitorRepository();
  const monitorService = new MonitorService(monitorRepository, workspaceAccessService);
  const monitorController = new MonitorController(monitorService);

  app.post(
    "/projects/:projectId/monitors",
    { schema: createMonitorRouteSchema },
    monitorController.create,
  );

  app.get(
    "/projects/:projectId/monitors",
    { schema: findAllMonitorsRouteSchema },
    monitorController.findAll,
  );
};
