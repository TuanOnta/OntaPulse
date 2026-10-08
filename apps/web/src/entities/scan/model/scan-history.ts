import type { Scan, ScanStatus } from "@/shared/types/domain";

import type { ScanChipTone } from "./scan-run";

/** Same threshold as the SLOW_RESPONSE finding rule. */
export const SLOW_MS = 2000;
/** The API returns every scan of a monitor; the screen lists only the newest ones. */
export const HISTORY_LIMIT = 50;
/** Bars of the response-time chart (the latest finished scans). */
export const CHART_BARS = 12;
const CHART_HEADROOM = 1.25;
const CHART_PADDING = 1.08;
const CHART_GRID_MS = [0, 1000, 2000] as const;

export type HistoryFilter = "ALL" | "SUCCEEDED" | "FAILED";

export const HISTORY_FILTERS: readonly { id: HistoryFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "SUCCEEDED", label: "Succeeded" },
  { id: "FAILED", label: "Failed" },
];

export function isBusyScan(scan: Pick<Scan, "status">): boolean {
  return scan.status === "QUEUED" || scan.status === "RUNNING";
}

export function isFinishedScan(scan: Pick<Scan, "status">): boolean {
  return scan.status === "SUCCEEDED" || scan.status === "FAILED";
}

export function isSlow(responseTimeMs: number | null | undefined): boolean {
  return responseTimeMs != null && responseTimeMs >= SLOW_MS;
}

export function countByFilter(
  scans: readonly Pick<Scan, "status">[],
): Record<HistoryFilter, number> {
  return {
    ALL: scans.length,
    SUCCEEDED: scans.filter((scan) => scan.status === "SUCCEEDED").length,
    FAILED: scans.filter((scan) => scan.status === "FAILED").length,
  };
}

export function filterScans<T extends Pick<Scan, "status">>(
  scans: readonly T[],
  filter: HistoryFilter,
): T[] {
  return filter === "ALL" ? [...scans] : scans.filter((scan) => scan.status === filter);
}

const STATUS_CHIP: Record<ScanStatus, { tone: ScanChipTone; label: string }> = {
  QUEUED: { tone: "queued", label: "Queued" },
  RUNNING: { tone: "running", label: "Running" },
  SUCCEEDED: { tone: "succeeded", label: "Succeeded" },
  FAILED: { tone: "failed", label: "Failed" },
};

export function statusChip(status: ScanStatus) {
  return STATUS_CHIP[status];
}

export type HttpTone = "ok" | "client-error" | "server-error";

/** 4xx is amber, 5xx is red; both are still SUCCEEDED scans with findings. */
export function httpTone(statusCode: number): HttpTone {
  if (statusCode >= 500) return "server-error";
  if (statusCode >= 400) return "client-error";
  return "ok";
}

/** "214 ms", "2,410 ms". */
export function formatMs(responseTimeMs: number): string {
  return `${responseTimeMs.toLocaleString("en-US")} ms`;
}

/** The finished scans of a newest-first list, oldest to newest, at most `limit`. */
export function chartScans<T extends Pick<Scan, "status">>(
  scans: readonly T[],
  limit: number = CHART_BARS,
): T[] {
  return scans.filter(isFinishedScan).slice(0, limit).reverse();
}

/** Top of the chart scale: always shows the 2 s line, and grows for slower responses. */
export function chartMax(responseTimes: readonly number[]): number {
  return Math.max(SLOW_MS * CHART_HEADROOM, Math.max(0, ...responseTimes) * CHART_PADDING);
}

export function barHeightPercent(responseTimeMs: number, max: number): number {
  return (responseTimeMs / max) * 100;
}

/** Grid lines of the chart with their offset from the top, in percent. */
export function chartGrid(
  max: number,
): { ms: number; label: string; top: number; slow: boolean }[] {
  return CHART_GRID_MS.map((ms) => ({
    ms,
    label: ms === 0 ? "0" : `${ms / 1000} s`,
    top: 100 - (ms / max) * 100,
    slow: ms === SLOW_MS,
  }));
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
export function relativeTime(value: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
