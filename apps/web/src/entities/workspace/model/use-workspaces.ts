import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "@/shared/api/client";
import type { Workspace } from "@/shared/types/domain";

export type WorkspacesError = { message: string; requestId?: string };

export type WorkspacesState =
  | { status: "loading"; workspaces: Workspace[]; error: null }
  | { status: "ready"; workspaces: Workspace[]; error: null }
  | { status: "error"; workspaces: Workspace[]; error: WorkspacesError };

const GENERIC_ERROR = "Check your connection and try again.";

function toError(error: unknown): WorkspacesError {
  if (error instanceof ApiError) {
    return { message: error.message, requestId: error.payload.requestId };
  }
  return { message: GENERIC_ERROR };
}

/** Loads the signed-in user's workspaces (`GET /api/workspaces`) and exposes a `reload`. */
export function useWorkspaces() {
  const [state, setState] = useState<WorkspacesState>({
    status: "loading",
    workspaces: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .workspaces()
      .then((workspaces) => {
        if (!ignore) setState({ status: "ready", workspaces, error: null });
      })
      .catch((error: unknown) => {
        if (!ignore) setState({ status: "error", workspaces: [], error: toError(error) });
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading", workspaces: [], error: null });
    setAttempt((value) => value + 1);
  }, []);

  /** Swaps in a renamed workspace without showing the loading state again. */
  const replaceWorkspace = useCallback((workspace: Workspace) => {
    setState((current) =>
      current.status === "ready"
        ? {
            ...current,
            workspaces: current.workspaces.map((item) =>
              item.id === workspace.id ? { ...item, ...workspace } : item,
            ),
          }
        : current,
    );
  }, []);

  const removeWorkspace = useCallback((workspaceId: string) => {
    setState((current) =>
      current.status === "ready"
        ? { ...current, workspaces: current.workspaces.filter((item) => item.id !== workspaceId) }
        : current,
    );
  }, []);

  return { ...state, reload, replaceWorkspace, removeWorkspace };
}
