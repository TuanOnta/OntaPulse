import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../src/infrastructure/database/prisma.js";
import { ScanSchedulerRepository } from "../src/modules/scans/scan-scheduler.repository.js";
import { ScanSchedulerService } from "../src/modules/scans/scan-scheduler.service.js";
import { createTestIdentity, resetDatabase, TEST_WORKSPACE_ID } from "./helpers/database.js";

const schedulerLogs: Array<{ context: object; message: string }> = [];
const logger = {
  error: () => {},
  info: (context: object, message: string) => {
    schedulerLogs.push({ context, message });
  },
};

async function createMonitor(options: {
  isActive?: boolean;
  nextScheduledAt: Date;
  intervalSeconds?: number;
}) {
  const project = await prisma.project.create({
    data: {
      workspaceId: TEST_WORKSPACE_ID,
      name: "Scheduler Test Project",
    },
  });

  return prisma.monitor.create({
    data: {
      projectId: project.id,
      name: "Scheduler Test Monitor",
      targetUrl: `https://example.com/${crypto.randomUUID()}`,
      intervalSeconds: options.intervalSeconds ?? 60,
      isActive: options.isActive ?? true,
      nextScheduledAt: options.nextScheduledAt,
    },
  });
}

describe("Scan scheduler", () => {
  beforeEach(async () => {
    schedulerLogs.length = 0;
    await resetDatabase();
    await createTestIdentity();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("queues due active monitors and advances their next schedule", async () => {
    const now = new Date("2026-09-17T00:00:00.000Z");
    const monitor = await createMonitor({
      nextScheduledAt: new Date("2026-09-16T23:59:00.000Z"),
      intervalSeconds: 300,
    });
    const scheduler = new ScanSchedulerService(new ScanSchedulerRepository(), logger);

    await expect(scheduler.runOnce(now)).resolves.toBe(1);

    const scans = await prisma.scan.findMany({ where: { monitorId: monitor.id } });
    const updatedMonitor = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(scans).toHaveLength(1);
    expect(scans[0]).toMatchObject({ monitorId: monitor.id, status: "QUEUED" });
    await expect(
      prisma.scanOutboxEvent.findUnique({ where: { scanId: scans[0].id } }),
    ).resolves.toMatchObject({
      monitorId: monitor.id,
      status: "PENDING",
    });
    expect(updatedMonitor.nextScheduledAt).toEqual(new Date("2026-09-17T00:05:00.000Z"));
    expect(schedulerLogs).toEqual([
      {
        context: {
          dueMonitorCount: 1,
          scheduledCount: 1,
          durationMs: expect.any(Number),
        },
        message: "Scan scheduler run completed",
      },
    ]);
  });

  it("does not queue inactive or not-yet-due monitors", async () => {
    const now = new Date("2026-09-17T00:00:00.000Z");
    await createMonitor({ isActive: false, nextScheduledAt: new Date("2026-09-16T23:59:00.000Z") });
    await createMonitor({ nextScheduledAt: new Date("2026-09-17T00:01:00.000Z") });
    const scheduler = new ScanSchedulerService(new ScanSchedulerRepository(), logger);

    await expect(scheduler.runOnce(now)).resolves.toBe(0);
    await expect(prisma.scan.count()).resolves.toBe(0);
  });

  it("keeps scheduled work pending in the outbox until the broker recovers", async () => {
    const now = new Date("2026-09-17T00:00:00.000Z");
    const monitor = await createMonitor({ nextScheduledAt: now });
    const scheduler = new ScanSchedulerService(new ScanSchedulerRepository(), logger);

    await expect(scheduler.runOnce(now)).resolves.toBe(1);

    const scan = await prisma.scan.findFirstOrThrow({ where: { monitorId: monitor.id } });
    expect(scan).toMatchObject({ status: "QUEUED", errorMessage: null, finishedAt: null });
    await expect(
      prisma.scanOutboxEvent.findUnique({ where: { scanId: scan.id } }),
    ).resolves.toMatchObject({
      status: "PENDING",
    });
    expect(schedulerLogs).toEqual([
      {
        context: {
          dueMonitorCount: 1,
          scheduledCount: 1,
          durationMs: expect.any(Number),
        },
        message: "Scan scheduler run completed",
      },
    ]);
  });

  it("claims a due monitor only once when schedulers overlap", async () => {
    const now = new Date("2026-09-17T00:00:00.000Z");
    const monitor = await createMonitor({ nextScheduledAt: now });
    const firstScheduler = new ScanSchedulerService(new ScanSchedulerRepository(), logger);
    const secondScheduler = new ScanSchedulerService(new ScanSchedulerRepository(), logger);

    const results = await Promise.all([firstScheduler.runOnce(now), secondScheduler.runOnce(now)]);

    expect(results.sort()).toEqual([0, 1]);
    await expect(prisma.scan.count({ where: { monitorId: monitor.id } })).resolves.toBe(1);
    await expect(prisma.scanOutboxEvent.count()).resolves.toBe(1);
  });
});
