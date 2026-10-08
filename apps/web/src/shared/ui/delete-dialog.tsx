import { useState, type FormEvent } from "react";

import { getErrorMessage } from "@/shared/lib/api-error";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { ActionButton } from "@/shared/ui/pill-button";

/** True when the typed text matches the resource name (surrounding spaces ignored). */
export function matchesName(typed: string, name: string): boolean {
  return typed.trim() === name;
}

function DeleteForm({
  kind,
  name,
  cascade,
  onConfirm,
  onCancel,
}: {
  kind: string;
  name: string;
  cascade: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = matchesName(typed, name);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (failure) {
      setError(getErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-[18px] p-[26px]" onSubmit={submit}>
      <DialogTitle className="font-display text-[26px] leading-[normal] font-bold tracking-[-.01em]">
        Delete {kind}?
      </DialogTitle>
      <div className="flex gap-3 rounded-[14px] border border-landing-danger/35 bg-landing-danger/[.07] px-4 py-3.5 text-[15px] leading-[1.45] text-landing-text-2">
        <svg
          aria-hidden="true"
          className="mt-0.5 flex-none text-landing-danger-text"
          fill="none"
          height="20"
          viewBox="0 0 20 20"
          width="20"
        >
          <path
            d="M10 2.8 L18 16.5 H2 Z"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
          <path
            d="M10 8 V11.6 M10 13.9 V14"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
        </svg>
        <p id="delete-warning">
          <strong className="font-semibold text-landing-text">{name}</strong> will be permanently
          deleted. {cascade} This cannot be undone.
        </p>
      </div>
      <div>
        <label
          className="mb-1.5 block text-[14px] font-medium text-landing-text-2"
          htmlFor="delete-confirm"
        >
          Type the {kind} name to confirm
        </label>
        <input
          aria-describedby="delete-warning delete-error"
          autoComplete="off"
          autoFocus
          className="min-h-12 w-full rounded-[14px] border border-landing-border-strong bg-landing-bg/80 px-3.5 text-[16px] text-landing-text placeholder:text-landing-muted focus:border-landing-text-2 focus:shadow-[0_0_0_4px_rgb(232_241_236/0.08)] focus:outline-none"
          id="delete-confirm"
          onChange={(event) => setTyped(event.target.value)}
          placeholder={name}
          spellCheck={false}
          type="text"
          value={typed}
        />
        <p
          className="mt-1.5 min-h-5 text-[14px] text-landing-danger-text"
          id="delete-error"
          role="alert"
        >
          {error}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        <ActionButton onClick={onCancel} variant="ghost">
          Cancel
        </ActionButton>
        <ActionButton disabled={!ready || busy} type="submit" variant="dangerSolid">
          {busy ? "Deleting..." : `Delete ${kind}`}
        </ActionButton>
      </div>
    </form>
  );
}

/** Delete confirmation: the button stays disabled until the exact name is typed. Rebuilt on every open. */
export function DeleteDialog({
  open,
  onOpenChange,
  kind,
  name,
  cascade,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: string;
  name: string;
  /** What else disappears with it, one sentence. */
  cascade: string;
  /** Throw to keep the dialog open; the error message is shown under the field. */
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby="delete-warning"
        className="max-w-[520px] gap-0 rounded-[24px] border-landing-border-strong bg-landing-surface p-0 text-landing-text shadow-[0_40px_80px_-20px_rgb(0_0_0/0.9)] sm:max-w-[520px]"
        showCloseButton={false}
      >
        <DeleteForm
          cascade={cascade}
          kind={kind}
          name={name}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}
