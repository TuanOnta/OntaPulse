import type { FastifyPluginAsync } from "fastify";

import { ScanController } from "./scan.controller.js";
import {
  findAllScansRouteSchema,
  findScanByIdRouteSchema,
  triggerScanRouteSchema,
} from "./scan.openapi.js";
import { ScanRepository } from "./scan.repository.js";
import { ScanService } from "./scan.service.js";

export const scanRoutes: FastifyPluginAsync =
  async (app) => {
    const scanRepository = new ScanRepository();

    const scanService = new ScanService(
      scanRepository,
    );

    const scanController = new ScanController(
      scanService,
    );

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