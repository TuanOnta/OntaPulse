import type { CreateProjectInput } from "./project.schema.js";
import { ProjectRepository } from "./project.repository.js";

export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  create(workspaceId: string, input: CreateProjectInput) {
    return this.projectRepository.create(workspaceId, input);
  }

  findAll(workspaceId: string) {
    return this.projectRepository.findAll(workspaceId);
  }
}
