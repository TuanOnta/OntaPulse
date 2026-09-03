import type { CreateProjectInput } from "./project.schema.js";
import { ProjectRepository } from "./project.repository.js";

export class ProjectService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  create(input: CreateProjectInput) {
    return this.projectRepository.create(input);
  }

  findAll() {
    return this.projectRepository.findAll();
  }
}
