import { z } from "zod";

const baseEnvSchema = {
  API_PORT: z.coerce.number().int().positive(),

  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  POSTGRES_DB: z.string().min(1),
  POSTGRES_PORT: z.coerce.number().int().positive(),

  REDIS_PORT: z.coerce.number().int().positive(),
  REDIS_URL: z.string().url(),

  DATABASE_URL: z.string().url(),
};

const rabbitMqEnvSchema = {
  RABBITMQ_USER: z.string().min(1),
  RABBITMQ_PASSWORD: z.string().min(1),
  RABBITMQ_PORT: z.coerce.number().int().positive(),
  RABBITMQ_MANAGEMENT_PORT: z.coerce.number().int().positive(),
  RABBITMQ_URL: z.string().url(),
};

export const envSchema = z.discriminatedUnion("NODE_ENV", [
  z.object({
    ...baseEnvSchema,
    NODE_ENV: z.literal("test"),
  }),
  z.object({
    ...baseEnvSchema,
    ...rabbitMqEnvSchema,
    NODE_ENV: z.enum(["development", "production"]),
  }),
]);
