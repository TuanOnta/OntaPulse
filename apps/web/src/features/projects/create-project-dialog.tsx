import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { ActionButton, PlusIcon } from "@/shared/ui/pill-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";

export const PROJECT_NAME_MAX = 120;
export const PROJECT_DESCRIPTION_MAX = 500;

const FIELD =
  "w-full rounded-[14px] border border-landing-border-strong bg-landing-bg/80 px-3.5 text-[16px] text-landing-text placeholder:text-landing-muted focus:border-landing-text-2 focus:shadow-[0_0_0_4px_rgb(232_241_236/0.08)] focus:outline-none aria-[invalid=true]:border-landing-danger aria-[invalid=true]:shadow-[0_0_0_4px_rgb(255_122_107/0.12)]";
const LABEL = "mb-1.5 flex justify-between text-[14px] font-medium text-landing-text-2";
const ERROR = "mt-1.5 min-h-5 text-[14px] text-landing-danger-text";

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={`font-mono text-[13px] ${value > max ? "text-landing-danger-text" : "text-landing-muted"}`}
    >
      {value} / {max}
    </span>
  );
}

type FieldErrors = { name?: string; description?: string };

export function validateProject(name: string, description: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name) errors.name = "Project name is required.";
  else if (name.length > PROJECT_NAME_MAX) errors.name = "Use 120 characters or fewer.";
  if (description.length > PROJECT_DESCRIPTION_MAX) {
    errors.description = "Use 500 characters or fewer.";
  }
  return errors;
}

/** "New project" dialog (`POST /workspaces/:id/projects`, OWNER and ADMIN only; the API decides). */
export function CreateProjectDialog({
  open,
  onOpenChange,
  workspaceId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  function handleOpenChange(next: boolean) {
    if (next) {
      setName("");
      setDescription("");
      setErrors({});
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const found = validateProject(trimmedName, trimmedDescription);
    setErrors(found);
    if (found.name || found.description) {
      document.getElementById(found.name ? "project-name" : "project-description")?.focus();
      return;
    }
    setBusy(true);
    try {
      await api.createProject(workspaceId, trimmedName, trimmedDescription);
      toast.success(`Project “${trimmedName}” created.`);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="max-w-[520px] gap-0 rounded-[24px] border-landing-border-strong bg-landing-surface p-0 text-landing-text shadow-[0_40px_80px_-20px_rgb(0_0_0/0.9)] sm:max-w-[520px]"
        showCloseButton={false}
      >
        <form className="flex flex-col gap-[18px] p-[26px]" noValidate onSubmit={submit}>
          <DialogTitle className="font-display text-[26px] leading-[normal] font-bold tracking-[-.01em]">
            New project
          </DialogTitle>
          <DialogDescription className="-mt-2.5 text-[16px] text-landing-muted">
            Projects group related monitors, for example one per product or environment.
          </DialogDescription>
          <div>
            <div className={LABEL}>
              <label htmlFor="project-name">Name</label>
              <Counter max={PROJECT_NAME_MAX} value={name.length} />
            </div>
            <input
              aria-describedby="project-name-error"
              aria-invalid={errors.name ? true : undefined}
              autoComplete="off"
              className={`${FIELD} min-h-12`}
              id="project-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Marketing site"
              type="text"
              value={name}
            />
            <p className={ERROR} id="project-name-error" role="alert">
              {errors.name}
            </p>
          </div>
          <div>
            <div className={LABEL}>
              <label htmlFor="project-description">
                Description <span className="font-normal text-landing-muted">(optional)</span>
              </label>
              <Counter max={PROJECT_DESCRIPTION_MAX} value={description.length} />
            </div>
            <textarea
              aria-describedby="project-description-error"
              aria-invalid={errors.description ? true : undefined}
              className={`${FIELD} min-h-24 resize-y py-3 leading-[1.45]`}
              id="project-description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does this project cover?"
              value={description}
            />
            <p className={ERROR} id="project-description-error" role="alert">
              {errors.description}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap justify-end gap-2.5">
            <ActionButton onClick={() => handleOpenChange(false)} variant="ghost">
              Cancel
            </ActionButton>
            <ActionButton disabled={busy} type="submit">
              <PlusIcon />
              {busy ? "Creating..." : "Create project"}
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
