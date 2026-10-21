import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";
import type {
  CheckSettings,
  DnsBaseline,
  Finding,
  Monitor,
  Project,
  ScanDetail,
  Workspace,
  WorkspaceRole,
} from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({
  checkSettings: vi.fn(),
  updateCheckSettings: vi.fn(),
  latestDnsScan: vi.fn(),
  dnsBaseline: vi.fn(),
  triggerDnsScan: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/shared/api/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/shared/api/client")>();
  return {
    ...original,
    api: {
      ...original.api,
      checkSettings: mocks.checkSettings,
      updateCheckSettings: mocks.updateCheckSettings,
      latestDnsScan: mocks.latestDnsScan,
      dnsBaseline: mocks.dnsBaseline,
      triggerDnsScan: mocks.triggerDnsScan,
    },
  };
});
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { DnsWatch } from "./dns-watch";

const workspace = (role: WorkspaceRole): Workspace => ({
  id: "w1",
  name: "OntaPulse",
  role,
  createdAt: "2026-03-04T08:12:00Z",
  updatedAt: "2026-03-04T08:12:00Z",
});
const project: Project = {
  id: "p1",
  workspaceId: "w1",
  name: "Core API",
  description: null,
  createdAt: "2026-03-18T14:20:00Z",
  updatedAt: "2026-03-18T14:20:00Z",
};
const monitor: Monitor = {
  id: "m1",
  projectId: "p1",
  name: "www.example.com",
  targetUrl: "https://www.example.com/",
  intervalSeconds: 300,
  isActive: true,
  createdAt: "2026-03-18T14:40:00Z",
  updatedAt: "2026-03-18T14:40:00Z",
};

const settings = (dnsWatchEnabled: boolean): CheckSettings => ({
  monitorId: "m1",
  securityPostureEnabled: false,
  dnsWatchEnabled,
  pathProbesEnabled: false,
  pathProbesAcknowledgedAt: null,
});
const noScan = () =>
  new ApiError({ statusCode: 404, code: "NO_DNS_SCAN", message: "No DNS watch scan found" });
const noBaseline = () =>
  new ApiError({ statusCode: 404, code: "NO_DNS_BASELINE", message: "No DNS baseline found" });

const finding = (overrides: Partial<Finding> = {}): Finding => ({
  id: "f1",
  scanId: "scn-4",
  code: "EMAIL_DMARC_MISSING",
  checkId: "EMAIL_DMARC_MISSING",
  category: "EMAIL_AUTH",
  confidence: null,
  title: "DMARC record not observed",
  severity: "MEDIUM",
  description: "No valid DMARC record was found by the tree walk.",
  recommendation: "Publish a DMARC record.",
  evidence: { domain: "example.com" },
  createdAt: "2026-10-20T10:00:00Z",
  ...overrides,
});

const scan = (overrides: Partial<ScanDetail> = {}): ScanDetail => ({
  id: "scn-4",
  monitorId: "m1",
  kind: "DNS_WATCH",
  status: "SUCCEEDED",
  statusCode: null,
  responseTimeMs: null,
  createdAt: "2026-10-20T10:00:00Z",
  finishedAt: "2026-10-20T10:00:03Z",
  findings: [],
  subChecks: [
    { name: "dns_records", state: "ran", reason: null },
    { name: "dangling_cname", state: "skipped", reason: "not_applicable" },
    { name: "email_auth", state: "ran", reason: null },
  ],
  ...overrides,
});

