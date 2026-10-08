import { cn } from "cn";

import { ROLE_FILTERS, ROLE_LABEL, type RoleFilter } from "@/entities/workspace";

import { riseStyle } from "./rise";

type Props = {
  role: RoleFilter;
  query: string;
  counts: Record<RoleFilter, number>;
  onRoleChange: (role: RoleFilter) => void;
  onQueryChange: (query: string) => void;
};

/** Role filter chips with counts, and the workspace search box. */
export function WorkspaceToolbar({ role, query, counts, onRoleChange, onQueryChange }: Props) {
  return (
    <div
      className="mt-[30px] mb-[18px] flex animate-dash-rise flex-wrap items-center justify-between gap-3.5 motion-reduce:animate-none"
      style={riseStyle(3)}
    >
      <div aria-label="Filter by role" className="flex flex-wrap gap-2" role="group">
        {ROLE_FILTERS.map((filter) => (
          <button
            aria-pressed={role === filter}
            className={cn(
              "min-h-10 cursor-pointer rounded-full border px-4 text-[15px] font-medium transition-colors duration-200 motion-reduce:transition-none",
              role === filter
                ? "border-landing-muted bg-landing-surface-2 text-landing-text"
                : "border-landing-border text-landing-text-2 hover:border-landing-border-strong hover:text-landing-text",
            )}
            key={filter}
            onClick={() => onRoleChange(filter)}
            type="button"
          >
            {ROLE_LABEL[filter]}
            <span className="ml-1.5 font-mono text-[13px] text-landing-muted">
              {counts[filter]}
            </span>
          </button>
        ))}
      </div>
      <label className="relative max-w-[340px] flex-[1_1_260px] max-[520px]:max-w-none max-[520px]:basis-full">
        <span className="sr-only">Search workspaces</span>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-landing-muted"
          fill="none"
          height="18"
          viewBox="0 0 20 20"
          width="18"
        >
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M13.5 13.5 L17 17"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.6"
          />
        </svg>
        <input
          autoComplete="off"
          className="min-h-11 w-full rounded-[14px] border border-landing-border bg-landing-bg/70 pr-3.5 pl-[42px] text-[16px] text-landing-text transition-[border-color,box-shadow] duration-200 placeholder:text-landing-muted focus:border-landing-text-2 focus:shadow-[0_0_0_4px_rgb(232_241_236/0.08)] focus:outline-none motion-reduce:transition-none"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search workspaces"
          spellCheck={false}
          type="search"
          value={query}
        />
      </label>
    </div>
  );
}
