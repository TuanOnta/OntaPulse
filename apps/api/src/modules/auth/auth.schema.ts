import { z } from "zod";

export const registerBodySchema = z.object({
  name: z.string().trim().min(2).max(80),

  email: z.string().trim().toLowerCase().email(),

  password: z.string().min(12).max(128),
});

export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export type LoginInput = z.infer<typeof loginBodySchema>;
export type RegisterInput = z.infer<typeof registerBodySchema>;
