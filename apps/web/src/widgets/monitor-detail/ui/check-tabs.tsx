import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

import { formatMs, isBusyScan, isCheckScan, relativeTime } from "@/entities/scan";
import type { MonitorChecks } from "@/features/security/model/use-monitor-checks";
import { RunSecurityScanButton } from "@/features/security/ui/run-security-scan-button";
import { SecuritySwitch } from "@/features/security/ui/security-switch";
import { riseStyle } from "@/shared/lib/rise";
import type { Scan } from "@/shared/types/domain";
import { ActionButton, SMALL_PILL } from "@/shared/ui/pill-button";

import { summarizeCheck } from "../model/check-summary";
import { CHECK_TAB, CheckCard, CheckSummaryText, type CheckTab } from "./check-card";

const PulseIcon = () => (
  <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
    <path
      d="M2 11 H6 L8.5 4 L12 16 L14 11 H18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
    <path
      d="M10 2.5 L16.5 5 V10 C16.5 13.5 13.8 16 10 17.5 C6.2 16 3.5 13.5 3.5 10 V5 Z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.6"
    />
  </svg>
);

const GlobeIcon = () => (
  <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M3 10 H17 M10 3 C7.5 6 7.5 14 10 17 M10 3 C12.5 6 12.5 14 10 17"
      stroke="currentColor"
      strokeWidth="1.4"
    />
  </svg>
);

const PlayIcon = () => (
  <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
    <path d="M4.5 3 L12.5 8 L4.5 13 Z" fill="currentColor" />
  </svg>
);

/** The `?tab=` value of the URL as a tab; anything unknown opens the overview. */
export function parseCheckTab(value: string | null): CheckTab {
  return CHECK_TAB.find((tab) => tab === value) ?? "overview";
}

/** The newest plain HTTP probe of the list (newest first), the one the Availability card reports. */
function latestHttpScan(scans: readonly Scan[]): Scan | undefined {
  return scans.find((scan) => !isCheckScan(scan));
}

function AvailabilitySummary({ scan, now }: { scan: Scan | undefined; now: number }) {
  if (!scan) {
    return (
      <>
        <span className="block text-[16px] font-semibold">No scan yet</span>
        <span className="mt-0.5 block text-[14px] text-landing-muted">
          Run a scan to see the status and response time
        </span>
      </>
    );
  }
  const when = relativeTime(scan.finishedAt ?? scan.createdAt, now);
  if (isBusyScan(scan)) {
    return (
      <>
        <span className="block text-[16px] font-semibold">
          {scan.status === "QUEUED" ? "Queued" : "Running"}
        </span>
        <span className="mt-0.5 block text-[14px] text-landing-muted">Started {when}</span>
      </>
    );
  }
  if (scan.status === "FAILED") {
    return (
      <>
        <span className="block text-[16px] font-semibold text-landing-danger-text">
          Last scan failed
        </span>
        <span className="mt-0.5 block text-[14px] text-landing-muted">{when}</span>
      </>
    );
  }
  return (
    <>
      <span className="block text-[16px] font-semibold">
        {scan.statusCode != null ? `HTTP ${scan.statusCode}` : "Succeeded"}
        {scan.responseTimeMs != null ? ` · ${formatMs(scan.responseTimeMs)}` : ""}
      </span>
      <span className="mt-0.5 block text-[14px] text-landing-muted">Last scan {when}</span>
    </>
  );
}

/** A panel under the strip; Radix mounts `children` only while its tab is selected. */
export function CheckPanel({ value, children }: { value: CheckTab; children: ReactNode }) {
  return (
    <Tabs.Content
      className="animate-dash-drop rounded-[26px] border border-landing-accent/55 bg-landing-surface-2/50 p-6 outline-none max-[959px]:p-[18px] max-[520px]:p-3.5 motion-reduce:animate-none"
      value={value}
    >
      {children}
    </Tabs.Content>
  );
}

/**
 * The Checks strip: Availability, Security and Domain & DNS side by side. Each card shows the stored status,
 * owns its switch and Run, and selects the panel below, so the three are one click apart and readable without
 * switching. Members get the state as text and no controls; the API decides who may change anything.
 */
