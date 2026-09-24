import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/infrastructure/database/prisma.js";

const app = buildApp();

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Health endpoints", () => {
  it("returns 200 when the API is healthy", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
    });
  });

  it("returns ready when the database can be queried", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
  });

  it("returns service unavailable when the database query fails", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("Database unavailable"));

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "not_ready" });
  });
});
