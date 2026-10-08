import { z } from "zod";

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

/** Rename and/or change the description. An empty description clears it. */
export const updateProjectBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: "Provide a name or a description",
  });

export const projectIdParamsSchema = z.object({
  projectId: z.uuid(),
});

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectBodySchema>;
export type WorkspaceIdParams = z.infer<typeof workspaceIdParamsSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectBodySchema>;
export type ProjectIdParams = z.infer<typeof projectIdParamsSchema>;
