import { env } from "../../src/config/env.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";

export const TEST_USER_ID = "10000000-0000-4000-8000-000000000001";
export const TEST_WORKSPACE_ID = "10000000-0000-4000-8000-000000000002";

export async function resetDatabase(): Promise<void> {
  if (env.NODE_ENV !== "test") {
    throw new Error("resetDatabase can only run in the test environment");
  }

  await prisma.scanFinding.deleteMany();
  await prisma.operationsAuditLog.deleteMany();
  await prisma.scan.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

export async function createTestIdentity(): Promise<void> {
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: "api-tests@ontapulse.local",
      name: "API Test User",
      passwordHash: "not-used-by-domain-tests",
    },
  });

  await prisma.workspace.create({
    data: {
      id: TEST_WORKSPACE_ID,
      name: "API Test Workspace",
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: TEST_WORKSPACE_ID,
      userId: TEST_USER_ID,
      role: "OWNER",
    },
  });
}
