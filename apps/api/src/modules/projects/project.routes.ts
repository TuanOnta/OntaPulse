import type { FastifyPluginAsync } from "fastify";

import { ProjectController } from "./project.controller.js";
import {
  createProjectRouteSchema,
  findAllProjectsRouteSchema,
} from "./project.openapi.js";
import { ProjectRepository } from "./project.repository.js";
import { ProjectService } from "./project.service.js";

export const projectRoutes: FastifyPluginAsync = async (app) => {
  const projectRepository = new ProjectRepository();
  const projectService = new ProjectService(projectRepository);
  const projectController = new ProjectController(projectService);

  app.post(
    "/",
    { schema: createProjectRouteSchema },
    projectController.create,
  );

  app.get(
    "/",
    { schema: findAllProjectsRouteSchema },
    projectController.findAll,
  );
};