import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function CreateWorkspaceForm() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name"));
    setBusy(true);
    try {
      const workspace = await api.createWorkspace(name);
      toast.success("Workspace created");
      navigate(`/workspaces/${workspace.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="rounded-xl border border-slate-700/70 bg-surface p-6" onSubmit={submit}>
      <Label htmlFor="workspace-name">Workspace name</Label>
      <Input
        id="workspace-name"
        className="mt-2"
        name="name"
        maxLength={120}
        required
        placeholder="Acme engineering"
      />
      <div className="mt-6 flex justify-end">
        <Button disabled={busy}>{busy ? "Creating..." : "Create workspace"}</Button>
      </div>
    </form>
  );
}
