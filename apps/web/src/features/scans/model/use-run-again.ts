import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";

/**
 * "Run scan again": triggers a new scan of the monitor (202, QUEUED) and opens its page, which follows it.
 * `hrefFor` builds the page address of the new scan; `host` is only used in the toast.
 */
export function useRunAgain(monitorId: string, hrefFor: (scanId: string) => string) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function run(host?: string) {
    setBusy(true);
    try {
      const scan = await api.triggerScan(monitorId);
      toast.success(host ? `Scan queued for ${host}.` : "Scan queued.");
      navigate(hrefFor(scan.id));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return { run, busy };
}
