import { AppShell } from "@/app/layouts/app-shell";

import { WorkspaceContent } from "./workspace-content";

/** /workspaces/:workspaceId: projects and members of one workspace inside the app shell. */
export function WorkspacePage() {
  return (
    <AppShell>
      <WorkspaceContent />
    </AppShell>
  );
}
