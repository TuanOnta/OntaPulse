import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";

import { api } from "@/shared/api/client";
import type { Workspace } from "@/shared/types/domain";

export function WorkspaceNavigation() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadWorkspaces() {
      try {
        const result = await api.workspaces();
        if (!ignore) setWorkspaces(result);
      } catch {
        if (!ignore) setFailed(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadWorkspaces();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="mt-6 hidden lg:block" aria-labelledby="workspace-navigation-title">
      <div className="mb-2 flex items-center justify-between px-3">
        <h2
          id="workspace-navigation-title"
          className="text-xs font-medium uppercase tracking-wide text-muted"
        >
          Workspaces
        </h2>
        {workspaces.length > 0 && <span className="text-xs text-muted">{workspaces.length}</span>}
      </div>
      {loading ? (
        <div className="space-y-2 px-3 py-2" aria-label="Loading workspaces">
          <div className="h-4 w-3/4 animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/5 motion-reduce:animate-none" />
        </div>
      ) : failed ? (
        <p className="px-3 py-2 text-xs leading-5 text-muted">Workspaces are unavailable.</p>
      ) : workspaces.length === 0 ? (
        <p className="px-3 py-2 text-xs leading-5 text-muted">No workspaces yet.</p>
      ) : (
        <nav className="space-y-1" aria-label="Workspace navigation">
          {workspaces.map((workspace) => (
            <NavLink
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${isActive ? "bg-signal/15 text-signal" : "text-muted hover:bg-white/5 hover:text-ink"}`
              }
              key={workspace.id}
              to={`/workspaces/${workspace.id}`}
            >
              <Building2 className="size-4 shrink-0" />
              <span className="truncate">{workspace.name}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </section>
  );
}
