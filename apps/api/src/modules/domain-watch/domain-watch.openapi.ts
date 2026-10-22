import type { FastifySchema } from "fastify";

import { DNS_CHANGE_SCOPES, DNS_RECORD_TYPES } from "./domain-watch.constants.js";

const monitorIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["monitorId"],
  properties: { monitorId: { type: "string", format: "uuid" } },
} as const;

const textList = { type: "array", items: { type: "string" } } as const;

const snapshotSchema = {
  type: "object",
  required: ["host", "organization"],
  properties: {
    host: {
      type: "object",
      required: ["name", ...DNS_RECORD_TYPES],
      properties: {
        name: { type: "string" },
        A: textList,
        AAAA: textList,
        CNAME: textList,
        NS: textList,
        MX: textList,
        TXT: textList,
      },
    },
    organization: {
      type: "object",
      required: ["name", "NS", "MX"],
      properties: { name: { type: "string" }, NS: textList, MX: textList },
    },
  },
} as const;

const changeSchema = {
  type: "object",
  required: ["scope", "type", "added", "removed"],
  properties: {
    scope: { type: "string", enum: [...DNS_CHANGE_SCOPES] },
    type: { type: "string", enum: [...DNS_RECORD_TYPES] },
    added: textList,
    removed: textList,
  },
} as const;

const baselineResponseSchema = {
  type: "object",
  required: [
    "monitorId",
    "scanId",
    "host",
    "organizationDomain",
    "observedAt",
    "snapshot",
    "changes",
  ],
  properties: {
    monitorId: { type: "string", format: "uuid" },
    scanId: { type: "string", format: "uuid" },
    host: { type: "string" },
    organizationDomain: { type: "string" },
    observedAt: { type: "string", format: "date-time" },
    snapshot: snapshotSchema,
    changes: {
      type: "array",
      items: {
        type: "object",
        required: ["scanId", "observedAt", "changes"],
        properties: {
          scanId: { type: "string", format: "uuid" },
          observedAt: { type: "string", format: "date-time" },
          changes: { type: "array", items: changeSchema },
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

export const findDnsBaselineRouteSchema: FastifySchema = {
  tags: ["Domain watch"],
  summary: "Get the DNS baseline of a monitor with its recent changes",
  description:
    "The normalized record snapshot stored by the first successful DNS_WATCH scan and replaced by later ones, " +
    "with the latest changes (newest first). Responds 404 NO_DNS_BASELINE before the first successful scan.",
  params: monitorIdParamsSchema,
  response: {
    200: baselineResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
};
