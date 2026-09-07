import { z } from "zod";

export const createWorkspaceBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.uuid(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceBodySchema>;
export type WorkspaceIdParams = z.infer<typeof workspaceIdParamsSchema>;
