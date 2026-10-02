import { AppError } from "../../infrastructure/errors/app-error.js";
import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import type { CreateMonitorInput, UpdateMonitorInput } from "./monitor.schema.js";
import { MonitorRepository } from "./monitor.repository.js";

export class MonitorService {
  constructor(
    private readonly monitorRepository: MonitorRepository,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async create(projectId: string, userId: string, input: CreateMonitorInput) {
    const project = await this.monitorRepository.findProjectById(projectId);

    if (!project) {
      throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }

    await this.workspaceAccessService.requireRole(
      project.workspaceId,
      userId,
      ["OWNER", "ADMIN"],
      new AppError("Project not found", 404, "PROJECT_NOT_FOUND"),
    );

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

  async findAll(projectId: string, userId: string) {
    const project = await this.monitorRepository.findProjectById(projectId);

    if (!project) {
      throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }

    await this.workspaceAccessService.requireMember(
      project.workspaceId,
      userId,
      new AppError("Project not found", 404, "PROJECT_NOT_FOUND"),
    );

    return this.monitorRepository.findAllByProjectId(projectId);
  }

  async update(monitorId: string, userId: string, input: UpdateMonitorInput) {
    const monitor = await this.monitorRepository.findById(monitorId);
    if (!monitor) throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    await this.workspaceAccessService.requireRole(monitor.project.workspaceId, userId, ["OWNER", "ADMIN"]);
    return this.monitorRepository.update(monitorId, input);
  }

  async delete(monitorId: string, userId: string) {
    const monitor = await this.monitorRepository.findById(monitorId);
    if (!monitor) throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    await this.workspaceAccessService.requireRole(monitor.project.workspaceId, userId, ["OWNER", "ADMIN"]);
    await this.monitorRepository.delete(monitorId);
  }
}