const baselineDoc = (overrides: Partial<DnsBaseline> = {}): DnsBaseline => ({
  monitorId: "m1",
  scanId: "scn-4",
  host: "www.example.com",
  organizationDomain: "example.com",
  observedAt: "2026-10-20T10:00:03Z",
  snapshot: {
    host: {
      name: "www.example.com",
      A: ["93.184.216.34"],
      AAAA: [],
      CNAME: [],
      NS: [],
      MX: [],
      TXT: ["v=spf1 -all"],
    },
    organization: { name: "example.com", NS: ["a.iana-servers.net"], MX: ["0 ."] },
  },
  changes: [],
  ...overrides,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderSection(role: WorkspaceRole = "OWNER") {
  return render(
    <MemoryRouter initialEntries={["/monitor"]}>
      <Routes>
        <Route
          element={
            <DnsWatch
              host="www.example.com"
              monitor={monitor}
              project={project}
              workspace={workspace(role)}
            />
          }
          path="/monitor"
        />
        <Route element={<Where />} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.checkSettings.mockResolvedValue(settings(true));
  mocks.latestDnsScan.mockRejectedValue(noScan());
  mocks.dnsBaseline.mockRejectedValue(noBaseline());
});

describe("Domain and DNS section", () => {
  it("explains how a scan starts when DNS watch is on and nothing ran yet", async () => {
    renderSection();

    expect(await screen.findByText("No DNS scan yet")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Domain and DNS" })).toBeVisible();
    expect(screen.getByText(/the host itself is not contacted/)).toBeVisible();
    expect(screen.getByRole("switch", { name: "DNS watch" })).toBeChecked();
    expect(mocks.dnsBaseline).not.toHaveBeenCalled();
  });

  it("explains the switch when DNS watch is off and disables the run button with the reason", async () => {
    mocks.checkSettings.mockResolvedValue(settings(false));
    renderSection();

    expect(await screen.findByText("DNS watch is off")).toBeVisible();
    expect(screen.getByRole("switch", { name: "DNS watch" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Run DNS scan/ })).toBeDisabled();
    expect(screen.getByText("Turn on DNS watch first.")).toBeVisible();
  });

  it("turns DNS watch on with the switch and enables the button", async () => {
    const user = userEvent.setup();
    mocks.checkSettings.mockResolvedValue(settings(false));
    mocks.updateCheckSettings.mockResolvedValue(settings(true));
    renderSection();

    await user.click(await screen.findByRole("switch", { name: "DNS watch" }));

    expect(mocks.updateCheckSettings).toHaveBeenCalledWith("m1", { dnsWatchEnabled: true });
    await waitFor(() => expect(screen.getByRole("switch", { name: "DNS watch" })).toBeChecked());
    expect(screen.getByRole("button", { name: /Run DNS scan/ })).toBeEnabled();
  });

  it("rolls the switch back and says why when the API refuses", async () => {
    const user = userEvent.setup();
    mocks.checkSettings.mockResolvedValue(settings(false));
    mocks.updateCheckSettings.mockRejectedValue(
      new ApiError({
        statusCode: 403,
        code: "INSUFFICIENT_WORKSPACE_ROLE",
        message: "Insufficient workspace role",
      }),
    );
    renderSection("ADMIN");

    await user.click(await screen.findByRole("switch", { name: "DNS watch" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Insufficient workspace role"),
    );
    expect(screen.getByRole("switch", { name: "DNS watch" })).not.toBeChecked();
  });

  it("gives a member the state as text, with no switch and no run button", async () => {
    renderSection("MEMBER");

    expect(await screen.findByText("DNS watch is on")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run DNS scan/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("No DNS scan yet. An owner or admin can run the first one."),
    ).toBeVisible();
  });

  it("offers a retry for the settings, the result, and the baseline on their own", async () => {
    const user = userEvent.setup();
    mocks.checkSettings.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-s" }),
    );
    renderSection();

    expect(await screen.findByText("Couldn’t load the DNS watch settings.")).toBeVisible();
    expect(screen.getByText("Request ID: req-s")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No DNS scan yet")).toBeVisible();
  });

  it("offers a retry when the latest result cannot be loaded", async () => {
    const user = userEvent.setup();
    mocks.latestDnsScan.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down" }),
    );
    renderSection();

    expect(await screen.findByText("Couldn’t load the DNS result.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("No DNS scan yet")).toBeVisible();
  });
});

describe("Domain and DNS result", () => {
  it("shows the findings by severity, the checks that ran, and a link to the scan", async () => {
    mocks.latestDnsScan.mockResolvedValue(
      scan({
        findings: [
          finding(),
          finding({
            id: "f2",
            code: "DNS_NS_CHANGED",
            checkId: "DNS_NS_CHANGED",
            category: "DNS",
            severity: "HIGH",
            title: "Name servers changed",
            description: "The NS records observed now differ from the baseline.",
          }),
        ],
      }),
    );
    renderSection();

    expect(await screen.findByText(/2 findings observed/)).toBeVisible();
    expect(screen.getByText(/2 checks ran, 1 skipped/)).toBeVisible();
    const groups = screen.getByRole("group", { name: "DNS findings by severity" });
    expect(within(groups).getByText("1 high")).toBeVisible();
    expect(within(groups).getByText("1 medium")).toBeVisible();
    expect(screen.getByText("Name servers changed")).toBeVisible();
    expect(screen.getByText("DMARC record not observed")).toBeVisible();
    expect(screen.getByText("DNS records")).toBeVisible();
    expect(screen.getByText("Dangling CNAME")).toBeVisible();
    expect(screen.getByText("Skipped: not applicable")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Open the scan" })[0]).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1/monitors/m1/scans/scn-4",
    );
  });

  it("says plainly when nothing was flagged", async () => {
    mocks.latestDnsScan.mockResolvedValue(scan());
    renderSection();

    expect(
      await screen.findByText("Nothing was flagged in the DNS checks that ran."),
    ).toBeVisible();
    expect(screen.getByText(/0 findings observed/)).toBeVisible();
  });

  it("shows why the last DNS scan failed and that the baseline is unchanged", async () => {
    mocks.latestDnsScan.mockResolvedValue(
      scan({
        status: "FAILED",
        errorMessage: "The host name could not be resolved",
        subChecks: null,
      }),
    );
    renderSection();

    expect(await screen.findByText("The last DNS scan could not complete")).toBeVisible();
    // The message becomes a sentence of its own, with exactly one period.
    expect(
      screen.getByText(/The host name could not be resolved\. Nothing was recorded/),
    ).toBeVisible();
    expect(screen.getByText(/the baseline is unchanged/)).toBeVisible();
  });
});

describe("Baseline and recent changes", () => {
  beforeEach(() => {
    mocks.latestDnsScan.mockResolvedValue(scan());
  });

  it("lists the records of the host and of the organizational domain as text", async () => {
    mocks.dnsBaseline.mockResolvedValue(baselineDoc());
    renderSection();

    const baseline = await screen.findByRole("region", { name: "Baseline" });
    expect(within(baseline).getByText(/^Observed /)).toBeVisible();
    expect(within(baseline).getByText("www.example.com")).toBeVisible();
    const host = within(baseline).getByLabelText("Records of the host");
    expect(within(host).getByText("93.184.216.34")).toBeVisible();
    expect(within(host).getByText("v=spf1 -all")).toBeVisible();
    // A type without records says so.
    expect(within(host).getAllByText("None observed")).toHaveLength(4);
    expect(within(baseline).getByText("Organizational domain")).toBeVisible();
    const organization = within(baseline).getByLabelText("Records of the organizational domain");
    expect(within(organization).getByText("a.iana-servers.net")).toBeVisible();
    expect(within(organization).getByText("0 .")).toBeVisible();
  });

  it("shows record values as text and trims a long list", async () => {
    const snapshot = baselineDoc().snapshot;
    mocks.dnsBaseline.mockResolvedValue(
      baselineDoc({
        snapshot: {
          ...snapshot,
          host: {
            ...snapshot.host,
            TXT: [
              "<img src=x onerror=alert(1)>",
              ...Array.from({ length: 8 }, (_, index) => `token-${index}`),
            ],
          },
        },
      }),
    );
    renderSection();

    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("and 3 more")).toBeVisible();
    expect(screen.queryByText("token-7")).not.toBeInTheDocument();
  });

  it("says when nothing changed since the baseline", async () => {
    mocks.dnsBaseline.mockResolvedValue(baselineDoc());
    renderSection();

    expect(await screen.findByText("No changes since the baseline was recorded.")).toBeVisible();
  });

  it("lists the changes newest first with signs and words, never colour alone", async () => {
    mocks.dnsBaseline.mockResolvedValue(
      baselineDoc({
        changes: [
          {
            scanId: "old",
            observedAt: "2026-10-18T10:00:00Z",
            changes: [{ scope: "host", type: "A", added: ["1.1.1.2"], removed: ["1.1.1.1"] }],
          },
          {
            scanId: "new",
            observedAt: "2026-10-19T10:00:00Z",
            changes: [
              {
                scope: "organization",
                type: "NS",
                added: ["ns2.example.net"],
                removed: [],
              },
            ],
          },
        ],
      }),
    );
    renderSection();

    const list = await screen.findByRole("list", { name: "Recent DNS changes" });
    const entries = within(list)
      .getAllByRole("listitem", { name: "" })
      .filter((item) => item.querySelector("[aria-label='Changed records']"));
    expect(entries).toHaveLength(2);
    expect(
      within(entries[0] as HTMLElement).getByText("NS of the organizational domain"),
    ).toBeVisible();
    expect(within(entries[0] as HTMLElement).getByText("1 added")).toBeVisible();
    const added = within(entries[0] as HTMLElement).getByRole("list", { name: "Added" });
    expect(added).toHaveTextContent("+Added: ns2.example.net");
    expect(within(entries[1] as HTMLElement).getByText("A of the host")).toBeVisible();
    expect(within(entries[1] as HTMLElement).getByText("1 added, 1 removed")).toBeVisible();
    const removed = within(entries[1] as HTMLElement).getByRole("list", { name: "Removed" });
    expect(removed).toHaveTextContent("−Removed: 1.1.1.1");
    expect(
      within(entries[0] as HTMLElement).getByRole("link", { name: "Open the scan" }),
    ).toHaveAttribute("href", "/workspaces/w1/projects/p1/monitors/m1/scans/new");
  });

  it("limits the list to ten and says how many there are", async () => {
    mocks.dnsBaseline.mockResolvedValue(
      baselineDoc({
        changes: Array.from({ length: 12 }, (_, index) => ({
          scanId: `s${index}`,
          observedAt: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
          changes: [{ scope: "host" as const, type: "A", added: [`10.0.0.${index}`], removed: [] }],
        })),
      }),
    );
    renderSection();

    expect(await screen.findByText("Showing 10 of 12 changes.")).toBeVisible();
    expect(screen.getByText("10.0.0.11")).toBeVisible();
    expect(screen.queryByText("10.0.0.0")).not.toBeInTheDocument();
  });

  it("explains that the first successful scan records the baseline", async () => {
    renderSection();

    expect(
      await screen.findByText("No baseline yet. The first successful DNS scan records one."),
    ).toBeVisible();
    expect(screen.queryByRole("region", { name: "Baseline" })).not.toBeInTheDocument();
  });

  it("keeps the result when only the baseline request fails, and retries it on its own", async () => {
    const user = userEvent.setup();
    mocks.dnsBaseline.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-b" }),
    );
    mocks.dnsBaseline.mockResolvedValueOnce(baselineDoc());
    renderSection();

    expect(await screen.findByText("Couldn’t load the DNS baseline.")).toBeVisible();
    expect(screen.getByText("Request ID: req-b")).toBeVisible();
    expect(screen.getByText("Nothing was flagged in the DNS checks that ran.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("region", { name: "Baseline" })).toBeVisible();
  });

  it("is read only for every role: a member sees the same baseline", async () => {
    mocks.dnsBaseline.mockResolvedValue(baselineDoc());
    renderSection("MEMBER");

    expect(await screen.findByRole("region", { name: "Baseline" })).toBeVisible();
  });
});

describe("Run DNS scan", () => {
  it("queues a DNS scan and opens its page", async () => {
    const user = userEvent.setup();
    mocks.triggerDnsScan.mockResolvedValue(scan({ id: "scn-new", status: "QUEUED" }));
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run DNS scan/ }));

    expect(mocks.triggerDnsScan).toHaveBeenCalledWith("m1");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("DNS scan queued for www.example.com.");
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/workspaces/w1/projects/p1/monitors/m1/scans/scn-new",
    );
  });

  it("tells the user when the API says DNS watch is off", async () => {
    const user = userEvent.setup();
    mocks.triggerDnsScan.mockRejectedValue(
      new ApiError({ statusCode: 409, code: "SECURITY_CHECKS_DISABLED", message: "off" }),
    );
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run DNS scan/ }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("DNS watch is off for this monitor."),
    );
  });

  it("shows the wait after a rate limit and keeps the button off", async () => {
    const user = userEvent.setup();
    mocks.triggerDnsScan.mockRejectedValue(
      new ApiError({
        statusCode: 429,
        code: "SCAN_RATE_LIMITED",
        message: "Scan rate limit reached",
        details: { retryAfterSeconds: 45 },
      }),
    );
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run DNS scan/ }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("You can run another DNS scan in 45 s."),
    );
    expect(await screen.findByText(/You can run another DNS scan in/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Run DNS scan/ })).toBeDisabled();
  });

  it("shows the API message for any other failure", async () => {
    const user = userEvent.setup();
    mocks.triggerDnsScan.mockRejectedValue(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down" }),
    );
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run DNS scan/ }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Down"));
  });
});
