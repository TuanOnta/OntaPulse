import { canManageWorkspace } from "@/entities/workspace";
import { EdgeProfileCard } from "@/features/security/ui/edge-profile-card";
import { PathProbesPanel } from "@/features/security/ui/path-probes-panel";
import type { MonitorChecks } from "@/features/security/model/use-monitor-checks";
import type { Monitor, Project, Workspace } from "@/shared/types/domain";
import { LoadErrorBanner } from "@/shared/ui/state-panel";

import { SecurityResult } from "./ui/security-result";
import { SecurityEmpty, SecuritySkeleton } from "./ui/security-states";

/**
 * Security panel of the monitor screen: the exposed-file checks, the latest result and the edge layers. The
 * on/off switch and "Run security scan" are on the Security card of the Checks strip. It shows stored data
 * only; enabling and running go through the API, which decides who may do them.
 */
export function SecurityPosture({
  workspace,
  project,
  monitor,
  host,
  checks,
}: {
  workspace: Workspace;
  project: Project;
  monitor: Monitor;
  host: string;
  checks: MonitorChecks;
}) {
  const canManage = canManageWorkspace(workspace.role);
  const { settings, security } = checks;
  const latest = security.latest;
  const scanHref = (scanId: string) =>
    `/workspaces/${workspace.id}/projects/${project.id}/monitors/${monitor.id}/scans/${scanId}`;

  return (
    <section aria-labelledby="security-title">
      <div className="mb-4">
        <h2 className="font-display text-[22px] font-bold tracking-[-.01em]" id="security-title">
          Security
        </h2>
        <p className="mt-0.5 text-[15px] text-landing-muted">
          What a passive check observed on this host. Nothing is changed on the target.
        </p>
      </div>

      {settings.status === "ready" ? (
        <PathProbesPanel
          acknowledgedAt={settings.settings.pathProbesAcknowledgedAt}
          canManage={canManage}
          enabled={settings.settings.pathProbesEnabled}
          host={host}
          onDisable={() => void settings.disablePathProbes()}
          onEnable={settings.enablePathProbes}
          saving={settings.probesSaving}
          securityEnabled={checks.securityEnabled}
        />
      ) : null}

      {settings.status === "error" ? (
        <LoadErrorBanner
          message={settings.error.message}
          onRetry={settings.reload}
          requestId={settings.error.requestId}
          title="Couldn’t load the security settings."
        />
      ) : settings.status === "loading" || latest.status === "loading" ? (
        <SecuritySkeleton />
      ) : latest.status === "error" ? (
        <LoadErrorBanner
          message={latest.error.message}
          onRetry={latest.reload}
          requestId={latest.error.requestId}
          title="Couldn’t load the security result."
        />
      ) : latest.status === "empty" ? (
        <SecurityEmpty canManage={canManage} enabled={checks.securityEnabled} />
      ) : (
        <div className="flex flex-col gap-3.5">
          <SecurityResult scan={latest.scan} scanHref={scanHref(latest.scan.id)} />
          <EdgeProfileCard monitorId={monitor.id} scanHref={scanHref} scanId={latest.scan.id} />
        </div>
      )}
    </section>
  );
}
