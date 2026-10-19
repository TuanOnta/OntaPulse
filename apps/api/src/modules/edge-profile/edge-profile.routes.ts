import type { FastifyPluginAsync } from "fastify";

import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { EdgeProfileController } from "./edge-profile.controller.js";
import { findEdgeProfileRouteSchema } from "./edge-profile.openapi.js";
import { EdgeProfileRepository } from "./edge-profile.repository.js";
import { EdgeProfileService } from "./edge-profile.service.js";

export const edgeProfileRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const service = new EdgeProfileService(
    new EdgeProfileRepository(),
    new WorkspaceAccessService(new WorkspaceRepository()),
  );
  const controller = new EdgeProfileController(service);

  app.get(
    "/monitors/:monitorId/edge-profile",
    { schema: findEdgeProfileRouteSchema },
    controller.findByMonitorId,
  );
};
