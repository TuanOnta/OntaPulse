import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { envSchema } from "./env.schema.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";

config({
  path: resolve(currentDir, "../../../../", envFile),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables:", parsedEnv.error.flatten().fieldErrors);

  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
