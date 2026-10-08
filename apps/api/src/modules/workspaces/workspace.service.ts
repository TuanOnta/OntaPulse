import { AppError } from "../../infrastructure/errors/app-error.js";
import { WorkspaceAccessService } from "./workspace-access.service.js";
import { WorkspaceRepository } from "./workspace.repository.js";
import type {
  AddWorkspaceMemberInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  UpdateWorkspaceMemberInput,
} from "./workspace.schema.js";

export class WorkspaceService {
  private readonly workspaceAccessService: WorkspaceAccessService;

  constructor(private readonly workspaceRepository: WorkspaceRepository) {
    this.workspaceAccessService = new WorkspaceAccessService(workspaceRepository);
  }

  create(userId: string, input: CreateWorkspaceInput) {
    return this.workspaceRepository.createWithOwner(userId, input);
  }

  async findAll(userId: string) {
    const memberships = await this.workspaceRepository.findAllForUser(userId);

    return memberships.map((membership) => ({
      ...membership.workspace,
      role: membership.role,
      joinedAt: membership.joinedAt,
    }));
  }

  async update(workspaceId: string, actorId: string, input: UpdateWorkspaceInput) {
    const membership = await this.workspaceAccessService.requireRole(workspaceId, actorId, [
      "OWNER",
      "ADMIN",
    ]);
    const workspace = await this.workspaceRepository.update(workspaceId, input);
    const member = await this.workspaceRepository.findMember(workspaceId, actorId);

    return {
      ...workspace,
      role: membership.role,
      joinedAt: member?.joinedAt ?? workspace.createdAt,
    };
  }

  async delete(workspaceId: string, actorId: string) {
    await this.workspaceAccessService.requireRole(workspaceId, actorId, ["OWNER"]);
    await this.workspaceRepository.delete(workspaceId);
  }

  async findMembers(workspaceId: string, userId: string) {
    await this.workspaceAccessService.requireMember(workspaceId, userId);
    const memberships = await this.workspaceRepository.findMembers(workspaceId);

    return memberships.map(formatMember);
  }

  async addMember(workspaceId: string, actorId: string, input: AddWorkspaceMemberInput) {
    await this.workspaceAccessService.requireRole(workspaceId, actorId, ["OWNER", "ADMIN"]);
    const user = await this.workspaceRepository.findUserByEmail(input.email);

    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const existing = await this.workspaceRepository.findMember(workspaceId, user.id);
    if (existing) throw new AppError("User is already a workspace member", 409, "MEMBER_EXISTS");

    return formatMember(await this.workspaceRepository.addMember(workspaceId, user.id));
  }

  async updateMemberRole(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
    input: UpdateWorkspaceMemberInput,
  ) {
    await this.workspaceAccessService.requireRole(workspaceId, actorId, ["OWNER"]);
    const member = await this.getManageableMember(workspaceId, targetUserId);

    if (member.role === "OWNER") {
      throw new AppError("The workspace owner role cannot be changed", 403, "OWNER_ROLE_PROTECTED");
    }

    return formatMember(
      await this.workspaceRepository.updateMemberRole(workspaceId, targetUserId, input.role),
    );
  }

  async removeMember(workspaceId: string, actorId: string, targetUserId: string) {
    const actor = await this.workspaceAccessService.requireRole(workspaceId, actorId, [
      "OWNER",
      "ADMIN",
    ]);
    const member = await this.getManageableMember(workspaceId, targetUserId);

    if (member.role === "OWNER") {
      throw new AppError("The workspace owner cannot be removed", 403, "OWNER_ROLE_PROTECTED");
    }
    if (actor.role === "ADMIN" && member.role !== "MEMBER") {
      throw new AppError(
        "Admins can only remove workspace members",
        403,
        "INSUFFICIENT_WORKSPACE_ROLE",
      );
    }

    await this.workspaceRepository.removeMember(workspaceId, targetUserId);
  }

  private async getManageableMember(workspaceId: string, userId: string) {
    const member = await this.workspaceRepository.findMember(workspaceId, userId);
    if (!member) throw new AppError("Workspace member not found", 404, "MEMBER_NOT_FOUND");
    return member;
  }
}

function formatMember(membership: {
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: Date;
  user: { id: string; name: string; email: string };
}) {
  return { ...membership.user, role: membership.role, joinedAt: membership.joinedAt };
}
