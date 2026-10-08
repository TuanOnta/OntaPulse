import { useState, type FormEvent } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { ActionButton } from "@/shared/ui/pill-button";

import { WORKSPACE_NAME_MAX, useCreateWorkspace } from "./model/use-create-workspace";

function NewWorkspaceForm({ onCancel }: { onCancel: () => void }) {
  const [name, setName] = useState("");
  const { create, busy, error } = useCreateWorkspace();
  const over = name.length > WORKSPACE_NAME_MAX;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await create(name);
    if (!created) document.getElementById("new-workspace-name")?.focus();
  }

  return (
    <form className="flex flex-col gap-[18px] p-[26px]" noValidate onSubmit={submit}>
      <DialogTitle className="font-display text-[26px] leading-[normal] font-bold tracking-[-.01em]">
        New workspace
      </DialogTitle>
      <DialogDescription className="-mt-2.5 text-[16px] text-landing-muted">
        A workspace holds your projects, monitors and teammates. You will be its owner.
      </DialogDescription>
      <div>
        <div className="mb-1.5 flex justify-between text-[14px] font-medium text-landing-text-2">
          <label htmlFor="new-workspace-name">Workspace name</label>
          <span
            className={`font-mono text-[13px] ${over ? "text-landing-danger-text" : "text-landing-muted"}`}
          >
            {name.length} / {WORKSPACE_NAME_MAX}
          </span>
        </div>
        <input
          aria-describedby="new-workspace-hint new-workspace-error"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          autoFocus
          className="min-h-12 w-full rounded-[14px] border border-landing-border-strong bg-landing-bg/80 px-3.5 text-[16px] text-landing-text placeholder:text-landing-muted focus:border-landing-text-2 focus:shadow-[0_0_0_4px_rgb(232_241_236/0.08)] focus:outline-none aria-[invalid=true]:border-landing-danger aria-[invalid=true]:shadow-[0_0_0_4px_rgb(255_122_107/0.12)]"
          id="new-workspace-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Acme Platform"
          type="text"
          value={name}
        />
        <p className="mt-1.5 text-[14px] text-landing-muted" id="new-workspace-hint">
          You can add members once it is created.
        </p>
        <p
          className="mt-1.5 min-h-5 text-[14px] text-landing-danger-text"
          id="new-workspace-error"
          role="alert"
        >
          {error}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        <ActionButton className="max-[640px]:flex-[1_1_120px]" onClick={onCancel} variant="ghost">
          Cancel
        </ActionButton>
        <ActionButton
          className="max-[640px]:flex-[2_1_180px] max-[640px]:px-4 max-[640px]:whitespace-nowrap"
          disabled={busy}
          type="submit"
        >
          {busy ? "Creating..." : "Create workspace"}
        </ActionButton>
      </div>
    </form>
  );
}

/** "New workspace" dialog; a bottom sheet below 640 px. The form is rebuilt on every open. */
export function NewWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-[520px] gap-0 rounded-[24px] border-landing-border-strong bg-landing-surface p-0 text-landing-text shadow-[0_40px_80px_-20px_rgb(0_0_0/0.9)] sm:max-w-[520px] max-[640px]:top-auto max-[640px]:bottom-0 max-[640px]:left-0 max-[640px]:w-screen max-[640px]:max-w-none max-[640px]:translate-x-0 max-[640px]:translate-y-0 max-[640px]:rounded-t-[24px] max-[640px]:rounded-b-none max-[640px]:border-b-0"
        showCloseButton={false}
      >
        <NewWorkspaceForm onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
