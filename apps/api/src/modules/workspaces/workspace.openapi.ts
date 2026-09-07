import type { FastifySchema } from "fastify";

const workspaceResponseSchema = {
  type: "object",
  required: ["id", "name", "role", "joinedAt", "createdAt", "updatedAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    role: { type: "string", enum: ["OWNER", "ADMIN", "MEMBER"] },
    joinedAt: { type: "string", format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const errorResponseSchema = {
  type: "object",
  required: ["statusCode", "code", "message", "requestId"],
  properties: {
    statusCode: { type: "integer" },
    code: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" },
    details: {
      anyOf: [
        { type: "object", additionalProperties: true },
        { type: "array", items: { type: "object", additionalProperties: true } },
      ],
    },
  },
} as const;

export const createWorkspaceRouteSchema: FastifySchema = {
  tags: ["Workspaces"],
  summary: "Create a workspace",
  description: "Creates a workspace and assigns the authenticated user as its owner.",
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
    },
  },
  response: {
    201: workspaceResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
  },
};

export const findAllWorkspacesRouteSchema: FastifySchema = {
  tags: ["Workspaces"],
  summary: "List current user workspaces",
  response: {
    200: {
      type: "array",
      items: workspaceResponseSchema,
    },
    401: errorResponseSchema,
  },
};
