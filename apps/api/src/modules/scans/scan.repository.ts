import { prisma } from "../../infrastructure/database/prisma.js";

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
      },
    });
  }

  create(monitorId: string) {
    return prisma.$transaction(async (transaction) => {
      const scan = await transaction.scan.create({ data: { monitorId } });
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

  findAllByMonitorId(monitorId: string) {
    return prisma.scan.findMany({
      where: {
        monitorId,
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
