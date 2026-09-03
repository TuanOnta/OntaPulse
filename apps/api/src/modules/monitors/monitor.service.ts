import { AppError } from "../../infrastructure/errors/app-error.js";
import type { CreateMonitorInput } from "./monitor.schema.js";
import { MonitorRepository } from "./monitor.repository.js";

export class MonitorService {
  constructor(private readonly monitorRepository: MonitorRepository) {}

  async create(projectId: string, input: CreateMonitorInput) {
    const project = await this.monitorRepository.findProjectById(projectId);

    if (!project) {
      throw new AppError(
        "Project not found",
        404,
        "PROJECT_NOT_FOUND",
      );
    }

    const existingMonitor = await this.monitorRepository.findByTargetUrl(
      projectId,
      input.targetUrl,
    );

    if (existingMonitor) {
      throw new AppError(
        "A monitor for this URL already exists in this project",
        409,
        "MONITOR_ALREADY_EXISTS",
      );
    }

    return this.monitorRepository.create(projectId, input);
  }

  async findAll(projectId: string) {
    const project = await this.monitorRepository.findProjectById(projectId);

    if (!project) {
      throw new AppError(
        "Project not found",
        404,
        "PROJECT_NOT_FOUND",
      );
    }

    return this.monitorRepository.findAllByProjectId(projectId);
  }
}