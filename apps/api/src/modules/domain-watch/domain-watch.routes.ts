import type { FastifyPluginAsync } from "fastify";

import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { DomainWatchController } from "./domain-watch.controller.js";
import { findDnsBaselineRouteSchema } from "./domain-watch.openapi.js";
import { DomainWatchRepository } from "./domain-watch.repository.js";
import { DomainWatchService } from "./domain-watch.service.js";

export const domainWatchRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const service = new DomainWatchService(
    new DomainWatchRepository(),
    new WorkspaceAccessService(new WorkspaceRepository()),
  );
  const controller = new DomainWatchController(service);

  app.get(
    "/monitors/:monitorId/dns-baseline",
    { schema: findDnsBaselineRouteSchema },
    controller.findBaseline,
  );
};
