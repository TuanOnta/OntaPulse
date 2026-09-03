import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { resetDatabase } from "./helpers/database.js";

const app = buildApp();

const NON_EXISTENT_ID = "00000000-0000-4000-8000-000000000000";

async function createProject(name = "Scan Test Project"): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name,
    },
  });

  expect(response.statusCode).toBe(201);

  return response.json().id as string;
}

async function createMonitor(
  projectId: string,
  name = "Scan Test Monitor",
  targetUrl = "https://example.com",
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: `/api/projects/${projectId}/monitors`,
    payload: {
      name,
      targetUrl,
      intervalSeconds: 300,
    },
  });

  expect(response.statusCode).toBe(201);

  return response.json().id as string;
}

describe("Scan API", () => {
  beforeAll(async () => {
    await app.ready();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await resetDatabase();
    await app.close();
  });

  describe("POST /api/monitors/:monitorId/scans", () => {
    it("creates a queued scan", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const response = await app.inject({
        method: "POST",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(response.statusCode).toBe(202);

      expect(response.json()).toEqual({
        id: expect.any(String),
        monitorId,
        status: "QUEUED",
        statusCode: null,
        responseTimeMs: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: expect.any(String),
      });
    });

    it("stores the queued scan in the database", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const response = await app.inject({
        method: "POST",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(response.statusCode).toBe(202);

      const responseBody = response.json();

      const storedScan = await prisma.scan.findUnique({
        where: {
          id: responseBody.id,
        },
      });

      expect(storedScan).not.toBeNull();

      expect(storedScan).toMatchObject({
        id: responseBody.id,
        monitorId,
        status: "QUEUED",
        statusCode: null,
        responseTimeMs: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      });
    });

    it("creates different scan records for repeated triggers", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const firstResponse = await app.inject({
        method: "POST",
        url: `/api/monitors/${monitorId}/scans`,
      });

      const secondResponse = await app.inject({
        method: "POST",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(firstResponse.statusCode).toBe(202);
      expect(secondResponse.statusCode).toBe(202);

      expect(firstResponse.json().id).not.toBe(secondResponse.json().id);

      const scanCount = await prisma.scan.count({
        where: {
          monitorId,
        },
      });

      expect(scanCount).toBe(2);
    });

    it("rejects an invalid monitor ID", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/monitors/not-a-uuid/scans",
      });

      expect(response.statusCode).toBe(400);

      expect(response.json()).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
      });

      expect(response.json()).toHaveProperty("requestId");
    });

    it("returns 404 when the monitor does not exist", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/monitors/${NON_EXISTENT_ID}/scans`,
      });

      expect(response.statusCode).toBe(404);

      expect(response.json()).toMatchObject({
        statusCode: 404,
        code: "MONITOR_NOT_FOUND",
        message: "Monitor not found",
      });

      expect(response.json()).toHaveProperty("requestId");
    });

    it("does not create a scan when the monitor does not exist", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/monitors/${NON_EXISTENT_ID}/scans`,
      });

      expect(response.statusCode).toBe(404);

      const scanCount = await prisma.scan.count();

      expect(scanCount).toBe(0);
    });
  });

  describe("GET /api/monitors/:monitorId/scans", () => {
    it("returns an empty array when the monitor has no scans", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it("returns all scans belonging to the monitor", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const firstTriggerResponse = await app.inject({
        method: "POST",
        url: `/api/monitors/${monitorId}/scans`,
      });

      const secondTriggerResponse = await app.inject({
        method: "POST",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(firstTriggerResponse.statusCode).toBe(202);
      expect(secondTriggerResponse.statusCode).toBe(202);

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toHaveLength(2);

      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: firstTriggerResponse.json().id,
            monitorId,
            status: "QUEUED",
          }),

          expect.objectContaining({
            id: secondTriggerResponse.json().id,
            monitorId,
            status: "QUEUED",
          }),
        ]),
      );
    });

    it("returns scans from newest to oldest", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const olderScan = await prisma.scan.create({
        data: {
          monitorId,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });

      const newerScan = await prisma.scan.create({
        data: {
          monitorId,
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.map((scan: { id: string }) => scan.id)).toEqual([newerScan.id, olderScan.id]);
    });

    it("does not return scans belonging to another monitor", async () => {
      const projectId = await createProject();

      const firstMonitorId = await createMonitor(
        projectId,
        "First Monitor",
        "https://first.example.com",
      );

      const secondMonitorId = await createMonitor(
        projectId,
        "Second Monitor",
        "https://second.example.com",
      );

      const firstScan = await prisma.scan.create({
        data: {
          monitorId: firstMonitorId,
        },
      });

      await prisma.scan.create({
        data: {
          monitorId: secondMonitorId,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${firstMonitorId}/scans`,
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toEqual([
        expect.objectContaining({
          id: firstScan.id,
          monitorId: firstMonitorId,
        }),
      ]);
    });

    it("serializes completed scan fields correctly", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const startedAt = new Date("2026-01-01T10:00:00.000Z");

      const finishedAt = new Date("2026-01-01T10:00:01.000Z");

      const scan = await prisma.scan.create({
        data: {
          monitorId,
          status: "SUCCEEDED",
          statusCode: 200,
          responseTimeMs: 1_000,
          startedAt,
          finishedAt,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toEqual([
        expect.objectContaining({
          id: scan.id,
          monitorId,
          status: "SUCCEEDED",
          statusCode: 200,
          responseTimeMs: 1_000,
          errorMessage: null,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
        }),
      ]);
    });

    it("serializes failed scan fields correctly", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const startedAt = new Date("2026-01-01T10:00:00.000Z");

      const finishedAt = new Date("2026-01-01T10:00:05.000Z");

      const scan = await prisma.scan.create({
        data: {
          monitorId,
          status: "FAILED",
          errorMessage: "Request timed out",
          responseTimeMs: 5_000,
          startedAt,
          finishedAt,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toEqual([
        expect.objectContaining({
          id: scan.id,
          monitorId,
          status: "FAILED",
          statusCode: null,
          responseTimeMs: 5_000,
          errorMessage: "Request timed out",
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
        }),
      ]);
    });

    it("rejects an invalid monitor ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/monitors/not-a-uuid/scans",
      });

      expect(response.statusCode).toBe(400);

      expect(response.json()).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    });

    it("returns 404 when the monitor does not exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/monitors/${NON_EXISTENT_ID}/scans`,
      });

      expect(response.statusCode).toBe(404);

      expect(response.json()).toMatchObject({
        statusCode: 404,
        code: "MONITOR_NOT_FOUND",
        message: "Monitor not found",
      });
    });
  });

  describe("GET /api/scans/:scanId", () => {
    it("returns a queued scan without findings", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const triggerResponse = await app.inject({
        method: "POST",
        url: `/api/monitors/${monitorId}/scans`,
      });

      expect(triggerResponse.statusCode).toBe(202);

      const scanId = triggerResponse.json().id as string;

      const response = await app.inject({
        method: "GET",
        url: `/api/scans/${scanId}`,
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toEqual({
        id: scanId,
        monitorId,
        status: "QUEUED",
        statusCode: null,
        responseTimeMs: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: expect.any(String),
        findings: [],
      });
    });

    it("returns a scan together with its findings", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const startedAt = new Date("2026-01-01T10:00:00.000Z");

      const finishedAt = new Date("2026-01-01T10:00:00.250Z");

      const scan = await prisma.scan.create({
        data: {
          monitorId,
          status: "SUCCEEDED",
          statusCode: 200,
          responseTimeMs: 250,
          startedAt,
          finishedAt,
        },
      });

      const finding = await prisma.scanFinding.create({
        data: {
          scanId: scan.id,
          code: "MISSING_SECURITY_HEADER",
          title: "Missing Content-Security-Policy header",
          severity: "HIGH",
          description: "The response does not contain a Content-Security-Policy header.",
          recommendation: "Configure a restrictive Content-Security-Policy header.",
          evidence: {
            header: "content-security-policy",
            present: false,
          },
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/scans/${scan.id}`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toMatchObject({
        id: scan.id,
        monitorId,
        status: "SUCCEEDED",
        statusCode: 200,
        responseTimeMs: 250,
        errorMessage: null,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),

        findings: [
          {
            id: finding.id,
            scanId: scan.id,
            code: "MISSING_SECURITY_HEADER",
            title: "Missing Content-Security-Policy header",
            severity: "HIGH",
            description: "The response does not contain a Content-Security-Policy header.",
            recommendation: "Configure a restrictive Content-Security-Policy header.",
            evidence: {
              header: "content-security-policy",
              present: false,
            },
            createdAt: expect.any(String),
          },
        ],
      });
    });

    it("returns findings from oldest to newest", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const scan = await prisma.scan.create({
        data: {
          monitorId,
          status: "SUCCEEDED",
        },
      });

      const olderFinding = await prisma.scanFinding.create({
        data: {
          scanId: scan.id,
          code: "OLDER_FINDING",
          title: "Older finding",
          severity: "LOW",
          description: "Older finding description",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });

      const newerFinding = await prisma.scanFinding.create({
        data: {
          scanId: scan.id,
          code: "NEWER_FINDING",
          title: "Newer finding",
          severity: "MEDIUM",
          description: "Newer finding description",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/scans/${scan.id}`,
      });

      expect(response.statusCode).toBe(200);

      const findingIds = response.json().findings.map((finding: { id: string }) => finding.id);

      expect(findingIds).toEqual([olderFinding.id, newerFinding.id]);
    });

    it("preserves null values in a finding", async () => {
      const projectId = await createProject();
      const monitorId = await createMonitor(projectId);

      const scan = await prisma.scan.create({
        data: {
          monitorId,
          status: "SUCCEEDED",
        },
      });

      await prisma.scanFinding.create({
        data: {
          scanId: scan.id,
          code: "INFORMATIONAL_FINDING",
          title: "Informational finding",
          severity: "LOW",
          description: "No additional information",
          recommendation: null,
          evidence: Prisma.DbNull,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/scans/${scan.id}`,
      });

      expect(response.statusCode).toBe(200);

      expect(response.json().findings[0]).toMatchObject({
        recommendation: null,
        evidence: null,
      });
    });

    it("rejects an invalid scan ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/scans/not-a-uuid",
      });

      expect(response.statusCode).toBe(400);

      expect(response.json()).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
      });

      expect(response.json()).toHaveProperty("requestId");
    });

    it("returns 404 when the scan does not exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/scans/${NON_EXISTENT_ID}`,
      });

      expect(response.statusCode).toBe(404);

      expect(response.json()).toMatchObject({
        statusCode: 404,
        code: "SCAN_NOT_FOUND",
        message: "Scan not found",
      });

      expect(response.json()).toHaveProperty("requestId");
    });
  });
});
