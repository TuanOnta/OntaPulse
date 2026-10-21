import { useRunCheckScan } from "./use-run-check-scan";

/** "Run DNS scan": queues a DNS watch scan (202) and opens its page. Same 409 and 429 handling as the security scan. */
export function useRunDnsScan(monitorId: string, hrefFor: (scanId: string) => string) {
  return useRunCheckScan(monitorId, hrefFor, "dns");
}
