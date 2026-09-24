import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../src/infrastructure/database/prisma.js";
import type { ScanJob, ScanQueue } from "../src/infrastructure/queue/scan-queue.js";
import { ScanSchedulerRepository } from "../src/modules/scans/scan-scheduler.repository.js";
import { ScanSchedulerService } from "../src/modules/scans/scan-scheduler.service.js";
import { createTestIdentity, resetDatabase, TEST_WORKSPACE_ID } from "./helpers/database.js";

class FakeScanQueue implements ScanQueue {
  jobs: ScanJob[] = [];
  enqueueError: Error | null = null;

  async enqueue(job: ScanJob): Promise<void> {
    if (this.enqueueError) {
      throw this.enqueueError;
    }

    this.jobs.push(job);
  }

  async close(): Promise<void> {}
}

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
    const queue = new FakeScanQueue();
    const scheduler = new ScanSchedulerService(new ScanSchedulerRepository(), queue, logger);

    await expect(scheduler.runOnce(now)).resolves.toBe(1);

    const scans = await prisma.scan.findMany({ where: { monitorId: monitor.id } });
    const updatedMonitor = await prisma.monitor.findUniqueOrThrow({ where: { id: monitor.id } });

    expect(scans).toHaveLength(1);
    expect(scans[0]).toMatchObject({ monitorId: monitor.id, status: "QUEUED" });
    expect(queue.jobs).toEqual([{ scanId: scans[0].id, monitorId: monitor.id }]);
    expect(updatedMonitor.nextScheduledAt).toEqual(new Date("2026-09-17T00:05:00.000Z"));
    expect(schedulerLogs).toEqual([
      {
        context: {
          dueMonitorCount: 1,
          scheduledCount: 1,
          failedEnqueueCount: 0,
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
    const queue = new FakeScanQueue();
    const scheduler = new ScanSchedulerService(new ScanSchedulerRepository(), queue, logger);

    await expect(scheduler.runOnce(now)).resolves.toBe(0);
    await expect(prisma.scan.count()).resolves.toBe(0);
    expect(queue.jobs).toEqual([]);
  });

  it("records a safe failure when the queue is unavailable", async () => {
    const now = new Date("2026-09-17T00:00:00.000Z");
    const monitor = await createMonitor({ nextScheduledAt: now });
    const queue = new FakeScanQueue();
    queue.enqueueError = new Error("RabbitMQ connection failed");
    const scheduler = new ScanSchedulerService(new ScanSchedulerRepository(), queue, logger);

    await expect(scheduler.runOnce(now)).resolves.toBe(1);

    const scan = await prisma.scan.findFirstOrThrow({ where: { monitorId: monitor.id } });
    expect(scan).toMatchObject({
      status: "FAILED",
      errorMessage: "Scan queue is unavailable",
      finishedAt: expect.any(Date),
    });
    expect(schedulerLogs).toEqual([
      {
        context: {
          dueMonitorCount: 1,
          scheduledCount: 1,
          failedEnqueueCount: 1,
          durationMs: expect.any(Number),
        },
        message: "Scan scheduler run completed",
      },
    ]);
  });

  it("claims a due monitor only once when schedulers overlap", async () => {
    const now = new Date("2026-09-17T00:00:00.000Z");
    const monitor = await createMonitor({ nextScheduledAt: now });
    const queue = new FakeScanQueue();
    const firstScheduler = new ScanSchedulerService(new ScanSchedulerRepository(), queue, logger);
    const secondScheduler = new ScanSchedulerService(new ScanSchedulerRepository(), queue, logger);

    const results = await Promise.all([firstScheduler.runOnce(now), secondScheduler.runOnce(now)]);

    expect(results.sort()).toEqual([0, 1]);
    await expect(prisma.scan.count({ where: { monitorId: monitor.id } })).resolves.toBe(1);
    expect(queue.jobs).toHaveLength(1);
  });
});
