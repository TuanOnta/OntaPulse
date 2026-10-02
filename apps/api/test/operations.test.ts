import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../src/infrastructure/database/prisma.js";
import type {
  DeadLetterRedriveResult,
  QueueHealth,
  ScanJob,
  ScanQueueOperations,
} from "../src/infrastructure/queue/scan-queue.js";
import { buildAuthenticatedApp } from "./helpers/authenticated-app.js";
import { createTestIdentity, resetDatabase, TEST_WORKSPACE_ID } from "./helpers/database.js";

class FakeQueueOperations implements ScanQueueOperations {
  jobs: ScanJob[] = [];

  async health(): Promise<QueueHealth> {
    return { main: 2, retry: 1, deadLetter: 3 };
  }

  async redriveDeadLetter(job: ScanJob): Promise<DeadLetterRedriveResult> {
    this.jobs.push(job);
    return "REDRIVEN";
  }
}

async function createScan() {
  const project = await prisma.project.create({
    data: { workspaceId: TEST_WORKSPACE_ID, name: "Operations Project" },
  });
  const monitor = await prisma.monitor.create({
    data: {
      projectId: project.id,
      name: "Operations Monitor",
      targetUrl: "https://operations.example.com",
    },
  });
  return prisma.scan.create({ data: { monitorId: monitor.id } });
}

describe("operations API", () => {
  const queueOperations = new FakeQueueOperations();
  const app = buildAuthenticatedApp({ queueOperations });

  beforeEach(async () => {
    queueOperations.jobs = [];
    await resetDatabase();
    await createTestIdentity();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it("returns broker health and workspace-scoped recovery counts to an owner", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/workspaces/${TEST_WORKSPACE_ID}/operations/queue-health`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      broker: { main: 2, retry: 1, deadLetter: 3 },
      workspace: {
        pendingOutbox: 0,
        queued: 0,
        stuckRunning: 0,
        failedRecently: 0,
        generatedAt: expect.any(String),
      },
    });
  });

  it("redrives a workspace scan and records the operation", async () => {
    const scan = await createScan();
    const response = await app.inject({
      method: "POST",
      url: `/api/workspaces/${TEST_WORKSPACE_ID}/operations/dlq/${scan.id}/redrive`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ result: "REDRIVEN" });
    expect(queueOperations.jobs).toEqual([{ scanId: scan.id, monitorId: scan.monitorId }]);
    await expect(
      prisma.operationsAuditLog.findFirst({ where: { action: "queue.dlq_redrive" } }),
    ).resolves.toMatchObject({
      actor: "10000000-0000-4000-8000-000000000001",
      details: { workspaceId: TEST_WORKSPACE_ID, scanId: scan.id, result: "REDRIVEN" },
    });
  });
});
