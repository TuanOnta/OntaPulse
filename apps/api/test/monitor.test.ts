import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { resetDatabase } from "./helpers/database.js";

const app = buildApp();

const NON_EXISTENT_PROJECT_ID = "00000000-0000-4000-8000-000000000000";

async function createProject(name = "Monitor Test Project"): Promise<string> {
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

describe("Monitor API", () => {
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

  describe("POST /api/projects/:projectId/monitors", () => {
    it("creates a monitor", async () => {
      const projectId = await createProject();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "OntaPulse API",
          targetUrl: "https://api.example.com/health",
          intervalSeconds: 300,
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toEqual({
        id: expect.any(String),
        projectId,
        name: "OntaPulse API",
        targetUrl: "https://api.example.com/health",
        intervalSeconds: 300,
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("uses 300 seconds as the default interval", async () => {
      const projectId = await createProject();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "Default Interval Monitor",
          targetUrl: "https://example.com",
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        intervalSeconds: 300,
      });
    });

    it("trims the monitor name", async () => {
      const projectId = await createProject();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "  OntaPulse Website  ",
          targetUrl: "https://example.com",
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        name: "OntaPulse Website",
      });
    });

    it("accepts an HTTP target URL", async () => {
      const projectId = await createProject();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "HTTP Monitor",
          targetUrl: "http://example.com/health",
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        targetUrl: "http://example.com/health",
      });
    });

    it("accepts a URL containing a path and query parameters", async () => {
      const projectId = await createProject();

      const targetUrl = "https://example.com/health?service=api&region=id";

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "Health Endpoint",
          targetUrl,
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        targetUrl,
      });
    });

    it.each([
      {
        intervalSeconds: 60,
        description: "minimum interval",
      },
      {
        intervalSeconds: 86_400,
        description: "maximum interval",
      },
    ])("accepts the $description", async ({ intervalSeconds }) => {
      const projectId = await createProject();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: `Monitor ${intervalSeconds}`,
          targetUrl: `https://example.com/${intervalSeconds}`,
          intervalSeconds,
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        intervalSeconds,
      });
    });

    it("accepts a name with exactly 120 characters", async () => {
      const projectId = await createProject();
      const name = "a".repeat(120);

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name,
          targetUrl: "https://example.com",
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        name,
      });
    });

    it.each([
      {
        caseName: "name is missing",
        payload: {
          targetUrl: "https://example.com",
        },
      },
      {
        caseName: "name is empty",
        payload: {
          name: "",
          targetUrl: "https://example.com",
        },
      },
      {
        caseName: "name only contains whitespace",
        payload: {
          name: "   ",
          targetUrl: "https://example.com",
        },
      },
      {
        caseName: "name exceeds 120 characters",
        payload: {
          name: "a".repeat(121),
          targetUrl: "https://example.com",
        },
      },
      {
        caseName: "name is not a string",
        payload: {
          name: 123,
          targetUrl: "https://example.com",
        },
      },
      {
        caseName: "targetUrl is missing",
        payload: {
          name: "OntaPulse",
        },
      },
      {
        caseName: "targetUrl is empty",
        payload: {
          name: "OntaPulse",
          targetUrl: "",
        },
      },
      {
        caseName: "targetUrl is not a URL",
        payload: {
          name: "OntaPulse",
          targetUrl: "example.com",
        },
      },
      {
        caseName: "targetUrl is a relative URL",
        payload: {
          name: "OntaPulse",
          targetUrl: "/health",
        },
      },
      {
        caseName: "targetUrl uses FTP",
        payload: {
          name: "OntaPulse",
          targetUrl: "ftp://example.com",
        },
      },
      {
        caseName: "targetUrl uses the JavaScript protocol",
        payload: {
          name: "OntaPulse",
          targetUrl: "javascript:alert(1)",
        },
      },
      {
        caseName: "targetUrl is not a string",
        payload: {
          name: "OntaPulse",
          targetUrl: 123,
        },
      },
      {
        caseName: "intervalSeconds is below 60",
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
          intervalSeconds: 59,
        },
      },
      {
        caseName: "intervalSeconds is above 86400",
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
          intervalSeconds: 86_401,
        },
      },
      {
        caseName: "intervalSeconds is a decimal",
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
          intervalSeconds: 60.5,
        },
      },
      {
        caseName: "intervalSeconds is a string",
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
          intervalSeconds: "300",
        },
      },
      {
        caseName: "intervalSeconds is null",
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
          intervalSeconds: null,
        },
      },
      {
        caseName: "client attempts to set isActive",
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
          isActive: false,
        },
      },
      {
        caseName: "payload contains an unknown property",
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
          unknownField: true,
        },
      },
    ])("rejects the payload when $caseName", async ({ payload }) => {
      const projectId = await createProject();

      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload,
      });

      expect(response.statusCode).toBe(400);

      expect(response.json()).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
      });

      expect(response.json()).toHaveProperty("requestId");
    });

    it("rejects an invalid project ID", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects/not-a-uuid/monitors",
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
        },
      });

      expect(response.statusCode).toBe(400);

      expect(response.json()).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    });

    it("returns 404 when the project does not exist", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/projects/${NON_EXISTENT_PROJECT_ID}/monitors`,
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
        },
      });

      expect(response.statusCode).toBe(404);

      expect(response.json()).toMatchObject({
        statusCode: 404,
        code: "PROJECT_NOT_FOUND",
        message: "Project not found",
      });

      expect(response.json()).toHaveProperty("requestId");
    });

    it("rejects a duplicate target URL in the same project", async () => {
      const projectId = await createProject();

      const firstResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "Primary Monitor",
          targetUrl: "https://example.com",
        },
      });

      expect(firstResponse.statusCode).toBe(201);

      const duplicateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "Duplicate Monitor",
          targetUrl: "https://example.com",
        },
      });

      expect(duplicateResponse.statusCode).toBe(409);

      expect(duplicateResponse.json()).toMatchObject({
        statusCode: 409,
        code: "MONITOR_ALREADY_EXISTS",
      });
    });

    it("allows the same target URL in different projects", async () => {
      const firstProjectId = await createProject("First Project");
      const secondProjectId = await createProject("Second Project");

      const firstResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${firstProjectId}/monitors`,
        payload: {
          name: "First Monitor",
          targetUrl: "https://example.com",
        },
      });

      const secondResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${secondProjectId}/monitors`,
        payload: {
          name: "Second Monitor",
          targetUrl: "https://example.com",
        },
      });

      expect(firstResponse.statusCode).toBe(201);
      expect(secondResponse.statusCode).toBe(201);

      expect(firstResponse.json()).toMatchObject({
        projectId: firstProjectId,
      });

      expect(secondResponse.json()).toMatchObject({
        projectId: secondProjectId,
      });
    });

    it("allows only one concurrent creation for the same URL", async () => {
      const projectId = await createProject();

      const request = {
        method: "POST" as const,
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "Concurrent Monitor",
          targetUrl: "https://concurrent.example.com",
        },
      };

      const responses = await Promise.all([app.inject(request), app.inject(request)]);

      const statusCodes = responses
        .map((response) => response.statusCode)
        .sort((first, second) => first - second);

      expect(statusCodes).toEqual([201, 409]);
    });
  });

  describe("GET /api/projects/:projectId/monitors", () => {
    it("returns an empty array when the project has no monitors", async () => {
      const projectId = await createProject();

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/monitors`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it("returns all monitors belonging to the project", async () => {
      const projectId = await createProject();

      const firstCreateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "API Monitor",
          targetUrl: "https://api.example.com",
          intervalSeconds: 60,
        },
      });

      const secondCreateResponse = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "Web Monitor",
          targetUrl: "https://www.example.com",
          intervalSeconds: 600,
        },
      });

      expect(firstCreateResponse.statusCode).toBe(201);
      expect(secondCreateResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/monitors`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toHaveLength(2);

      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            projectId,
            name: "API Monitor",
            targetUrl: "https://api.example.com",
            intervalSeconds: 60,
            isActive: true,
          }),
          expect.objectContaining({
            projectId,
            name: "Web Monitor",
            targetUrl: "https://www.example.com",
            intervalSeconds: 600,
            isActive: true,
          }),
        ]),
      );
    });

    it("returns the complete monitor response structure", async () => {
      const projectId = await createProject();

      await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/monitors`,
        payload: {
          name: "OntaPulse",
          targetUrl: "https://example.com",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/monitors`,
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toHaveLength(1);

      expect(body[0]).toEqual({
        id: expect.any(String),
        projectId,
        name: "OntaPulse",
        targetUrl: "https://example.com",
        intervalSeconds: 300,
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("does not return monitors belonging to another project", async () => {
      const firstProjectId = await createProject("First Project");
      const secondProjectId = await createProject("Second Project");

      await app.inject({
        method: "POST",
        url: `/api/projects/${firstProjectId}/monitors`,
        payload: {
          name: "First Project Monitor",
          targetUrl: "https://first.example.com",
        },
      });

      await app.inject({
        method: "POST",
        url: `/api/projects/${secondProjectId}/monitors`,
        payload: {
          name: "Second Project Monitor",
          targetUrl: "https://second.example.com",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${firstProjectId}/monitors`,
      });

      expect(response.statusCode).toBe(200);

      expect(response.json()).toEqual([
        expect.objectContaining({
          projectId: firstProjectId,
          name: "First Project Monitor",
        }),
      ]);
    });

    it("rejects an invalid project ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects/not-a-uuid/monitors",
      });

      expect(response.statusCode).toBe(400);

      expect(response.json()).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    });

    it("returns 404 when the project does not exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/projects/${NON_EXISTENT_PROJECT_ID}/monitors`,
      });

      expect(response.statusCode).toBe(404);

      expect(response.json()).toMatchObject({
        statusCode: 404,
        code: "PROJECT_NOT_FOUND",
        message: "Project not found",
      });
    });
  });
});
