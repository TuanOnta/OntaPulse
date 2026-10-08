import { describe, expect, it } from "vitest";

import type { Finding } from "@/shared/types/domain";

import {
  METER_TICK_PERCENT,
  codeClass,
  duration,
  findingCopy,
  httpStatusText,
  meterPercent,
  scanOutcome,
  scanTimeline,
  severityCounts,
  sortFindings,
} from "./scan-view";

const finding = (severity: Finding["severity"], code = "SLOW_RESPONSE") =>
  ({ id: code + severity, scanId: "s", code, title: "T", severity, description: "D" }) as Finding;

describe("scanOutcome", () => {
  it("describes queued, running and failed scans", () => {
    const base = { statusCode: null, responseTimeMs: null, findings: [] };
    expect(scanOutcome({ ...base, status: "QUEUED" }).title).toBe("Waiting for a worker");
    expect(scanOutcome({ ...base, status: "RUNNING" }, "api.example.com").sub).toBe(
      "A worker is sending the request to api.example.com.",
    );
    expect(scanOutcome({ ...base, status: "RUNNING" }).sub).toContain("the target");
    expect(scanOutcome({ ...base, status: "FAILED" })).toMatchObject({
      tone: "bad",
      orb: "failed",
    });
  });

  it("describes a clean result and results with findings", () => {
    const ok = scanOutcome({
      status: "SUCCEEDED",
      statusCode: 200,
      responseTimeMs: 214,
      findings: [],
    });
    expect(ok).toMatchObject({ tone: "ok", title: "Target responded normally" });
    expect(ok.sub).toBe("HTTP 200 in 214 ms, no findings.");

    const medium = scanOutcome({
      status: "SUCCEEDED",
      statusCode: 200,
      responseTimeMs: 2410,
      findings: [finding("MEDIUM")],
    });
    expect(medium).toMatchObject({ tone: "warn", title: "Target answered, with 1 finding" });
    expect(medium.sub).toBe("HTTP 200 in 2,410 ms. Review the findings below.");

    const high = scanOutcome({
      status: "SUCCEEDED",
      statusCode: 503,
      responseTimeMs: 2410,
      findings: [finding("HIGH", "HTTP_SERVER_ERROR"), finding("MEDIUM")],
    });
    expect(high).toMatchObject({ tone: "bad", title: "Target answered, with 2 findings" });
  });

  it("copes with a missing status or response time", () => {
    const sub = scanOutcome({
      status: "SUCCEEDED",
      statusCode: null,
      responseTimeMs: null,
      findings: [],
    }).sub;
    expect(sub).toBe("The target answered, no findings.");
  });
});

describe("findings", () => {
  it("sorts most severe first and counts per severity", () => {
    const list = [
      finding("LOW", "a"),
      finding("CRITICAL", "b"),
      finding("MEDIUM", "c"),
      finding("MEDIUM", "d"),
    ];
    expect(sortFindings(list).map((item) => item.severity)).toEqual([
      "CRITICAL",
      "MEDIUM",
      "MEDIUM",
      "LOW",
    ]);
    expect(severityCounts(list)).toEqual([
      { severity: "CRITICAL", count: 1 },
      { severity: "MEDIUM", count: 2 },
      { severity: "LOW", count: 1 },
    ]);
    expect(severityCounts([])).toEqual([]);
  });

  it("uses the prototype copy for known codes and the API text for unknown ones", () => {
    const scan = { statusCode: 503, responseTimeMs: 2410 };
    expect(findingCopy(finding("HIGH", "HTTP_SERVER_ERROR"), scan)).toMatchObject({
      title: "Server error response",
    });
    expect(findingCopy(finding("MEDIUM", "HTTP_CLIENT_ERROR"), scan).text).toContain("HTTP 503");
    expect(findingCopy(finding("MEDIUM"), scan).text).toContain("2,410 ms");
    expect(
      findingCopy({ code: "NEW_RULE", title: "Brand new", description: "Explained." }, scan),
    ).toEqual({ title: "Brand new", text: "Explained." });
  });
});

describe("tiles", () => {
  it("names status codes and picks a colour class", () => {
    expect(httpStatusText(200, "SUCCEEDED")).toBe("OK");
    expect(httpStatusText(503, "SUCCEEDED")).toBe("Service Unavailable");
    expect(httpStatusText(418, "SUCCEEDED")).toBe("Client error");
    expect(httpStatusText(507, "SUCCEEDED")).toBe("Server error");
    expect(httpStatusText(307, "SUCCEEDED")).toBe("Redirect");
    expect(httpStatusText(null, "FAILED")).toBe("No response");
    expect(httpStatusText(null, "RUNNING")).toBe("Pending");
    expect(codeClass(200)).toBe("c2");
    expect(codeClass(404)).toBe("c4");
    expect(codeClass(503)).toBe("c5");
    expect(codeClass(null)).toBe("cnone");
  });

  it("scales the meter to 3 s with the tick at 2 s", () => {
    expect(meterPercent(1500)).toBe(50);
    expect(meterPercent(9000)).toBe(100);
    expect(METER_TICK_PERCENT).toBeCloseTo(66.67, 1);
  });
});

describe("duration and timeline", () => {
  it("formats durations and tolerates missing times", () => {
    expect(duration("2026-10-08T12:00:00Z", "2026-10-08T12:00:00.214Z")).toBe("214 ms");
    expect(duration("2026-10-08T12:00:00Z", "2026-10-08T12:00:02.4Z")).toBe("2.4 s");
    expect(duration(null, "2026-10-08T12:00:00Z")).toBe("");
    expect(duration("2026-10-08T12:00:05Z", "2026-10-08T12:00:00Z")).toBe("0 ms");
  });

  const t = (s: number) => new Date(Date.UTC(2026, 9, 8, 12, 0, s)).toISOString();

  it("builds the timeline of a queued, running, succeeded and failed scan", () => {
    const queued = scanTimeline({
      status: "QUEUED",
      createdAt: t(0),
      startedAt: null,
      finishedAt: null,
    });
    expect(queued.map((step) => step.state)).toEqual(["done", "pending", "pending"]);

    const running = scanTimeline({
      status: "RUNNING",
      createdAt: t(0),
      startedAt: t(2),
      finishedAt: null,
    });
    expect(running.map((step) => step.state)).toEqual(["done", "active", "pending"]);
    expect(running[0].sub).toBe("Waited 2.0 s for a worker");

    const done = scanTimeline({
      status: "SUCCEEDED",
      createdAt: t(0),
      startedAt: t(2),
      finishedAt: t(4),
    });
    expect(done.map((step) => step.state)).toEqual(["done", "done", "done"]);
    expect(done[2]).toMatchObject({ title: "Succeeded", sub: "Took 2.0 s end to end" });

    const failed = scanTimeline({
      status: "FAILED",
      createdAt: t(0),
      startedAt: t(2),
      finishedAt: t(12),
    });
    expect(failed[2]).toMatchObject({ state: "bad", sub: "Gave up after 10.0 s. Not retried." });
  });

  it("collapses to status only when timestamps are missing", () => {
    const steps = scanTimeline({
      status: "SUCCEEDED",
      createdAt: t(0),
      startedAt: null,
      finishedAt: null,
    });
    expect(steps[0].sub).toBe("Waiting for a worker");
    expect(steps[1].at).toBeNull();
    expect(steps[2].sub).toBe("The target answered");
  });
});
