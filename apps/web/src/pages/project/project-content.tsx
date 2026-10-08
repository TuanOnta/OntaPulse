import { useParams } from "react-router-dom";

import { useMonitors } from "@/entities/monitor";
import { useProjects } from "@/entities/project";
import { useWorkspacesContext } from "@/entities/workspace";
import {
  LoadErrorBanner,
  ProjectDetail,
  ProjectDetailSkeleton,
  ProjectNotFound,
} from "@/widgets/project-detail";

/** Project body. It lives inside `AppShell`, which owns the shared workspace list. */
export function ProjectContent() {
  const { workspaceId = "", projectId = "" } = useParams();
  const workspaceList = useWorkspacesContext();
  const projects = useProjects(workspaceId);
  const monitors = useMonitors(projectId);

  if (workspaceList.status === "error" || projects.status === "error") {
    const failure = workspaceList.status === "error" ? workspaceList.error : projects.error;
    return (
      <LoadErrorBanner
        message={failure?.message ?? ""}
        onRetry={() => {
          workspaceList.reload();
          projects.reload();
          monitors.reload();
        }}
        requestId={failure?.requestId}
        title="Couldn’t load this project."
      />
    );
  }
  if (workspaceList.status === "loading" || projects.status === "loading") {
    return <ProjectDetailSkeleton />;
  }

  const workspace = workspaceList.workspaces.find((item) => item.id === workspaceId);
  const project = projects.projects.find((item) => item.id === projectId);
  if (!workspace) return <ProjectNotFound />;
  if (projects.status === "notfound" || !project || monitors.status === "notfound") {
    return <ProjectNotFound workspaceId={workspace.id} />;
  }

  return (
    <ProjectDetail
      monitors={{ ...monitors, status: monitors.status }}
      project={project}
      workspace={workspace}
    />
  );
}
