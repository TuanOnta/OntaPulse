export const SCAN_KINDS = ["HTTP_PROBE", "SECURITY_POSTURE", "DNS_WATCH"] as const;

export type ScanKind = (typeof SCAN_KINDS)[number];

export const DEFAULT_SCAN_KIND: ScanKind = "HTTP_PROBE";

/**
 * Kinds a worker can run today. A kind joins this list in the phase that ships its checks;
 * until then a trigger for it is rejected so no job is queued that no worker can execute.
 */
export const AVAILABLE_SCAN_KINDS: readonly ScanKind[] = ["HTTP_PROBE"];

export function isScanKindAvailable(kind: ScanKind): boolean {
  return AVAILABLE_SCAN_KINDS.includes(kind);
}

export const FINDING_CATEGORIES = [
  "HEADERS",
  "COOKIES",
  "CORS",
  "REDIRECT",
  "TLS",
  "EXPOSED_FILES",
  "DNS",
  "EMAIL_AUTH",
] as const;

export const FINDING_CONFIDENCES = ["LOW", "MEDIUM", "HIGH"] as const;
