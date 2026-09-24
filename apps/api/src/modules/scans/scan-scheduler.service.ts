import type { ScanQueue } from "../../infrastructure/queue/scan-queue.js";
import type { DueMonitor, ScanSchedulerRepository } from "./scan-scheduler.repository.js";

interface SchedulerLogger {
  error(context: object, message: string): void;
  info(context: object, message: string): void;
}

export class ScanSchedulerService {
  constructor(
    private readonly repository: ScanSchedulerRepository,
    private readonly scanQueue: ScanQueue,
    private readonly logger: SchedulerLogger,
  ) {}

  async runOnce(now = new Date()): Promise<number> {
    const startedAt = Date.now();
    const dueMonitors = await this.repository.findDueMonitors(now);
    let scheduledCount = 0;
    let failedEnqueueCount = 0;

    for (const monitor of dueMonitors) {
      const scan = await this.repository.claimAndCreateScan(monitor, now);

      if (!scan) {
        continue;
      }

      scheduledCount += 1;
      if (!(await this.enqueue(monitor, scan.id))) {
        failedEnqueueCount += 1;
      }
    }

    if (dueMonitors.length > 0) {
      this.logger.info(
        {
          dueMonitorCount: dueMonitors.length,
          scheduledCount,
          failedEnqueueCount,
          durationMs: Date.now() - startedAt,
        },
        "Scan scheduler run completed",
      );
    }

    return scheduledCount;
  }

  private async enqueue(monitor: DueMonitor, scanId: string): Promise<boolean> {
    try {
      await this.scanQueue.enqueue({
        scanId,
        monitorId: monitor.id,
      });
      return true;
    } catch (error) {
      await this.repository.markFailed(scanId, "Scan queue is unavailable");
      this.logger.error(
        { err: error, monitorId: monitor.id, scanId },
        "Scheduled scan queue unavailable",
      );
      return false;
    }
  }
}
