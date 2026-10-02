import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../src/infrastructure/database/prisma.js";
import type { ScanJob, ScanQueue } from "../src/infrastructure/queue/scan-queue.js";
import { ScanOutboxPublisher } from "../src/modules/scans/scan-outbox-publisher.js";
import { ScanRepository } from "../src/modules/scans/scan.repository.js";
import { createTestIdentity, resetDatabase, TEST_WORKSPACE_ID } from "./helpers/database.js";

class FakeScanQueue implements ScanQueue {
  jobs: ScanJob[] = [];
  error: Error | null = null;

  async enqueue(job: ScanJob): Promise<void> {
    if (this.error) throw this.error;
    this.jobs.push(job);
  }

  async close(): Promise<void> {}
}

async function createMonitor() {
  const project = await prisma.project.create({
    data: { workspaceId: TEST_WORKSPACE_ID, name: "Outbox Project" },
  });
  return prisma.monitor.create({
    data: {
      projectId: project.id,
      name: "Outbox Monitor",
      targetUrl: "https://outbox.example.com",
    },
  });
}

describe("Scan outbox publisher", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createTestIdentity();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("publishes a claimed event and marks it published only after enqueue succeeds", async () => {
    const monitor = await createMonitor();
    const scan = await new ScanRepository().create(monitor.id);
    const queue = new FakeScanQueue();
    const publisher = new ScanOutboxPublisher(new ScanRepository(), queue, { error: () => {} });

    await publisher.publishPending();

    expect(queue.jobs).toEqual([{ scanId: scan.id, monitorId: monitor.id }]);
    await expect(
      prisma.scanOutboxEvent.findUnique({ where: { scanId: scan.id } }),
    ).resolves.toMatchObject({
      status: "PUBLISHED",
      attempts: 0,
      claimedAt: null,
      publishedAt: expect.any(Date),
    });
  });

  it("releases a failed publication for retry without persisting technical error text", async () => {
    const monitor = await createMonitor();
    const scan = await new ScanRepository().create(monitor.id);
    const queue = new FakeScanQueue();
    queue.error = new Error("amqp://user:secret@broker refused connection");
    const publisher = new ScanOutboxPublisher(new ScanRepository(), queue, { error: () => {} });

    await publisher.publishPending();

    await expect(
      prisma.scanOutboxEvent.findUnique({ where: { scanId: scan.id } }),
    ).resolves.toMatchObject({
      status: "PENDING",
      attempts: 1,
      claimedAt: null,
      lastError: "Queue publication failed",
    });
  });
});
