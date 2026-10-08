import { AppShell } from "@/app/layouts/app-shell";

import { ProjectContent } from "./project-content";

/** /workspaces/:workspaceId/projects/:projectId: monitors of one project inside the app shell. */
export function ProjectPage() {
  return (
    <AppShell>
      <ProjectContent />
    </AppShell>
  );
}
