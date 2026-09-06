import { z } from "zod";

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectBodySchema>;
export type WorkspaceIdParams = z.infer<typeof workspaceIdParamsSchema>;
