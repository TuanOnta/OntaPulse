import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, Crumbs } from "@/app/layouts/app-shell";
import { CreateMonitorForm } from "@/features/monitors/create-monitor-form";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { formatDate, formatInterval } from "@/shared/lib/format";
import type { Monitor, Project } from "@/shared/types/domain";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeading } from "@/shared/ui/page-heading";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export function ProjectPage() {
  const { workspaceId = "", projectId = "" } = useParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectList, monitorList] = await Promise.all([
        api.projects(workspaceId),
        api.monitors(projectId),
      ]);
      setProjects(projectList);
      setMonitors(monitorList);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [projectId, workspaceId]);
  useEffect(() => {
    void load();
  }, [load]);
  const project = projects.find((item) => item.id === projectId);
  return (
    <AppShell>
      <Crumbs
        items={[
          { label: "Overview", to: "/dashboard" },
          { label: "Workspace", to: `/workspaces/${workspaceId}` },
          { label: project?.name ?? "Project" },
        ]}
      />
      <PageHeading
        eyebrow="PROJECT"
        title={project?.name ?? "Project"}
        description={
          project?.description || "Track targets and inspect each scan when something changes."
        }
      />
      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
        <section>
          {loading ? (
            <Skeleton className="h-56" />
          ) : monitors.length === 0 ? (
            <EmptyState
              title="No monitored targets"
              description="Add your first HTTP or HTTPS target to begin collecting scan results."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700/70 bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monitors.map((monitor) => (
                    <TableRow key={monitor.id}>
                      <TableCell>
                        <Link
                          className="block"
                          to={`/workspaces/${workspaceId}/projects/${projectId}/monitors/${monitor.id}`}
                        >
                          <span className="font-medium hover:text-signal">{monitor.name}</span>
                          <span className="mt-1 block max-w-100 truncate text-xs text-muted">
                            {monitor.targetUrl}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted">
                        {formatInterval(monitor.intervalSeconds)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted">
                        {formatDate(monitor.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
        <CreateMonitorForm projectId={projectId} onCreated={load} />
      </div>
    </AppShell>
  );
}
