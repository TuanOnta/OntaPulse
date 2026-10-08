import { useState, type FormEvent } from "react";

import { getErrorMessage } from "@/shared/lib/api-error";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { ActionButton } from "@/shared/ui/pill-button";

export const RENAME_NAME_MAX = 120;
export const RENAME_DESCRIPTION_MAX = 500;

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

type Errors = { name?: string; description?: string };

export function validateRename(name: string, description: string, kind: string): Errors {
  const errors: Errors = {};
  if (!name) errors.name = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} name is required.`;
  else if (name.length > RENAME_NAME_MAX) errors.name = "Use 120 characters or fewer.";
  if (description.length > RENAME_DESCRIPTION_MAX) {
    errors.description = "Use 500 characters or fewer.";
  }
  return errors;
}

type FormProps = {
  kind: string;
  initialName: string;
  initialDescription: string;
  withDescription: boolean;
  onSubmit: (name: string, description: string) => Promise<void>;
  onCancel: () => void;
};

function RenameForm({
  kind,
  initialName,
  initialDescription,
  withDescription,
  onSubmit,
  onCancel,
}: FormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const found = validateRename(trimmedName, withDescription ? trimmedDescription : "", kind);
    setErrors(found);
    if (found.name || found.description) {
      document.getElementById(found.name ? "rename-name" : "rename-description")?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSubmit(trimmedName, trimmedDescription);
    } catch (error) {
      setErrors({ name: getErrorMessage(error) });
      document.getElementById("rename-name")?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-[18px] p-[26px]" noValidate onSubmit={submit}>
      <DialogTitle className="font-display text-[26px] leading-[normal] font-bold tracking-[-.01em]">
        Rename {kind}
      </DialogTitle>
      <div>
        <div className={LABEL}>
          <label htmlFor="rename-name">Name</label>
          <Counter max={RENAME_NAME_MAX} value={name.length} />
        </div>
        <input
          aria-describedby="rename-name-error"
          aria-invalid={errors.name ? true : undefined}
          autoComplete="off"
          autoFocus
          className={`${FIELD} min-h-12`}
          id="rename-name"
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          type="text"
          value={name}
        />
        <p className={ERROR} id="rename-name-error" role="alert">
          {errors.name}
        </p>
      </div>
      {withDescription ? (
        <div>
          <div className={LABEL}>
            <label htmlFor="rename-description">
              Description <span className="font-normal text-landing-muted">(optional)</span>
            </label>
            <Counter max={RENAME_DESCRIPTION_MAX} value={description.length} />
          </div>
          <textarea
            aria-describedby="rename-description-error"
            aria-invalid={errors.description ? true : undefined}
            className={`${FIELD} min-h-24 resize-y py-3 leading-[1.45]`}
            id="rename-description"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
          <p className={ERROR} id="rename-description-error" role="alert">
            {errors.description}
          </p>
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        <ActionButton onClick={onCancel} variant="ghost">
          Cancel
        </ActionButton>
        <ActionButton disabled={busy} type="submit">
          {busy ? "Saving..." : "Save changes"}
        </ActionButton>
      </div>
    </form>
  );
}

/** Rename dialog (name, plus a description when `withDescription`). The form is rebuilt on every open. */
export function RenameDialog({
  open,
  onOpenChange,
  kind,
  initialName,
  initialDescription = "",
  withDescription = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: string;
  initialName: string;
  initialDescription?: string;
  withDescription?: boolean;
  /** Throw to keep the dialog open; the error message is shown under the name. */
  onSubmit: (name: string, description: string) => Promise<void>;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-[520px] gap-0 rounded-[24px] border-landing-border-strong bg-landing-surface p-0 text-landing-text shadow-[0_40px_80px_-20px_rgb(0_0_0/0.9)] sm:max-w-[520px]"
        showCloseButton={false}
      >
        <RenameForm
          initialDescription={initialDescription}
          initialName={initialName}
          kind={kind}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          withDescription={withDescription}
        />
      </DialogContent>
    </Dialog>
  );
}
