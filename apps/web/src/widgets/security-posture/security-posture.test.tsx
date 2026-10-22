import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/client";
import type {
  CheckSettings,
  EdgeProfile,
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
  latestSecurityScan: vi.fn(),
  latestDnsScan: vi.fn(),
  edgeProfile: vi.fn(),
  triggerSecurityScan: vi.fn(),
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
      latestSecurityScan: mocks.latestSecurityScan,
      latestDnsScan: mocks.latestDnsScan,
      edgeProfile: mocks.edgeProfile,
      triggerSecurityScan: mocks.triggerSecurityScan,
    },
  };
});
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { useMonitorChecks } from "@/features/security/model/use-monitor-checks";
import { CheckPanel, CheckTabs } from "@/widgets/monitor-detail/ui/check-tabs";

import { SecurityPosture } from "./security-posture";

const workspace = (role: WorkspaceRole): Workspace => ({
  id: "w1",
  name: "MrScraper Platform",
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
  name: "api.example.com",
  targetUrl: "https://api.example.com/v1/health",
  intervalSeconds: 300,
  isActive: true,
  createdAt: "2026-03-18T14:40:00Z",
  updatedAt: "2026-03-18T14:40:00Z",
};

const settings = (enabled: boolean): CheckSettings => ({
  monitorId: "m1",
  securityPostureEnabled: enabled,
  dnsWatchEnabled: false,
  pathProbesEnabled: false,
  pathProbesAcknowledgedAt: null,
});
const noScan = () =>
  new ApiError({ statusCode: 404, code: "NO_SECURITY_SCAN", message: "No security scan found" });

const noEdgeProfile = () =>
  new ApiError({ statusCode: 404, code: "NO_EDGE_PROFILE", message: "No edge profile found" });

const edgeProfile = (overrides: Partial<EdgeProfile> = {}): EdgeProfile => ({
  monitorId: "m1",
  scanId: "scn-9",
  challengeObserved: false,
  observedAt: "2026-10-20T10:00:03Z",
  detections: [],
  ...overrides,
});

const finding = (overrides: Partial<Finding>): Finding => ({
  id: "f1",
  scanId: "scn-9",
  code: "SEC_HDR_CSP_MISSING",
  checkId: "SEC_HDR_CSP_MISSING",
  category: "HEADERS",
  confidence: null,
  title: "Content-Security-Policy not observed",
  severity: "MEDIUM",
  description: "The response did not include a Content-Security-Policy header.",
  recommendation: "Add a Content-Security-Policy.",
  evidence: { header: "content-security-policy" },
  createdAt: "2026-10-20T10:00:00Z",
  ...overrides,
});

const scan = (overrides: Partial<ScanDetail> = {}): ScanDetail => ({
  id: "scn-9",
  monitorId: "m1",
  kind: "SECURITY_POSTURE",
  status: "SUCCEEDED",
  statusCode: 200,
  responseTimeMs: 90,
  createdAt: "2026-10-20T10:00:00Z",
  finishedAt: "2026-10-20T10:00:03Z",
  findings: [],
  subChecks: [
    { name: "headers", state: "ran", reason: null },
    { name: "tls", state: "ran", reason: null },
    { name: "redirect", state: "skipped", reason: "connection_failed" },
  ],
  ...overrides,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

const scanHref = (scanId: string) => `/workspaces/w1/projects/p1/monitors/m1/scans/${scanId}`;

/** The section as the monitor screen draws it: inside the Checks strip, whose card owns switch and Run. */
function Section({ role }: { role: WorkspaceRole }) {
  const checks = useMonitorChecks("m1", scanHref);
  return (
    <CheckTabs
      canManage={role !== "MEMBER"}
      checks={checks}
      host="api.example.com"
      onRunScan={() => {}}
      onTabChange={() => {}}
      scans={[]}
      scansBusy={false}
      tab="security"
    >
      <CheckPanel value="security">
        <SecurityPosture
          checks={checks}
          host="api.example.com"
          monitor={monitor}
          project={project}
          workspace={workspace(role)}
        />
      </CheckPanel>
    </CheckTabs>
  );
}

function renderSection(role: WorkspaceRole = "OWNER") {
  return render(
    <MemoryRouter initialEntries={["/monitor"]}>
      <Routes>
        <Route element={<Section role={role} />} path="/monitor" />
        <Route element={<Where />} path="*" />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.checkSettings.mockResolvedValue(settings(true));
  mocks.latestSecurityScan.mockRejectedValue(noScan());
  mocks.latestDnsScan.mockRejectedValue(
    new ApiError({ statusCode: 404, code: "NO_DNS_SCAN", message: "No DNS watch scan found" }),
  );
  mocks.edgeProfile.mockRejectedValue(noEdgeProfile());
});

describe("SecurityPosture", () => {
  it("explains how a scan starts when checks are on and nothing ran yet", async () => {
    renderSection();

    expect(
      await screen.findByText(
        "No security scan yet. Run one to see what is observed on this host.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Security" })).toBeVisible();
    expect(screen.getByRole("switch", { name: "Security checks" })).toBeChecked();
  });

  it("explains the switch when checks are off, and disables the run button with the reason", async () => {
    mocks.checkSettings.mockResolvedValue(settings(false));
    renderSection();

    expect(
      await screen.findByText(
        "Security checks are off. Turn them on to observe headers, cookies, CORS, redirects, and TLS.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("switch", { name: "Security checks" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Run security scan/ })).toBeDisabled();
    expect(screen.getByText("Turn on security checks first.")).toBeVisible();
  });

  it("turns the checks on with the switch and enables the button", async () => {
    const user = userEvent.setup();
    mocks.checkSettings.mockResolvedValue(settings(false));
    mocks.updateCheckSettings.mockResolvedValue(settings(true));
    renderSection();

    await user.click(await screen.findByRole("switch", { name: "Security checks" }));

    expect(mocks.updateCheckSettings).toHaveBeenCalledWith("m1", { securityPostureEnabled: true });
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Security checks" })).toBeChecked(),
    );
    expect(screen.getByRole("button", { name: /Run security scan/ })).toBeEnabled();
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

    await user.click(await screen.findByRole("switch", { name: "Security checks" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Insufficient workspace role"),
    );
    expect(screen.getByRole("switch", { name: "Security checks" })).not.toBeChecked();
  });

  it("gives a member the state as text, with no switch and no run button", async () => {
    renderSection("MEMBER");

    expect(await screen.findByText("Security checks are on")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run security scan/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("No security scan yet. An owner or admin can run the first one."),
    ).toBeVisible();
  });

  it("shows the latest result: findings by severity, evidence as text, and the checks that ran", async () => {
    mocks.latestSecurityScan.mockResolvedValue(
      scan({
        findings: [
          finding({ id: "f1" }),
          finding({
            id: "f2",
            code: "SEC_TLS_CHAIN_INVALID",
            checkId: "SEC_TLS_CHAIN_INVALID",
            category: "TLS",
            confidence: "MEDIUM",
            severity: "HIGH",
            title: "TLS certificate chain is not trusted",
            description: "The certificate chain did not validate against the trust store.",
            recommendation: null,
            evidence: { verifyMessage: "<script>alert(1)</script>" },
          }),
        ],
      }),
    );
    renderSection();

    expect(await screen.findByText(/2 findings observed/)).toBeVisible();
    expect(screen.getByText(/2 checks ran, 1 skipped/)).toBeVisible();
    const groups = screen.getByRole("group", { name: "Findings by severity" });
    expect(within(groups).getByText("1 high")).toBeVisible();
    expect(within(groups).getByText("1 medium")).toBeVisible();

    const items = screen.getAllByRole("listitem");
    const first = items.find((item) => within(item).queryByText("SEC_TLS_CHAIN_INVALID"));
    expect(first).toBeDefined();
    expect(within(first as HTMLElement).getByText("HIGH")).toBeVisible();
    expect(within(first as HTMLElement).getByText("· Confidence: medium")).toBeVisible();
    expect(within(first as HTMLElement).getByText("TLS and certificate")).toBeVisible();
    // Untrusted evidence is shown as text, not as markup.
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();

    expect(screen.getByRole("list", { name: "Checks in this scan" })).toBeVisible();
    expect(screen.getByText("Skipped: connection failed")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Open the scan" })[0]).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1/monitors/m1/scans/scn-9",
    );
  });

  it("says plainly when nothing was flagged", async () => {
    mocks.latestSecurityScan.mockResolvedValue(scan());
    renderSection();

    expect(await screen.findByText("Nothing was flagged in the checks that ran.")).toBeVisible();
    expect(screen.getByText(/0 findings observed/)).toBeVisible();
  });

  it("shows why the last security scan failed", async () => {
    mocks.latestSecurityScan.mockResolvedValue(
      scan({ status: "FAILED", errorMessage: "Scan target is unavailable", subChecks: null }),
    );
    renderSection();

    expect(await screen.findByText("The last security scan could not complete")).toBeVisible();
    expect(screen.getByText(/Scan target is unavailable/)).toBeVisible();
  });

  it("offers a retry when the result cannot be loaded", async () => {
    const user = userEvent.setup();
    mocks.latestSecurityScan.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-7" }),
    );
    renderSection();

    expect(await screen.findByText("Couldn’t load the security result.")).toBeVisible();
    expect(screen.getByText("Request ID: req-7")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByText(
        "No security scan yet. Run one to see what is observed on this host.",
      ),
    ).toBeVisible();
  });

  it("offers a retry when the settings cannot be loaded", async () => {
    mocks.checkSettings.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down" }),
    );
    renderSection();

    expect(await screen.findByText("Couldn’t load the security settings.")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("queues a security scan and opens its page", async () => {
    const user = userEvent.setup();
    mocks.triggerSecurityScan.mockResolvedValue(scan({ id: "scn-new", status: "QUEUED" }));
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run security scan/ }));

    expect(mocks.triggerSecurityScan).toHaveBeenCalledWith("m1");
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Security scan queued for api.example.com.");
    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/workspaces/w1/projects/p1/monitors/m1/scans/scn-new",
    );
  });

  it("tells the user when the API says the checks are off", async () => {
    const user = userEvent.setup();
    mocks.triggerSecurityScan.mockRejectedValue(
      new ApiError({ statusCode: 409, code: "SECURITY_CHECKS_DISABLED", message: "off" }),
    );
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run security scan/ }));

    expect(mocks.toastError).toHaveBeenCalledWith("Security checks are off for this monitor.");
  });

  it("disables the button with a countdown after a rate limit", async () => {
    const user = userEvent.setup();
    mocks.triggerSecurityScan.mockRejectedValue(
      new ApiError({
        statusCode: 429,
        code: "SCAN_RATE_LIMITED",
        message: "Scan rate limit reached",
        details: { retryAfterSeconds: 1800 },
      }),
    );
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run security scan/ }));

    expect(mocks.toastError).toHaveBeenCalledWith("You can run another security scan in 30 min.");
    expect(screen.getByRole("button", { name: /Run security scan/ })).toBeDisabled();
    expect(screen.getByText("You can run another security scan in 30 min.")).toBeVisible();
  });

  it("falls back to the API message when a rate limit carries no wait time", async () => {
    const user = userEvent.setup();
    mocks.triggerSecurityScan.mockRejectedValue(
      new ApiError({
        statusCode: 429,
        code: "SCAN_RATE_LIMITED",
        message: "Scan rate limit reached",
        details: { retryAfterSeconds: "soon" },
      }),
    );
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run security scan/ }));

    expect(mocks.toastError).toHaveBeenCalledWith("Scan rate limit reached");
    expect(screen.getByRole("button", { name: /Run security scan/ })).toBeEnabled();
  });

  it("shows other errors as they are", async () => {
    const user = userEvent.setup();
    mocks.triggerSecurityScan.mockRejectedValue(
      new ApiError({ statusCode: 503, code: "SCAN_QUEUE_UNAVAILABLE", message: "Queue is down" }),
    );
    renderSection();

    await user.click(await screen.findByRole("button", { name: /Run security scan/ }));

    expect(mocks.toastError).toHaveBeenCalledWith("Queue is down");
  });
});

