import type { FastifySchema } from "fastify";

import {
  EDGE_CONFIDENCES,
  EDGE_LAYERS,
  EDGE_SIGNAL_TYPES,
  EDGE_VENDORS,
} from "./edge-profile.constants.js";

const monitorIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["monitorId"],
  properties: { monitorId: { type: "string", format: "uuid" } },
} as const;

const edgeProfileResponseSchema = {
  type: "object",
  required: ["monitorId", "scanId", "challengeObserved", "observedAt", "detections"],
  properties: {
    monitorId: { type: "string", format: "uuid" },
    scanId: { type: "string", format: "uuid" },
    challengeObserved: { type: "boolean" },
    observedAt: { type: "string", format: "date-time" },
    detections: {
      type: "array",
      items: {
        type: "object",
        required: ["vendor", "layer", "confidence", "signals"],
        properties: {
          vendor: { type: "string", enum: [...EDGE_VENDORS] },
          layer: { type: "string", enum: [...EDGE_LAYERS] },
          confidence: { type: "string", enum: [...EDGE_CONFIDENCES] },
          signals: {
            type: "array",
            items: {
              type: "object",
              required: ["type", "name"],
              properties: {
                type: { type: "string", enum: [...EDGE_SIGNAL_TYPES] },
                name: { type: "string" },
              },
            },
          },
        },
      },
    },
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

export const findEdgeProfileRouteSchema: FastifySchema = {
  tags: ["Edge profile"],
  summary: "Get the latest edge profile of a monitor",
  description:
    "The CDN, WAF, and anti-bot layers observed in the newest finished SECURITY_POSTURE scan. " +
    "Informational: an edge layer is not a defect. An empty detections list means none was observed. " +
    "Responds 404 NO_EDGE_PROFILE before the first posture scan.",
  params: monitorIdParamsSchema,
  response: {
    200: edgeProfileResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
};
