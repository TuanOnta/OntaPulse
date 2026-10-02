import { AppError } from "../../infrastructure/errors/app-error.js";
import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { ScanRepository } from "./scan.repository.js";

export class ScanService {
  constructor(
    private readonly scanRepository: ScanRepository,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async trigger(monitorId: string, userId: string) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    await this.workspaceAccessService.requireRole(
      monitor.project.workspaceId,
      userId,
      ["OWNER", "ADMIN"],
      new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND"),
    );

    const scan = await this.scanRepository.create(monitorId);

    return scan;
  }

  async findAll(monitorId: string, userId: string) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    await this.workspaceAccessService.requireMember(
      monitor.project.workspaceId,
      userId,
      new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND"),
    );

    return this.scanRepository.findAllByMonitorId(monitorId);
  }

  async findById(scanId: string, userId: string) {
    const scan = await this.scanRepository.findById(scanId);

    if (!scan) {
      throw new AppError("Scan not found", 404, "SCAN_NOT_FOUND");
    }

    await this.workspaceAccessService.requireMember(
      scan.monitor.project.workspaceId,
      userId,
      new AppError("Scan not found", 404, "SCAN_NOT_FOUND"),
    );

    const { monitor: _monitor, ...authorizedScan } = scan;

    return authorizedScan;
  }
}
