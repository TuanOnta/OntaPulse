export const SCAN_KINDS = ["HTTP_PROBE", "SECURITY_POSTURE", "DNS_WATCH"] as const;

export type ScanKind = (typeof SCAN_KINDS)[number];

export const DEFAULT_SCAN_KIND: ScanKind = "HTTP_PROBE";

/**
 * Kinds a worker can run today. A kind joins this list in the phase that ships its checks;
 * until then a trigger for it is rejected so no job is queued that no worker can execute.
 */
export const AVAILABLE_SCAN_KINDS: readonly ScanKind[] = [
  "HTTP_PROBE",
  "SECURITY_POSTURE",
  "DNS_WATCH",
];

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
 *
 * A person may run a security scan again after a short cooldown (to check a fix). The hourly
 * minimum is for the scheduler (recurring runs, a later phase) and is not enforced on manual runs.
 */
export const SECURITY_POSTURE_MANUAL_COOLDOWN_SECONDS = 60;
export const SECURITY_POSTURE_SCHEDULE_MIN_INTERVAL_SECONDS = 3_600;
export const SECURITY_POSTURE_WORKSPACE_LIMIT_PER_HOUR = 60;
export const DNS_WATCH_MANUAL_COOLDOWN_SECONDS = 60;
export const DNS_WATCH_SCHEDULE_MIN_INTERVAL_SECONDS = 3_600;
export const DNS_WATCH_WORKSPACE_LIMIT_PER_HOUR = 60;
export const WORKSPACE_LIMIT_WINDOW_SECONDS = 3_600;

export const SCAN_KIND_LIMITS: Partial<
  Record<ScanKind, { manualCooldownSeconds: number; workspaceLimitPerWindow: number }>
> = {
  SECURITY_POSTURE: {
    manualCooldownSeconds: SECURITY_POSTURE_MANUAL_COOLDOWN_SECONDS,
    workspaceLimitPerWindow: SECURITY_POSTURE_WORKSPACE_LIMIT_PER_HOUR,
  },
  DNS_WATCH: {
    manualCooldownSeconds: DNS_WATCH_MANUAL_COOLDOWN_SECONDS,
    workspaceLimitPerWindow: DNS_WATCH_WORKSPACE_LIMIT_PER_HOUR,
  },
};

export const SUB_CHECK_STATES = ["ran", "skipped"] as const;
