import { useSearchParams } from "react-router-dom";

import { splitUrl } from "@/entities/monitor";
import { canManageWorkspace, workspaceLook } from "@/entities/workspace";
import { useMonitorScans } from "@/features/monitors/model/use-monitor-scans";
import { useMonitorChecks } from "@/features/security/model/use-monitor-checks";
import { useNow } from "@/shared/lib/use-now";
import { DnsWatch } from "@/widgets/dns-watch";
import { SecurityPosture } from "@/widgets/security-posture";
import type { Monitor, Project, Workspace } from "@/shared/types/domain";

import { overallLine, summarizeCheck } from "./model/check-summary";
import { CheckPanel, CheckTabs, parseCheckTab } from "./ui/check-tabs";
import type { CheckTab } from "./ui/check-card";
import { MonitorCrumbs } from "./ui/monitor-crumbs";
import { MonitorHeader } from "./ui/monitor-header";
import { MonitorTiles } from "./ui/monitor-tiles";
import { ResponseChart } from "./ui/response-chart";
import { ScanHistory } from "./ui/scan-history";

const RELATIVE_TIME_REFRESH_MS = 60_000;
const TAB_PARAM = "tab";

/**
 * Monitor screen body: breadcrumb, header, config tiles, then the Checks strip (Availability, Security,
 * Domain & DNS) whose cards double as tabs for the panel below. The tab lives in the URL (`?tab=`).
 */
export function MonitorDetail({
  workspace,
  project,
  monitor,
}: {
  workspace: Workspace;
  project: Project;
  monitor: Monitor;
}) {
  const scans = useMonitorScans(monitor.id);
  const now = useNow(RELATIVE_TIME_REFRESH_MS);
  const [params, setParams] = useSearchParams();
  const tab = parseCheckTab(params.get(TAB_PARAM));
  const { protocol, host, path } = splitUrl(monitor.targetUrl);
  const canRun = canManageWorkspace(workspace.role);
  const scanHref = (scanId: string) =>
    `/workspaces/${workspace.id}/projects/${project.id}/monitors/${monitor.id}/scans/${scanId}`;
  const checks = useMonitorChecks(monitor.id, scanHref);

  const onTabChange = (next: CheckTab) => {
    const copy = new URLSearchParams(params);
    copy.set(TAB_PARAM, next);
    setParams(copy, { replace: true });
  };

  const overall = overallLine([
    summarizeCheck(checks.settings.status, checks.securityEnabled, checks.security.latest),
    summarizeCheck(checks.settings.status, checks.dnsEnabled, checks.dns.latest),
  ]);

  return (
    <>
      <MonitorCrumbs
        host={host}
        projectId={project.id}
        projectName={project.name}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
      />
      <MonitorHeader
        canRun={canRun}
        host={host}
        overall={overall}
        path={path}
        protocol={protocol}
        tone={workspaceLook(workspace).tone}
      />
      <MonitorTiles
        createdAt={monitor.createdAt}
        intervalSeconds={monitor.intervalSeconds}
        projectName={project.name}
        targetUrl={monitor.targetUrl}
      />
      <CheckTabs
        canManage={canRun}
        checks={checks}
        host={host}
        onRunScan={() => void scans.run(host)}
        onTabChange={onTabChange}
        scans={scans.scans}
        scansBusy={scans.busy}
        tab={tab}
      >
        <CheckPanel value="overview">
          <ResponseChart freshId={scans.freshId} scans={scans.scans} />
          <ScanHistory
            busy={scans.busy}
            canRun={canRun}
            error={scans.error}
            freshId={scans.freshId}
            monitorId={monitor.id}
            now={now}
            onReload={scans.reload}
            onRun={() => void scans.run(host)}
            projectId={project.id}
            scans={scans.scans}
            status={scans.status}
            workspaceId={workspace.id}
          />
        </CheckPanel>
        <CheckPanel value="security">
          <SecurityPosture
            checks={checks}
            host={host}
            monitor={monitor}
            project={project}
            workspace={workspace}
          />
        </CheckPanel>
        <CheckPanel value="dns">
          <DnsWatch checks={checks} monitor={monitor} project={project} workspace={workspace} />
        </CheckPanel>
      </CheckTabs>
    </>
  );
}
