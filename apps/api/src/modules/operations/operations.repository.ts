import { prisma } from "../../infrastructure/database/prisma.js";

export class OperationsRepository {
  findScanWorkspace(scanId: string) {
    return prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        monitorId: true,
        monitor: { select: { project: { select: { workspaceId: true } } } },
      },
    });
  }

  async workspaceHealth(workspaceId: string, now = new Date()) {
    const stuckBefore = new Date(now.getTime() - 15 * 60_000);
    const [pendingOutbox, queued, stuckRunning, failedRecently] = await Promise.all([
      prisma.scanOutboxEvent.count({
        where: {
          status: { in: ["PENDING", "PUBLISHING"] },
          scan: { monitor: { project: { workspaceId } } },
        },
      }),
      prisma.scan.count({ where: { status: "QUEUED", monitor: { project: { workspaceId } } } }),
      prisma.scan.count({
        where: {
          status: "RUNNING",
          startedAt: { lt: stuckBefore },
          monitor: { project: { workspaceId } },
        },
      }),
      prisma.scan.count({
        where: {
          status: "FAILED",
          finishedAt: { gte: stuckBefore },
          monitor: { project: { workspaceId } },
        },
      }),
    ]);
    return { pendingOutbox, queued, stuckRunning, failedRecently, generatedAt: now };
  }

  audit(action: string, actor: string, details: Record<string, string>) {
    return prisma.operationsAuditLog.create({ data: { action, actor, details } });
  }
}
