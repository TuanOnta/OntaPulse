import { useAuth } from "@/app/providers/auth-provider";
import { firstName, useWorkspacesContext } from "@/entities/workspace";
import { HeartbeatDivider, OverviewHead, WorkspaceOverview } from "@/widgets/workspace-overview";

/** Dashboard body. It lives inside `AppShell`, which owns the shared workspace list. */
export function DashboardContent() {
  const { user } = useAuth();
  const { status, workspaces, error, reload } = useWorkspacesContext();

  return (
    <>
      <OverviewHead firstName={firstName(user?.name)} />
      <HeartbeatDivider />
      <WorkspaceOverview error={error} onRetry={reload} status={status} workspaces={workspaces} />
    </>
  );
}
