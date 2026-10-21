import { prisma } from "../../infrastructure/database/prisma.js";
import { MAX_DNS_CHANGE_HISTORY } from "./domain-watch.constants.js";

export class DomainWatchRepository {
  findMonitorById(monitorId: string) {
    return prisma.monitor.findUnique({
      where: { id: monitorId },
      select: { id: true, project: { select: { workspaceId: true } } },
    });
  }

  findBaselineByMonitorId(monitorId: string) {
    return prisma.dnsBaseline.findUnique({
      where: { monitorId },
      select: {
        monitorId: true,
        scanId: true,
        host: true,
        organizationDomain: true,
        snapshot: true,
        observedAt: true,
      },
    });
  }

  findRecentChanges(monitorId: string) {
    return prisma.dnsChange.findMany({
      where: { monitorId },
      orderBy: { observedAt: "desc" },
      take: MAX_DNS_CHANGE_HISTORY,
      select: { scanId: true, observedAt: true, changes: true },
    });
  }
}
