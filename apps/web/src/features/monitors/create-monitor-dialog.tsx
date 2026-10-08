import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  INTERVAL_DEFAULT_SECONDS,
  INTERVAL_MAX_SECONDS,
  INTERVAL_MIN_SECONDS,
  INTERVAL_PRESETS,
  deriveMonitorName,
  humanInterval,
  splitUrl,
  validateMonitor,
  type MonitorFieldErrors,
} from "@/entities/monitor";
import { ApiError, api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { ActionButton } from "@/shared/ui/pill-button";
import { cn } from "cn";

const FIELD =
  "w-full min-h-12 rounded-[14px] border border-landing-border-strong bg-landing-bg/80 px-3.5 text-[16px] text-landing-text placeholder:text-landing-muted focus:border-landing-text-2 focus:shadow-[0_0_0_4px_rgb(232_241_236/0.08)] focus:outline-none aria-[invalid=true]:border-landing-danger aria-[invalid=true]:shadow-[0_0_0_4px_rgb(255_122_107/0.12)]";
const LABEL = "mb-1.5 block text-[14px] font-medium text-landing-text-2";
const HINT = "mt-1.5 text-[14px] text-landing-muted";
const ERROR = "mt-1.5 min-h-5 text-[14px] text-landing-danger-text";

/** "Add monitor" dialog (`POST /projects/:id/monitors`, OWNER and ADMIN; the API decides). */
export function CreateMonitorDialog({
  open,
  onOpenChange,
  projectId,
  existingUrls,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingUrls: readonly string[];
  onCreated: () => void;
}) {
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(String(INTERVAL_DEFAULT_SECONDS));
  const [errors, setErrors] = useState<MonitorFieldErrors>({});
  const [busy, setBusy] = useState(false);
  const seconds = Number(interval);

  function handleOpenChange(next: boolean) {
    if (next) {
      setUrl("");
      setInterval(String(INTERVAL_DEFAULT_SECONDS));
      setErrors({});
    }
    onOpenChange(next);
  }

  function focusFirstError(found: MonitorFieldErrors) {
    document.getElementById(found.url ? "monitor-url" : "monitor-interval")?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUrl = url.trim();
    const found = validateMonitor(targetUrl, seconds, existingUrls);
    setErrors(found);
    if (found.url || found.interval) {
      focusFirstError(found);
      return;
    }
    setBusy(true);
    try {
      await api.createMonitor(projectId, {
        name: deriveMonitorName(targetUrl),
        targetUrl,
        intervalSeconds: seconds,
      });
      toast.success(`Monitor added for ${splitUrl(targetUrl).host}.`);
      onOpenChange(false);
      onCreated();
    } catch (error) {
      if (error instanceof ApiError) {
        const next: MonitorFieldErrors = { url: error.message };
        setErrors(next);
        focusFirstError(next);
      } else {
        toast.error(getErrorMessage(error));
      }
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
            Add monitor
          </DialogTitle>
          <DialogDescription className="-mt-2.5 text-[16px] text-landing-muted">
            OntaPulse checks this URL with an HTTP GET on the interval you choose.
          </DialogDescription>
          <div>
            <label className={LABEL} htmlFor="monitor-url">
              Target URL
            </label>
            <input
              aria-describedby="monitor-url-hint monitor-url-error"
              aria-invalid={errors.url ? true : undefined}
              autoComplete="off"
              className={FIELD}
              id="monitor-url"
              inputMode="url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/health"
              spellCheck={false}
              type="url"
              value={url}
            />
            <p className={HINT} id="monitor-url-hint">
              Public http or https URLs only. Private network addresses are rejected and redirects
              are not followed.
            </p>
            <p className={ERROR} id="monitor-url-error" role="alert">
              {errors.url}
            </p>
          </div>
          <div>
            <label className={LABEL} htmlFor="monitor-interval">
              Check interval
            </label>
            <div className="grid grid-cols-2 items-start gap-3 max-[520px]:grid-cols-1">
              <input
                aria-describedby="monitor-interval-error"
                aria-invalid={errors.interval ? true : undefined}
                className={FIELD}
                id="monitor-interval"
                inputMode="numeric"
                max={INTERVAL_MAX_SECONDS}
                min={INTERVAL_MIN_SECONDS}
                onChange={(event) => setInterval(event.target.value)}
                step={1}
                type="number"
                value={interval}
              />
              <span
                aria-live="polite"
                className="self-center pt-[22px] font-mono text-[14px] text-landing-muted max-[520px]:pt-0"
              >
                {Number.isFinite(seconds) && seconds >= 1 ? humanInterval(seconds) : ""}
              </span>
            </div>
            <div aria-label="Interval presets" className="mt-2.5 flex flex-wrap gap-2" role="group">
              {INTERVAL_PRESETS.map(([value, label]) => (
                <button
                  aria-pressed={seconds === value}
                  className={cn(
                    "min-h-10 cursor-pointer rounded-full border px-4 text-[15px] font-medium transition-colors duration-200 motion-reduce:transition-none",
                    seconds === value
                      ? "border-landing-muted bg-landing-surface-2 text-landing-text"
                      : "border-landing-border text-landing-text-2 hover:border-landing-border-strong hover:text-landing-text",
                  )}
                  key={value}
                  onClick={() => setInterval(String(value))}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={HINT}>In seconds, from 60 to 86,400.</p>
            <p className={ERROR} id="monitor-interval-error" role="alert">
              {errors.interval}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap justify-end gap-2.5">
            <ActionButton onClick={() => handleOpenChange(false)} variant="ghost">
              Cancel
            </ActionButton>
            <ActionButton disabled={busy} type="submit">
              {busy ? "Adding..." : "Add monitor"}
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
