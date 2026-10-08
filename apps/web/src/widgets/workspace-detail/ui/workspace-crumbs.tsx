import { Link } from "react-router-dom";

import { riseStyle } from "@/shared/lib/rise";

/** Breadcrumb: Dashboard / <workspace name>. */
export function WorkspaceCrumbs({ name }: { name: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-[18px] flex animate-dash-rise flex-wrap items-center gap-2 font-mono text-[14px] leading-[normal] text-landing-muted motion-reduce:animate-none"
      style={riseStyle(0)}
    >
      <Link
        className="inline-flex min-h-8 items-center rounded-md hover:text-landing-text"
        to="/dashboard"
      >
        Dashboard
      </Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page" className="max-w-[40ch] truncate text-landing-text-2">
        {name}
      </span>
    </nav>
  );
}
