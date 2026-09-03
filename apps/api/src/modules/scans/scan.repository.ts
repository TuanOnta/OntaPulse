import { prisma } from "../../infrastructure/database/prisma.js";

export class ScanRepository {
  findMonitorById(monitorId: string) {
    return prisma.monitor.findUnique({
      where: {
        id: monitorId,
      },

      select: {
        id: true,
      },
    });
  }

  create(monitorId: string) {
    return prisma.scan.create({
      data: {
        monitorId,
      },
    });
  }

  findAllByMonitorId(monitorId: string) {
    return prisma.scan.findMany({
      where: {
        monitorId,
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  }

  findById(scanId: string) {
    return prisma.scan.findUnique({
      where: {
        id: scanId,
      },

      include: {
        findings: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  }
}
