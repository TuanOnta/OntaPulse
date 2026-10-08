import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "@/shared/api/client";
import type { Monitor } from "@/shared/types/domain";

export type MonitorsError = { message: string; requestId?: string };

export type MonitorsState =
  | { status: "loading"; monitors: Monitor[]; error: null }
  | { status: "ready"; monitors: Monitor[]; error: null }
  | { status: "notfound"; monitors: Monitor[]; error: null }
  | { status: "error"; monitors: Monitor[]; error: MonitorsError };

const GENERIC_ERROR = "Check your connection and try again.";
const NOT_FOUND = 404;

/** Loads `GET /projects/:id/monitors`. A 404 means the project is not visible to the user. */
export function useMonitors(projectId: string) {
  const [state, setState] = useState<MonitorsState>({
    status: "loading",
    monitors: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .monitors(projectId)
      .then((monitors) => {
        if (!ignore) setState({ status: "ready", monitors, error: null });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        if (error instanceof ApiError && error.payload.statusCode === NOT_FOUND) {
          setState({ status: "notfound", monitors: [], error: null });
          return;
        }
        const detail =
          error instanceof ApiError
            ? { message: error.message, requestId: error.payload.requestId }
            : { message: GENERIC_ERROR };
        setState({ status: "error", monitors: [], error: detail });
      });
    return () => {
      ignore = true;
    };
  }, [projectId, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading", monitors: [], error: null });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, reload };
}
