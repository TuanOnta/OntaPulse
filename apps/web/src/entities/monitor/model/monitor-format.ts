import type { Monitor } from "@/shared/types/domain";

export const INTERVAL_MIN_SECONDS = 60;
export const INTERVAL_MAX_SECONDS = 86_400;
export const INTERVAL_DEFAULT_SECONDS = 300;
export const MONITOR_NAME_MAX = 120;

/** Quick-pick intervals of the "Add monitor" dialog, as `[seconds, label]`. */
export const INTERVAL_PRESETS: readonly (readonly [number, string])[] = [
  [60, "1 min"],
  [300, "5 min"],
  [900, "15 min"],
  [3600, "1 hour"],
  [86_400, "24 hours"],
];

const DAY = 86_400;
const HOUR = 3600;
const MINUTE = 60;

/** "every 5 min", "every hour", "every 2 days", "every 90 s". */
export function humanInterval(seconds: number): string {
  if (seconds % DAY === 0) return seconds === DAY ? "every day" : `every ${seconds / DAY} days`;
  if (seconds % HOUR === 0)
    return seconds === HOUR ? "every hour" : `every ${seconds / HOUR} hours`;
  if (seconds % MINUTE === 0) return `every ${seconds / MINUTE} min`;
  return `every ${seconds} s`;
}

export type UrlParts = { protocol: string; host: string; path: string };

/** Splits a target URL for display. Falls back to the raw text when it does not parse. */
export function splitUrl(value: string): UrlParts {
  try {
    const url = new URL(value);
    return {
      protocol: url.protocol.replace(":", ""),
      host: url.host,
      path: (url.pathname === "/" ? "" : url.pathname) + url.search,
    };
  } catch {
    return { protocol: "", host: value, path: "" };
  }
}

/** The API needs a monitor name; the prototype has no name field, so the host is used. */
export function deriveMonitorName(targetUrl: string): string {
  return splitUrl(targetUrl).host.slice(0, MONITOR_NAME_MAX);
}

export type MonitorFieldErrors = { url?: string; interval?: string };

/** Client-side checks of the dialog. The API stays authoritative (private targets, duplicates). */
export function validateMonitor(
  rawUrl: string,
  intervalSeconds: number,
  existingUrls: readonly string[],
): MonitorFieldErrors {
  const errors: MonitorFieldErrors = {};
  let parsed: URL | null = null;
  try {
    parsed = new URL(rawUrl);
  } catch {
    parsed = null;
  }
  if (!rawUrl) errors.url = "Enter a URL.";
  else if (!parsed) errors.url = "Enter a full URL, for example https://example.com.";
  else if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    errors.url = "Only http and https URLs are supported.";
  } else if (existingUrls.includes(rawUrl)) {
    errors.url = "This URL is already monitored in this project.";
  }
  if (
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < INTERVAL_MIN_SECONDS ||
    intervalSeconds > INTERVAL_MAX_SECONDS
  ) {
    errors.interval = "Use a whole number from 60 to 86,400 seconds.";
  }
  return errors;
}

/** Case-insensitive search over the target URL. An empty query returns everything. */
export function filterMonitors<T extends Pick<Monitor, "targetUrl">>(
  monitors: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  return needle
    ? monitors.filter((monitor) => monitor.targetUrl.toLowerCase().includes(needle))
    : [...monitors];
}
