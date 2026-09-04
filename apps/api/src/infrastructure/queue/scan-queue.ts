export interface ScanJob {
  scanId: string;
  monitorId: string;
}

export interface ScanQueue {
  enqueue(job: ScanJob): Promise<void>;
  close(): Promise<void>;
}
