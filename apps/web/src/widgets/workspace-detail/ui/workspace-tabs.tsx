import type { KeyboardEvent, ReactNode } from "react";

import { riseStyle } from "@/shared/lib/rise";

export type WorkspaceTab = "projects" | "members";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "projects", label: "Projects" },
  { id: "members", label: "Members" },
];

export const tabId = (tab: WorkspaceTab) => `workspace-tab-${tab}`;
export const PANE_ID = "workspace-pane";

/** Projects / Members tablist (roving tabindex, arrows, Home and End) plus the shared tabpanel. */
export function WorkspaceTabs({
  tab,
  counts,
  onChange,
  children,
}: {
  tab: WorkspaceTab;
  counts: Record<WorkspaceTab, number | null>;
  onChange: (tab: WorkspaceTab) => void;
  children: ReactNode;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    onChange(TABS[next].id);
    document.getElementById(tabId(TABS[next].id))?.focus();
  }

  return (
    <>
      <div
        aria-label="Workspace sections"
        className="mt-7 mb-[22px] flex animate-dash-rise gap-1.5 border-b border-landing-border motion-reduce:animate-none"
        role="tablist"
        style={riseStyle(2)}
      >
        {TABS.map(({ id, label }, index) => {
          const selected = tab === id;
          const count = counts[id];
          return (
            <button
              aria-controls={PANE_ID}
              aria-selected={selected}
              className={`relative min-h-12 cursor-pointer px-[18px] text-[16px] font-semibold transition-colors duration-200 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-center after:rounded-sm after:bg-landing-text after:transition-transform after:duration-300 max-[520px]:px-3 motion-reduce:transition-none motion-reduce:after:transition-none ${
                selected
                  ? "text-landing-text after:scale-x-100"
                  : "text-landing-muted after:scale-x-0 hover:text-landing-text"
              }`}
              id={tabId(id)}
              key={id}
              onClick={() => onChange(id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {label}
              {count !== null ? (
                <span className="ml-2 rounded-full bg-landing-surface-2 px-2 py-0.5 font-mono text-[12px] font-medium text-landing-text-2">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <section aria-labelledby={tabId(tab)} id={PANE_ID} role="tabpanel">
        {children}
      </section>
    </>
  );
}
