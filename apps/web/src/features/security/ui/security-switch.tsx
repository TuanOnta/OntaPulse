import { useId } from "react";

import { Switch } from "@/shared/ui/switch";

const COPY = {
  security: {
    label: "Security checks",
    on: "Security checks are on",
    off: "Security checks are off",
  },
  dns: { label: "DNS watch", on: "DNS watch is on", off: "DNS watch is off" },
} as const;

/**
 * "Security checks" (or "DNS watch") on/off. Owners and admins get the switch; members only read the state,
 * because the API refuses a change from them anyway.
 */
export function SecuritySwitch({
  enabled,
  canManage,
  saving,
  onChange,
  kind = "security",
}: {
  enabled: boolean;
  canManage: boolean;
  saving: boolean;
  onChange: (enabled: boolean) => void;
  kind?: keyof typeof COPY;
}) {
  const id = useId();
  const copy = COPY[kind];

  if (!canManage) {
    return <p className="text-[15px] text-landing-muted">{enabled ? copy.on : copy.off}</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <label className="cursor-pointer text-[15px] font-medium text-landing-text-2" htmlFor={id}>
        {copy.label}
      </label>
      <Switch checked={enabled} disabled={saving} id={id} onCheckedChange={onChange} />
      <span aria-hidden="true" className="w-7 font-mono text-[13px] text-landing-muted">
        {enabled ? "On" : "Off"}
      </span>
    </div>
  );
}
