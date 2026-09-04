import { AppError } from "../../infrastructure/errors/app-error.js";
import type { ScanQueue } from "../../infrastructure/queue/scan-queue.js";
import { ScanRepository } from "./scan.repository.js";

export class ScanService {
  constructor(
    private readonly scanRepository: ScanRepository,
    private readonly scanQueue: ScanQueue,
  ) {}

  async trigger(monitorId: string) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    const scan = await this.scanRepository.create(monitorId);

    try {
      await this.scanQueue.enqueue({
        scanId: scan.id,
        monitorId,
      });
    } catch (error) {
      await this.scanRepository.markFailed(scan.id, "Scan queue is unavailable");

      throw new AppError("Scan queue is unavailable", 503, "SCAN_QUEUE_UNAVAILABLE", undefined, {
        cause: error,
      });
    }

    return scan;
  }

  async findAll(monitorId: string) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    return this.scanRepository.findAllByMonitorId(monitorId);
  }

  async findById(scanId: string) {
    const scan = await this.scanRepository.findById(scanId);

    if (!scan) {
      throw new AppError("Scan not found", 404, "SCAN_NOT_FOUND");
    }

    return scan;
  }
}
