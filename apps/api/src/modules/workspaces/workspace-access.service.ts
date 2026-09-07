import type { WorkspaceRole } from "../../generated/prisma/enums.js";

import { AppError } from "../../infrastructure/errors/app-error.js";
import { WorkspaceRepository } from "./workspace.repository.js";

export class WorkspaceAccessService {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

  async requireMember(workspaceId: string, userId: string, notFoundError?: AppError) {
    const membership = await this.workspaceRepository.findMembership(workspaceId, userId);

    if (!membership) {
      throw notFoundError ?? new AppError("Workspace not found", 404, "WORKSPACE_NOT_FOUND");
    }

    return membership;
  }

  async requireRole(
    workspaceId: string,
    userId: string,
    allowedRoles: readonly WorkspaceRole[],
    notFoundError?: AppError,
  ) {
    const membership = await this.requireMember(workspaceId, userId, notFoundError);

    if (!allowedRoles.includes(membership.role)) {
      throw new AppError("Insufficient workspace role", 403, "INSUFFICIENT_WORKSPACE_ROLE");
    }

    return membership;
  }
}
