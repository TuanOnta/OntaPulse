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
