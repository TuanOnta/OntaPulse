import { Link } from "react-router-dom";

import { riseStyle } from "@/shared/lib/rise";

/** Breadcrumb: Dashboard / <workspace> / <project> / <host>. */
export function MonitorCrumbs({
  workspaceId,
  workspaceName,
  projectId,
  projectName,
  host,
}: {
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  host: string;
}) {
  const link =
    "inline-flex min-h-8 max-w-[28ch] items-center truncate rounded-md hover:text-landing-text";
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-[18px] flex animate-dash-rise flex-wrap items-center gap-2 font-mono text-[14px] leading-[normal] text-landing-muted motion-reduce:animate-none"
      style={riseStyle(0)}
    >
      <Link className={link} to="/dashboard">
        Dashboard
      </Link>
      <span aria-hidden="true">/</span>
      <Link className={link} to={`/workspaces/${workspaceId}`}>
        {workspaceName}
      </Link>
      <span aria-hidden="true">/</span>
      <Link className={link} to={`/workspaces/${workspaceId}/projects/${projectId}`}>
        {projectName}
      </Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page" className="max-w-[40ch] truncate text-landing-text-2">
        {host}
      </span>
    </nav>
  );
}
