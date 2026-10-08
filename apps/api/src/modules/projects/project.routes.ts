import type { FastifyPluginAsync } from "fastify";

import { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { WorkspaceRepository } from "../workspaces/workspace.repository.js";
import { ProjectController } from "./project.controller.js";
import {
  createProjectRouteSchema,
  deleteProjectRouteSchema,
  findAllProjectsRouteSchema,
  updateProjectRouteSchema,
} from "./project.openapi.js";
import { ProjectRepository } from "./project.repository.js";
import { ProjectService } from "./project.service.js";

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const workspaceRepository = new WorkspaceRepository();
  const workspaceAccessService = new WorkspaceAccessService(workspaceRepository);
  const projectRepository = new ProjectRepository();
  const projectService = new ProjectService(projectRepository, workspaceAccessService);
  const projectController = new ProjectController(projectService);

  app.post(
    "/workspaces/:workspaceId/projects",
    { schema: createProjectRouteSchema },
    projectController.create,
  );
  app.get(
    "/workspaces/:workspaceId/projects",
    { schema: findAllProjectsRouteSchema },
    projectController.findAll,
  );
  app.patch("/projects/:projectId", { schema: updateProjectRouteSchema }, projectController.update);
  app.delete(
    "/projects/:projectId",
    { schema: deleteProjectRouteSchema },
    projectController.delete,
  );
};
