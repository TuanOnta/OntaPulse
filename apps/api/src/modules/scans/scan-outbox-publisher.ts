import type { ScanQueue } from "../../infrastructure/queue/scan-queue.js";
import { ScanRepository } from "./scan.repository.js";

export class ScanOutboxPublisher {
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly repository: ScanRepository, private readonly queue: ScanQueue) {}

  start(): void {
    void this.publishPending();
    this.interval = setInterval(() => void this.publishPending(), 5_000);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  async publishPending(): Promise<void> {
    for (const event of await this.repository.pendingOutboxEvents()) {
      try {
        await this.queue.enqueue({ scanId: event.scanId, monitorId: event.monitorId });
        await this.repository.markOutboxPublished(event.id);
      } catch (error) {
        await this.repository.recordOutboxFailure(event.id, error);
      }
    }
  }
}
