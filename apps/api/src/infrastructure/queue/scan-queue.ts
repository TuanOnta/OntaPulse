export interface ScanJob {
  scanId: string;
  monitorId: string;
}

export interface ScanQueue {
  enqueue(job: ScanJob): Promise<void>;
  close(): Promise<void>;
}

export interface QueueHealth {
  main: number;
  retry: number;
  deadLetter: number;
}

export type DeadLetterRedriveResult = "REDRIVEN" | "EMPTY" | "HEAD_MISMATCH" | "INVALID_MESSAGE";

export interface ScanQueueOperations {
  health(): Promise<QueueHealth>;
  redriveDeadLetter(job: ScanJob): Promise<DeadLetterRedriveResult>;
}
