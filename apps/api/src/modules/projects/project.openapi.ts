import type { FastifySchema } from "fastify";

const projectResponseSchema = {
  type: "object",
  required: ["id", "name", "description", "createdAt", "updatedAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    description: { type: ["string", "null"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const validationErrorSchema = {
  type: "object",
  required: ["message", "errors"],
  properties: {
    message: { type: "string" },
    errors: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;

export const createProjectRouteSchema: FastifySchema = {
  tags: ["Projects"],
  summary: "Create a project",
  description: "Creates a logical container for one or more monitors.",
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: {
        type: "string",
        minLength: 1,
        maxLength: 120,
      },
      description: {
        type: "string",
        maxLength: 500,
      },
    },
  },
  response: {
    201: projectResponseSchema,
    400: validationErrorSchema,
  },
};

export const findAllProjectsRouteSchema: FastifySchema = {
  tags: ["Projects"],
  summary: "List projects",
  response: {
    200: {
      type: "array",
      items: projectResponseSchema,
    },
  },
};