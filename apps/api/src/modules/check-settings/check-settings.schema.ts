import { z } from "zod";

export const monitorIdParamsSchema = z.object({
  monitorId: z.string().uuid(),
});

// `pathProbesAcknowledged` is the caller's statement that they are authorized to test the target. It is only
// meaningful together with `pathProbesEnabled`; the service requires it when probes are switched on.
export const updateCheckSettingsBodySchema = z
  .object({
    securityPostureEnabled: z.boolean().optional(),
    dnsWatchEnabled: z.boolean().optional(),
    pathProbesEnabled: z.boolean().optional(),
    pathProbesAcknowledged: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.securityPostureEnabled !== undefined ||
      value.dnsWatchEnabled !== undefined ||
      value.pathProbesEnabled !== undefined,
    "At least one setting is required",
  )
  .refine(
    (value) => value.pathProbesAcknowledged === undefined || value.pathProbesEnabled !== undefined,
    "pathProbesAcknowledged needs pathProbesEnabled",
  );

export type UpdateCheckSettingsInput = z.infer<typeof updateCheckSettingsBodySchema>;
