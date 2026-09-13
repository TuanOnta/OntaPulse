import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, Crumbs } from "@/app/layouts/app-shell";
import { CreateProjectForm } from "@/features/projects/create-project-form";
import { WorkspaceMembers } from "@/features/workspaces/workspace-members";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { formatDate } from "@/shared/lib/format";
import type { Project, Workspace } from "@/shared/types/domain";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeading } from "@/shared/ui/page-heading";
import { Skeleton } from "@/shared/ui/skeleton";

export function WorkspacePage() {
  const { workspaceId = "" } = useParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allWorkspaces, allProjects] = await Promise.all([
        api.workspaces(),
        api.projects(workspaceId),
      ]);
      setWorkspaces(allWorkspaces);
      setProjects(allProjects);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);
  useEffect(() => {
    void load();
  }, [load]);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  return (
    <AppShell>
      <Crumbs
        items={[{ label: "Overview", to: "/dashboard" }, { label: workspace?.name ?? "Workspace" }]}
      />
      <PageHeading
        eyebrow="WORKSPACE"
        title={workspace?.name ?? "Workspace"}
        description="Projects keep related targets together so scan history remains meaningful."
      />
      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <section>
          {loading ? (
            <Skeleton className="h-52" />
          ) : projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Create a project to start grouping monitored targets."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((project) => (
                <Link
                  className="rounded-xl border border-slate-700/70 bg-surface p-5 transition-colors hover:border-signal/50"
                  key={project.id}
                  to={`/workspaces/${workspaceId}/projects/${project.id}`}
                >
                  <h2 className="font-semibold">{project.name}</h2>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-muted">
                    {project.description || "No description yet."}
                  </p>
                  <p className="mt-5 text-xs text-muted">Created {formatDate(project.createdAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
        <CreateProjectForm workspaceId={workspaceId} onCreated={load} />
      </div>
      {!loading && workspace && (
        <div className="mt-8">
          <WorkspaceMembers workspaceId={workspaceId} role={workspace.role} />
        </div>
      )}
    </AppShell>
  );
}
