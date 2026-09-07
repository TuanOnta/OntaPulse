import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateWorkspaceInput } from "./workspace.schema.js";

export class WorkspaceRepository {
  findMembership(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
  }

  findAllForUser(userId: string) {
    return prisma.workspaceMember.findMany({
      where: { userId },
      select: {
        role: true,
        joinedAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  }

  createWithOwner(userId: string, input: CreateWorkspaceInput) {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: input.name },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: "OWNER",
        },
        select: {
          role: true,
          joinedAt: true,
        },
      });

      return {
        ...workspace,
        role: membership.role,
        joinedAt: membership.joinedAt,
      };
    });
  }
}
