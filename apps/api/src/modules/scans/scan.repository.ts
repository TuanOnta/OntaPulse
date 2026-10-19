import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../infrastructure/errors/app-error.js";
import { DEFAULT_SCAN_KIND, WORKSPACE_LIMIT_WINDOW_SECONDS, type ScanKind } from "./scan-kinds.js";

export class ScanRepository {
  findMonitorById(monitorId: string) {
    return prisma.monitor.findUnique({
      where: {
        id: monitorId,
      },

      select: {
        id: true,
        project: {
          select: {
            workspaceId: true,
          },
        },
        checkSettings: {
          select: {
            securityPostureEnabled: true,
            dnsWatchEnabled: true,
          },
        },
      },
    });
  }

  /**
   * Creates a rate-limited scan. A per-workspace advisory lock serializes concurrent triggers so
   * two requests cannot both pass the interval and workspace checks.
   */
  createRateLimited(
    monitorId: string,
    workspaceId: string,
    kind: ScanKind,
    limits: { minIntervalSeconds: number; workspaceLimitPerWindow: number },
    now = new Date(),
  ) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${workspaceId}, 0))`;

      const lastScan = await transaction.scan.findFirst({
        where: { monitorId, kind },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      if (lastScan) {
        const retryAfterSeconds = Math.ceil(
          (lastScan.createdAt.getTime() + limits.minIntervalSeconds * 1_000 - now.getTime()) /
            1_000,
        );

        if (retryAfterSeconds > 0) {
          throw new AppError("Scan rate limit reached", 429, "SCAN_RATE_LIMITED", {
            retryAfterSeconds,
          });
        }
      }

      const windowStart = new Date(now.getTime() - WORKSPACE_LIMIT_WINDOW_SECONDS * 1_000);
      const recent = await transaction.scan.findMany({
        where: { kind, createdAt: { gte: windowStart }, monitor: { project: { workspaceId } } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
        take: limits.workspaceLimitPerWindow,
      });

      if (recent.length >= limits.workspaceLimitPerWindow) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil(
            (recent[0]!.createdAt.getTime() +
              WORKSPACE_LIMIT_WINDOW_SECONDS * 1_000 -
              now.getTime()) /
              1_000,
          ),
        );

        throw new AppError("Scan rate limit reached", 429, "SCAN_RATE_LIMITED", {
          retryAfterSeconds,
        });
      }

      const scan = await transaction.scan.create({ data: { monitorId, kind } });
      await transaction.scanOutboxEvent.create({ data: { scanId: scan.id, monitorId } });
      return scan;
    });
  }

  create(monitorId: string, kind: ScanKind = DEFAULT_SCAN_KIND) {
    return prisma.$transaction(async (transaction) => {
      const scan = await transaction.scan.create({ data: { monitorId, kind } });
      await transaction.scanOutboxEvent.create({
        data: { scanId: scan.id, monitorId },
      });
      return scan;
    });
  }

  pendingOutboxEvents() {
    return prisma.scanOutboxEvent.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }

  async claimPendingOutboxEvents(now = new Date()) {
    const staleBefore = new Date(now.getTime() - 60_000);
    const candidates = await prisma.scanOutboxEvent.findMany({
      where: {
        OR: [{ status: "PENDING" }, { status: "PUBLISHING", claimedAt: { lt: staleBefore } }],
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    const claimed = [];
    for (const event of candidates) {
      const result = await prisma.scanOutboxEvent.updateMany({
        where: {
          id: event.id,
          OR: [{ status: "PENDING" }, { status: "PUBLISHING", claimedAt: { lt: staleBefore } }],
        },
        data: { status: "PUBLISHING", claimedAt: now },
      });
      if (result.count === 1) claimed.push(event);
    }

    return claimed;
  }

  markOutboxPublished(id: string) {
    return prisma.scanOutboxEvent.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: new Date(), claimedAt: null, lastError: null },
    });
  }

  recordOutboxFailure(id: string, error: unknown) {
    return prisma.scanOutboxEvent.update({
      where: { id },
      data: {
        status: "PENDING",
        claimedAt: null,
        attempts: { increment: 1 },
        lastError: "Queue publication failed",
      },
    });
  }

  markFailed(scanId: string, errorMessage: string) {
    return prisma.scan.update({
      where: {
        id: scanId,
      },

      data: {
        status: "FAILED",
        errorMessage,
        finishedAt: new Date(),
      },
    });
  }

  findLatestTerminalByKind(monitorId: string, kind: ScanKind) {
    return prisma.scan.findFirst({
      where: { monitorId, kind, status: { in: ["SUCCEEDED", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      include: { findings: { orderBy: { createdAt: "asc" } } },
    });
  }

  findAllByMonitorId(monitorId: string, kind?: ScanKind) {
    return prisma.scan.findMany({
      where: {
        monitorId,
        ...(kind ? { kind } : {}),
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }

  findById(scanId: string) {
    return prisma.scan.findUnique({
      where: {
        id: scanId,
      },

      include: {
        findings: {
          orderBy: {
            createdAt: "asc",
          },
        },
        monitor: {
          select: {
            project: {
              select: {
                workspaceId: true,
              },
            },
          },
        },
      },
    });
  }
}
