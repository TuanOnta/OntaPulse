import { useId, useState } from "react";

import { formatFull } from "@/shared/lib/format";
import { Switch } from "@/shared/ui/switch";

import { PathProbesDialog } from "./path-probes-dialog";

/** "On. Acknowledged <time>." or "Off. Not requested." The time is when the owner or admin acknowledged. */
export function pathProbesStateText(enabled: boolean, acknowledgedAt: string | null): string {
  if (!enabled) return "Off. Not requested.";
  return acknowledgedAt ? `On. Acknowledged ${formatFull(acknowledgedAt)}.` : "On.";
}

/**
 * Opt-in exposed-file checks. Owners and admins get the switch; turning it on goes through a confirmation with an
 * authorization checkbox, turning it off needs none. Members only read the state, because the API refuses a change
 * from them anyway. Shown whatever the security switch says: the checks run inside security scans.
 */
export function PathProbesPanel({
  canManage,
  enabled,
  acknowledgedAt,
  securityEnabled,
  saving,
  host,
  onEnable,
  onDisable,
}: {
  canManage: boolean;
  enabled: boolean;
  acknowledgedAt: string | null;
  securityEnabled: boolean;
  saving: boolean;
  host: string;
  /** Resolve when enabled; throw to keep the dialog open with the message. */
  onEnable: () => Promise<void>;
  onDisable: () => void;
}) {
  const switchId = useId();
  const [confirming, setConfirming] = useState(false);

  return (
    <section
      aria-labelledby="probes-title"
      className="mb-3.5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 rounded-[22px] border border-landing-border bg-landing-surface/[.72] p-[22px]"
    >
      <div className="min-w-0 max-w-[60ch]">
        <h3 className="font-display text-[19px] font-bold tracking-[-.01em]" id="probes-title">
          Exposed-file checks
        </h3>
        <p className="mt-0.5 text-[15px] text-landing-muted">
          Requests three fixed paths on this host and matches a known pattern. Runs with security
          scans.
          {securityEnabled ? "" : " Security checks are off, so nothing runs yet."}
        </p>
      </div>
      <div className="flex flex-col gap-1.5 max-[520px]:w-full">
        {canManage ? (
          <div className="flex items-center gap-3">
            <label
              className="cursor-pointer text-[15px] font-medium text-landing-text-2"
              htmlFor={switchId}
            >
              Exposed-file checks
            </label>
            <Switch
              checked={enabled}
              disabled={saving}
              id={switchId}
              onCheckedChange={(next) => {
                if (next) setConfirming(true);
                else onDisable();
              }}
            />
            <span aria-hidden="true" className="w-7 font-mono text-[13px] text-landing-muted">
              {enabled ? "On" : "Off"}
            </span>
          </div>
        ) : null}
        <p className="text-[14px] text-landing-muted" data-testid="path-probes-state">
          {pathProbesStateText(enabled, acknowledgedAt)}
        </p>
      </div>
      {canManage ? (
        <PathProbesDialog
          host={host}
          onConfirm={async () => {
            await onEnable();
            setConfirming(false);
          }}
          onOpenChange={setConfirming}
          open={confirming}
        />
      ) : null}
    </section>
  );
}
