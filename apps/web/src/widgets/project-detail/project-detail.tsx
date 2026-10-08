import { useState } from "react";

import { splitUrl, type MonitorsError } from "@/entities/monitor";
import { canManageWorkspace, workspaceLook } from "@/entities/workspace";
import { CreateMonitorDialog } from "@/features/monitors/create-monitor-dialog";
import { useScanRuns } from "@/features/monitors/model/use-scan-runs";
import type { Monitor, Project, Workspace } from "@/shared/types/domain";

import { MonitorsSection } from "./ui/monitors-section";
import { ProjectCrumbs } from "./ui/project-crumbs";
import { ProjectHeader } from "./ui/project-header";

export type ProjectDetailProps = {
  workspace: Workspace;
  project: Project;
  monitors: {
    status: "loading" | "ready" | "error";
    monitors: Monitor[];
    error: MonitorsError | null;
    reload: () => void;
  };
};

/** Project screen body: breadcrumb, header, monitor list with scan runs, and the add-monitor dialog. */
export function ProjectDetail({ workspace, project, monitors }: ProjectDetailProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { runs, start } = useScanRuns();
  const manage = canManageWorkspace(workspace.role);
  const tone = workspaceLook(workspace).tone;

  return (
    <>
      <ProjectCrumbs
        projectName={project.name}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
      />
      <ProjectHeader
        canManage={manage}
        createdAt={project.createdAt}
        description={project.description}
        monitorCount={monitors.status === "ready" ? monitors.monitors.length : null}
        name={project.name}
        onAddMonitor={() => setDialogOpen(true)}
        tone={tone}
      />
      <MonitorsSection
        canManage={manage}
        error={monitors.error}
        monitors={monitors.monitors}
        onAddMonitor={() => setDialogOpen(true)}
        onReload={monitors.reload}
        onRunScan={(monitor) => void start(monitor.id, splitUrl(monitor.targetUrl).host)}
        projectId={project.id}
        runs={runs}
        status={monitors.status}
        workspaceId={workspace.id}
      />
      <CreateMonitorDialog
        existingUrls={monitors.monitors.map((monitor) => monitor.targetUrl)}
        onCreated={monitors.reload}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        projectId={project.id}
      />
    </>
  );
}
