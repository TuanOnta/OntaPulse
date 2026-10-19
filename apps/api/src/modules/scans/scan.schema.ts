import { z } from "zod";

import { SCAN_KINDS } from "./scan-kinds.js";

export const monitorIdParamsSchema = z.object({
  monitorId: z.string().uuid(),
});

export const scanIdParamsSchema = z.object({
  scanId: z.string().uuid(),
});

export const triggerScanBodySchema = z
  .object({
    kind: z.enum(SCAN_KINDS).optional(),
  })
  .strict()
  .optional();

export type TriggerScanInput = z.infer<typeof triggerScanBodySchema>;
