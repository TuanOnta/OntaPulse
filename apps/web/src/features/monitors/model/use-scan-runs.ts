import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { QUEUED_RUN, isRunFinished, toScanRun, type ScanRun } from "@/entities/scan";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";

export const SCAN_POLL_MS = 1500;
export const SCAN_MAX_POLLS = 120;

/**
 * Runs scans from the project screen and follows each one through QUEUED -> RUNNING -> terminal by polling
 * `GET /scans/:id`. Only scans started here get a status; the monitor list itself has none. Every timer is
 * cleared on unmount.
 */
export function useScanRuns() {
  const [runs, setRuns] = useState<Record<string, ScanRun>>({});
  const timers = useRef(new Set<number>());
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach((id) => window.clearTimeout(id));
      pending.clear();
    };
  }, []);

  const drop = useCallback((monitorId: string) => {
    setRuns((current) => {
      const { [monitorId]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const follow = useCallback(
    (monitorId: string, scanId: string, attempt: number) => {
      const id = window.setTimeout(async () => {
        timers.current.delete(id);
        try {
          const run = toScanRun(await api.scan(scanId));
          if (!alive.current) return;
          setRuns((current) => ({ ...current, [monitorId]: run }));
          if (isRunFinished(run)) return;
          if (attempt >= SCAN_MAX_POLLS) {
            drop(monitorId);
            toast.error("The scan is taking longer than expected. Open the monitor to follow it.");
            return;
          }
          follow(monitorId, scanId, attempt + 1);
        } catch (error) {
          if (!alive.current) return;
          drop(monitorId);
          toast.error(getErrorMessage(error));
        }
      }, SCAN_POLL_MS);
      timers.current.add(id);
    },
    [drop],
  );

  /** Triggers a scan (202, QUEUED) and starts following it. `label` is used in the toast. */
  const start = useCallback(
    async (monitorId: string, label: string) => {
      setRuns((current) => ({ ...current, [monitorId]: QUEUED_RUN }));
      try {
        const scan = await api.triggerScan(monitorId);
        if (!alive.current) return;
        toast.success(`Scan queued for ${label}.`);
        follow(monitorId, scan.id, 1);
      } catch (error) {
        if (!alive.current) return;
        drop(monitorId);
        toast.error(getErrorMessage(error));
      }
    },
    [drop, follow],
  );

  return { runs, start };
}
