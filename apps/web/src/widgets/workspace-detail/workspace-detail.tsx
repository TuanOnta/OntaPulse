import { useMemo, useState } from "react";

import type { ProjectsError } from "@/entities/project";
import { canManageWorkspace, workspaceLook, type MembersError } from "@/entities/workspace";
import { CreateProjectDialog } from "@/features/projects/create-project-dialog";
import { MembersPane } from "@/features/workspaces/members-pane";
import type { Project, Workspace, WorkspaceMember } from "@/shared/types/domain";

import { ProjectsPane } from "./ui/projects-pane";
import { WorkspaceCrumbs } from "./ui/workspace-crumbs";
import { WorkspaceHero } from "./ui/workspace-hero";
import { WorkspaceTabs, type WorkspaceTab } from "./ui/workspace-tabs";

export type WorkspaceDetailProps = {
  workspace: Workspace;
  currentUserId?: string;
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  projects: {
    status: "loading" | "ready" | "error";
    projects: Project[];
    error: ProjectsError | null;
    reload: () => void;
  };
  members: {
    status: "loading" | "ready" | "error";
    members: WorkspaceMember[];
    error: MembersError | null;
    reload: () => void;
    addMember: (member: WorkspaceMember) => void;
    replaceMember: (member: WorkspaceMember) => void;
    removeMember: (id: string) => void;
  };
};

/** Workspace screen body: breadcrumb, hero, tabs and the two panes with their dialogs. */
export function WorkspaceDetail({
  workspace,
  currentUserId,
  tab,
  onTabChange,
  projects,
  members,
}: WorkspaceDetailProps) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [focusEmailToken, setFocusEmailToken] = useState(0);
  const look = useMemo(() => workspaceLook(workspace), [workspace]);
  const manage = canManageWorkspace(workspace.role);

  function addMember() {
    onTabChange("members");
    setFocusEmailToken((value) => value + 1);
  }

  return (
    <>
      <WorkspaceCrumbs name={workspace.name} />
      <WorkspaceHero
        canManage={manage}
        createdAt={workspace.createdAt}
        memberCount={members.status === "ready" ? members.members.length : null}
        name={workspace.name}
        onAddMember={addMember}
        onNewProject={() => setProjectDialogOpen(true)}
        projectCount={projects.status === "ready" ? projects.projects.length : null}
        role={workspace.role}
        wave={look.wave}
      />
      <WorkspaceTabs
        counts={{
          projects: projects.status === "ready" ? projects.projects.length : null,
          members: members.status === "ready" ? members.members.length : null,
        }}
        onChange={onTabChange}
        tab={tab}
      >
        {tab === "projects" ? (
          <ProjectsPane
            canManage={manage}
            error={projects.error}
            onNewProject={() => setProjectDialogOpen(true)}
            onReload={projects.reload}
            projects={projects.projects}
            status={projects.status}
            workspaceId={workspace.id}
          />
        ) : (
          <MembersPane
            currentUserId={currentUserId}
            error={members.error}
            focusEmailToken={focusEmailToken}
            members={members.members}
            onAdded={members.addMember}
            onChanged={members.replaceMember}
            onReload={members.reload}
            onRemoved={members.removeMember}
            role={workspace.role}
            status={members.status}
            workspaceId={workspace.id}
          />
        )}
      </WorkspaceTabs>
      <CreateProjectDialog
        onCreated={() => {
          onTabChange("projects");
          projects.reload();
        }}
        onOpenChange={setProjectDialogOpen}
        open={projectDialogOpen}
        workspaceId={workspace.id}
      />
    </>
  );
}
