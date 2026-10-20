import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "@/shared/api/client";
import type { EdgeProfile } from "@/shared/types/domain";

export type EdgeProfileError = { message: string; requestId?: string };

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; profile: EdgeProfile }
  | { status: "error"; error: EdgeProfileError };

const GENERIC_ERROR = "Check your connection and try again.";

/**
 * The current edge profile of a monitor. A monitor with no profile yet answers 404 NO_EDGE_PROFILE, which is the
 * empty state, not an error. `refreshKey` (the newest security scan id) refetches after a new scan finishes.
 */
export function useEdgeProfile(monitorId: string, refreshKey?: string) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .edgeProfile(monitorId)
      .then((profile) => {
        if (!ignore) setState({ status: "ready", profile });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        if (error instanceof ApiError && error.payload.code === "NO_EDGE_PROFILE") {
          setState({ status: "empty" });
          return;
        }
        setState({
          status: "error",
          error:
            error instanceof ApiError
              ? { message: error.message, requestId: error.payload.requestId }
              : { message: GENERIC_ERROR },
        });
      });
    return () => {
      ignore = true;
    };
  }, [monitorId, refreshKey, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, reload };
}
