import { useParams } from "react-router-dom";

import { splitUrl, useMonitors } from "@/entities/monitor";
import { useProjects } from "@/entities/project";
import { useWorkspacesContext } from "@/entities/workspace";
import { useDocumentTitle } from "@/shared/lib/use-document-title";
import {
  LoadErrorBanner,
  MonitorDetail,
  MonitorDetailSkeleton,
  MonitorNotFound,
} from "@/widgets/monitor-detail";

/** Monitor body. It renders inside `AppShell` (the layout route), which owns the shared workspace list. */
export function MonitorContent() {
  const { workspaceId = "", projectId = "", monitorId = "" } = useParams();
  const workspaceList = useWorkspacesContext();
  const projects = useProjects(workspaceId);
  const monitors = useMonitors(projectId);
  const target =
    monitors.status === "ready"
      ? monitors.monitors.find((item) => item.id === monitorId)?.targetUrl
      : undefined;
  useDocumentTitle(target ? splitUrl(target).host : "Monitor");

  if (
    workspaceList.status === "error" ||
    projects.status === "error" ||
    monitors.status === "error"
  ) {
    const failure =
      workspaceList.status === "error"
        ? workspaceList.error
        : projects.status === "error"
          ? projects.error
          : monitors.error;
    return (
      <LoadErrorBanner
        message={failure?.message ?? ""}
        onRetry={() => {
          workspaceList.reload();
          projects.reload();
          monitors.reload();
        }}
        requestId={failure?.requestId}
        title="Couldn’t load this monitor."
      />
    );
  }
  if (
    workspaceList.status === "loading" ||
    projects.status === "loading" ||
    monitors.status === "loading"
  ) {
    return <MonitorDetailSkeleton />;
  }

  const workspace = workspaceList.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return <MonitorNotFound backTo="/dashboard" label="Back to dashboard" />;

  const project =
    projects.status === "ready"
      ? projects.projects.find((item) => item.id === projectId)
      : undefined;
  if (!project) {
    return <MonitorNotFound backTo={`/workspaces/${workspace.id}`} label="Back to workspace" />;
  }

  const monitor =
    monitors.status === "ready"
      ? monitors.monitors.find((item) => item.id === monitorId)
      : undefined;
  if (!monitor) {
    return (
      <MonitorNotFound
        backTo={`/workspaces/${workspace.id}/projects/${project.id}`}
        label="Back to project"
      />
    );
  }

  return <MonitorDetail monitor={monitor} project={project} workspace={workspace} />;
}
