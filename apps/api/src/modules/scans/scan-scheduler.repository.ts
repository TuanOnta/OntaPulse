import { prisma } from "../../infrastructure/database/prisma.js";

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

      return transaction.scan.create({
        data: {
          monitorId: monitor.id,
        },
      });
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
}
