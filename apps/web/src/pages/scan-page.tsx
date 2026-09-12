import { RefreshCw, ServerCrash } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, Crumbs } from "@/app/layouts/app-shell";
import { ScanStatusBadge } from "@/entities/scan/ui/scan-status-badge";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { formatDate } from "@/shared/lib/format";
import type { FindingSeverity, ScanDetail } from "@/shared/types/domain";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeading } from "@/shared/ui/page-heading";
import { Skeleton } from "@/shared/ui/skeleton";

export function ScanPage() {
  const { scanId = "", workspaceId, projectId, monitorId } = useParams();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      setScan(await api.scan(scanId));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [scanId]);
  useEffect(() => {
    void load();
  }, [load]);
  const pending = scan?.status === "QUEUED" || scan?.status === "RUNNING";
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load, pending]);
  return (
    <AppShell>
      <Crumbs
        items={[
          { label: "Overview", to: "/dashboard" },
          ...(workspaceId && projectId && monitorId
            ? [
                { label: "Workspace", to: `/workspaces/${workspaceId}` },
                { label: "Project", to: `/workspaces/${workspaceId}/projects/${projectId}` },
                {
                  label: "Monitor",
                  to: `/workspaces/${workspaceId}/projects/${projectId}/monitors/${monitorId}`,
                },
              ]
            : []),
          { label: "Scan details" },
        ]}
      />
      {loading || !scan ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <PageHeading
            eyebrow="SCAN"
            title={`Run ${scan.id.slice(0, 8)}`}
            description={`Queued ${formatDate(scan.createdAt)}`}
            action={
              <div className="flex items-center gap-3">
                <ScanStatusBadge status={scan.status} />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void load()}
                  aria-label="Refresh scan"
                >
                  <RefreshCw className={pending ? "animate-spin motion-reduce:animate-none" : ""} />
                </Button>
              </div>
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Metric
              label="HTTP status"
              value={scan.statusCode != null ? String(scan.statusCode) : "—"}
            />
            <Metric
              label="Response time"
              value={scan.responseTimeMs != null ? `${scan.responseTimeMs} ms` : "—"}
            />
            <Metric label="Finished" value={formatDate(scan.finishedAt)} />
          </div>
          {scan.errorMessage && (
            <div className="mt-6 flex gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-rose-100">
              <ServerCrash className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">This scan could not complete</p>
                <p className="mt-1 text-rose-200/80">{scan.errorMessage}</p>
              </div>
            </div>
          )}
          <section className="mt-8 rounded-xl border border-slate-700/70 bg-surface">
            <div className="border-b border-slate-700/70 px-5 py-4">
              <h2 className="font-semibold">Findings</h2>
              <p className="mt-1 text-sm text-muted">
                Issues detected during this single scan execution.
              </p>
            </div>
            {scan.findings.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title={scan.status === "SUCCEEDED" ? "No findings" : "No findings recorded"}
                  description={
                    scan.status === "SUCCEEDED"
                      ? "This scan completed without discovering an issue."
                      : "Findings are added when the scan completes."
                  }
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-700/70">
                {scan.findings.map((finding) => (
                  <article className="p-5" key={finding.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{finding.title}</h3>
                          <Badge className={`border-0 ${severityTone(finding.severity)}`}>
                            {finding.severity}
                          </Badge>
                        </div>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                          {finding.description}
                        </p>
                      </div>
                      <span className="text-xs text-muted">{finding.code}</span>
                    </div>
                    {finding.recommendation && (
                      <div className="mt-4 rounded-md bg-slate-950/35 p-3 text-sm text-slate-300">
                        <span className="font-medium text-signal">Recommended: </span>
                        {finding.recommendation}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function severityTone(severity: FindingSeverity) {
  return severity === "CRITICAL"
    ? "bg-rose-500/15 text-rose-300"
    : severity === "HIGH"
      ? "bg-orange-500/15 text-orange-300"
      : severity === "MEDIUM"
        ? "bg-amber-400/15 text-amber-200"
        : "bg-sky-400/15 text-sky-200";
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-xl border border-slate-700/70 bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-3 text-xl font-semibold">{value}</p>
    </section>
  );
}
