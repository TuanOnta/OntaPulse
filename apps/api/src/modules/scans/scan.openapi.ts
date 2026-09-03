import type { FastifySchema } from "fastify";

const scanStatusSchema = {
  type: "string",

  enum: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"],
} as const;

const scanResponseSchema = {
  type: "object",

  required: [
    "id",
    "monitorId",
    "status",
    "statusCode",
    "responseTimeMs",
    "errorMessage",
    "startedAt",
    "finishedAt",
    "createdAt",
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
  },
} as const;

const findingResponseSchema = {
  type: "object",

  required: [
    "id",
    "scanId",
    "code",
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
  description: "Creates a queued scan for the selected monitor.",

  params: monitorIdParamsSchema,

  response: {
    202: scanResponseSchema,
    400: errorResponseSchema,
    404: errorResponseSchema,
  },
};

export const findAllScansRouteSchema: FastifySchema = {
  tags: ["Scans"],
  summary: "List scans for a monitor",

  params: monitorIdParamsSchema,

  response: {
    200: {
      type: "array",
      items: scanResponseSchema,
    },

    400: errorResponseSchema,
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
    404: errorResponseSchema,
  },
};
