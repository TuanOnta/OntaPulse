import { prisma } from "../../infrastructure/database/prisma.js";
import { workspaceNameKey } from "../workspaces/workspace-name.js";

interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
}

export class AuthRepository {
  findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        workspaceMemberships: {
          select: {
            role: true,
            joinedAt: true,
            workspace: { select: { id: true, name: true, createdAt: true } },
          },
        },
      },
    });
  }
  findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  findUserForLogin(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, passwordHash: true, createdAt: true },
    });
  }

  createUserWithWorkspace(input: CreateUserInput) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      });

      const workspaceName = `${input.name}'s Workspace`;
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          ownerId: user.id,
          nameKey: workspaceNameKey(workspaceName),
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      return {
        user,
        workspace,
      };
    });
  }
}
