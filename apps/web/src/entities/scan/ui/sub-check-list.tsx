import type { SubCheck } from "@/shared/types/domain";
import { cn } from "cn";

import { subCheckLabel, subCheckStateText } from "../model/security-scan";

/** Which checks of a security scan ran and which were skipped (with the reason), as words and an icon. */
export function SubCheckList({ subChecks }: { subChecks: readonly SubCheck[] }) {
  return (
    <ul aria-label="Checks in this scan" className="m-0 flex list-none flex-col gap-2 p-0">
      {subChecks.map((item) => {
        const ran = item.state === "ran";

        return (
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px]" key={item.name}>
            <span
              aria-hidden="true"
              className={cn(
                "grid size-5 flex-none place-items-center rounded-full border text-[11px]",
                ran
                  ? "border-landing-accent/60 text-landing-accent"
                  : "border-landing-border-strong text-landing-muted",
              )}
            >
              {ran ? "✓" : "–"}
            </span>
            <span className="font-medium text-landing-text">{subCheckLabel(item.name)}</span>
            <span className="text-landing-muted">{subCheckStateText(item)}</span>
          </li>
        );
      })}
    </ul>
  );
}
