import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";

config({
  path: resolve(currentDir, "../../", envFile),
  override: true,
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
