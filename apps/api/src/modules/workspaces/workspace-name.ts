import { AppError } from "../../infrastructure/errors/app-error.js";

/**
 * The key that makes workspace names unique per owner: trimmed, Unicode-normalized and lower-cased, so "Acme", "acme"
 * and " ACME " are the same name. The stored `name` keeps what the user typed; the key is internal.
 */
export function workspaceNameKey(name: string): string {
  return name.trim().normalize("NFKC").toLowerCase();
}

export function workspaceNameTaken(): AppError {
  return new AppError("You already have a workspace with this name.", 409, "WORKSPACE_NAME_TAKEN");
}

/** A Prisma unique-constraint violation (a lost race on the owner and name key index). */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
