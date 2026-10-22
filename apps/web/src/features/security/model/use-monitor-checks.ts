import { useNow } from "@/shared/lib/use-now";

import { useCheckSettings } from "./use-check-settings";
import { useLatestDnsScan } from "./use-latest-dns-scan";
import { useLatestSecurityScan } from "./use-latest-security-scan";
import { useRunDnsScan } from "./use-run-dns-scan";
import { useRunSecurityScan } from "./use-run-security-scan";

const IDLE_REFRESH_MS = 60_000;
const COUNTDOWN_REFRESH_MS = 1_000;

export type MonitorChecks = ReturnType<typeof useMonitorChecks>;

/**
 * Everything the Checks strip and its panels share for one monitor: the check settings, the latest security
 * and DNS result, and the two run actions with their rate-limit countdown. Loaded once here so the cards and
 * the panels never fetch the same thing twice.
 */
export function useMonitorChecks(monitorId: string, scanHref: (scanId: string) => string) {
  const settings = useCheckSettings(monitorId);
  const security = useLatestSecurityScan(monitorId);
  const dns = useLatestDnsScan(monitorId);
  const runSecurity = useRunSecurityScan(monitorId, scanHref);
  const runDns = useRunDnsScan(monitorId, scanHref);
  const waiting = runSecurity.retryAt !== null || runDns.retryAt !== null;
  // The ticking `useNow` re-renders the countdown; the wait itself is read from the clock when drawn,
  // so the first value after a rate limit is exact instead of one tick old.
  const now = useNow(waiting ? COUNTDOWN_REFRESH_MS : IDLE_REFRESH_MS);

  const waitSeconds = (retryAt: number | null) =>
    retryAt ? Math.ceil((retryAt - Date.now()) / 1000) : 0;

  return {
    now,
    settings,
    securityEnabled: settings.status === "ready" && settings.settings.securityPostureEnabled,
    dnsEnabled: settings.status === "ready" && settings.settings.dnsWatchEnabled,
    security: { latest: security, run: runSecurity, waitSeconds: waitSeconds(runSecurity.retryAt) },
    dns: { latest: dns, run: runDns, waitSeconds: waitSeconds(runDns.retryAt) },
  };
}
