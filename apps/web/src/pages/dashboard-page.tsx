import { ArrowRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/app/layouts/app-shell";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { formatDate } from "@/shared/lib/format";
import type { Workspace } from "@/shared/types/domain";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeading } from "@/shared/ui/page-heading";
import { Skeleton } from "@/shared/ui/skeleton";

export function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .workspaces()
      .then(setWorkspaces)
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <PageHeading
        eyebrow="OPERATIONS"
        title="Your monitoring workspaces"
        description="Choose a workspace to inspect projects, targets, and the scans behind them."
        action={
          <Button asChild>
            <Link to="/workspaces/new">
              <Plus /> New workspace
            </Link>
          </Button>
        }
      />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Skeleton className="h-40" key={key} />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <EmptyState
          title="No workspaces yet"
          description="Create a workspace before you add a project or monitor a target."
          action={
            <Button asChild>
              <Link to="/workspaces/new">
                <Plus /> Create workspace
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => (
            <Link
              className="group rounded-xl border border-slate-700/70 bg-surface p-5 transition-colors hover:border-signal/50 hover:bg-surface-raised"
              key={workspace.id}
              to={`/workspaces/${workspace.id}`}
            >
              <div className="flex items-start justify-between">
                <span className="grid size-9 place-items-center rounded-lg bg-signal/10 text-sm font-semibold text-signal">
                  {workspace.name.slice(0, 1).toUpperCase()}
                </span>
                <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-signal" />
              </div>
              <h2 className="mt-7 font-semibold">{workspace.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {workspace.role?.toLowerCase() ?? "member"} access · joined{" "}
                {formatDate(workspace.joinedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
