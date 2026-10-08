import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { ProjectRepository } from "./project.repository.js";
import { AppError } from "../../infrastructure/errors/app-error.js";
import type { CreateProjectInput, UpdateProjectInput } from "./project.schema.js";

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

  async update(projectId: string, userId: string, input: UpdateProjectInput) {
    await this.requireManageableProject(projectId, userId);

    return this.projectRepository.update(projectId, input);
  }

  async delete(projectId: string, userId: string) {
    await this.requireManageableProject(projectId, userId);
    await this.projectRepository.delete(projectId);
  }

  /** OWNER and ADMIN manage a project; anyone else outside the workspace sees "not found". */
  private async requireManageableProject(projectId: string, userId: string) {
    const project = await this.projectRepository.findById(projectId);

    if (!project) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");

    await this.workspaceAccessService.requireRole(
      project.workspaceId,
      userId,
      ["OWNER", "ADMIN"],
      new AppError("Project not found", 404, "PROJECT_NOT_FOUND"),
    );

    return project;
  }
}
