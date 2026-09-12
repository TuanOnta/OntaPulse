import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

export function CreateMonitorForm({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    try {
      await api.createMonitor(projectId, {
        name: String(values.get("name")),
        targetUrl: String(values.get("targetUrl")),
        intervalSeconds: Number(values.get("intervalSeconds")),
      });
      form.reset();
      toast.success("Monitor created");
      await onCreated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="h-fit rounded-xl border border-slate-700/70 bg-surface p-5" onSubmit={submit}>
      <h2 className="font-semibold">Add monitor</h2>
      <p className="mt-1 text-sm leading-5 text-muted">OntaPulse performs safe HTTP GET checks.</p>
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="monitor-name">Name</Label>
          <Input
            className="mt-2"
            id="monitor-name"
            name="name"
            maxLength={120}
            required
            placeholder="Marketing homepage"
          />
        </div>
        <div>
          <Label htmlFor="target-url">Target URL</Label>
          <Input
            className="mt-2"
            id="target-url"
            name="targetUrl"
            type="url"
            required
            placeholder="https://example.com"
          />
        </div>
        <div>
          <Label htmlFor="interval">Scan interval</Label>
          <Select name="intervalSeconds" defaultValue="300">
            <SelectTrigger className="mt-2" id="interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="60">Every minute</SelectItem>
              <SelectItem value="300">Every 5 minutes</SelectItem>
              <SelectItem value="900">Every 15 minutes</SelectItem>
              <SelectItem value="3600">Every hour</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" disabled={busy}>
          {busy ? (
            "Adding..."
          ) : (
            <>
              <Plus /> Add monitor
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
