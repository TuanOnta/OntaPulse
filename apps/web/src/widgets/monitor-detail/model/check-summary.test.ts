import { describe, expect, it } from "vitest";

import type { Finding, ScanDetail } from "@/shared/types/domain";

import { overallLine, summarizeCheck, type CheckSummary } from "./check-summary";

const finding = (severity: Finding["severity"]) =>
  ({ id: severity, scanId: "s", code: "X", title: "T", severity, description: "D" }) as Finding;

const scan = (overrides: Partial<ScanDetail> = {}): ScanDetail =>
  ({
    id: "s",
    monitorId: "m",
    status: "SUCCEEDED",
    createdAt: "2026-10-20T10:00:00Z",
    finishedAt: "2026-10-20T10:00:03Z",
    findings: [],
    ...overrides,
  }) as ScanDetail;

describe("summarizeCheck", () => {
  it("waits while the settings or the result load", () => {
    expect(summarizeCheck("loading", true, { status: "empty" })).toEqual({ state: "loading" });
    expect(summarizeCheck("ready", true, { status: "loading" })).toEqual({ state: "loading" });
  });

  it("reports a failed load of either", () => {
    expect(summarizeCheck("error", true, { status: "empty" })).toEqual({ state: "error" });
    expect(summarizeCheck("ready", true, { status: "error" })).toEqual({ state: "error" });
  });

  it("says off even when an older result exists", () => {
    expect(summarizeCheck("ready", false, { status: "ready", scan: scan() })).toEqual({
      state: "off",
    });
  });

  it("says empty when it is on and nothing ran", () => {
    expect(summarizeCheck("ready", true, { status: "empty" })).toEqual({ state: "empty" });
  });

  it("marks a failed scan with the time it was checked", () => {
    expect(
      summarizeCheck("ready", true, { status: "ready", scan: scan({ status: "FAILED" }) }),
    ).toEqual({ state: "failed", checkedAt: "2026-10-20T10:00:03Z" });
  });

  it("counts findings by severity, and uses the creation time of an unfinished scan", () => {
    const result = summarizeCheck("ready", true, {
      status: "ready",
      scan: scan({ finishedAt: null, findings: [finding("HIGH"), finding("LOW"), finding("LOW")] }),
    });
    expect(result).toEqual({
      state: "ready",
      checkedAt: "2026-10-20T10:00:00Z",
      findings: 3,
      counts: [
        { severity: "HIGH", count: 1 },
        { severity: "LOW", count: 2 },
      ],
    });
  });
});

describe("overallLine", () => {
  const ready = (findings: number): CheckSummary => ({
    state: "ready",
    checkedAt: "x",
    findings,
    counts: [],
  });

  it("stays empty while something loads or nothing has a result", () => {
    expect(overallLine([{ state: "loading" }, ready(2)])).toBeNull();
    expect(overallLine([{ state: "off" }, { state: "empty" }])).toBeNull();
  });

  it("adds up the findings of the results that exist, in observed wording", () => {
    expect(overallLine([ready(0), { state: "off" }])).toBe("No findings observed");
    expect(overallLine([ready(1), { state: "failed", checkedAt: "x" }])).toBe("1 finding observed");
    expect(overallLine([ready(2), ready(3)])).toBe("5 findings observed");
  });
});
