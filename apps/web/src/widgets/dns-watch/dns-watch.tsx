import { canManageWorkspace } from "@/entities/workspace";
import { useCheckSettings } from "@/features/security/model/use-check-settings";
import { useDnsBaseline } from "@/features/security/model/use-dns-baseline";
import { useLatestDnsScan } from "@/features/security/model/use-latest-dns-scan";
import { useRunDnsScan } from "@/features/security/model/use-run-dns-scan";
import { RunSecurityScanButton } from "@/features/security/ui/run-security-scan-button";
import { SecuritySwitch } from "@/features/security/ui/security-switch";
import { riseStyle } from "@/shared/lib/rise";
import { useNow } from "@/shared/lib/use-now";
import type { Monitor, Project, Workspace } from "@/shared/types/domain";
import { LoadErrorBanner } from "@/shared/ui/state-panel";

import { DnsBaselineCard } from "./ui/dns-baseline-card";
import { DnsChangesCard } from "./ui/dns-changes-card";
import { DnsResult } from "./ui/dns-result";
import { DnsEmpty, DnsSkeleton } from "./ui/dns-states";

const IDLE_REFRESH_MS = 60_000;
const COUNTDOWN_REFRESH_MS = 1_000;

/**
 * Domain and DNS section of the monitor screen: the DNS watch switch, "Run DNS scan", the latest result, the
 * stored baseline, and the recent changes. It shows stored data only; the scan makes DNS queries to public
 * resolvers and never contacts the host. Enabling and running go through the API, which decides who may.
 */
export function DnsWatch({
  workspace,
  project,
  monitor,
  host,
}: {
  workspace: Workspace;
  project: Project;
  monitor: Monitor;
  host: string;
}) {
  const canManage = canManageWorkspace(workspace.role);
  const settings = useCheckSettings(monitor.id);
  const latest = useLatestDnsScan(monitor.id);
  const baseline = useDnsBaseline(monitor.id, latest.status === "ready" ? latest.scan.id : null);
  const scanHref = (scanId: string) =>
    `/workspaces/${workspace.id}/projects/${project.id}/monitors/${monitor.id}/scans/${scanId}`;
  const run = useRunDnsScan(monitor.id, scanHref);
  // The ticking `useNow` re-renders the countdown; the wait itself is read from the clock when drawn.
  useNow(run.retryAt ? COUNTDOWN_REFRESH_MS : IDLE_REFRESH_MS);
  const waitSeconds = run.retryAt ? Math.ceil((run.retryAt - Date.now()) / 1000) : 0;
  const enabled = settings.status === "ready" && settings.settings.dnsWatchEnabled;

  return (
    <section aria-labelledby="dns-title">
      <div
        className="mt-[30px] mb-4 flex animate-dash-rise flex-wrap items-start justify-between gap-x-4 gap-y-3 motion-reduce:animate-none"
        style={riseStyle(4)}
      >
        <div className="max-w-[62ch]">
          <h2 className="font-display text-[22px] font-bold tracking-[-.01em]" id="dns-title">
            Domain and DNS
          </h2>
          <p className="mt-0.5 text-[15px] text-landing-muted">
            DNS records observed for this host and its organizational domain, compared with a
            baseline. Only DNS queries are made; the host itself is not contacted.
          </p>
        </div>
        {settings.status === "ready" ? (
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3 max-[520px]:w-full max-[520px]:flex-col">
            <SecuritySwitch
              canManage={canManage}
              enabled={enabled}
              kind="dns"
              onChange={(value) => void settings.setDnsWatch(value)}
              saving={settings.saving}
            />
            {canManage ? (
              <RunSecurityScanButton
                busy={run.busy}
                enabled={enabled}
                host={host}
                kind="dns"
                onRun={() => void run.run(host)}
                waitSeconds={waitSeconds}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className="flex animate-dash-rise flex-col gap-3.5 motion-reduce:animate-none"
        style={riseStyle(5)}
      >
        {settings.status === "error" ? (
          <LoadErrorBanner
            message={settings.error.message}
            onRetry={settings.reload}
            requestId={settings.error.requestId}
            title="Couldn’t load the DNS watch settings."
          />
        ) : settings.status === "loading" || latest.status === "loading" ? (
          <DnsSkeleton />
        ) : latest.status === "error" ? (
          <LoadErrorBanner
            message={latest.error.message}
            onRetry={latest.reload}
            requestId={latest.error.requestId}
            title="Couldn’t load the DNS result."
          />
        ) : latest.status === "empty" ? (
          <DnsEmpty canManage={canManage} enabled={enabled} />
        ) : (
          <>
            <DnsResult scan={latest.scan} scanHref={scanHref(latest.scan.id)} />
            {baseline.status === "loading" ? (
              <DnsSkeleton label="Loading the DNS baseline" />
            ) : baseline.status === "error" ? (
              <LoadErrorBanner
                message={baseline.error.message}
                onRetry={baseline.reload}
                requestId={baseline.error.requestId}
                title="Couldn’t load the DNS baseline."
              />
            ) : baseline.status === "empty" ? (
              <p className="rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px] text-landing-text-2">
                No baseline yet. The first successful DNS scan records one.
              </p>
            ) : (
              <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3.5 max-[1023px]:grid-cols-1">
                <DnsBaselineCard baseline={baseline.baseline} />
                <DnsChangesCard baseline={baseline.baseline} scanHref={scanHref} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
