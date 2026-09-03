import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { resetDatabase } from "./helpers/database.js";

const app = buildApp();

describe("Project API", () => {
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

  describe("POST /api/projects", () => {
    it("creates a project", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "OntaPulse Production",
          description: "Production monitoring environment",
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body).toMatchObject({
        name: "OntaPulse Production",
        description: "Production monitoring environment",
      });

      expect(body).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      );
    });

    it("trims the name and description", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "  OntaPulse Production  ",
          description: "  Production environment  ",
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        name: "OntaPulse Production",
        description: "Production environment",
      });
    });

    it("creates a project without a description", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Minimal Project",
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        name: "Minimal Project",
        description: null,
      });
    });

    it("accepts values at the maximum allowed length", async () => {
      const name = "a".repeat(120);
      const description = "b".repeat(500);

      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name,
          description,
        },
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toMatchObject({
        name,
        description,
      });
    });

    it.each([
      {
        caseName: "name is missing",
        payload: {},
      },
      {
        caseName: "name is empty",
        payload: {
          name: "",
        },
      },
      {
        caseName: "name only contains whitespace",
        payload: {
          name: "   ",
        },
      },
      {
        caseName: "name exceeds 120 characters",
        payload: {
          name: "a".repeat(121),
        },
      },
      {
        caseName: "description exceeds 500 characters",
        payload: {
          name: "OntaPulse",
          description: "a".repeat(501),
        },
      },
      {
        caseName: "name is a number",
        payload: {
          name: 123,
        },
      },
      {
        caseName: "name is null",
        payload: {
          name: null,
        },
      },
      {
        caseName: "description is a number",
        payload: {
          name: "OntaPulse",
          description: 123,
        },
      },
      {
        caseName: "payload contains an unknown property",
        payload: {
          name: "OntaPulse",
          unknownField: true,
        },
      },
    ])("rejects the payload when $caseName", async ({ payload }) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload,
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();

      expect(body).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
      });

      expect(body).toHaveProperty("requestId");
    });
  });

  describe("GET /api/projects", () => {
    it("returns an empty array when no projects exist", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    });

    it("returns all existing projects", async () => {
      const firstCreateResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Project A",
          description: "First project",
        },
      });

      const secondCreateResponse = await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "Project B",
          description: "Second project",
        },
      });

      expect(firstCreateResponse.statusCode).toBe(201);
      expect(secondCreateResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toHaveLength(2);

      expect(body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Project A",
            description: "First project",
          }),
          expect.objectContaining({
            name: "Project B",
            description: "Second project",
          }),
        ]),
      );
    });

    it("returns the complete project response structure", async () => {
      await app.inject({
        method: "POST",
        url: "/api/projects",
        payload: {
          name: "OntaPulse",
        },
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/projects",
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body).toHaveLength(1);

      expect(body[0]).toEqual({
        id: expect.any(String),
        name: "OntaPulse",
        description: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });
});
