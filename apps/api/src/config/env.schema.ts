import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  API_PORT: z.coerce.number().int().positive(),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive(),
  REDIS_PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});
