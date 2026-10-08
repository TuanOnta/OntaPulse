import { useState, type FormEvent } from "react";

import { ActionButton, PlusIcon } from "@/shared/ui/pill-button";

import { WORKSPACE_NAME_MAX, useCreateWorkspace } from "./model/use-create-workspace";

/** Inline "name + Create workspace" form of the empty dashboard (an account without workspaces). */
export function FirstWorkspaceForm() {
  const [name, setName] = useState("");
  const { create, busy, error } = useCreateWorkspace();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await create(name);
    if (!created) document.getElementById("first-workspace-name")?.focus();
  }

  return (
    <>
      <form
        className="mt-3.5 flex w-[min(460px,100%)] gap-2.5 text-left max-[640px]:flex-col"
        noValidate
        onSubmit={submit}
      >
        <label className="sr-only" htmlFor="first-workspace-name">
          Workspace name
        </label>
        <input
          aria-describedby="first-workspace-error"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-[14px] border border-landing-border-strong bg-landing-bg/80 px-3.5 text-[16px] text-landing-text placeholder:text-landing-muted focus:border-landing-text-2 focus:shadow-[0_0_0_4px_rgb(232_241_236/0.08)] focus:outline-none aria-[invalid=true]:border-landing-danger aria-[invalid=true]:shadow-[0_0_0_4px_rgb(255_122_107/0.12)]"
          id="first-workspace-name"
          maxLength={WORKSPACE_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          placeholder="Workspace name"
          type="text"
          value={name}
        />
        <ActionButton className="flex-none" disabled={busy} type="submit">
          <PlusIcon />
          {busy ? "Creating..." : "Create workspace"}
        </ActionButton>
      </form>
      <p
        className="min-h-5 w-[min(460px,100%)] text-left text-[14px] text-landing-danger-text"
        id="first-workspace-error"
        role="alert"
      >
        {error}
      </p>
    </>
  );
}
