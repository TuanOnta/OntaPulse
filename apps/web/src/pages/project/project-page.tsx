import { ProjectContent } from "./project-content";

/** /workspaces/:workspaceId/projects/:projectId: monitors of one project. Rendered inside the app shell (see `AppLayout`), which stays mounted between screens. */
export function ProjectPage() {
  return <ProjectContent />;
}
