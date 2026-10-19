import type { FastifySchema } from "fastify";

const monitorIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["monitorId"],
  properties: { monitorId: { type: "string", format: "uuid" } },
} as const;

const checkSettingsResponseSchema = {
  type: "object",
  required: [
    "monitorId",
    "securityPostureEnabled",
    "dnsWatchEnabled",
    "pathProbesEnabled",
    "pathProbesAcknowledgedAt",
  ],
  properties: {
    monitorId: { type: "string", format: "uuid" },
    securityPostureEnabled: { type: "boolean" },
    dnsWatchEnabled: { type: "boolean" },
    pathProbesEnabled: { type: "boolean" },
    pathProbesAcknowledgedAt: { type: ["string", "null"], format: "date-time" },
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
    details: {},
  },
} as const;

export const getCheckSettingsRouteSchema: FastifySchema = {
  tags: ["Check settings"],
  summary: "Get the security check settings of a monitor",
  description: "A monitor without stored settings reports every check as disabled.",
  params: monitorIdParamsSchema,
  response: {
    200: checkSettingsResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export const updateCheckSettingsRouteSchema: FastifySchema = {
  tags: ["Check settings"],
  summary: "Enable or disable security checks for a monitor",
  description: "OWNER and ADMIN only. Path-probe settings are not accepted yet.",
  params: monitorIdParamsSchema,
  body: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      securityPostureEnabled: { type: "boolean" },
      dnsWatchEnabled: { type: "boolean" },
    },
  },
  response: {
    200: checkSettingsResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
  },
};
