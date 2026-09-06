import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateProjectInput } from "./project.schema.js";

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
}
