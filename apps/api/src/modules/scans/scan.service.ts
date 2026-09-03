import { AppError } from "../../infrastructure/errors/app-error.js";
import { ScanRepository } from "./scan.repository.js";

export class ScanService {
  constructor(private readonly scanRepository: ScanRepository) {}

  async trigger(monitorId: string) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    return this.scanRepository.create(monitorId);
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
