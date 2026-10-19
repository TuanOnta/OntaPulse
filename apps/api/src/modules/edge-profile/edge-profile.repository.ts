import { prisma } from "../../infrastructure/database/prisma.js";

export class EdgeProfileRepository {
  findMonitorById(monitorId: string) {
    return prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { id: true, project: { select: { workspaceId: true } } },
    });
  }

  findByMonitorId(monitorId: string) {
    return prisma.monitorEdgeProfile.findUnique({
      where: { monitorId },
      select: {
        monitorId: true,
        scanId: true,
        challengeObserved: true,
        detections: true,
        observedAt: true,
      },
    });
  }
}
