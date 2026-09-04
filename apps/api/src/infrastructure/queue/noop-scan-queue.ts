import type { ScanJob, ScanQueue } from "./scan-queue.js";

export class NoopScanQueue implements ScanQueue {
  async enqueue(_job: ScanJob): Promise<void> {}

  async close(): Promise<void> {}
}
