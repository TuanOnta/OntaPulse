import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";

export const WORKSPACE_NAME_MAX = 120;

/** The checks of the prototype; the API accepts 1-120 characters after trimming. */
export function validateWorkspaceName(value: string): string | null {
  const name = value.trim();
  if (!name) return "Workspace name is required.";
  if (name.length > WORKSPACE_NAME_MAX) return "Use 120 characters or fewer.";
  return null;
}

/**
 * Validates and creates a workspace (`POST /api/workspaces`, the user becomes OWNER), then toasts and opens
 * it. Shared by the dialog and the inline first-run form. `create` resolves to true on success.
 */
export function useCreateWorkspace() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(rawName: string): Promise<boolean> {
    const invalid = validateWorkspaceName(rawName);
    setError(invalid);
    if (invalid) return false;
    const name = rawName.trim();
    setBusy(true);
    try {
      const workspace = await api.createWorkspace(name);
      toast.success(`Workspace “${name}” created. Opening it…`);
      navigate(`/workspaces/${workspace.id}`);
      return true;
    } catch (failure) {
      setError(getErrorMessage(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { create, busy, error, clearError: () => setError(null) };
}
