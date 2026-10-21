import type { FastifySchema } from "fastify";

import {
  FINDING_CATEGORIES,
  FINDING_CONFIDENCES,
  SCAN_KINDS,
  SUB_CHECK_STATES,
} from "./scan-kinds.js";

const scanKindSchema = {
  type: "string",

  enum: [...SCAN_KINDS],
} as const;

const scanStatusSchema = {
  type: "string",

  enum: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"],
} as const;

const scanResponseSchema = {
  type: "object",

  required: [
    "id",
    "monitorId",
    "kind",
    "status",
    "statusCode",
    "responseTimeMs",
    "errorMessage",
    "startedAt",
    "finishedAt",
    "createdAt",
    "subChecks",
  ],

  properties: {
    id: {
      type: "string",
      format: "uuid",
    },

    monitorId: {
      type: "string",
      format: "uuid",
    },

    kind: scanKindSchema,

    status: scanStatusSchema,

    statusCode: {
      type: ["integer", "null"],
    },

    responseTimeMs: {
      type: ["integer", "null"],
    },

    errorMessage: {
      type: ["string", "null"],
    },

    startedAt: {
      type: ["string", "null"],
      format: "date-time",
    },

    finishedAt: {
      type: ["string", "null"],
      format: "date-time",
    },

    createdAt: {
      type: "string",
      format: "date-time",
    },

    subChecks: {
      type: ["array", "null"],

      items: {
        type: "object",
        required: ["name", "state", "reason"],

        properties: {
          name: { type: "string" },
          state: { type: "string", enum: [...SUB_CHECK_STATES] },
          reason: { type: ["string", "null"] },
        },
      },
    },
  },
} as const;

const findingResponseSchema = {
  type: "object",

  required: [
    "id",
    "scanId",
    "code",
    "checkId",
    "category",
    "confidence",
    "title",
    "severity",
    "description",
    "recommendation",
    "evidence",
    "createdAt",
  ],

  properties: {
    id: {
      type: "string",
      format: "uuid",
    },

    scanId: {
      type: "string",
      format: "uuid",
    },

    code: {
      type: "string",
    },

    checkId: {
      type: ["string", "null"],
    },

    category: {
      type: ["string", "null"],

      enum: [...FINDING_CATEGORIES, null],
    },

    confidence: {
      type: ["string", "null"],

      enum: [...FINDING_CONFIDENCES, null],
    },

    title: {
      type: "string",
    },

    severity: {
      type: "string",

      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    },

    description: {
      type: "string",
    },

    recommendation: {
      type: ["string", "null"],
    },

    evidence: {},

    createdAt: {
      type: "string",
      format: "date-time",
    },
  },
} as const;

const scanDetailsResponseSchema = {
  ...scanResponseSchema,

  required: [...scanResponseSchema.required, "findings"],

  properties: {
    ...scanResponseSchema.properties,

    findings: {
      type: "array",
      items: findingResponseSchema,
    },
  },
} as const;

const monitorIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["monitorId"],

  properties: {
    monitorId: {
      type: "string",
      format: "uuid",
    },
  },
} as const;

const scanIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scanId"],

  properties: {
    scanId: {
      type: "string",
      format: "uuid",
    },
  },
} as const;

const triggerScanBodyJsonSchema = {
  type: "object",
  additionalProperties: false,

  properties: {
    kind: scanKindSchema,
  },
} as const;

const errorResponseSchema = {
  type: "object",

  required: ["statusCode", "code", "message", "requestId"],

  properties: {
    statusCode: {
      type: "integer",
    },

    code: {
      type: "string",
    },

    message: {
      type: "string",
    },

    requestId: {
      type: "string",
    },

    details: {
      anyOf: [
        {
          type: "object",
          additionalProperties: true,
        },
        {
          type: "array",
          items: {
            type: "object",
            additionalProperties: true,
          },
        },
      ],
    },
  },
} as const;

export const triggerScanRouteSchema: FastifySchema = {
  tags: ["Scans"],
  summary: "Trigger a monitor scan",
  description:
    "Creates a queued scan for the selected monitor. The optional body selects the scan kind " +
    "and defaults to HTTP_PROBE. Kinds without a worker implementation return 400 " +
    "SCAN_KIND_NOT_AVAILABLE. SECURITY_POSTURE and DNS_WATCH need the check enabled on the monitor " +
    "(409 SECURITY_CHECKS_DISABLED) and are rate limited (429 SCAN_RATE_LIMITED).",

  params: monitorIdParamsSchema,

  body: triggerScanBodyJsonSchema,

  response: {
    202: scanResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema,
    429: errorResponseSchema,
    503: errorResponseSchema,
  },
};

export const findAllScansRouteSchema: FastifySchema = {
  tags: ["Scans"],
  summary: "List scans for a monitor",

  params: monitorIdParamsSchema,

  querystring: {
    type: "object",
    additionalProperties: false,

    properties: {
      kind: scanKindSchema,
    },
  },

  response: {
    200: {
      type: "array",
      items: scanResponseSchema,
    },

    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export const findScanByIdRouteSchema: FastifySchema = {
  tags: ["Scans"],
  summary: "Get scan details",

  params: scanIdParamsSchema,

  response: {
    200: scanDetailsResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export const findLatestDnsWatchRouteSchema: FastifySchema = {
  tags: ["Scans"],
  summary: "Get the latest DNS watch scan of a monitor",
  description:
    "Returns the newest finished DNS_WATCH scan with its findings and sub-check results. " +
    "Responds 404 NO_DNS_SCAN when the monitor has none.",

  params: monitorIdParamsSchema,

  response: {
    200: scanDetailsResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export const findLatestSecurityPostureRouteSchema: FastifySchema = {
  tags: ["Scans"],
  summary: "Get the latest security posture scan of a monitor",
  description:
    "Returns the newest finished SECURITY_POSTURE scan with its findings and sub-check results. " +
    "Responds 404 NO_SECURITY_SCAN when the monitor has none.",

  params: monitorIdParamsSchema,

  response: {
    200: scanDetailsResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    404: errorResponseSchema,
  },
};
