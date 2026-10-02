import { AppError } from "../../infrastructure/errors/app-error.js";
import type { ScanQueueOperations } from "../../infrastructure/queue/scan-queue.js";
import type { WorkspaceAccessService } from "../workspaces/workspace-access.service.js";
import { OperationsRepository } from "./operations.repository.js";

export class OperationsService {
  constructor(
    private readonly repository: OperationsRepository,
    private readonly queue: ScanQueueOperations,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async health(workspaceId: string, userId: string) {
    await this.workspaceAccessService.requireRole(workspaceId, userId, ["OWNER"]);
    const [workspace, broker] = await Promise.all([
      this.repository.workspaceHealth(workspaceId),
      this.queue.health(),
    ]);
    return { workspace, broker };
  }

  async redrive(workspaceId: string, scanId: string, userId: string) {
    const scan = await this.repository.findScanWorkspace(scanId);
    if (!scan || scan.monitor.project.workspaceId !== workspaceId) {
      throw new AppError("Scan not found", 404, "SCAN_NOT_FOUND");
    }
    await this.workspaceAccessService.requireRole(
      workspaceId,
      userId,
      ["OWNER"],
      new AppError("Scan not found", 404, "SCAN_NOT_FOUND"),
    );

    try {
      const result = await this.queue.redriveDeadLetter({ scanId, monitorId: scan.monitorId });
      await this.repository.audit("queue.dlq_redrive", userId, { workspaceId, scanId, result });
      return { result };
    } catch {
      await this.repository.audit("queue.dlq_redrive_failed", userId, { workspaceId, scanId });
      throw new AppError("Queue operation is unavailable", 503, "QUEUE_OPERATION_UNAVAILABLE");
    }
  }
}
