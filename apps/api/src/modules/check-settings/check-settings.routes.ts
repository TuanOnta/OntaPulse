import type { FastifyPluginAsync } from "fastify";

import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { CheckSettingsController } from "./check-settings.controller.js";
import {
  getCheckSettingsRouteSchema,
  updateCheckSettingsRouteSchema,
} from "./check-settings.openapi.js";
import { CheckSettingsRepository } from "./check-settings.repository.js";
import { CheckSettingsService } from "./check-settings.service.js";

export const checkSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const service = new CheckSettingsService(
    new CheckSettingsRepository(),
    new WorkspaceAccessService(new WorkspaceRepository()),
  );
  const controller = new CheckSettingsController(service);

  app.get(
    "/monitors/:monitorId/check-settings",
    { schema: getCheckSettingsRouteSchema },
    controller.get,
  );

  app.patch(
    "/monitors/:monitorId/check-settings",
    { schema: updateCheckSettingsRouteSchema },
    controller.update,
  );
};
