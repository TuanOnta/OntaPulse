import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { Finding, ScanDetail as ScanDetailData } from "@/shared/types/domain";

import { ScanDetail } from "./scan-detail";

const base: ScanDetailData = {
  id: "scn-9",
  monitorId: "m1",
  kind: "SECURITY_POSTURE",
  status: "SUCCEEDED",
  statusCode: 200,
  responseTimeMs: 120,
  createdAt: "2026-10-20T10:00:00Z",
  startedAt: "2026-10-20T10:00:01Z",
  finishedAt: "2026-10-20T10:00:03Z",
  findings: [],
  subChecks: [
    { name: "headers", state: "ran", reason: null },
    { name: "cookies", state: "ran", reason: null },
    { name: "tls", state: "ran", reason: null },
    { name: "redirect", state: "skipped", reason: "connection_failed" },
  ],
};

const finding = (overrides: Partial<Finding>): Finding => ({
  id: "f1",
  scanId: "scn-9",
  code: "SEC_TLS_CERT_EXPIRES_SOON_14",
  checkId: "SEC_TLS_CERT_EXPIRES_SOON_14",
  category: "TLS",
  confidence: null,
  title: "TLS certificate expires within 14 days",
  severity: "HIGH",
  description: "The server certificate expires within 14 days.",
  recommendation: "Renew the certificate now.",
  evidence: { daysRemaining: 9 },
  createdAt: "2026-10-20T10:00:03Z",
  ...overrides,
});

function renderScan(scan: ScanDetailData) {
  return render(
    <MemoryRouter>
      <ScanDetail context={null} scan={scan} />
    </MemoryRouter>,
  );
}

describe("ScanDetail for a security scan", () => {
  it("shows the security hero, check counts, HTTPS status and the request description", () => {
    renderScan(base);

    expect(screen.getByRole("heading", { name: "Security check complete" })).toBeVisible();
    expect(screen.getByText("Checks run")).toBeVisible();
    expect(screen.getByText("3/4")).toBeVisible();
    expect(screen.getByText("1 skipped, see below")).toBeVisible();
    expect(screen.getByText("HTTPS status")).toBeVisible();
    expect(screen.getByText("OK")).toBeVisible();
    expect(screen.queryByText("Response time")).not.toBeInTheDocument();
    expect(
      screen.getByText("2 GET requests and 1 TLS handshake, redirects are not followed"),
    ).toBeVisible();
  });

  it("lists the findings with what was observed and the checks that ran or were skipped", () => {
    renderScan({ ...base, findings: [finding({})] });

    expect(
      screen.getByRole("heading", { name: "Security check complete, with 1 finding" }),
    ).toBeVisible();
    const card = screen
      .getByRole("heading", { name: "TLS certificate expires within 14 days" })
      .closest("li") as HTMLElement;
    expect(within(card).getByText("HIGH")).toBeVisible();
    expect(within(card).getByText("The server certificate expires within 14 days.")).toBeVisible();
    expect(within(card).getByText("Renew the certificate now.")).toBeVisible();
    expect(within(card).getByText("SEC_TLS_CERT_EXPIRES_SOON_14")).toBeVisible();

    const checks = screen.getByRole("list", { name: "Checks in this scan" });
    expect(within(checks).getByText("TLS and certificate")).toBeVisible();
    expect(within(checks).getByText("Skipped: connection failed")).toBeVisible();
  });

  it("says so when nothing was flagged", () => {
    renderScan(base);

    expect(screen.getByRole("heading", { name: "No findings" })).toBeVisible();
    expect(
      screen.getByText(
        "Nothing was flagged in the checks that ran. Checks that were skipped are listed below.",
      ),
    ).toBeVisible();
  });

  it("does not claim an HTTP result when the security check failed", () => {
    renderScan({
      ...base,
      status: "FAILED",
      statusCode: null,
      responseTimeMs: null,
      errorMessage: "Scan target is unavailable",
      subChecks: null,
      findings: [],
    });

    expect(
      screen.getByRole("heading", { name: "The security check could not complete" }),
    ).toBeVisible();
    expect(screen.getByText("No check could run")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Scan target is unavailable" })).toBeVisible();
  });
});

describe("ScanDetail for a probe that failed on the certificate", () => {
  const probe: ScanDetailData = {
    id: "scn-1",
    monitorId: "m1",
    kind: "HTTP_PROBE",
    status: "FAILED",
    statusCode: null,
    responseTimeMs: null,
    errorMessage: "Certificate does not match the host name",
    createdAt: "2026-10-20T10:00:00Z",
    startedAt: "2026-10-20T10:00:01Z",
    finishedAt: "2026-10-20T10:00:01Z",
    findings: [],
  };

  it("explains the certificate failure and points to the security scan", () => {
    renderScan(probe);

    expect(
      screen.getByRole("heading", { name: "Certificate does not match the host name" }),
    ).toBeVisible();
    expect(screen.getByText(/certificate could not be verified/)).toBeVisible();
    expect(screen.getByText(/run a security scan to see the certificate findings/)).toBeVisible();
    expect(screen.queryByText(/reachable from the public internet/)).not.toBeInTheDocument();
  });

  it("keeps the generic explanation for other failures", () => {
    renderScan({ ...probe, errorMessage: "Scan target is unavailable" });

    expect(screen.getByText(/reachable from the public internet/)).toBeVisible();
  });
});

describe("ScanDetail lifecycle times", () => {
  it("marks each time as the moment the step happened, not as a duration", () => {
    renderScan(base);

    const lifecycle = screen.getByRole("region", { name: "Lifecycle" });
    const times = lifecycle.querySelectorAll("time");

    expect(times).toHaveLength(3);
    for (const time of times) {
      expect(time.textContent).toMatch(/^at \d{2}[.:]\d{2}[.:]\d{2}$/);
      expect(time.getAttribute("title")).toBeTruthy();
    }
    expect(times[0]?.getAttribute("datetime")).toBe("2026-10-20T10:00:00Z");
    expect(within(lifecycle).getByText("Waited 1.0 s for a worker")).toBeVisible();
  });
});
