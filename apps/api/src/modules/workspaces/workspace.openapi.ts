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

const workspaceMemberResponseSchema = {
  type: "object",
  required: ["id", "name", "email", "role", "joinedAt"],
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    role: { type: "string", enum: ["OWNER", "ADMIN", "MEMBER"] },
    joinedAt: { type: "string", format: "date-time" },
  },
} as const;

const workspaceIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["workspaceId"],
  properties: { workspaceId: { type: "string", format: "uuid" } },
} as const;

const workspaceMemberParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["workspaceId", "userId"],
  properties: {
    workspaceId: { type: "string", format: "uuid" },
    userId: { type: "string", format: "uuid" },
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

export const updateWorkspaceRouteSchema: FastifySchema = {
  tags: ["Workspaces"],
  summary: "Rename a workspace",
  description: "Owners and admins can rename a workspace.",
  params: workspaceIdParamsSchema,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: { name: { type: "string", minLength: 1, maxLength: 120 } },
  },
  response: {
    200: workspaceResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export const deleteWorkspaceRouteSchema: FastifySchema = {
  tags: ["Workspaces"],
  summary: "Delete a workspace",
  description:
    "Only the owner can delete a workspace. Its members, projects, monitors, scans and findings are removed permanently.",
  params: workspaceIdParamsSchema,
  response: {
    204: { type: "null", description: "Workspace deleted" },
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
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

export const findWorkspaceMembersRouteSchema: FastifySchema = {
  tags: ["Workspaces"],
  summary: "List workspace members",
  params: workspaceIdParamsSchema,
  response: {
    200: { type: "array", items: workspaceMemberResponseSchema },
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export const addWorkspaceMemberRouteSchema: FastifySchema = {
  tags: ["Workspaces"],
  summary: "Add a workspace member",
  params: workspaceIdParamsSchema,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["email"],
    properties: { email: { type: "string", format: "email", maxLength: 320 } },
  },
  response: {
    201: workspaceMemberResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema,
  },
};

export const updateWorkspaceMemberRoleRouteSchema: FastifySchema = {
  tags: ["Workspaces"],
  summary: "Update a workspace member role",
  params: workspaceMemberParamsSchema,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["role"],
    properties: { role: { type: "string", enum: ["ADMIN", "MEMBER"] } },
  },
  response: {
    200: workspaceMemberResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export const removeWorkspaceMemberRouteSchema: FastifySchema = {
  tags: ["Workspaces"],
  summary: "Remove a workspace member",
  params: workspaceMemberParamsSchema,
  response: {
    204: { type: "null" },
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
  },
};