describe("Edge layers card", () => {
  beforeEach(() => {
    mocks.latestSecurityScan.mockResolvedValue(scan());
  });

  it("lists each observed layer with words for layer and confidence, and the signals as text", async () => {
    mocks.edgeProfile.mockResolvedValue(
      edgeProfile({
        detections: [
          {
            vendor: "AWS_WAF",
            layer: "WAF",
            confidence: "MEDIUM",
            signals: [{ type: "STATUS_MARKER", name: "x-amzn-waf-action" }],
          },
          {
            vendor: "CLOUDFLARE",
            layer: "CDN",
            confidence: "HIGH",
            signals: [
              { type: "HEADER_NAME", name: "cf-ray" },
              { type: "COOKIE_NAME", name: "<b>x</b>" },
            ],
          },
        ],
      }),
    );
    renderSection();

    const list = await screen.findByRole("list", { name: "Observed edge layers" });
    const rows = within(list).getAllByRole("listitem");
    // Layers are ordered CDN, WAF, anti-bot.
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText("Cloudflare")).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText("CDN")).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText("High confidence")).toBeVisible();
    expect(
      within(rows[0] as HTMLElement).getByText("Signals: Header: cf-ray · Cookie: <b>x</b>"),
    ).toBeVisible();
    expect(within(rows[1] as HTMLElement).getByText("AWS WAF")).toBeVisible();
    expect(within(rows[1] as HTMLElement).getByText("WAF")).toBeVisible();
    expect(within(rows[1] as HTMLElement).getByText("Medium confidence")).toBeVisible();
    expect(
      within(rows[1] as HTMLElement).getByText("Signals: Challenge marker: x-amzn-waf-action"),
    ).toBeVisible();
    expect(screen.queryByText(/Recognised services/)).not.toBeInTheDocument();
    // API text is never turned into markup.
    expect(document.querySelector("b")).toBeNull();
    expect(mocks.edgeProfile).toHaveBeenCalledWith("m1");
  });

  it("says when no layer was observed, which is a result and not a missing profile", async () => {
    mocks.edgeProfile.mockResolvedValue(edgeProfile());
    renderSection();

    expect(
      await screen.findByText("No CDN, WAF, or anti-bot layer was observed in the last scan."),
    ).toBeVisible();
    expect(
      screen.getByText(/Recognised services: Cloudflare, Amazon CloudFront.*shows nothing here\./),
    ).toBeVisible();
    expect(screen.queryByRole("list", { name: "Observed edge layers" })).not.toBeInTheDocument();
  });

  it("explains a monitor with a security scan but no edge profile yet", async () => {
    renderSection();

    expect(
      await screen.findByText("No edge profile yet. The next security scan records one."),
    ).toBeVisible();
  });

  it("notes a served challenge and that findings from it were skipped", async () => {
    mocks.edgeProfile.mockResolvedValue(edgeProfile({ challengeObserved: true }));
    renderSection();

    expect(
      await screen.findByText(
        "A challenge page was served to the scanner. Security findings from that response were skipped.",
      ),
    ).toBeVisible();
  });

  it("shows when it was observed and links to the scan that produced it", async () => {
    mocks.edgeProfile.mockResolvedValue(edgeProfile({ scanId: "scn-3" }));
    renderSection();

    await screen.findByText(/Observed/);
    const links = screen.getAllByRole("link", { name: "Open the scan" });
    expect(links.at(-1)).toHaveAttribute(
      "href",
      "/workspaces/w1/projects/p1/monitors/m1/scans/scn-3",
    );
  });

  it("shows unknown values from a newer API as readable text instead of failing", async () => {
    mocks.edgeProfile.mockResolvedValue(
      edgeProfile({
        detections: [
          {
            vendor: "NEW_VENDOR",
            layer: "EDGE_FUNCTION" as never,
            confidence: "VERY_HIGH" as never,
            signals: [{ type: "TLS_FINGERPRINT", name: "abc" }],
          },
        ],
      }),
    );
    renderSection();

    expect(await screen.findByText("new vendor")).toBeVisible();
    expect(screen.getByText("edge function")).toBeVisible();
    expect(screen.getByText("very high confidence")).toBeVisible();
    expect(screen.getByText("Signals: tls fingerprint: abc")).toBeVisible();
  });

  it("keeps the security result when only the edge request fails, and retries on its own", async () => {
    const user = userEvent.setup();
    mocks.edgeProfile.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down", requestId: "req-edge" }),
    );
    mocks.edgeProfile.mockResolvedValueOnce(edgeProfile());
    renderSection();

    expect(await screen.findByText("Couldn’t load the edge layers.")).toBeVisible();
    expect(screen.getByText("Request ID: req-edge")).toBeVisible();
    expect(screen.getByText("Nothing was flagged in the checks that ran.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByText("No CDN, WAF, or anti-bot layer was observed in the last scan."),
    ).toBeVisible();
  });

  it("is read only for every role: a member sees the same card", async () => {
    mocks.edgeProfile.mockResolvedValue(edgeProfile());
    renderSection("MEMBER");

    expect(await screen.findByRole("heading", { name: "Edge layers" })).toBeVisible();
  });

  it("does not ask for an edge profile before there is a security scan", async () => {
    mocks.latestSecurityScan.mockRejectedValue(noScan());
    renderSection();

    await screen.findByText("No security scan yet. Run one to see what is observed on this host.");
    expect(mocks.edgeProfile).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Edge layers" })).not.toBeInTheDocument();
  });
});

