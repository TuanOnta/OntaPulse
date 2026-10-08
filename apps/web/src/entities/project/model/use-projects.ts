import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "@/shared/api/client";
import type { Project } from "@/shared/types/domain";

export type ProjectsError = { message: string; requestId?: string };

export type ProjectsState =
  | { status: "loading"; projects: Project[]; error: null }
  | { status: "ready"; projects: Project[]; error: null }
  | { status: "notfound"; projects: Project[]; error: null }
  | { status: "error"; projects: Project[]; error: ProjectsError };

const GENERIC_ERROR = "Check your connection and try again.";
const NOT_FOUND = 404;

/** Loads `GET /workspaces/:id/projects`. A 404 means the workspace is not visible to the user. */
export function useProjects(workspaceId: string) {
  const [state, setState] = useState<ProjectsState>({
    status: "loading",
    projects: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .projects(workspaceId)
      .then((projects) => {
        if (!ignore) setState({ status: "ready", projects, error: null });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        if (error instanceof ApiError && error.payload.statusCode === NOT_FOUND) {
          setState({ status: "notfound", projects: [], error: null });
          return;
        }
        const detail =
          error instanceof ApiError
            ? { message: error.message, requestId: error.payload.requestId }
            : { message: GENERIC_ERROR };
        setState({ status: "error", projects: [], error: detail });
      });
    return () => {
      ignore = true;
    };
  }, [workspaceId, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading", projects: [], error: null });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, reload };
}
