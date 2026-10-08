import { useState } from "react";
import { toast } from "sonner";

import { canManageWorkspace } from "@/entities/workspace";
import { api } from "@/shared/api/client";
import type { Workspace } from "@/shared/types/domain";
import { DeleteDialog } from "@/shared/ui/delete-dialog";
import { ManageMenu } from "@/shared/ui/manage-menu";
import { RenameDialog } from "@/shared/ui/rename-dialog";

const DELETE_CASCADE =
  "All its projects, monitors and scan history are removed, and every member loses access.";

/**
 * "..." menu of a workspace: rename (OWNER and ADMIN) and delete (OWNER only). The API enforces the same
 * rules; this only hides or disables what the role cannot do.
 */
export function ManageWorkspace({
  workspace,
  onRenamed,
  onDeleted,
}: {
  workspace: Workspace;
  onRenamed: (workspace: Workspace) => void;
  onDeleted: (name: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!canManageWorkspace(workspace.role)) return null;

  return (
    <>
      <ManageMenu
        canDelete={workspace.role === "OWNER"}
        deleteDisabledReason="Only owners can delete a workspace."
        kind="workspace"
        onDelete={() => setDeleting(true)}
        onRename={() => setRenaming(true)}
      />
      <RenameDialog
        initialName={workspace.name}
        kind="workspace"
        onOpenChange={setRenaming}
        onSubmit={async (name) => {
          const updated = await api.renameWorkspace(workspace.id, name);
          setRenaming(false);
          onRenamed(updated);
          toast.success(`Workspace renamed to “${updated.name}”.`);
        }}
        open={renaming}
      />
      <DeleteDialog
        cascade={DELETE_CASCADE}
        kind="workspace"
        name={workspace.name}
        onConfirm={async () => {
          await api.deleteWorkspace(workspace.id);
          setDeleting(false);
          onDeleted(workspace.name);
          toast.success(`Workspace “${workspace.name}” was deleted.`);
        }}
        onOpenChange={setDeleting}
        open={deleting}
      />
    </>
  );
}
