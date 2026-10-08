import { useMemo, useState } from "react";

import {
  ROLE_LABEL,
  countByRole,
  filterWorkspaces,
  summarizeWorkspaces,
  type RoleFilter,
  type WorkspacesError,
} from "@/entities/workspace";
import type { Workspace } from "@/shared/types/domain";

import { CreateWorkspaceCard } from "./create-workspace-card";
import { OverviewStats } from "./overview-stats";
import { OverviewEmpty, OverviewError, OverviewNoResults } from "./state-panels";
import { WorkspaceCard } from "./workspace-card";
import { WorkspaceGridSkeleton } from "./workspace-grid-skeleton";
import { WorkspaceToolbar } from "./workspace-toolbar";

type Props = {
  status: "loading" | "ready" | "error";
  workspaces: readonly Workspace[];
  error: WorkspacesError | null;
  onRetry: () => void;
};

const GRID =
  "grid [perspective:1200px] grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 max-[520px]:grid-cols-[minmax(0,1fr)]";

/** Stats, filters and workspace cards, with the loading, empty, error and no-results states. */
export function WorkspaceOverview({ status, workspaces, error, onRetry }: Props) {
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [query, setQuery] = useState("");

  const summary = useMemo(() => summarizeWorkspaces(workspaces), [workspaces]);
  const counts = useMemo(() => countByRole(workspaces), [workspaces]);
  const visible = useMemo(
    () => filterWorkspaces(workspaces, role, query),
    [workspaces, role, query],
  );

  function clearFilters() {
    setRole("ALL");
    setQuery("");
  }

  const hasWorkspaces = status === "ready" && workspaces.length > 0;
  const trimmedQuery = query.trim();

  return (
    <div className="[&_a:focus-visible]:outline-landing-text [&_a:focus-visible]:outline-offset-[3px] [&_button:focus-visible]:outline-landing-text [&_button:focus-visible]:outline-offset-[3px]">
      {status === "error" && error ? <OverviewError error={error} onRetry={onRetry} /> : null}
      {hasWorkspaces ? (
        <>
          <OverviewStats summary={summary} />
          <WorkspaceToolbar
            counts={counts}
            onQueryChange={setQuery}
            onRoleChange={setRole}
            query={query}
            role={role}
          />
        </>
      ) : null}
      <div aria-live="polite">
        {status === "loading" ? <WorkspaceGridSkeleton /> : null}
        {status === "ready" && workspaces.length === 0 ? <OverviewEmpty /> : null}
        {hasWorkspaces && visible.length === 0 ? (
          <OverviewNoResults onClear={clearFilters} term={trimmedQuery || ROLE_LABEL[role]} />
        ) : null}
        {hasWorkspaces && visible.length > 0 ? (
          <div className={GRID}>
            {visible.map((workspace, index) => (
              <WorkspaceCard index={index} key={workspace.id} workspace={workspace} />
            ))}
            {role === "ALL" && !trimmedQuery ? (
              <CreateWorkspaceCard index={visible.length + 4} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
