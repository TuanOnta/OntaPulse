import type { Scan, SubCheck } from "@/shared/types/domain";

/** True for the scans made by the security posture check (the API calls the kind SECURITY_POSTURE). */
export function isSecurityScan(scan: Pick<Scan, "kind">): boolean {
  return scan.kind === "SECURITY_POSTURE";
}

/** True for the scans made by the DNS watch (the API calls the kind DNS_WATCH). */
export function isDnsScan(scan: Pick<Scan, "kind">): boolean {
  return scan.kind === "DNS_WATCH";
}

/** Security and DNS scans share the findings plus sub-checks shape and have no HTTP result of their own. */
export function isCheckScan(scan: Pick<Scan, "kind">): boolean {
  return isSecurityScan(scan) || isDnsScan(scan);
}

/** "Security" or "DNS": the name of the kind of check, for headings and tags. */
export function checkKindName(scan: Pick<Scan, "kind">): "Security" | "DNS" {
  return isDnsScan(scan) ? "DNS" : "Security";
}

const SUB_CHECK_LABELS: Record<string, string> = {
  headers: "Security headers",
  cookies: "Cookies",
  cors: "CORS",
  redirect: "HTTP to HTTPS redirect",
  tls: "TLS and certificate",
  exposed_files: "Exposed files",
  edge: "Edge detection",
  dns_records: "DNS records",
  dangling_cname: "Dangling CNAME",
  email_auth: "Email authentication",
};

const SKIP_REASONS: Record<string, string> = {
  connection_failed: "Skipped: connection failed",
  challenge_response: "Skipped: challenge response",
  not_enabled: "Skipped: not enabled",
  not_applicable: "Skipped: not applicable",
  budget_exhausted: "Skipped: request budget reached",
  prerequisite_failed: "Skipped: an earlier check did not run",
};

export function subCheckLabel(name: string): string {
  return SUB_CHECK_LABELS[name] ?? name;
}

/** "Ran", or the reason a check was skipped. An unknown reason is shown, never hidden. */
export function subCheckStateText(subCheck: Pick<SubCheck, "state" | "reason">): string {
  if (subCheck.state === "ran") return "Ran";
  if (!subCheck.reason) return "Skipped";

  return SKIP_REASONS[subCheck.reason] ?? `Skipped: ${subCheck.reason.replaceAll("_", " ")}`;
}

export function subCheckCounts(subChecks: readonly Pick<SubCheck, "state">[] | null | undefined): {
  ran: number;
  skipped: number;
  total: number;
} {
  const list = subChecks ?? [];
  const ran = list.filter((item) => item.state === "ran").length;

  return { ran, skipped: list.length - ran, total: list.length };
}

/** "45 s", "12 min", "1 h 5 min": how long until a rate limit lifts. */
export function formatWait(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds));
  if (safe < 60) return `${safe} s`;
  const minutes = Math.ceil(safe / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
