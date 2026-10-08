import { describe, expect, it } from "vitest";

import {
  barHeightPercent,
  chartGrid,
  chartMax,
  chartScans,
  countByFilter,
  filterScans,
  formatMs,
  httpTone,
  isBusyScan,
  isSlow,
  relativeTime,
  statusChip,
} from "./scan-history";

const scan = (status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED", id: string = status) => ({
  id,
  status,
});

describe("scan history helpers", () => {
  it("counts and filters by status", () => {
    const scans = [scan("RUNNING"), scan("SUCCEEDED", "a"), scan("SUCCEEDED", "b"), scan("FAILED")];
    expect(countByFilter(scans)).toEqual({ ALL: 4, SUCCEEDED: 2, FAILED: 1 });
    expect(filterScans(scans, "SUCCEEDED").map((item) => item.id)).toEqual(["a", "b"]);
    expect(filterScans(scans, "ALL")).toHaveLength(4);
    expect(filterScans(scans, "FAILED")).toHaveLength(1);
  });

  it("knows busy and slow", () => {
    expect(isBusyScan(scan("QUEUED"))).toBe(true);
    expect(isBusyScan(scan("RUNNING"))).toBe(true);
    expect(isBusyScan(scan("FAILED"))).toBe(false);
    expect(isSlow(1999)).toBe(false);
    expect(isSlow(2000)).toBe(true);
    expect(isSlow(null)).toBe(false);
  });

  it("labels the statuses and colours the HTTP codes", () => {
    expect(statusChip("QUEUED")).toEqual({ tone: "queued", label: "Queued" });
    expect(statusChip("SUCCEEDED").label).toBe("Succeeded");
    expect(httpTone(200)).toBe("ok");
    expect(httpTone(301)).toBe("ok");
    expect(httpTone(404)).toBe("client-error");
    expect(httpTone(503)).toBe("server-error");
    expect(formatMs(2410)).toBe("2,410 ms");
    expect(formatMs(214)).toBe("214 ms");
  });

  it("takes the latest finished scans, oldest first, and skips busy ones", () => {
    const newestFirst = [
      scan("RUNNING", "r"),
      ...Array.from({ length: 15 }, (_, i) => scan("SUCCEEDED", `s${i}`)),
    ];
    const bars = chartScans(newestFirst);
    expect(bars).toHaveLength(12);
    expect(bars[0].id).toBe("s11");
    expect(bars.at(-1)?.id).toBe("s0");
    expect(chartScans([scan("QUEUED")])).toEqual([]);
  });

  it("scales the chart so the 2 s line is always visible", () => {
    expect(chartMax([])).toBe(2500);
    expect(chartMax([214, 188])).toBe(2500);
    expect(chartMax([2410])).toBeCloseTo(2410 * 1.08);
    expect(barHeightPercent(1250, 2500)).toBe(50);
    const grid = chartGrid(2500);
    expect(grid.map((line) => line.label)).toEqual(["0", "1 s", "2 s"]);
    expect(grid[0].top).toBe(100);
    expect(grid[2]).toMatchObject({ slow: true, top: 20 });
  });

  it("formats relative times", () => {
    const now = Date.parse("2026-10-08T12:00:00Z");
    const ago = (ms: number) => new Date(now - ms).toISOString();
    expect(relativeTime(ago(10_000), now)).toBe("just now");
    expect(relativeTime(ago(4 * 60_000), now)).toBe("4 min ago");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3 h ago");
    expect(relativeTime(ago(2 * 86_400_000), now)).toBe("2 d ago");
    expect(relativeTime(new Date(now + 5000).toISOString(), now)).toBe("just now");
  });
});
