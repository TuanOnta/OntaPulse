import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateMonitorInput } from "./monitor.schema.js";
import type { UpdateMonitorInput } from "./monitor.schema.js";

export class MonitorRepository {
  findProjectById(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
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

  findById(id: string) {
    return prisma.monitor.findUnique({ where: { id }, include: { project: true } });
  }

  update(id: string, input: UpdateMonitorInput) {
    return prisma.monitor.update({
      where: { id },
      data: { ...input, ...(input.isActive === true ? { nextScheduledAt: new Date() } : {}) },
    });
  }

  delete(id: string) {
    return prisma.monitor.delete({ where: { id } });
  }
}
