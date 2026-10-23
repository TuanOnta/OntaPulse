import { AppError } from "../../infrastructure/errors/app-error.js";
import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { CheckSettingsRepository, type CheckSettingsWrite } from "./check-settings.repository.js";
import type { UpdateCheckSettingsInput } from "./check-settings.schema.js";

const DEFAULT_SETTINGS = {
  securityPostureEnabled: false,
  dnsWatchEnabled: false,
  pathProbesEnabled: false,
  pathProbesAcknowledgedAt: null,
  securityNextScanAt: null,
  dnsNextScanAt: null,
} as const;

type StoredSettings = NonNullable<Awaited<ReturnType<CheckSettingsRepository["findByMonitorId"]>>>;

/** The API names the stored next-run times `...NextScanAt`: when the next recurring scan is due, or null while off. */
function toResponse(settings: StoredSettings) {
  const { securityNextScheduledAt, dnsNextScheduledAt, ...rest } = settings;

  return {
    ...rest,
    securityNextScanAt: securityNextScheduledAt,
    dnsNextScanAt: dnsNextScheduledAt,
  };
}

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

    return settings ? toResponse(settings) : { monitorId, ...DEFAULT_SETTINGS };
  }

  async update(monitorId: string, userId: string, input: UpdateCheckSettingsInput) {
    const monitor = await this.requireMonitor(monitorId);

    await this.workspaceAccessService.requireRole(
      monitor.project.workspaceId,
      userId,
      ["OWNER", "ADMIN"],
      monitorNotFound(),
    );

    return toResponse(await this.repository.upsert(monitorId, toWrite(input, userId)));
  }

  private async requireMonitor(monitorId: string) {
    const monitor = await this.repository.findMonitorById(monitorId);

    if (!monitor) {
      throw monitorNotFound();
    }

    return monitor;
  }
}

/**
 * Path probes are opt-in. Switching them on needs the explicit acknowledgment and records who gave it and when;
 * switching them off clears it, so "enabled" always implies a stored acknowledgment and re-enabling needs a new one.
 */
function toWrite(input: UpdateCheckSettingsInput, userId: string): CheckSettingsWrite {
  const { pathProbesAcknowledged, ...switches } = input;

  if (input.pathProbesEnabled === true) {
    if (pathProbesAcknowledged !== true) {
      throw new AppError(
        "Enabling path probes needs the acknowledgment that you are authorized to test this target",
        400,
        "PATH_PROBE_ACKNOWLEDGMENT_REQUIRED",
      );
    }

    return {
      ...switches,
      pathProbesAcknowledgedById: userId,
      pathProbesAcknowledgedAt: new Date(),
    };
  }

  if (input.pathProbesEnabled === false) {
    return { ...switches, pathProbesAcknowledgedById: null, pathProbesAcknowledgedAt: null };
  }

  return switches;
}

function monitorNotFound(): AppError {
  return new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
}
