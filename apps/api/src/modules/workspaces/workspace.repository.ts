import { prisma } from "../../infrastructure/database/prisma.js";
import { isUniqueViolation, workspaceNameKey, workspaceNameTaken } from "./workspace-name.js";
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

  /**
   * Renames a workspace. The name must stay unique among the workspaces of its owner (case and surrounding spaces
   * ignored); the workspace itself is not a clash, so renaming to its own name, or only changing its case, works.
   */
  async update(workspaceId: string, input: UpdateWorkspaceInput) {
    const nameKey = workspaceNameKey(input.name);

    try {
      return await prisma.$transaction(async (tx) => {
        const current = await tx.workspace.findUniqueOrThrow({
          where: { id: workspaceId },
          select: { ownerId: true },
        });

        if (current.ownerId) {
          const clash = await tx.workspace.findFirst({
            where: { ownerId: current.ownerId, nameKey, id: { not: workspaceId } },
            select: { id: true },
          });

          if (clash) {
            throw workspaceNameTaken();
          }
        }

        return tx.workspace.update({
          where: { id: workspaceId },
          // A workspace without a known owner cannot take part in the rule, so it keeps no key.
          data: { name: input.name, nameKey: current.ownerId ? nameKey : null },
          select: { id: true, name: true, createdAt: true, updatedAt: true },
        });
      });
    } catch (error) {
      throw isUniqueViolation(error) ? workspaceNameTaken() : error;
    }
  }

  /** Removes the workspace; members, projects, monitors, scans and findings go with it (cascade). */
  delete(workspaceId: string) {
    return prisma.workspace.delete({ where: { id: workspaceId } });
  }

  /**
   * Creates a workspace and its OWNER membership. A user cannot own two workspaces with the same name: the check
   * gives a clear error, and the unique index on (ownerId, nameKey) settles two requests that race.
   */
  async createWithOwner(userId: string, input: CreateWorkspaceInput) {
    const nameKey = workspaceNameKey(input.name);

    try {
      return await this.createOwned(userId, input, nameKey);
    } catch (error) {
      throw isUniqueViolation(error) ? workspaceNameTaken() : error;
    }
  }

  private createOwned(userId: string, input: CreateWorkspaceInput, nameKey: string) {
    return prisma.$transaction(async (tx) => {
      const clash = await tx.workspace.findFirst({
        where: { ownerId: userId, nameKey },
        select: { id: true },
      });

      if (clash) {
        throw workspaceNameTaken();
      }

      const workspace = await tx.workspace.create({
        data: { name: input.name, ownerId: userId, nameKey },
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
