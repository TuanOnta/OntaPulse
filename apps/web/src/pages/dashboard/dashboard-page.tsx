import { AppShell } from "@/app/layouts/app-shell";

import { DashboardContent } from "./dashboard-content";

/** /dashboard: overview of the signed-in user's workspaces inside the app shell. */
export function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
