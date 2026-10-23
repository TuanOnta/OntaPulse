import { SCHEDULED_KINDS, type ScheduledScanKind } from "./scan-kinds.js";
import {
  CheckSchedulerRepository,
  type CheckClaimResult,
  type ScanSchedulerRepository,
} from "./scan-scheduler.repository.js";

interface SchedulerLogger {
  error(context: object, message: string): void;
  info(context: object, message: string): void;
}

export interface CheckPassCounts {
  dueCount: number;
  scheduledCount: number;
  skippedCount: number;
  skipped: { workspace_limit: number; in_flight: number };
  failedCount: number;
}

const SCHEDULED_KIND_NAMES = Object.keys(SCHEDULED_KINDS) as ScheduledScanKind[];

export class ScanSchedulerService {
  constructor(
    private readonly repository: ScanSchedulerRepository,
    private readonly logger: SchedulerLogger,
    private readonly checkRepository: CheckSchedulerRepository = new CheckSchedulerRepository(),
  ) {}

  /**
   * One scheduler cycle: the availability pass first (unchanged), then the recurring security and DNS pass. The
   * return value is the number of availability scans queued, as before; the check pass reports in its own log event.
   */
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

    await this.runCheckPass(now);

    return scheduledCount;
  }

  /**
   * Queues the due recurring scans of every scheduled kind. A skipped occurrence (workspace at its hourly limit, or
   * a scan of that kind still in flight) still advances the schedule, and one failing monitor never stops the rest.
   * The log carries counts only: no hostnames and nothing read from a target.
   */
  private async runCheckPass(now: Date): Promise<void> {
    const startedAt = Date.now();
    const kinds: Partial<Record<ScheduledScanKind, CheckPassCounts>> = {};

    for (const kind of SCHEDULED_KIND_NAMES) {
      const due = await this.checkRepository.findDueChecks(kind, now);

      if (due.length === 0) {
        continue;
      }

      const counts: CheckPassCounts = {
        dueCount: due.length,
        scheduledCount: 0,
        skippedCount: 0,
        skipped: { workspace_limit: 0, in_flight: 0 },
        failedCount: 0,
      };
      kinds[kind] = counts;

      for (const check of due) {
        let result: CheckClaimResult;

        try {
          result = await this.checkRepository.claimAndCreateCheckScan(kind, check, now);
        } catch (error) {
          counts.failedCount += 1;
          this.logger.error(
            { err: error, kind, monitorId: check.monitorId },
            "Scheduled check scan failed",
          );
          continue;
        }

        if (result === "scheduled") {
          counts.scheduledCount += 1;
        } else if (result === "workspace_limit" || result === "in_flight") {
          counts.skippedCount += 1;
          counts.skipped[result] += 1;
        }
      }
    }

    if (Object.keys(kinds).length > 0) {
      this.logger.info(
        { kinds, durationMs: Date.now() - startedAt },
        "Check scan scheduler run completed",
      );
    }
  }
}
