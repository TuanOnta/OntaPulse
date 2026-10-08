import { prisma } from "../../infrastructure/database/prisma.js";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "./workspace.schema.js";

export class WorkspaceRepository {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
  }

  findMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  findMembers(workspaceId: string) {
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    });
  }

  addMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.create({
      data: { workspaceId, userId, role: "MEMBER" },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  updateMemberRole(workspaceId: string, userId: string, role: "ADMIN" | "MEMBER") {
    return prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data: { role },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  removeMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

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

  update(workspaceId: string, input: UpdateWorkspaceInput) {
    return prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: input.name },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });
  }

  /** Removes the workspace; members, projects, monitors, scans and findings go with it (cascade). */
  delete(workspaceId: string) {
    return prisma.workspace.delete({ where: { id: workspaceId } });
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