describe("Exposed-file checks", () => {
  const withProbes = (overrides: Partial<CheckSettings> = {}): CheckSettings => ({
    ...settings(true),
    ...overrides,
  });

  it("enables only through the confirmation, sending the acknowledgment with the switch", async () => {
    const user = userEvent.setup();
    mocks.updateCheckSettings.mockResolvedValue(
      withProbes({ pathProbesEnabled: true, pathProbesAcknowledgedAt: "2026-10-20T10:00:00Z" }),
    );
    renderSection();

    await user.click(await screen.findByRole("switch", { name: "Exposed-file checks" }));
    const dialog = screen.getByRole("dialog", { name: "Check for exposed files?" });
    expect(mocks.updateCheckSettings).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Turn on" })).toBeDisabled();

    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Turn on" }));

    await waitFor(() =>
      expect(mocks.updateCheckSettings).toHaveBeenCalledWith("m1", {
        pathProbesEnabled: true,
        pathProbesAcknowledged: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("switch", { name: "Exposed-file checks" })).toBeChecked();
    expect(screen.getByTestId("path-probes-state")).toHaveTextContent(/^On\. Acknowledged /);
  });

  it("sends nothing when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole("switch", { name: "Exposed-file checks" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.updateCheckSettings).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Exposed-file checks" })).not.toBeChecked();
    expect(screen.getByTestId("path-probes-state")).toHaveTextContent("Off. Not requested.");
  });

  it("shows the API refusal inside the dialog and leaves the checks off", async () => {
    const user = userEvent.setup();
    mocks.updateCheckSettings.mockRejectedValue(
      new ApiError({
        statusCode: 403,
        code: "INSUFFICIENT_WORKSPACE_ROLE",
        message: "Insufficient workspace role",
        requestId: "req-p",
      }),
    );
    renderSection("ADMIN");

    await user.click(await screen.findByRole("switch", { name: "Exposed-file checks" }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Turn on" }));

    expect(await screen.findByText("Insufficient workspace role")).toBeVisible();
    expect(screen.getByText("Request ID: req-p")).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByTestId("path-probes-state")).toHaveTextContent("Off. Not requested.");
  });

  it("turns off without a dialog and sends only the switch", async () => {
    const user = userEvent.setup();
    mocks.checkSettings.mockResolvedValue(
      withProbes({ pathProbesEnabled: true, pathProbesAcknowledgedAt: "2026-10-20T10:00:00Z" }),
    );
    mocks.updateCheckSettings.mockResolvedValue(withProbes());
    renderSection();

    await user.click(await screen.findByRole("switch", { name: "Exposed-file checks" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.updateCheckSettings).toHaveBeenCalledWith("m1", { pathProbesEnabled: false });
    await waitFor(() =>
      expect(screen.getByTestId("path-probes-state")).toHaveTextContent("Off. Not requested."),
    );
  });

  it("rolls the switch back and says why when turning off is refused", async () => {
    const user = userEvent.setup();
    mocks.checkSettings.mockResolvedValue(
      withProbes({ pathProbesEnabled: true, pathProbesAcknowledgedAt: "2026-10-20T10:00:00Z" }),
    );
    mocks.updateCheckSettings.mockRejectedValue(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down" }),
    );
    renderSection();

    await user.click(await screen.findByRole("switch", { name: "Exposed-file checks" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Down"));
    expect(screen.getByRole("switch", { name: "Exposed-file checks" })).toBeChecked();
    expect(screen.getByTestId("path-probes-state")).toHaveTextContent(/^On\. Acknowledged /);
  });

  it("gives a member the state as text, with no switch and no dialog", async () => {
    mocks.checkSettings.mockResolvedValue(
      withProbes({ pathProbesEnabled: true, pathProbesAcknowledgedAt: "2026-10-20T10:00:00Z" }),
    );
    renderSection("MEMBER");

    expect(await screen.findByTestId("path-probes-state")).toHaveTextContent(/^On\. Acknowledged /);
    expect(screen.queryByRole("switch", { name: "Exposed-file checks" })).not.toBeInTheDocument();
  });

  it("stays visible when the security checks are off and says nothing runs yet", async () => {
    mocks.checkSettings.mockResolvedValue(withProbes({ securityPostureEnabled: false }));
    renderSection();

    expect(await screen.findByRole("heading", { name: "Exposed-file checks" })).toBeVisible();
    expect(screen.getByText(/Security checks are off, so nothing runs yet\./)).toBeVisible();
  });

  it("does not show the panel while the settings failed to load", async () => {
    mocks.checkSettings.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: "BOOM", message: "Down" }),
    );
    renderSection();

    await screen.findByText("Couldn’t load the security settings.");
    expect(screen.queryByRole("heading", { name: "Exposed-file checks" })).not.toBeInTheDocument();
  });
});
