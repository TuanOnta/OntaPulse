import { describe, expect, it, vi } from "vitest";

import { assertSeedAllowed, seedDatabase } from "../prisma/seed.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

describe("database seed safety", () => {
  it("allows a local development database", () => {
    expect(
      assertSeedAllowed({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://ontapulse:secret@localhost:5433/ontapulse",
      }),
    ).toBe("postgresql://ontapulse:secret@localhost:5433/ontapulse");
  });

  it("rejects test and production environments", () => {
    for (const nodeEnv of ["test", "production"]) {
      expect(() =>
        assertSeedAllowed({
          NODE_ENV: nodeEnv,
          DATABASE_URL: "postgresql://ontapulse:secret@localhost:5433/ontapulse",
        }),
      ).toThrow("Database seeding is only allowed in development");
    }
  });

  it("rejects a remote database", () => {
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://ontapulse:secret@database.example.com:5432/ontapulse",
      }),
    ).toThrow("Database seeding is only allowed for a local development database");
  });

  it("rejects the dedicated test database", () => {
    expect(() =>
      assertSeedAllowed({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://ontapulse:secret@localhost:5433/ontapulse_test",
      }),
    ).toThrow("Database seeding is only allowed for a local development database");
  });

  it("upserts the complete deterministic dataset", async () => {
    const transaction = {
      project: { upsert: vi.fn() },
      monitor: { upsert: vi.fn() },
      scan: { upsert: vi.fn() },
      scanFinding: { upsert: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (operation: (client: typeof transaction) => Promise<void>) =>
        operation(transaction),
      ),
    } as unknown as PrismaClient;

    await seedDatabase(prisma);

    expect(transaction.project.upsert).toHaveBeenCalledTimes(2);
    expect(transaction.monitor.upsert).toHaveBeenCalledTimes(3);
    expect(transaction.scan.upsert).toHaveBeenCalledTimes(4);
    expect(transaction.scanFinding.upsert).toHaveBeenCalledTimes(4);
  });
});
