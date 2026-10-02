import type { ScanQueue } from "../../infrastructure/queue/scan-queue.js";
import { ScanRepository } from "./scan.repository.js";

export class ScanOutboxPublisher {
  private interval: NodeJS.Timeout | null = null;
  private publishing = false;

  constructor(
    private readonly repository: ScanRepository,
    private readonly queue: ScanQueue,
    private readonly logger: { error(context: object, message: string): void },
  ) {}

  start(): void {
    void this.publishPending();
    this.interval = setInterval(() => void this.publishPending(), 5_000);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async publishPending(): Promise<void> {
    if (this.publishing) return;
    this.publishing = true;
    try {
      for (const event of await this.repository.claimPendingOutboxEvents()) {
        try {
          await this.queue.enqueue({ scanId: event.scanId, monitorId: event.monitorId });
          await this.repository.markOutboxPublished(event.id);
        } catch {
          await this.repository.recordOutboxFailure(event.id, undefined);
          this.logger.error(
            { outboxEventId: event.id, scanId: event.scanId },
            "Outbox publication failed",
          );
        }
      }
    } catch {
      this.logger.error({}, "Outbox polling failed");
    } finally {
      this.publishing = false;
    }
  }
}
