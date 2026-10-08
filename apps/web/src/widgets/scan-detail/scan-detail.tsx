import { splitUrl } from "@/entities/monitor";
import { isBusyScan, scanOutcome } from "@/entities/scan";
import { canManageWorkspace } from "@/entities/workspace";
import { useRunAgain } from "@/features/scans/model/use-run-again";
import { useNow } from "@/shared/lib/use-now";
import type {
  Monitor,
  Project,
  ScanDetail as ScanDetailData,
  Workspace,
} from "@/shared/types/domain";

import { Findings } from "./ui/findings";
import { LifecycleAndRequest } from "./ui/lifecycle-request";
import { MetricTiles } from "./ui/metric-tiles";
import { ScanCrumbs } from "./ui/scan-crumbs";
import { ScanHero, TONE, type HeroAction } from "./ui/scan-hero";

const RELATIVE_TIME_REFRESH_MS = 60_000;

/** The workspace, project and monitor of the scan; absent on the direct `/scans/:id` route. */
export type ScanContext = { workspace: Workspace; project: Project; monitor: Monitor };

/** Scan screen body: breadcrumb, hero, metric tiles, lifecycle, request details and findings. */
export function ScanDetail({
  scan,
  context,
}: {
  scan: ScanDetailData;
  context: ScanContext | null;
}) {
  const now = useNow(RELATIVE_TIME_REFRESH_MS);
  const host = context ? splitUrl(context.monitor.targetUrl).host : undefined;
  const hrefFor = (scanId: string) =>
    context
      ? `/workspaces/${context.workspace.id}/projects/${context.project.id}/monitors/${context.monitor.id}/scans/${scanId}`
      : `/scans/${scanId}`;
  const { run, busy } = useRunAgain(scan.monitorId, hrefFor);

  let action: HeroAction = "none";
  if (context) action = canManageWorkspace(context.workspace.role) ? "run" : "view-only";

  return (
    <>
      <ScanCrumbs
        context={
          context
            ? {
                workspaceId: context.workspace.id,
                workspaceName: context.workspace.name,
                projectId: context.project.id,
                projectName: context.project.name,
                monitorId: context.monitor.id,
                host: host ?? "",
              }
            : null
        }
      />
      <div className={TONE[scanOutcome(scan, host).tone]}>
        <ScanHero
          action={action}
          busy={busy || isBusyScan(scan)}
          host={host}
          now={now}
          onRunAgain={() => void run(host)}
          scan={scan}
        />
        <MetricTiles scan={scan} />
        <LifecycleAndRequest scan={scan} targetUrl={context?.monitor.targetUrl} />
        <Findings scan={scan} />
      </div>
    </>
  );
}
