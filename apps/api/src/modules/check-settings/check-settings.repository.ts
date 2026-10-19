import { prisma } from "../../infrastructure/database/prisma.js";
import type { UpdateCheckSettingsInput } from "./check-settings.schema.js";

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

  upsert(monitorId: string, input: UpdateCheckSettingsInput) {
    return prisma.monitorCheckSettings.upsert({
      where: { monitorId },
      create: { monitorId, ...input },
      update: input,
      select: settingsSelect,
    });
  }
}
