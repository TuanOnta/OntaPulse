import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { useAuth } from "@/app/providers/auth-provider";
import { useProjects } from "@/entities/project";
import { useWorkspaceMembers, useWorkspacesContext } from "@/entities/workspace";
import { DeletedPanel } from "@/shared/ui/state-panel";
import {
  LoadErrorBanner,
  WorkspaceDetail,
  WorkspaceDetailSkeleton,
  WorkspaceNotFound,
  type WorkspaceTab,
} from "@/widgets/workspace-detail";

const TAB_PARAM = "tab";

/** Workspace body. It lives inside `AppShell`, which owns the shared workspace list. */
export function WorkspaceContent() {
  const { workspaceId = "" } = useParams();
  const { user } = useAuth();
  const workspaceList = useWorkspacesContext();
  const projects = useProjects(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const [params, setParams] = useSearchParams();
  const [deletedName, setDeletedName] = useState<string | null>(null);
  const tab: WorkspaceTab = params.get(TAB_PARAM) === "members" ? "members" : "projects";

  function changeTab(next: WorkspaceTab) {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === "members") updated.set(TAB_PARAM, "members");
        else updated.delete(TAB_PARAM);
        return updated;
      },
      { replace: true },
    );
  }

  if (deletedName !== null) {
    return (
      <DeletedPanel
        label="Back to dashboard"
        text={`“${deletedName}” and everything in it has been removed.`}
        title="Workspace deleted"
        to="/dashboard"
      />
    );
  }

  if (workspaceList.status === "error") {
    return (
      <LoadErrorBanner
        message={workspaceList.error.message}
        onRetry={() => {
          workspaceList.reload();
          projects.reload();
          members.reload();
        }}
        requestId={workspaceList.error.requestId}
        title="Couldn’t load this workspace."
      />
    );
  }
  if (workspaceList.status === "loading") return <WorkspaceDetailSkeleton />;

  const workspace = workspaceList.workspaces.find((item) => item.id === workspaceId);
  if (!workspace || projects.status === "notfound") return <WorkspaceNotFound />;

  return (
    <WorkspaceDetail
      currentUserId={user?.id}
      members={members}
      onTabChange={changeTab}
      onWorkspaceDeleted={(name) => {
        setDeletedName(name);
        workspaceList.removeWorkspace(workspaceId);
      }}
      onWorkspaceRenamed={workspaceList.replaceWorkspace}
      projects={{ ...projects, status: projects.status }}
      tab={tab}
      workspace={workspace}
    />
  );
}
