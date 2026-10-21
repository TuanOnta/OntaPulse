import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { Scan } from "@/shared/types/domain";

import { ScanRow } from "./scan-row";

const scan = (overrides: Partial<Scan> = {}): Scan => ({
  id: "s1",
  monitorId: "m1",
  status: "SUCCEEDED",
  statusCode: 200,
  responseTimeMs: 120,
  createdAt: "2026-10-20T10:00:00Z",
  finishedAt: "2026-10-20T10:00:03Z",
  ...overrides,
});

function renderRow(value: Scan) {
  return render(
    <MemoryRouter>
      <div role="table">
        <ScanRow
          fresh={false}
          href="/scan/s1"
          now={Date.parse("2026-10-20T10:05:00Z")}
          scan={value}
        />
      </div>
    </MemoryRouter>,
  );
}

describe("ScanRow kind tag", () => {
  it("tags a DNS scan as DNS and says so in the link label", () => {
    renderRow(scan({ kind: "DNS_WATCH", statusCode: null, responseTimeMs: null }));

    expect(screen.getByText("DNS")).toBeVisible();
    expect(screen.getByRole("link", { name: /^Open dns scan from/ })).toHaveAttribute(
      "href",
      "/scan/s1",
    );
  });

  it("tags a security scan as Security", () => {
    renderRow(scan({ kind: "SECURITY_POSTURE" }));

    expect(screen.getByText("Security")).toBeVisible();
    expect(screen.getByRole("link", { name: /^Open security scan from/ })).toBeVisible();
  });

  it("leaves an HTTP probe untagged", () => {
    renderRow(scan({ kind: "HTTP_PROBE" }));

    expect(screen.queryByText("Security")).not.toBeInTheDocument();
    expect(screen.queryByText("DNS")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Open scan from/ })).toBeVisible();
  });
});
