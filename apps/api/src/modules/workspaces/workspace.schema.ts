import { z } from "zod";

export const createWorkspaceBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.uuid(),
});

export const workspaceMemberParamsSchema = workspaceIdParamsSchema.extend({
  userId: z.uuid(),
});

export const addWorkspaceMemberBodySchema = z.object({
  email: z.string().trim().email().max(320),
});

export const updateWorkspaceMemberBodySchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceBodySchema>;
export type WorkspaceIdParams = z.infer<typeof workspaceIdParamsSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberBodySchema>;
export type UpdateWorkspaceMemberInput = z.infer<typeof updateWorkspaceMemberBodySchema>;
