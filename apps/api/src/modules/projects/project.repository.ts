import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateProjectInput } from "./project.schema.js";

export class ProjectRepository {
  create(input: CreateProjectInput) {
    return prisma.project.create({
      data: input,
    });
  }

  findAll() {
    return prisma.project.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}
