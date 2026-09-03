import type { FastifySchema } from "fastify";

const monitorSchema = {
  type: "object",
  required: [
    "id",
    "projectId",
    "name",
    "targetUrl",
    "intervalSeconds",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    projectId: { type: "string", format: "uuid" },
    name: { type: "string" },
    targetUrl: { type: "string", format: "uri" },
    intervalSeconds: { type: "integer" },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const projectIdParams = {
  type: "object",
  required: ["projectId"],
  properties: {
    projectId: { type: "string", format: "uuid" },
  },
} as const;

export const createMonitorRouteSchema: FastifySchema = {
  tags: ["Monitors"],
  summary: "Create a monitor",
  params: projectIdParams,
  body: {
    type: "object",
    additionalProperties: false,
    required: ["name", "targetUrl"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      targetUrl: {
        type: "string",
        format: "uri",
        pattern: "^https?://",
      },
      intervalSeconds: {
        type: "integer",
        minimum: 60,
        maximum: 86_400,
        default: 300,
      },
    },
  },
  response: {
    201: monitorSchema,
  },
};

export const findAllMonitorsRouteSchema: FastifySchema = {
  tags: ["Monitors"],
  summary: "List monitors in a project",
  params: projectIdParams,
  response: {
    200: {
      type: "array",
      items: monitorSchema,
    },
  },
};
