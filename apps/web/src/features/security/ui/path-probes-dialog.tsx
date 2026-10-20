import { useId, useState, type FormEvent } from "react";

import { ApiError } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { ActionButton } from "@/shared/ui/pill-button";

/** The fixed paths the check requests (docs/security-checks.md section 8). Shown so the user knows what they allow. */
const PROBE_PATHS = ["/.env", "/.git/HEAD", "/.git/config"] as const;

type SubmitError = { message: string; requestId?: string };

function ConfirmForm({
  host,
  onConfirm,
  onCancel,
}: {
  host: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const checkboxId = useId();
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (failure) {
      setError({
        message: getErrorMessage(failure),
        requestId: failure instanceof ApiError ? failure.payload.requestId : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-[18px] p-[26px]" onSubmit={submit}>
      <DialogTitle className="font-display text-[26px] leading-[normal] font-bold tracking-[-.01em]">
        Check for exposed files?
      </DialogTitle>
      <DialogDescription className="text-[16px] leading-[1.5] text-landing-text-2">
        OntaPulse will request three fixed paths on{" "}
        <strong className="font-semibold text-landing-text">{host}</strong>. It reads at most 4 KB
        of each response to match a known pattern. Only the path, the HTTP status and the pattern
        name are stored, never the content.
      </DialogDescription>
      <ul
        aria-label="Requested paths"
        className="m-0 flex list-none flex-col gap-1 rounded-[14px] border border-landing-border bg-landing-bg/60 px-4 py-3 font-mono text-[14px] text-landing-text-2"
      >
        {PROBE_PATHS.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={authorized}
          disabled={busy}
          id={checkboxId}
          onCheckedChange={(value) => setAuthorized(value === true)}
        />
        <label
          className="cursor-pointer text-[15px] leading-[1.45] text-landing-text"
          htmlFor={checkboxId}
        >
          I am authorized to test {host}.
        </label>
      </div>
      <div className="min-h-5 text-[14px] text-landing-danger-text" role="alert">
        {error ? (
          <>
            <p>{error.message}</p>
            {error.requestId ? (
              <p className="font-mono text-landing-muted">Request ID: {error.requestId}</p>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2.5 max-[520px]:flex-col-reverse">
        <ActionButton disabled={busy} onClick={onCancel} variant="ghost">
          Cancel
        </ActionButton>
        <ActionButton disabled={!authorized || busy} type="submit" variant="primary">
          {busy ? "Turning on…" : "Turn on"}
        </ActionButton>
      </div>
    </form>
  );
}

/**
 * Opt-in for the exposed-file checks. Nothing is sent until the user confirms with the authorization checkbox
 * checked; the form is rebuilt on every open so the checkbox never starts checked. Throw from `onConfirm` to
 * keep the dialog open and show the message.
 */
export function PathProbesDialog({
  open,
  onOpenChange,
  host,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  host: string;
  onConfirm: () => Promise<void>;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-w-[520px] gap-0 rounded-[24px] border-landing-border-strong bg-landing-surface p-0 text-landing-text shadow-[0_40px_80px_-20px_rgb(0_0_0/0.9)] sm:max-w-[520px]"
        showCloseButton={false}
      >
        <ConfirmForm host={host} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  );
}
