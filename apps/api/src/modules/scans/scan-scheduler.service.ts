import type { ScanSchedulerRepository } from "./scan-scheduler.repository.js";

interface SchedulerLogger {
  error(context: object, message: string): void;
  info(context: object, message: string): void;
}

export class ScanSchedulerService {
  constructor(
    private readonly repository: ScanSchedulerRepository,
    private readonly logger: SchedulerLogger,
  ) {}

  async runOnce(now = new Date()): Promise<number> {
    const startedAt = Date.now();
    const dueMonitors = await this.repository.findDueMonitors(now);
    let scheduledCount = 0;

    for (const monitor of dueMonitors) {
      const scan = await this.repository.claimAndCreateScan(monitor, now);

      if (!scan) {
        continue;
      }

      scheduledCount += 1;
    }

    if (dueMonitors.length > 0) {
      this.logger.info(
        {
          dueMonitorCount: dueMonitors.length,
          scheduledCount,
          durationMs: Date.now() - startedAt,
        },
        "Scan scheduler run completed",
      );
    }

    return scheduledCount;
  }
}
