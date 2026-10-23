import { prisma } from "../../infrastructure/database/prisma.js";
import { SCHEDULED_KINDS } from "../scans/scan-kinds.js";

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
  securityNextScheduledAt: true,
  dnsNextScheduledAt: true,
} as const;

interface ScheduleColumns {
  securityNextScheduledAt: Date | null;
  dnsNextScheduledAt: Date | null;
}

/**
 * The recurring-run times that follow a switch. Switching a check on starts its schedule one interval from now, but
 * only when it has none, so sending "on" again does not push a run further away; switching it off clears it.
 */
export function scheduleFor(
  input: CheckSettingsWrite,
  current: ScheduleColumns | null,
  now: Date,
): Partial<ScheduleColumns> {
  const schedule: Partial<ScheduleColumns> = {};

  if (input.securityPostureEnabled === false) {
    schedule.securityNextScheduledAt = null;
  } else if (input.securityPostureEnabled === true && !current?.securityNextScheduledAt) {
    schedule.securityNextScheduledAt = new Date(
      now.getTime() + SCHEDULED_KINDS.SECURITY_POSTURE.intervalSeconds * 1_000,
    );
  }

  if (input.dnsWatchEnabled === false) {
    schedule.dnsNextScheduledAt = null;
  } else if (input.dnsWatchEnabled === true && !current?.dnsNextScheduledAt) {
    schedule.dnsNextScheduledAt = new Date(
      now.getTime() + SCHEDULED_KINDS.DNS_WATCH.intervalSeconds * 1_000,
    );
  }

  return schedule;
}

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

  /** Writes the switches together with the schedule they imply, in one transaction. */
  upsert(monitorId: string, input: CheckSettingsWrite, now = new Date()) {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.monitorCheckSettings.findUnique({
        where: { monitorId },
        select: { securityNextScheduledAt: true, dnsNextScheduledAt: true },
      });
      const data = { ...input, ...scheduleFor(input, current, now) };

      return transaction.monitorCheckSettings.upsert({
        where: { monitorId },
        create: { monitorId, ...data },
        update: data,
        select: settingsSelect,
      });
    });
  }
}
