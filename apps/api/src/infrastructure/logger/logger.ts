import type { FastifyServerOptions } from "fastify";

import { env } from "../../config/env.js";

export const loggerOptions: FastifyServerOptions["logger"] = {
  level: env.NODE_ENV === "development" ? "debug" : "info",
};