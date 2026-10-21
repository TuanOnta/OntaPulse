import { useRunCheckScan } from "./use-run-check-scan";

/**
 * "Run security scan": queues a security posture scan (202) and opens its page, which follows it. See
 * `useRunCheckScan` for how the 409 (checks off) and 429 (wait) answers are handled.
 */
export function useRunSecurityScan(monitorId: string, hrefFor: (scanId: string) => string) {
  return useRunCheckScan(monitorId, hrefFor, "security");
}
