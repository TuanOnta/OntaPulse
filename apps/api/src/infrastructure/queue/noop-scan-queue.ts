import type {
  DeadLetterRedriveResult,
  QueueHealth,
  ScanJob,
  ScanQueue,
  ScanQueueOperations,
} from "./scan-queue.js";

export class NoopScanQueue implements ScanQueue, ScanQueueOperations {
  async enqueue(_job: ScanJob): Promise<void> {}

  async close(): Promise<void> {}

  async health(): Promise<QueueHealth> {
    return { main: 0, retry: 0, deadLetter: 0 };
  }

  async redriveDeadLetter(_job: ScanJob): Promise<DeadLetterRedriveResult> {
    return "EMPTY";
  }
}
