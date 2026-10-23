import { ScanContent } from "./scan-content";

/** /workspaces/:workspaceId/projects/:projectId/monitors/:monitorId/scans/:scanId and /scans/:scanId. Rendered inside the app shell (see `AppLayout`), which stays mounted between screens. */
export function ScanPage() {
  return <ScanContent />;
}
