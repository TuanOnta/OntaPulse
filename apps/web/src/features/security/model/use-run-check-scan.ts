import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { formatWait } from "@/entities/scan";
import { ApiError, api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";

export type CheckKind = "security" | "dns";

const COPY: Record<CheckKind, { noun: string; queued: string; off: string }> = {
  security: {
    noun: "security",
    queued: "Security scan queued for",
    off: "Security checks are off for this monitor.",
  },
  dns: {
    noun: "DNS",
    queued: "DNS scan queued for",
    off: "DNS watch is off for this monitor.",
  },
};

function retryAfterSeconds(error: ApiError): number | null {
  const value = error.payload.details?.retryAfterSeconds;

  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * "Run security scan" / "Run DNS scan": queues the scan (202) and opens its page, which follows it. The API
 * decides who may run it and how often: a 409 means the checks are off and a 429 carries how long to wait,
 * which is kept in `retryAt` so the button can show a countdown.
 */
export function useRunCheckScan(
  monitorId: string,
  hrefFor: (scanId: string) => string,
  kind: CheckKind,
) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const copy = COPY[kind];

  const run = useCallback(
    async (host: string) => {
      setBusy(true);
      try {
        const scan =
          kind === "dns"
            ? await api.triggerDnsScan(monitorId)
            : await api.triggerSecurityScan(monitorId);
        setRetryAt(null);
        toast.success(`${copy.queued} ${host}.`);
        navigate(hrefFor(scan.id));
      } catch (error) {
        if (error instanceof ApiError && error.payload.code === "SECURITY_CHECKS_DISABLED") {
          toast.error(copy.off);
        } else if (error instanceof ApiError && error.payload.code === "SCAN_RATE_LIMITED") {
          const seconds = retryAfterSeconds(error);
          if (seconds !== null) setRetryAt(Date.now() + seconds * 1000);
          toast.error(
            seconds !== null
              ? `You can run another ${copy.noun} scan in ${formatWait(seconds)}.`
              : error.message,
          );
        } else {
          toast.error(getErrorMessage(error));
        }
      } finally {
        setBusy(false);
      }
    },
    [monitorId, hrefFor, navigate, kind, copy],
  );

  return { run, busy, retryAt };
}
