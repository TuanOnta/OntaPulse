import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

export function CreateProjectForm({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    try {
      await api.createProject(
        workspaceId,
        String(values.get("name")),
        String(values.get("description")),
      );
      form.reset();
      toast.success("Project created");
      await onCreated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="h-fit rounded-xl border border-slate-700/70 bg-surface p-5" onSubmit={submit}>
      <h2 className="font-semibold">New project</h2>
      <p className="mt-1 text-sm leading-5 text-muted">
        Name the service or product you want to track.
      </p>
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="project-name">Project name</Label>
          <Input className="mt-2" id="project-name" name="name" maxLength={120} required />
        </div>
        <div>
          <Label htmlFor="project-description">
            Description <span className="text-muted">optional</span>
          </Label>
          <Textarea
            className="mt-2"
            id="project-description"
            name="description"
            maxLength={500}
            rows={3}
          />
        </div>
        <Button className="w-full" disabled={busy}>
          {busy ? "Creating..." : "Create project"}
        </Button>
      </div>
    </form>
  );
}
