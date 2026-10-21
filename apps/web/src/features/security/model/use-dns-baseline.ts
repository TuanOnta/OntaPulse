import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "@/shared/api/client";
import type { DnsBaseline } from "@/shared/types/domain";

export type DnsBaselineError = { message: string; requestId?: string };

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; baseline: DnsBaseline }
  | { status: "error"; error: DnsBaselineError };

const GENERIC_ERROR = "Check your connection and try again.";

/**
 * The DNS baseline of a monitor with its recent changes. Before the first successful scan the API answers
 * 404 NO_DNS_BASELINE, which is the empty state, not an error. `refreshKey` is the newest DNS scan id: nothing is
 * requested while it is null (there is no scan yet) and a new id refetches after a scan finishes.
 */
export function useDnsBaseline(monitorId: string, refreshKey: string | null) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (refreshKey === null) return;
    let ignore = false;
    api
      .dnsBaseline(monitorId)
      .then((baseline) => {
        if (!ignore) setState({ status: "ready", baseline });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        if (error instanceof ApiError && error.payload.code === "NO_DNS_BASELINE") {
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
