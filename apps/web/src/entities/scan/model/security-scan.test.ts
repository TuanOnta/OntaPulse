import { describe, expect, it } from "vitest";

import type { Finding, ScanDetail } from "@/shared/types/domain";

import { chartScans } from "./scan-history";
import { scanOutcome } from "./scan-view";
import {
  formatWait,
  isSecurityScan,
  subCheckCounts,
  subCheckLabel,
  subCheckStateText,
} from "./security-scan";

const finding = (severity: Finding["severity"]): Finding => ({
  id: severity,
  scanId: "s1",
  code: "SEC_TLS_CERT_EXPIRED",
  title: "t",
  severity,
  description: "d",
  createdAt: "2026-10-20T00:00:00Z",
});

const posture = (extra: Partial<ScanDetail> = {}): ScanDetail => ({
  id: "s1",
  monitorId: "m1",
  kind: "SECURITY_POSTURE",
  status: "SUCCEEDED",
  createdAt: "2026-10-20T00:00:00Z",
  findings: [],
  subChecks: [
    { name: "headers", state: "ran", reason: null },
    { name: "tls", state: "ran", reason: null },
    { name: "redirect", state: "skipped", reason: "connection_failed" },
  ],
  ...extra,
});

describe("security scan helpers", () => {
  it("tells security scans from probes, and treats a missing kind as a probe", () => {
    expect(isSecurityScan({ kind: "SECURITY_POSTURE" })).toBe(true);
    expect(isSecurityScan({ kind: "HTTP_PROBE" })).toBe(false);
    expect(isSecurityScan({})).toBe(false);
  });

  it("labels checks and falls back to the raw name", () => {
    expect(subCheckLabel("tls")).toBe("TLS and certificate");
    expect(subCheckLabel("edge")).toBe("Edge detection");
    expect(subCheckLabel("cors")).toBe("CORS");
    expect(subCheckLabel("dns_records")).toBe("dns_records");
  });

  it.each([
    [{ state: "ran", reason: null }, "Ran"],
    [{ state: "skipped", reason: "connection_failed" }, "Skipped: connection failed"],
    [{ state: "skipped", reason: "challenge_response" }, "Skipped: challenge response"],
    [{ state: "skipped", reason: "some_new_reason" }, "Skipped: some new reason"],
    [{ state: "skipped", reason: null }, "Skipped"],
  ] as const)("words the state of %j", (subCheck, text) => {
    expect(subCheckStateText(subCheck)).toBe(text);
  });

  it("counts checks that ran and were skipped, and copes with none", () => {
    expect(subCheckCounts(posture().subChecks)).toEqual({ ran: 2, skipped: 1, total: 3 });
    expect(subCheckCounts(null)).toEqual({ ran: 0, skipped: 0, total: 0 });
    expect(subCheckCounts(undefined)).toEqual({ ran: 0, skipped: 0, total: 0 });
  });

  it.each([
    [1, "1 s"],
    [45, "45 s"],
    [59.2, "1 min"],
    [60, "1 min"],
    [61, "2 min"],
    [3599, "1 h"],
    [3600, "1 h"],
    [3900, "1 h 5 min"],
    [0, "1 s"],
  ])("formats a wait of %d seconds as %s", (seconds, text) => {
    expect(formatWait(seconds)).toBe(text);
  });
});

describe("scanOutcome for a security scan", () => {
  it("describes a queued and a running scan", () => {
    expect(scanOutcome(posture({ status: "QUEUED" })).title).toBe("Waiting for a worker");
    expect(scanOutcome(posture({ status: "RUNNING" }), "example.com")).toMatchObject({
      title: "Running security checks…",
      sub: "A worker is inspecting example.com.",
    });
  });

  it("does not claim an HTTP result", () => {
    expect(scanOutcome(posture({ status: "FAILED" }))).toMatchObject({
      tone: "bad",
      title: "The security check could not complete",
    });
  });

  it("is green when nothing was flagged", () => {
    expect(scanOutcome(posture())).toMatchObject({
      tone: "ok",
      title: "Security check complete",
      sub: "2 checks ran, nothing was flagged.",
    });
  });

  it("is amber for low findings and red from high up, with the count", () => {
    expect(scanOutcome(posture({ findings: [finding("LOW"), finding("MEDIUM")] }))).toMatchObject({
      tone: "warn",
      title: "Security check complete, with 2 findings",
    });
    expect(scanOutcome(posture({ findings: [finding("CRITICAL")] }))).toMatchObject({
      tone: "bad",
      title: "Security check complete, with 1 finding",
    });
  });

  it("leaves the probe wording unchanged", () => {
    expect(
      scanOutcome({ status: "SUCCEEDED", statusCode: 200, responseTimeMs: 12, findings: [] }).title,
    ).toBe("Target responded normally");
  });
});

describe("chartScans", () => {
  it("leaves security scans out of the response-time chart", () => {
    const scans = [
      { id: "a", status: "SUCCEEDED", kind: "SECURITY_POSTURE" },
      { id: "b", status: "SUCCEEDED", kind: "HTTP_PROBE" },
      { id: "c", status: "SUCCEEDED" },
      { id: "d", status: "QUEUED", kind: "HTTP_PROBE" },
    ] as const;

    expect(chartScans(scans).map((scan) => scan.id)).toEqual(["c", "b"]);
  });
});
