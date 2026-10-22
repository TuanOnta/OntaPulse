import { canManageWorkspace } from "@/entities/workspace";
import { useDnsBaseline } from "@/features/security/model/use-dns-baseline";
import type { MonitorChecks } from "@/features/security/model/use-monitor-checks";
import type { Monitor, Project, Workspace } from "@/shared/types/domain";
import { LoadErrorBanner } from "@/shared/ui/state-panel";

import { DnsBaselineCard } from "./ui/dns-baseline-card";
import { DnsChangesCard } from "./ui/dns-changes-card";
import { DnsResult } from "./ui/dns-result";
import { DnsEmpty, DnsSkeleton } from "./ui/dns-states";

/**
 * Domain and DNS panel of the monitor screen: the latest result, the stored baseline, and the recent changes.
 * The DNS watch switch and "Run DNS scan" are on the Domain & DNS card of the Checks strip. It shows stored
 * data only; the scan makes DNS queries to public resolvers and never contacts the host.
 */
export function DnsWatch({
  workspace,
  project,
  monitor,
  checks,
}: {
  workspace: Workspace;
  project: Project;
  monitor: Monitor;
  checks: MonitorChecks;
}) {
  const canManage = canManageWorkspace(workspace.role);
  const { settings, dns } = checks;
  const latest = dns.latest;
  const baseline = useDnsBaseline(monitor.id, latest.status === "ready" ? latest.scan.id : null);
  const scanHref = (scanId: string) =>
    `/workspaces/${workspace.id}/projects/${project.id}/monitors/${monitor.id}/scans/${scanId}`;

  return (
    <section aria-labelledby="dns-title">
      <div className="mb-4 max-w-[62ch]">
        <h2 className="font-display text-[22px] font-bold tracking-[-.01em]" id="dns-title">
          Domain and DNS
        </h2>
        <p className="mt-0.5 text-[15px] text-landing-muted">
          DNS records observed for this host and its organizational domain, compared with a
          baseline. Only DNS queries are made; the host itself is not contacted.
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
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
          <DnsEmpty canManage={canManage} enabled={checks.dnsEnabled} />
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
