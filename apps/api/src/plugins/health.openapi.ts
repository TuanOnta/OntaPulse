import type { FastifySchema } from "fastify";

export const healthSchema = {
    tags: ["Health"],
    summary: "Check that the API is running",
    response: {
        200: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", example: "ok" } },
        },
    },
}

export const databaseReadySchema = {
    tags: ["Health"],
    summary: "Check database readiness",
    response: {
        200: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", example: "ready" } },
        },
        503: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", example: "not_ready" } },
        },
    },
}