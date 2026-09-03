import { z } from "zod";

export const monitorIdParamsSchema = z.object({
  monitorId: z.string().uuid(),
});

export const scanIdParamsSchema = z.object({
  scanId: z.string().uuid(),
});
