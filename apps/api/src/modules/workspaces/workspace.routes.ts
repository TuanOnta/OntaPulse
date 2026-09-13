import type { FastifyPluginAsync } from "fastify";

import { WorkspaceController } from "./workspace.controller.js";
import {
  addWorkspaceMemberRouteSchema,
  createWorkspaceRouteSchema,
  findAllWorkspacesRouteSchema,
  findWorkspaceMembersRouteSchema,
  removeWorkspaceMemberRouteSchema,
  updateWorkspaceMemberRoleRouteSchema,
} from "./workspace.openapi.js";
import { WorkspaceRepository } from "./workspace.repository.js";
import { WorkspaceService } from "./workspace.service.js";

export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const workspaceRepository = new WorkspaceRepository();
  const workspaceService = new WorkspaceService(workspaceRepository);
  const workspaceController = new WorkspaceController(workspaceService);

  app.post("/workspaces", { schema: createWorkspaceRouteSchema }, workspaceController.create);
  app.get("/workspaces", { schema: findAllWorkspacesRouteSchema }, workspaceController.findAll);
  app.get(
    "/workspaces/:workspaceId/members",
    { schema: findWorkspaceMembersRouteSchema },
    workspaceController.findMembers,
  );
  app.post(
    "/workspaces/:workspaceId/members",
    { schema: addWorkspaceMemberRouteSchema },
    workspaceController.addMember,
  );
  app.patch(
    "/workspaces/:workspaceId/members/:userId",
    { schema: updateWorkspaceMemberRoleRouteSchema },
    workspaceController.updateMemberRole,
  );
  app.delete(
    "/workspaces/:workspaceId/members/:userId",
    { schema: removeWorkspaceMemberRouteSchema },
    workspaceController.removeMember,
  );
};
