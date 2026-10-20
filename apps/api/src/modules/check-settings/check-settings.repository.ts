import { prisma } from "../../infrastructure/database/prisma.js";

/** What the service may write: the switches and, for path probes, who acknowledged and when (or null). */
export interface CheckSettingsWrite {
  securityPostureEnabled?: boolean;
  dnsWatchEnabled?: boolean;
  pathProbesEnabled?: boolean;
  pathProbesAcknowledgedById?: string | null;
  pathProbesAcknowledgedAt?: Date | null;
}

const settingsSelect = {
  monitorId: true,
  securityPostureEnabled: true,
  dnsWatchEnabled: true,
  pathProbesEnabled: true,
  pathProbesAcknowledgedAt: true,
} as const;

export class CheckSettingsRepository {
  findMonitorById(monitorId: string) {
    return prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { id: true, project: { select: { workspaceId: true } } },
    });
  }

  findByMonitorId(monitorId: string) {
    return prisma.monitorCheckSettings.findUnique({
      where: { monitorId },
      select: settingsSelect,
    });
  }

  upsert(monitorId: string, input: CheckSettingsWrite) {
    return prisma.monitorCheckSettings.upsert({
      where: { monitorId },
      create: { monitorId, ...input },
      update: input,
      select: settingsSelect,
    });
  }
}
