import { describe, expect, it } from "vitest";

import {
  deriveMonitorName,
  filterMonitors,
  humanInterval,
  splitUrl,
  validateMonitor,
} from "./monitor-format";

describe("humanInterval", () => {
  it("picks the largest whole unit", () => {
    expect(humanInterval(60)).toBe("every 1 min");
    expect(humanInterval(300)).toBe("every 5 min");
    expect(humanInterval(3600)).toBe("every hour");
    expect(humanInterval(7200)).toBe("every 2 hours");
    expect(humanInterval(86_400)).toBe("every day");
    expect(humanInterval(172_800)).toBe("every 2 days");
    expect(humanInterval(90)).toBe("every 90 s");
  });
});

describe("splitUrl and deriveMonitorName", () => {
  it("splits protocol, host and path with query", () => {
    expect(splitUrl("https://api.example.com/v1/search?q=ping")).toEqual({
      protocol: "https",
      host: "api.example.com",
      path: "/v1/search?q=ping",
    });
    expect(splitUrl("http://legacy.example.com/").path).toBe("");
  });

  it("falls back to the raw text and derives a name from the host", () => {
    expect(splitUrl("not a url")).toEqual({ protocol: "", host: "not a url", path: "" });
    expect(deriveMonitorName("https://api.example.com:8443/health")).toBe("api.example.com:8443");
    expect(deriveMonitorName("x".repeat(200)).length).toBe(120);
  });
});

describe("validateMonitor", () => {
  it("accepts a valid URL and interval", () => {
    expect(validateMonitor("https://example.com", 300, [])).toEqual({});
  });

  it("explains each URL problem", () => {
    expect(validateMonitor("", 300, []).url).toBe("Enter a URL.");
    expect(validateMonitor("example.com", 300, []).url).toMatch(/full URL/);
    expect(validateMonitor("ftp://example.com", 300, []).url).toBe(
      "Only http and https URLs are supported.",
    );
    expect(validateMonitor("https://a.io", 300, ["https://a.io"]).url).toBe(
      "This URL is already monitored in this project.",
    );
  });

  it("limits the interval to whole numbers from 60 to 86,400", () => {
    for (const bad of [59, 86_401, 90.5, Number.NaN]) {
      expect(validateMonitor("https://a.io", bad, []).interval).toBeDefined();
    }
    expect(validateMonitor("https://a.io", 60, []).interval).toBeUndefined();
    expect(validateMonitor("https://a.io", 86_400, []).interval).toBeUndefined();
  });
});

describe("filterMonitors", () => {
  const list = [{ targetUrl: "https://API.example.com/health" }, { targetUrl: "http://b.io" }];
  it("matches case-insensitively and returns all for an empty query", () => {
    expect(filterMonitors(list, " api ")).toHaveLength(1);
    expect(filterMonitors(list, "")).toHaveLength(2);
    expect(filterMonitors(list, "zzz")).toHaveLength(0);
  });
});
