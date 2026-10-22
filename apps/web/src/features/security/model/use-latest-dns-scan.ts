import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "@/shared/api/client";
import type { ScanDetail } from "@/shared/types/domain";

export type LatestDnsError = { message: string; requestId?: string };

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; scan: ScanDetail }
  | { status: "error"; error: LatestDnsError };

const GENERIC_ERROR = "Check your connection and try again.";

/**
 * The newest finished DNS watch scan of a monitor with its findings and sub-checks. A monitor that never had
 * one answers 404 NO_DNS_SCAN, which is the empty state, not an error.
 */
export function useLatestDnsScan(monitorId: string) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .latestDnsScan(monitorId)
      .then((scan) => {
        if (!ignore) setState({ status: "ready", scan });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        if (error instanceof ApiError && error.payload.code === "NO_DNS_SCAN") {
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
  }, [monitorId, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, reload };
}
