import type { FastifyPluginAsync } from "fastify";

import { WorkspaceController } from "./workspace.controller.js";
import { createWorkspaceRouteSchema, findAllWorkspacesRouteSchema } from "./workspace.openapi.js";
import { WorkspaceRepository } from "./workspace.repository.js";
import { WorkspaceService } from "./workspace.service.js";

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const workspaceRepository = new WorkspaceRepository();
  const workspaceService = new WorkspaceService(workspaceRepository);
  const workspaceController = new WorkspaceController(workspaceService);

  app.post("/workspaces", { schema: createWorkspaceRouteSchema }, workspaceController.create);
  app.get("/workspaces", { schema: findAllWorkspacesRouteSchema }, workspaceController.findAll);
};
