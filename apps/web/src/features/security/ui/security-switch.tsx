import { useId } from "react";

import { Switch } from "@/shared/ui/switch";

/**
 * "Security checks" on/off. Owners and admins get the switch; members only read the state, because the API
 * refuses a change from them anyway.
 */
export function SecuritySwitch({
  enabled,
  canManage,
  saving,
  onChange,
}: {
  enabled: boolean;
  canManage: boolean;
  saving: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const id = useId();

  if (!canManage) {
    return (
      <p className="text-[15px] text-landing-muted">
        {enabled ? "Security checks are on" : "Security checks are off"}
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <label className="cursor-pointer text-[15px] font-medium text-landing-text-2" htmlFor={id}>
        Security checks
      </label>
      <Switch checked={enabled} disabled={saving} id={id} onCheckedChange={onChange} />
      <span aria-hidden="true" className="w-7 font-mono text-[13px] text-landing-muted">
        {enabled ? "On" : "Off"}
      </span>
    </div>
  );
}
