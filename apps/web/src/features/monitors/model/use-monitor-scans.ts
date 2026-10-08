import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { formatMs, isBusyScan } from "@/entities/scan";
import { ApiError, api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import type { Scan } from "@/shared/types/domain";

export const SCAN_LIST_POLL_MS = 2000;

export type MonitorScansError = { message: string; requestId?: string };

type State =
  | { status: "loading"; scans: Scan[]; error: null }
  | { status: "ready"; scans: Scan[]; error: null }
  | { status: "error"; scans: Scan[]; error: MonitorScansError };

const GENERIC_ERROR = "Check your connection and try again.";

function finishedMessage(scan: Scan): { ok: boolean; text: string } {
  if (scan.status === "FAILED") {
    return {
      ok: false,
      text: `Scan failed: ${scan.errorMessage || "the target did not respond."}`,
    };
  }
  if (scan.statusCode != null && scan.responseTimeMs != null) {
    return {
      ok: true,
      text: `Scan finished: HTTP ${scan.statusCode} in ${formatMs(scan.responseTimeMs)}.`,
    };
  }
  return { ok: true, text: "Scan finished." };
}

/**
 * Scan history of one monitor (`GET /monitors/:id/scans`, newest first) plus "run scan". A new scan is put on
 * top at once; while any scan is QUEUED or RUNNING the list is re-fetched every 2 s, which also follows scans
 * made by the scheduler. A scan started here announces its result once. All timers stop on unmount.
 */
export function useMonitorScans(monitorId: string) {
  const [state, setState] = useState<State>({ status: "loading", scans: [], error: null });
  const [attempt, setAttempt] = useState(0);
  const [running, setRunning] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const alive = useRef(false);
  const startedHere = useRef(new Set<string>());
  const busyIds = useRef(new Set<string>());

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    api
      .scans(monitorId)
      .then((scans) => {
        if (ignore) return;
        busyIds.current = new Set(scans.filter(isBusyScan).map((scan) => scan.id));
        setState({ status: "ready", scans, error: null });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        const detail =
          error instanceof ApiError
            ? { message: error.message, requestId: error.payload.requestId }
            : { message: GENERIC_ERROR };
        setState({ status: "error", scans: [], error: detail });
      });
    return () => {
      ignore = true;
    };
  }, [monitorId, attempt]);

  const busy = state.scans.some(isBusyScan);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => {
      api
        .scans(monitorId)
        .then((scans) => {
          if (!alive.current) return;
          for (const scan of scans) {
            if (
              busyIds.current.has(scan.id) &&
              !isBusyScan(scan) &&
              startedHere.current.has(scan.id)
            ) {
              const message = finishedMessage(scan);
              if (message.ok) toast.success(message.text);
              else toast.error(message.text);
              startedHere.current.delete(scan.id);
            }
          }
          busyIds.current = new Set(scans.filter(isBusyScan).map((scan) => scan.id));
          setState({ status: "ready", scans, error: null });
        })
        .catch(() => {
          // A failed refresh keeps the last list; the next tick tries again.
        });
    }, SCAN_LIST_POLL_MS);
    return () => window.clearInterval(id);
  }, [busy, monitorId]);

  const reload = useCallback(() => {
    setState({ status: "loading", scans: [], error: null });
    setAttempt((value) => value + 1);
  }, []);

  /** Triggers a scan (202, QUEUED). `host` is only used in the toast. */
  const run = useCallback(
    async (host: string) => {
      setRunning(true);
      try {
        const scan = await api.triggerScan(monitorId);
        if (!alive.current) return;
        startedHere.current.add(scan.id);
        busyIds.current.add(scan.id);
        setFreshId(scan.id);
        setState((current) => ({
          status: "ready",
          scans: [scan, ...current.scans.filter((item) => item.id !== scan.id)],
          error: null,
        }));
        toast.success(`Scan queued for ${host}.`);
      } catch (error) {
        if (alive.current) toast.error(getErrorMessage(error));
      } finally {
        if (alive.current) setRunning(false);
      }
    },
    [monitorId],
  );

  return { ...state, busy: busy || running, running, freshId, run, reload };
}
