import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateProjectInput, UpdateProjectInput } from "./project.schema.js";

export class ProjectRepository {
  create(workspaceId: string, input: CreateProjectInput) {
    return prisma.project.create({
      data: {
        ...input,
        workspaceId,
      },
    });
  }

  findAll(workspaceId: string) {
    return prisma.project.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  findById(projectId: string) {
    return prisma.project.findUnique({ where: { id: projectId } });
  }

  update(projectId: string, input: UpdateProjectInput) {
    return prisma.project.update({
      where: { id: projectId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        // An empty description clears it.
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      },
    });
  }

  /** Removes the project; its monitors, scans and findings go with it (cascade). */
  delete(projectId: string) {
    return prisma.project.delete({ where: { id: projectId } });
  }
}
