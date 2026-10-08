import { splitUrl } from "@/entities/monitor";
import { canManageWorkspace, workspaceLook } from "@/entities/workspace";
import { useMonitorScans } from "@/features/monitors/model/use-monitor-scans";
import { useNow } from "@/shared/lib/use-now";
import type { Monitor, Project, Workspace } from "@/shared/types/domain";

import { MonitorCrumbs } from "./ui/monitor-crumbs";
import { MonitorHeader } from "./ui/monitor-header";
import { MonitorTiles } from "./ui/monitor-tiles";
import { ResponseChart } from "./ui/response-chart";
import { ScanHistory } from "./ui/scan-history";

const RELATIVE_TIME_REFRESH_MS = 60_000;

/** Monitor screen body: breadcrumb, header, config tiles, response chart and scan history. */
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
  const { protocol, host, path } = splitUrl(monitor.targetUrl);
  const canRun = canManageWorkspace(workspace.role);

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
        busy={scans.busy}
        canRun={canRun}
        host={host}
        onRun={() => void scans.run(host)}
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
    </>
  );
}
