import { AppShell, Crumbs } from "@/app/layouts/app-shell";
import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";
import { PageHeading } from "@/shared/ui/page-heading";

export function WorkspaceCreatePage() {
  return (
    <AppShell>
      <Crumbs items={[{ label: "Overview", to: "/dashboard" }, { label: "New workspace" }]} />
      <div className="mx-auto max-w-lg">
        <PageHeading
          title="Create a workspace"
          description="A workspace groups the projects and people responsible for your monitoring."
        />
        <CreateWorkspaceForm />
      </div>
    </AppShell>
  );
}
