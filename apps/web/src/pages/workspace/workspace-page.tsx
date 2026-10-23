import { WorkspaceContent } from "./workspace-content";

/** /workspaces/:workspaceId: projects and members of one workspace. Rendered inside the app shell (see `AppLayout`), which stays mounted between screens. */
export function WorkspacePage() {
  return <WorkspaceContent />;
}
