import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateMonitorInput } from "./monitor.schema.js";

export class MonitorRepository {
  findProjectById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
  }

  findByTargetUrl(projectId: string, targetUrl: string) {
    return prisma.monitor.findUnique({
      where: {
        projectId_targetUrl: {
          projectId,
          targetUrl,
        },
      },
    });
  }

  create(projectId: string, input: CreateMonitorInput) {
    return prisma.monitor.create({
      data: {
        projectId,
        ...input,
      },
    });
  }

  findAllByProjectId(projectId: string) {
    return prisma.monitor.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }
}
