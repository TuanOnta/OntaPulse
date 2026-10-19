import { AppError } from "../../infrastructure/errors/app-error.js";
import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { CheckSettingsRepository } from "./check-settings.repository.js";
import type { UpdateCheckSettingsInput } from "./check-settings.schema.js";

const DEFAULT_SETTINGS = {
  securityPostureEnabled: false,
  dnsWatchEnabled: false,
  pathProbesEnabled: false,
  pathProbesAcknowledgedAt: null,
} as const;

export class CheckSettingsService {
  constructor(
    private readonly repository: CheckSettingsRepository,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async get(monitorId: string, userId: string) {
    const monitor = await this.requireMonitor(monitorId);

    await this.workspaceAccessService.requireMember(
      monitor.project.workspaceId,
      userId,
      monitorNotFound(),
    );

    const settings = await this.repository.findByMonitorId(monitorId);

    return settings ?? { monitorId, ...DEFAULT_SETTINGS };
  }

  async update(monitorId: string, userId: string, input: UpdateCheckSettingsInput) {
    const monitor = await this.requireMonitor(monitorId);

    await this.workspaceAccessService.requireRole(
      monitor.project.workspaceId,
      userId,
      ["OWNER", "ADMIN"],
      monitorNotFound(),
    );

    return this.repository.upsert(monitorId, input);
  }

  private async requireMonitor(monitorId: string) {
    const monitor = await this.repository.findMonitorById(monitorId);

    if (!monitor) {
      throw monitorNotFound();
    }

    return monitor;
  }
}

function monitorNotFound(): AppError {
  return new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
}
