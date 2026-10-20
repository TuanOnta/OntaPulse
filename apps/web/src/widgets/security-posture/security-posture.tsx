import { canManageWorkspace } from "@/entities/workspace";
import { useCheckSettings } from "@/features/security/model/use-check-settings";
import { useLatestSecurityScan } from "@/features/security/model/use-latest-security-scan";
import { useRunSecurityScan } from "@/features/security/model/use-run-security-scan";
import { EdgeProfileCard } from "@/features/security/ui/edge-profile-card";
import { RunSecurityScanButton } from "@/features/security/ui/run-security-scan-button";
import { SecuritySwitch } from "@/features/security/ui/security-switch";
import { riseStyle } from "@/shared/lib/rise";
import { useNow } from "@/shared/lib/use-now";
import type { Monitor, Project, Workspace } from "@/shared/types/domain";
import { LoadErrorBanner } from "@/shared/ui/state-panel";

import { SecurityResult } from "./ui/security-result";
import { SecurityEmpty, SecuritySkeleton } from "./ui/security-states";

const IDLE_REFRESH_MS = 60_000;
const COUNTDOWN_REFRESH_MS = 1_000;

/**
 * Security section of the monitor screen: the on/off switch, "Run security scan", and the latest result. It
 * shows stored data only; running and enabling go through the API, which decides who may do them.
 */
export function SecurityPosture({
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
  const latest = useLatestSecurityScan(monitor.id);
  const scanHref = (scanId: string) =>
    `/workspaces/${workspace.id}/projects/${project.id}/monitors/${monitor.id}/scans/${scanId}`;
  const run = useRunSecurityScan(monitor.id, scanHref);
  // The ticking `useNow` re-renders the countdown; the wait itself is read from the clock when drawn,
  // so the first value after a rate limit is exact instead of one tick old.
  useNow(run.retryAt ? COUNTDOWN_REFRESH_MS : IDLE_REFRESH_MS);
  const waitSeconds = run.retryAt ? Math.ceil((run.retryAt - Date.now()) / 1000) : 0;
  const enabled = settings.status === "ready" && settings.settings.securityPostureEnabled;

  return (
    <section aria-labelledby="security-title">
      <div
        className="mt-[30px] mb-4 flex animate-dash-rise flex-wrap items-start justify-between gap-x-4 gap-y-3 motion-reduce:animate-none"
        style={riseStyle(4)}
      >
        <div>
          <h2 className="font-display text-[22px] font-bold tracking-[-.01em]" id="security-title">
            Security
          </h2>
          <p className="mt-0.5 text-[15px] text-landing-muted">
            What a passive check observed on this host. Nothing is changed on the target.
          </p>
        </div>
        {settings.status === "ready" ? (
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3 max-[520px]:w-full max-[520px]:flex-col">
            <SecuritySwitch
              canManage={canManage}
              enabled={enabled}
              onChange={(value) => void settings.setSecurityPosture(value)}
              saving={settings.saving}
            />
            {canManage ? (
              <RunSecurityScanButton
                busy={run.busy}
                enabled={enabled}
                host={host}
                onRun={() => void run.run(host)}
                waitSeconds={waitSeconds}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="animate-dash-rise motion-reduce:animate-none" style={riseStyle(5)}>
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
          <SecurityEmpty canManage={canManage} enabled={enabled} />
        ) : (
          <div className="flex flex-col gap-3.5">
            <SecurityResult scan={latest.scan} scanHref={scanHref(latest.scan.id)} />
            <EdgeProfileCard monitorId={monitor.id} scanHref={scanHref} scanId={latest.scan.id} />
          </div>
        )}
      </div>
    </section>
  );
}
