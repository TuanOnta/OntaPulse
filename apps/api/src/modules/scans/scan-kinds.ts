export const SCAN_KINDS = ["HTTP_PROBE", "SECURITY_POSTURE", "DNS_WATCH"] as const;

export type ScanKind = (typeof SCAN_KINDS)[number];

export const DEFAULT_SCAN_KIND: ScanKind = "HTTP_PROBE";

/**
 * Kinds a worker can run today. A kind joins this list in the phase that ships its checks;
 * until then a trigger for it is rejected so no job is queued that no worker can execute.
 */
export const AVAILABLE_SCAN_KINDS: readonly ScanKind[] = ["HTTP_PROBE", "SECURITY_POSTURE"];

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

/**
 * Rate limits for kinds other than HTTP_PROBE (docs/security-checks.md section 4). They are
 * independent of the 60 s HTTP_PROBE interval floor.
 */
export const SECURITY_POSTURE_MIN_INTERVAL_SECONDS = 3_600;
export const SECURITY_POSTURE_WORKSPACE_LIMIT_PER_HOUR = 60;
export const WORKSPACE_LIMIT_WINDOW_SECONDS = 3_600;

export const SCAN_KIND_LIMITS: Partial<
  Record<ScanKind, { minIntervalSeconds: number; workspaceLimitPerWindow: number }>
> = {
  SECURITY_POSTURE: {
    minIntervalSeconds: SECURITY_POSTURE_MIN_INTERVAL_SECONDS,
    workspaceLimitPerWindow: SECURITY_POSTURE_WORKSPACE_LIMIT_PER_HOUR,
  },
};

export const SUB_CHECK_STATES = ["ran", "skipped"] as const;
