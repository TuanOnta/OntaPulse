import { useState } from "react";
import { toast } from "sonner";

import { canManageWorkspace } from "@/entities/workspace";
import { api } from "@/shared/api/client";
import type { Project, WorkspaceRole } from "@/shared/types/domain";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { ManageMenu } from "@/shared/ui/manage-menu";
import { RenameDialog } from "@/shared/ui/rename-dialog";

const DELETE_CASCADE = "All its monitors and their scan history are removed.";

/**
 * "..." menu of a project: rename (name and description) and delete, for OWNER and ADMIN. `role` is the
 * user's role in the parent workspace. The API enforces the same rules.
 */
export function ManageProject({
  project,
  role,
  onRenamed,
  onDeleted,
}: {
  project: Project;
  role?: WorkspaceRole;
  onRenamed: (project: Project) => void;
  onDeleted: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!canManageWorkspace(role)) return null;

  return (
    <>
      <ManageMenu
        canDelete
        deleteDisabledReason=""
        kind="project"
        onDelete={() => setDeleting(true)}
        onRename={() => setRenaming(true)}
      />
      <RenameDialog
        initialDescription={project.description ?? ""}
        initialName={project.name}
        kind="project"
        onOpenChange={setRenaming}
        onSubmit={async (name, description) => {
          const updated = await api.updateProject(project.id, { name, description });
          setRenaming(false);
          onRenamed(updated);
          toast.success(`Project renamed to “${updated.name}”.`);
        }}
        open={renaming}
        withDescription
      />
      <DeleteDialog
        cascade={DELETE_CASCADE}
        kind="project"
        name={project.name}
        onConfirm={async () => {
          await api.deleteProject(project.id);
          setDeleting(false);
          onDeleted(project.name);
          toast.success(`Project “${project.name}” was deleted.`);
        }}
        onOpenChange={setDeleting}
        open={deleting}
      />
    </>
  );
}
