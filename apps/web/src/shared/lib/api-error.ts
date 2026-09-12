import { ApiError } from "@/shared/api/client";

export function getErrorMessage(
  error: unknown,
  fallback = "Could not complete that request. Try again.",
) {
  return error instanceof ApiError ? error.message : fallback;
}
