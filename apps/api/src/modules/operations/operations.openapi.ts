import type { FastifySchema } from "fastify";

const workspaceIdParams = {
  type: "object",
  additionalProperties: false,
  required: ["workspaceId"],
  properties: { workspaceId: { type: "string", format: "uuid" } },
} as const;

const redriveParams = {
  type: "object",
  additionalProperties: false,
  required: ["workspaceId", "scanId"],
  properties: {
    workspaceId: { type: "string", format: "uuid" },
    scanId: { type: "string", format: "uuid" },
  },
} as const;

const errorResponse = {
  type: "object",
  required: ["statusCode", "code", "message", "requestId"],
  properties: {
    statusCode: { type: "integer" },
    code: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" },
  },
} as const;

export const queueHealthRouteSchema: FastifySchema = {
  tags: ["Operations"],
  summary: "Get queue and scan health",
  description:
    "Owner-only queue health. Broker counts are instance-wide; scan counts are scoped to the workspace.",
  params: workspaceIdParams,
  response: {
    200: {
      type: "object",
      required: ["workspace", "broker"],
      properties: {
        workspace: {
          type: "object",
          required: ["pendingOutbox", "queued", "stuckRunning", "failedRecently", "generatedAt"],
          properties: {
            pendingOutbox: { type: "integer" },
            queued: { type: "integer" },
            stuckRunning: { type: "integer" },
            failedRecently: { type: "integer" },
            generatedAt: { type: "string", format: "date-time" },
          },
        },
        broker: {
          type: "object",
          required: ["main", "retry", "deadLetter"],
          properties: {
            main: { type: "integer" },
            retry: { type: "integer" },
            deadLetter: { type: "integer" },
          },
        },
      },
    },
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    503: errorResponse,
  },
};

export const redriveDeadLetterRouteSchema: FastifySchema = {
  tags: ["Operations"],
  summary: "Redrive one dead-letter scan",
  description:
    "Owner-only. The operation republishes only the requested head-of-DLQ scan after publisher confirmation, then records an audit event.",
  params: redriveParams,
  response: {
    200: {
      type: "object",
      required: ["result"],
      properties: {
        result: { type: "string", enum: ["REDRIVEN", "EMPTY", "HEAD_MISMATCH", "INVALID_MESSAGE"] },
      },
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    503: errorResponse,
  },
};
