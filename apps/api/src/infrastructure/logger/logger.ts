import type { FastifyServerOptions } from "fastify";

import { env } from "../../config/env.js";

export const loggerOptions: FastifyServerOptions["logger"] = {
  level: env.NODE_ENV === "development" ? "debug" : env.NODE_ENV === "test" ? "silent" : "info",
};