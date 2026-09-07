import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { ProjectRepository } from "./project.repository.js";
import type { CreateProjectInput } from "./project.schema.js";

export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async create(workspaceId: string, userId: string, input: CreateProjectInput) {
    await this.workspaceAccessService.requireRole(workspaceId, userId, ["OWNER", "ADMIN"]);

    return this.projectRepository.create(workspaceId, input);
  }

  async findAll(workspaceId: string, userId: string) {
    await this.workspaceAccessService.requireMember(workspaceId, userId);

    return this.projectRepository.findAll(workspaceId);
  }
}
