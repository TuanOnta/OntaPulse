import { z } from "zod";

export const monitorIdParamsSchema = z.object({
  monitorId: z.string().uuid(),
});

// Path-probe fields are rejected until the phase that ships them (strict object).
export const updateCheckSettingsBodySchema = z
  .object({
    securityPostureEnabled: z.boolean().optional(),
    dnsWatchEnabled: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.securityPostureEnabled !== undefined || value.dnsWatchEnabled !== undefined,
    "At least one setting is required",
  );

export type UpdateCheckSettingsInput = z.infer<typeof updateCheckSettingsBodySchema>;
