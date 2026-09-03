import { z } from "zod";

export const projectIdParamsSchema = z.object({
  projectId: z.string().uuid(),
});

export const createMonitorBodySchema = z.object({
  name: z.string().trim().min(1).max(120),

  targetUrl: z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;

      return protocol === "http:" || protocol === "https:";
    }, "targetUrl must use http or https"),

  intervalSeconds: z.number().int().min(60).max(86_400).default(300),
});

export type CreateMonitorInput = z.infer<typeof createMonitorBodySchema>;
