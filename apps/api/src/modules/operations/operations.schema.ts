import { z } from "zod";

export const workspaceIdParamsSchema = z.object({ workspaceId: z.string().uuid() });

export const redriveDeadLetterParamsSchema = workspaceIdParamsSchema.extend({
  scanId: z.string().uuid(),
});
