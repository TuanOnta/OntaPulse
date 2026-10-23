import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { SCHEDULED_KINDS, type ScheduledScanKind } from "./scan-kinds.js";
import { workspaceLimitRetryAfterSeconds } from "./scan.repository.js";

const SCHEDULE_BATCH_SIZE = 100;

export interface DueMonitor {
  id: string;
  intervalSeconds: number;
}

export class ScanSchedulerRepository {
  findDueMonitors(now: Date): Promise<DueMonitor[]> {
    return prisma.monitor.findMany({
      where: {
        isActive: true,
        nextScheduledAt: {
          lte: now,
        },
      },
      select: {
        id: true,
        intervalSeconds: true,
      },
      orderBy: {
        nextScheduledAt: "asc",
      },
      take: SCHEDULE_BATCH_SIZE,
    });
  }

  async claimAndCreateScan(monitor: DueMonitor, now: Date) {
    const nextScheduledAt = new Date(now.getTime() + monitor.intervalSeconds * 1_000);

    return prisma.$transaction(async (transaction) => {
      const claim = await transaction.monitor.updateMany({
        where: {
          id: monitor.id,
          isActive: true,
          nextScheduledAt: {
            lte: now,
          },
        },
        data: {
          nextScheduledAt,
        },
      });

      if (claim.count === 0) {
        return null;
      }

      const scan = await transaction.scan.create({
        data: {
          monitorId: monitor.id,
        },
      });
      await transaction.scanOutboxEvent.create({
        data: { scanId: scan.id, monitorId: monitor.id },
      });
      return scan;
    });
  }
}

export interface DueCheck {
  monitorId: string;
  workspaceId: string;
}

export type CheckClaimResult = "scheduled" | "lost_claim" | "workspace_limit" | "in_flight";

function dueCheckWhere(kind: ScheduledScanKind, now: Date): Prisma.MonitorCheckSettingsWhereInput {
  return kind === "SECURITY_POSTURE"
    ? {
        securityPostureEnabled: true,
        securityNextScheduledAt: { lte: now },
        monitor: { isActive: true },
      }
    : { dnsWatchEnabled: true, dnsNextScheduledAt: { lte: now }, monitor: { isActive: true } };
}

/** The claim: the same conditions as "due", on one monitor, so only one scheduler instance moves the schedule. */
function claimCheckWhere(
  kind: ScheduledScanKind,
  monitorId: string,
  now: Date,
): Prisma.MonitorCheckSettingsWhereInput {
  return { monitorId, ...dueCheckWhere(kind, now) };
}

function nextCheckData(
  kind: ScheduledScanKind,
  next: Date,
): Prisma.MonitorCheckSettingsUpdateManyMutationInput {
  return kind === "SECURITY_POSTURE"
    ? { securityNextScheduledAt: next }
    : { dnsNextScheduledAt: next };
}

export class CheckSchedulerRepository {
  /** Monitors whose `kind` check is on, active, and due, oldest first. */
  async findDueChecks(kind: ScheduledScanKind, now: Date): Promise<DueCheck[]> {
    const rows = await prisma.monitorCheckSettings.findMany({
      where: dueCheckWhere(kind, now),
      select: {
        monitorId: true,
        monitor: { select: { project: { select: { workspaceId: true } } } },
      },
      orderBy:
        kind === "SECURITY_POSTURE"
          ? { securityNextScheduledAt: "asc" }
          : { dnsNextScheduledAt: "asc" },
      take: SCHEDULE_BATCH_SIZE,
    });

    return rows.map((row) => ({
      monitorId: row.monitorId,
      workspaceId: row.monitor.project.workspaceId,
    }));
  }

  /**
   * Claims one due occurrence and, unless it has to be skipped, creates the scan and its outbox event in the same
   * transaction. The schedule advances by one interval from `now` in every case but a lost claim: a skipped
   * occurrence is not retried, so a full workspace or a stopped worker never turns into a catch-up burst. A
   * rolled-back transaction leaves the old time, so a retried cycle cannot queue the same occurrence twice.
   */
  claimAndCreateCheckScan(
    kind: ScheduledScanKind,
    due: DueCheck,
    now: Date,
  ): Promise<CheckClaimResult> {
    const { intervalSeconds, workspaceLimitPerWindow } = SCHEDULED_KINDS[kind];
    const next = new Date(now.getTime() + intervalSeconds * 1_000);

    return prisma.$transaction(async (transaction) => {
      // Same per-workspace lock as manual triggers, so the hourly count cannot be passed by two writers at once.
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${due.workspaceId}, 0))`;

      const claim = await transaction.monitorCheckSettings.updateMany({
        where: claimCheckWhere(kind, due.monitorId, now),
        data: nextCheckData(kind, next),
      });

      if (claim.count === 0) {
        return "lost_claim";
      }

      const inFlight = await transaction.scan.count({
        where: { monitorId: due.monitorId, kind, status: { in: ["QUEUED", "RUNNING"] } },
      });

      if (inFlight > 0) {
        return "in_flight";
      }

      const limitRetryAfter = await workspaceLimitRetryAfterSeconds(
        transaction,
        due.workspaceId,
        kind,
        workspaceLimitPerWindow,
        now,
      );

      if (limitRetryAfter !== null) {
        return "workspace_limit";
      }

      const scan = await transaction.scan.create({ data: { monitorId: due.monitorId, kind } });
      await transaction.scanOutboxEvent.create({
        data: { scanId: scan.id, monitorId: due.monitorId },
      });
      return "scheduled";
    });
  }
}
