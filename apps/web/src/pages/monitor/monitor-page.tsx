import { MonitorContent } from "./monitor-content";

/** /workspaces/:workspaceId/projects/:projectId/monitors/:monitorId. Rendered inside the app shell (see `AppLayout`), which stays mounted between screens. */
export function MonitorPage() {
  return <MonitorContent />;
}
