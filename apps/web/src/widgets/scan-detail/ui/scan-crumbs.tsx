import { Link } from "react-router-dom";

import { riseStyle } from "@/shared/lib/rise";

type Context = {
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  monitorId: string;
  host: string;
};

const NAV =
  "mb-[18px] flex animate-dash-rise flex-wrap items-center gap-2 font-mono text-[14px] leading-[normal] text-landing-muted motion-reduce:animate-none";
const LINK =
  "inline-flex min-h-8 max-w-[28ch] items-center truncate rounded-md hover:text-landing-text";

/**
 * Dashboard / workspace / project / host / Scan. Without a context (the direct `/scans/:id` route) only
 * what is known is shown: Dashboard / Scan.
 */
export function ScanCrumbs({ context }: { context: Context | null }) {
  return (
    <nav aria-label="Breadcrumb" className={NAV} style={riseStyle(0)}>
      <Link className={LINK} to="/dashboard">
        Dashboard
      </Link>
      {context ? (
        <>
          <span aria-hidden="true">/</span>
          <Link className={LINK} to={`/workspaces/${context.workspaceId}`}>
            {context.workspaceName}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            className={LINK}
            to={`/workspaces/${context.workspaceId}/projects/${context.projectId}`}
          >
            {context.projectName}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            className={LINK}
            to={`/workspaces/${context.workspaceId}/projects/${context.projectId}/monitors/${context.monitorId}`}
          >
            {context.host}
          </Link>
        </>
      ) : null}
      <span aria-hidden="true">/</span>
      <span aria-current="page" className="text-landing-text-2">
        Scan
      </span>
    </nav>
  );
}
