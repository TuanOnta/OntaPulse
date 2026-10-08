import { AppShell } from "@/app/layouts/app-shell";

import { ScanContent } from "./scan-content";

/** /workspaces/:workspaceId/projects/:projectId/monitors/:monitorId/scans/:scanId and /scans/:scanId. */
export function ScanPage() {
  return (
    <AppShell>
      <ScanContent />
    </AppShell>
  );
}
