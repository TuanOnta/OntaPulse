import { z } from "zod";

export const monitorIdParamsSchema = z.object({
  monitorId: z.string().uuid(),
});