export function CheckTabs({
  tab,
  onTabChange,
  canManage,
  host,
  scans,
  scansBusy,
  onRunScan,
  checks,
  children,
}: {
  tab: CheckTab;
  onTabChange: (tab: CheckTab) => void;
  canManage: boolean;
  host: string;
  scans: readonly Scan[];
  scansBusy: boolean;
  onRunScan: () => void;
  checks: MonitorChecks;
  /** The `CheckPanel`s. */
  children: ReactNode;
}) {
  const { now, settings } = checks;
  const securitySummary = summarizeCheck(
    settings.status,
    checks.securityEnabled,
    checks.security.latest,
  );
  const dnsSummary = summarizeCheck(settings.status, checks.dnsEnabled, checks.dns.latest);
  const settingsReady = settings.status === "ready";

  return (
    <Tabs.Root onValueChange={(value) => onTabChange(parseCheckTab(value))} value={tab}>
      <section
        aria-labelledby="checks-title"
        className="mt-[26px] animate-dash-rise motion-reduce:animate-none"
        style={riseStyle(3)}
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="font-display text-[22px] font-bold tracking-[-.01em]" id="checks-title">
            Checks
          </h2>
          <p className="text-[15px] text-landing-muted">
            Pick a check to see its result. Switches and Run live on each card.
          </p>
        </div>
        <Tabs.List
          aria-label="Checks"
          className="grid grid-cols-1 gap-3.5 min-[1280px]:grid-cols-3"
        >
          <CheckCard
            footer={
              <>
                <span className="self-center text-[14px] text-landing-muted">HTTP probe</span>
                {canManage ? (
                  <ActionButton
                    className={SMALL_PILL}
                    disabled={scansBusy}
                    onClick={onRunScan}
                    variant="ghost"
                  >
                    <PlayIcon />
                    {scansBusy ? "Scanning…" : "Run scan"}
                  </ActionButton>
                ) : null}
              </>
            }
            icon={<PulseIcon />}
            name="Availability"
            stateLabel="Always on"
            value="overview"
          >
            <AvailabilitySummary now={now} scan={latestHttpScan(scans)} />
          </CheckCard>

          <CheckCard
            footer={
              settingsReady ? (
                <>
                  <SecuritySwitch
                    canManage={canManage}
                    enabled={checks.securityEnabled}
                    onChange={(value) => void settings.setSecurityPosture(value)}
                    saving={settings.saving}
                  />
                  {canManage ? (
                    <RunSecurityScanButton
                      busy={checks.security.run.busy}
                      enabled={checks.securityEnabled}
                      host={host}
                      onRun={() => void checks.security.run.run(host)}
                      waitSeconds={checks.security.waitSeconds}
                    />
                  ) : null}
                </>
              ) : null
            }
            icon={<ShieldIcon />}
            name="Security"
            stateLabel={settingsReady ? (checks.securityEnabled ? "On" : "Off") : ""}
            value="security"
          >
            <CheckSummaryText
              canManage={canManage}
              noun="security checks"
              now={now}
              summary={securitySummary}
            />
          </CheckCard>

          <CheckCard
            footer={
              settingsReady ? (
                <>
                  <SecuritySwitch
                    canManage={canManage}
                    enabled={checks.dnsEnabled}
                    kind="dns"
                    onChange={(value) => void settings.setDnsWatch(value)}
                    saving={settings.saving}
                  />
                  {canManage ? (
                    <RunSecurityScanButton
                      busy={checks.dns.run.busy}
                      enabled={checks.dnsEnabled}
                      host={host}
                      kind="dns"
                      onRun={() => void checks.dns.run.run(host)}
                      waitSeconds={checks.dns.waitSeconds}
                    />
                  ) : null}
                </>
              ) : null
            }
            icon={<GlobeIcon />}
            name="Domain & DNS"
            stateLabel={settingsReady ? (checks.dnsEnabled ? "On" : "Off") : ""}
            value="dns"
          >
            <CheckSummaryText
              canManage={canManage}
              noun="DNS watch"
              now={now}
              summary={dnsSummary}
            />
          </CheckCard>
        </Tabs.List>
      </section>

      <div className="mt-3.5 animate-dash-rise motion-reduce:animate-none" style={riseStyle(4)}>
        {children}
      </div>
    </Tabs.Root>
  );
}
