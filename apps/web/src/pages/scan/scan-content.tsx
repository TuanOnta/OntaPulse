import { useParams } from "react-router-dom";

import { useMonitors } from "@/entities/monitor";
import { useProjects } from "@/entities/project";
import { useWorkspacesContext } from "@/entities/workspace";
import { useScanDetail } from "@/features/scans/model/use-scan-detail";
import {
  LoadErrorBanner,
  ScanDetail,
  ScanDetailSkeleton,
  ScanNotFound,
} from "@/widgets/scan-detail";

type Ids = { workspaceId: string; projectId: string; monitorId: string; scanId: string };

/** The direct route `/scans/:scanId`: only the scan is known, so the page shows what it can. */
function DirectScanContent({ scanId }: { scanId: string }) {
  const scan = useScanDetail(scanId);

  if (scan.status === "error") {
    return (
      <LoadErrorBanner
        message={scan.error.message}
        onRetry={scan.reload}
        requestId={scan.error.requestId}
        title="Couldn’t load this scan."
      />
    );
  }
  if (scan.status === "loading") return <ScanDetailSkeleton />;
  if (scan.status === "notfound")
    return <ScanNotFound backTo="/dashboard" label="Back to dashboard" />;
  return <ScanDetail context={null} scan={scan.scan} />;
}

/** The nested route: workspace, project and monitor come from their own requests. */
function NestedScanContent({ workspaceId, projectId, monitorId, scanId }: Ids) {
  const workspaceList = useWorkspacesContext();
  const projects = useProjects(workspaceId);
  const monitors = useMonitors(projectId);
  const scan = useScanDetail(scanId);

  const failure =
    workspaceList.status === "error"
      ? workspaceList.error
      : projects.status === "error"
        ? projects.error
        : monitors.status === "error"
          ? monitors.error
          : scan.status === "error"
            ? scan.error
            : null;
  if (failure) {
    return (
      <LoadErrorBanner
        message={failure.message}
        onRetry={() => {
          workspaceList.reload();
          projects.reload();
          monitors.reload();
          scan.reload();
        }}
        requestId={failure.requestId}
        title="Couldn’t load this scan."
      />
    );
  }
  if (
    workspaceList.status === "loading" ||
    projects.status === "loading" ||
    monitors.status === "loading" ||
    scan.status === "loading"
  ) {
    return <ScanDetailSkeleton />;
  }

  const workspace = workspaceList.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return <ScanNotFound backTo="/dashboard" label="Back to dashboard" />;
  const project =
    projects.status === "ready"
      ? projects.projects.find((item) => item.id === projectId)
      : undefined;
  if (!project) {
    return <ScanNotFound backTo={`/workspaces/${workspace.id}`} label="Back to workspace" />;
  }
  const monitor =
    monitors.status === "ready"
      ? monitors.monitors.find((item) => item.id === monitorId)
      : undefined;
  const monitorPage = `/workspaces/${workspace.id}/projects/${project.id}/monitors/${monitorId}`;
  if (!monitor) {
    return (
      <ScanNotFound
        backTo={`/workspaces/${workspace.id}/projects/${project.id}`}
        label="Back to project"
      />
    );
  }
  if (scan.status !== "ready" || scan.scan.monitorId !== monitor.id) {
    return <ScanNotFound backTo={monitorPage} label="Back to monitor" />;
  }

  return <ScanDetail context={{ workspace, project, monitor }} scan={scan.scan} />;
}

/** Scan body. It lives inside `AppShell`, which owns the shared workspace list. */
export function ScanContent() {
  const { workspaceId, projectId, monitorId, scanId = "" } = useParams();
  if (workspaceId && projectId && monitorId) {
    return (
      <NestedScanContent
        monitorId={monitorId}
        projectId={projectId}
        scanId={scanId}
        workspaceId={workspaceId}
      />
    );
  }
  return <DirectScanContent scanId={scanId} />;
}
