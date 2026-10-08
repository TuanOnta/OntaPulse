import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { isBusyScan } from "@/entities/scan";
import { ApiError, api } from "@/shared/api/client";
import type { ScanDetail } from "@/shared/types/domain";

export const SCAN_DETAIL_POLL_MS = 2000;

export type ScanDetailError = { message: string; requestId?: string };

type State =
  | { status: "loading"; scan: null; error: null }
  | { status: "ready"; scan: ScanDetail; error: null }
  | { status: "notfound"; scan: null; error: null }
  | { status: "error"; scan: null; error: ScanDetailError };

const GENERIC_ERROR = "Check your connection and try again.";
const NOT_FOUND = 404;

function toState(error: unknown): State {
  if (error instanceof ApiError && error.payload.statusCode === NOT_FOUND) {
    return { status: "notfound", scan: null, error: null };
  }
  const detail =
    error instanceof ApiError
      ? { message: error.message, requestId: error.payload.requestId }
      : { message: GENERIC_ERROR };
  return { status: "error", scan: null, error: detail };
}

/**
 * One scan with its findings (`GET /scans/:id`). While it is QUEUED or RUNNING the scan is re-fetched every
 * 2 s; when this page sees it finish it says so once. Opening another scan id starts over.
 */
export function useScanDetail(scanId: string) {
  const [state, setState] = useState<State>({ status: "loading", scan: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const lastStatus = useRef<ScanDetail["status"] | null>(null);

  useEffect(() => {
    let ignore = false;
    lastStatus.current = null;
    setState({ status: "loading", scan: null, error: null });
    api
      .scan(scanId)
      .then((scan) => {
        if (ignore) return;
        lastStatus.current = scan.status;
        setState({ status: "ready", scan, error: null });
      })
      .catch((error: unknown) => {
        if (!ignore) setState(toState(error));
      });
    return () => {
      ignore = true;
    };
  }, [scanId, attempt]);

  const busy = state.status === "ready" && isBusyScan(state.scan);

  useEffect(() => {
    if (!busy) return;
    let ignore = false;
    const id = window.setInterval(() => {
      api
        .scan(scanId)
        .then((scan) => {
          if (ignore) return;
          const before = lastStatus.current;
          lastStatus.current = scan.status;
          if (before && (before === "QUEUED" || before === "RUNNING")) {
            if (scan.status === "SUCCEEDED") toast.success("Scan finished.");
            if (scan.status === "FAILED") toast.error("Scan failed.");
          }
          setState({ status: "ready", scan, error: null });
        })
        .catch(() => {
          // Keep the last known scan; the next tick tries again.
        });
    }, SCAN_DETAIL_POLL_MS);
    return () => {
      ignore = true;
      window.clearInterval(id);
    };
  }, [busy, scanId]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, reload };
}
