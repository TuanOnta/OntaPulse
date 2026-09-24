import type { ScanSchedulerService } from "./scan-scheduler.service.js";

const POLL_INTERVAL_MS = 10_000;

interface SchedulerLogger {
  error(context: object, message: string): void;
}

export class ScanScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly service: ScanSchedulerService,
    private readonly logger: SchedulerLogger,
  ) {}

  start(): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.run();
    }, POLL_INTERVAL_MS);

    void this.run();
  }

  stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  private async run(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      await this.service.runOnce();
    } catch (error) {
      this.logger.error({ err: error }, "Scan scheduler failed");
    } finally {
      this.running = false;
    }
  }
}
