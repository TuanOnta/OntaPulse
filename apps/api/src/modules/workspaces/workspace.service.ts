import { WorkspaceRepository } from "./workspace.repository.js";
import type { CreateWorkspaceInput } from "./workspace.schema.js";

export class WorkspaceService {
  constructor(private readonly workspaceRepository: WorkspaceRepository) {}

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
}
