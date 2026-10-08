import { AppShell } from "@/app/layouts/app-shell";

import { MonitorContent } from "./monitor-content";

/** /workspaces/:workspaceId/projects/:projectId/monitors/:monitorId inside the app shell. */
export function MonitorPage() {
  return (
    <AppShell>
      <MonitorContent />
    </AppShell>
  );
}
