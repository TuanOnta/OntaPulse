import { AppError } from "../../infrastructure/errors/app-error.js";
import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import {
  DEFAULT_SCAN_KIND,
  isScanKindAvailable,
  SCAN_KIND_LIMITS,
  type ScanKind,
} from "./scan-kinds.js";
import { ScanRepository } from "./scan.repository.js";

export class ScanService {
  constructor(
    private readonly scanRepository: ScanRepository,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async trigger(monitorId: string, userId: string, kind: ScanKind = DEFAULT_SCAN_KIND) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    await this.workspaceAccessService.requireRole(
      monitor.project.workspaceId,
      userId,
      ["OWNER", "ADMIN"],
      new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND"),
    );

    if (!isScanKindAvailable(kind)) {
      throw new AppError("Scan kind is not available", 400, "SCAN_KIND_NOT_AVAILABLE");
    }

    const limits = SCAN_KIND_LIMITS[kind];

    if (!limits) {
      return this.scanRepository.create(monitorId, kind);
    }

    const enabled =
      kind === "SECURITY_POSTURE"
        ? monitor.checkSettings?.securityPostureEnabled
        : monitor.checkSettings?.dnsWatchEnabled;

    if (!enabled) {
      // The error code is shared by both kinds so existing clients keep working; the message says which.
      throw new AppError(
        kind === "DNS_WATCH"
          ? "DNS watch is not enabled for this monitor"
          : "Security checks are not enabled for this monitor",
        409,
        "SECURITY_CHECKS_DISABLED",
      );
    }

    const scan = await this.scanRepository.createRateLimited(
      monitorId,
      monitor.project.workspaceId,
      kind,
      limits,
    );

    return scan;
  }

  async findAll(monitorId: string, userId: string, kind?: ScanKind) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    await this.workspaceAccessService.requireMember(
      monitor.project.workspaceId,
      userId,
      new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND"),
    );

    return this.scanRepository.findAllByMonitorId(monitorId, kind);
  }

  async findById(scanId: string, userId: string) {
    const scan = await this.scanRepository.findById(scanId);

    if (!scan) {
      throw new AppError("Scan not found", 404, "SCAN_NOT_FOUND");
    }

    await this.workspaceAccessService.requireMember(
      scan.monitor.project.workspaceId,
      userId,
      new AppError("Scan not found", 404, "SCAN_NOT_FOUND"),
    );

    const { monitor: _monitor, ...authorizedScan } = scan;

    return authorizedScan;
  }

  async findLatestDnsWatch(monitorId: string, userId: string) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    await this.workspaceAccessService.requireMember(
      monitor.project.workspaceId,
      userId,
      new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND"),
    );

    const scan = await this.scanRepository.findLatestTerminalByKind(monitorId, "DNS_WATCH");

    if (!scan) {
      throw new AppError("No DNS watch scan found", 404, "NO_DNS_SCAN");
    }

    return scan;
  }

  async findLatestSecurityPosture(monitorId: string, userId: string) {
    const monitor = await this.scanRepository.findMonitorById(monitorId);

    if (!monitor) {
      throw new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND");
    }

    await this.workspaceAccessService.requireMember(
      monitor.project.workspaceId,
      userId,
      new AppError("Monitor not found", 404, "MONITOR_NOT_FOUND"),
    );

    const scan = await this.scanRepository.findLatestTerminalByKind(monitorId, "SECURITY_POSTURE");

    if (!scan) {
      throw new AppError("No security posture scan found", 404, "NO_SECURITY_SCAN");
    }

    return scan;
  }
}
