import { env } from "../../src/config/env.js";
import { prisma } from "../../src/infrastructure/database/prisma.js";

export async function resetDatabase(): Promise<void> {
  if (env.NODE_ENV !== "test") {
    throw new Error("resetDatabase can only run in the test environment");
  }

  await prisma.scanFinding.deleteMany();
  await prisma.scan.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.project.deleteMany();
}
