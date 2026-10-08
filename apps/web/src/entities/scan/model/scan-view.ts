import type { Finding, FindingSeverity, ScanDetail } from "@/shared/types/domain";

import { SLOW_MS } from "./scan-history";

/** Top of the response-time meter on the scan screen; the 2 s tick sits at SLOW_MS / METER_MAX_MS. */
export const METER_MAX_MS = 3000;

export type OutcomeTone = "queued" | "running" | "ok" | "warn" | "bad";
export type OrbKind = "queued" | "running" | "ok" | "warn" | "failed";

export type ScanOutcome = { tone: OutcomeTone; orb: OrbKind; title: string; sub: string };

const SEVERITY_RANK: Record<FindingSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const HIGH_RANK = SEVERITY_RANK.HIGH;

export function severityRank(severity: FindingSeverity): number {
  return SEVERITY_RANK[severity];
}

/** Most severe first; equal severities keep their order. Returns a new array. */
export function sortFindings<T extends Pick<Finding, "severity">>(findings: readonly T[]): T[] {
  return [...findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

/** Findings per severity, most severe first, only severities that occur. */
export function severityCounts(
  findings: readonly Pick<Finding, "severity">[],
): { severity: FindingSeverity; count: number }[] {
  const counts = new Map<FindingSeverity, number>();
  for (const finding of findings) {
    counts.set(finding.severity, (counts.get(finding.severity) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([severity, count]) => ({ severity, count }))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

type ScanLike = Pick<ScanDetail, "status" | "statusCode" | "responseTimeMs" | "findings">;

/** Headline of the hero: what happened, in words, with the colour tone and orb that go with it. */
export function scanOutcome(scan: ScanLike, host?: string): ScanOutcome {
  const target = host ?? "the target";
  if (scan.status === "QUEUED") {
    return {
      tone: "queued",
      orb: "queued",
      title: "Waiting for a worker",
      sub: "The scan is queued and will start shortly.",
    };
  }
  if (scan.status === "RUNNING") {
    return {
      tone: "running",
      orb: "running",
      title: "Checking the target…",
      sub: `A worker is sending the request to ${target}.`,
    };
  }
  if (scan.status === "FAILED") {
    return {
      tone: "bad",
      orb: "failed",
      title: "The check could not complete",
      sub: "No HTTP response was received from the target.",
    };
  }
  const measured =
    scan.statusCode != null && scan.responseTimeMs != null
      ? `HTTP ${scan.statusCode} in ${scan.responseTimeMs.toLocaleString("en-US")} ms`
      : null;
  if (scan.findings.length === 0) {
    return {
      tone: "ok",
      orb: "ok",
      title: "Target responded normally",
      sub: measured ? `${measured}, no findings.` : "The target answered, no findings.",
    };
  }
  const top = Math.max(...scan.findings.map((finding) => severityRank(finding.severity)));
  const count = scan.findings.length;
  return {
    tone: top >= HIGH_RANK ? "bad" : "warn",
    orb: "warn",
    title: `Target answered, with ${count} finding${count > 1 ? "s" : ""}`,
    sub: measured ? `${measured}. Review the findings below.` : "Review the findings below.",
  };
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/** Reason phrase under the HTTP status tile; falls back to the class of the code. */
export function httpStatusText(statusCode: number | null | undefined, status: string): string {
  if (statusCode == null) return status === "FAILED" ? "No response" : "Pending";
  if (STATUS_TEXT[statusCode]) return STATUS_TEXT[statusCode];
  if (statusCode >= 500) return "Server error";
  if (statusCode >= 400) return "Client error";
  if (statusCode >= 300) return "Redirect";
  return "Success";
}

export type CodeClass = "c2" | "c4" | "c5" | "cnone";

/** Colour class of the HTTP status tile (the prototype keys it on the first digit). */
export function codeClass(statusCode: number | null | undefined): CodeClass {
  if (statusCode == null) return "cnone";
  if (statusCode >= 500) return "c5";
  if (statusCode >= 400) return "c4";
  return "c2";
}

export function meterPercent(responseTimeMs: number): number {
  return Math.min(100, (responseTimeMs / METER_MAX_MS) * 100);
}

export const METER_TICK_PERCENT = (SLOW_MS / METER_MAX_MS) * 100;

/** "214 ms" below a second, "2.4 s" from a second up. Empty when a timestamp is missing. */
export function duration(from: string | null | undefined, to: string | null | undefined): string {
  if (!from || !to) return "";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms)) return "";
  const safe = Math.max(0, ms);
  return safe < 1000 ? `${safe} ms` : `${(safe / 1000).toFixed(1)} s`;
}

export type TimelineState = "done" | "active" | "pending" | "bad";
export type TimelineStep = {
  state: TimelineState;
  title: string;
  sub: string;
  /** ISO time shown at the right of the step, when known. */
  at: string | null;
};

type TimelineScan = Pick<ScanDetail, "status" | "createdAt" | "startedAt" | "finishedAt">;

/** Queued, Running and Finished steps with what is known about each. */
export function scanTimeline(scan: TimelineScan): TimelineStep[] {
  const waited = duration(scan.createdAt, scan.startedAt);
  const ran = duration(scan.startedAt, scan.finishedAt);
  const steps: TimelineStep[] = [
    {
      state: "done",
      title: "Queued",
      sub: waited ? `Waited ${waited} for a worker` : "Waiting for a worker",
      at: scan.createdAt,
    },
  ];
  if (scan.status === "QUEUED") {
    steps.push({
      state: "pending",
      title: "Running",
      sub: "Starts when a worker picks it up",
      at: null,
    });
  } else if (scan.status === "RUNNING") {
    steps.push({
      state: "active",
      title: "Running",
      sub: "Request in flight…",
      at: scan.startedAt ?? null,
    });
  } else {
    steps.push({
      state: "done",
      title: "Running",
      sub: "Worker validated the URL and sent the request",
      at: scan.startedAt ?? null,
    });
  }
  if (scan.status === "SUCCEEDED") {
    steps.push({
      state: "done",
      title: "Succeeded",
      sub: ran ? `Took ${ran} end to end` : "The target answered",
      at: scan.finishedAt ?? null,
    });
  } else if (scan.status === "FAILED") {
    steps.push({
      state: "bad",
      title: "Failed",
      sub: ran ? `Gave up after ${ran}. Not retried.` : "Not retried.",
      at: scan.finishedAt ?? null,
    });
  } else {
    steps.push({
      state: "pending",
      title: "Finished",
      sub: "Result and findings appear here",
      at: null,
    });
  }
  return steps;
}

/** Headline and explanation of a finding: prototype copy for known codes, the API's own text otherwise. */
export function findingCopy(
  finding: Pick<Finding, "code" | "title" | "description">,
  scan: Pick<ScanDetail, "statusCode" | "responseTimeMs">,
): { title: string; text: string } {
  const code = scan.statusCode ?? "—";
  const ms = scan.responseTimeMs != null ? scan.responseTimeMs.toLocaleString("en-US") : "—";
  switch (finding.code) {
    case "HTTP_CLIENT_ERROR":
      return {
        title: "Client error response",
        text: `The target returned HTTP ${code}. A 4xx response means the request was rejected or the page was not found.`,
      };
    case "HTTP_SERVER_ERROR":
      return {
        title: "Server error response",
        text: `The target returned HTTP ${code}. A 5xx response usually means the service is failing or unavailable.`,
      };
    case "SLOW_RESPONSE":
      return {
        title: "Slow response",
        text: `The target took ${ms} ms to respond. Responses of ${SLOW_MS.toLocaleString("en-US")} ms or more are flagged.`,
      };
    default:
      return { title: finding.title, text: finding.description };
  }
}
