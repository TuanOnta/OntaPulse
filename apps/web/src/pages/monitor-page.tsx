import { ArrowRight, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AppShell, Crumbs } from "@/app/layouts/app-shell";
import { ScanStatusBadge } from "@/entities/scan/ui/scan-status-badge";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { formatDate, formatInterval } from "@/shared/lib/format";
import type { Monitor, Scan } from "@/shared/types/domain";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeading } from "@/shared/ui/page-heading";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export function MonitorPage() {
  const { workspaceId = "", projectId = "", monitorId = "" } = useParams();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const load = useCallback(async () => {
    try {
      const [monitorList, scanList] = await Promise.all([
        api.monitors(projectId),
        api.scans(monitorId),
      ]);
      setMonitors(monitorList);
      setScans(scanList);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [monitorId, projectId]);
  useEffect(() => {
    void load();
  }, [load]);
  const monitor = monitors.find((item) => item.id === monitorId);
  const pending = scans.some((scan) => scan.status === "QUEUED" || scan.status === "RUNNING");
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load, pending]);
  async function trigger() {
    setTriggering(true);
    try {
      await api.triggerScan(monitorId);
      toast.success("Scan queued");
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTriggering(false);
    }
  }
  const latest = scans[0];
  return (
    <AppShell>
      <Crumbs
        items={[
          { label: "Overview", to: "/dashboard" },
          { label: "Workspace", to: `/workspaces/${workspaceId}` },
          { label: "Project", to: `/workspaces/${workspaceId}/projects/${projectId}` },
          { label: monitor?.name ?? "Monitor" },
        ]}
      />
      <PageHeading
        eyebrow="MONITOR"
        title={monitor?.name ?? "Monitor"}
        description={monitor?.targetUrl ?? "Loading target details..."}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void load()}
              aria-label="Refresh scan history"
            >
              <RefreshCw className={pending ? "animate-spin motion-reduce:animate-none" : ""} />
            </Button>
            <Button onClick={() => void trigger()} disabled={triggering || pending}>
              {triggering ? (
                "Queuing..."
              ) : pending ? (
                "Scan in progress"
              ) : (
                <>
                  <Search /> Run scan
                </>
              )}
            </Button>
          </div>
        }
      />
      {loading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Metric label="Latest status">
              {latest ? (
                <ScanStatusBadge status={latest.status} />
              ) : (
                <span className="text-sm text-muted">No scans yet</span>
              )}
            </Metric>
            <Metric label="Response time">
              {latest?.responseTimeMs != null ? `${latest.responseTimeMs} ms` : "—"}
            </Metric>
            <Metric label="Scan interval">
              {monitor ? formatInterval(monitor.intervalSeconds) : "—"}
            </Metric>
          </div>
          <section className="mt-8 overflow-x-auto rounded-xl border border-slate-700/70 bg-surface">
            <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
              <div>
                <h2 className="font-semibold">Scan history</h2>
                <p className="mt-1 text-sm text-muted">
                  Newest runs appear first. Active runs refresh automatically.
                </p>
              </div>
              {pending && <span className="text-xs text-cyan-200">Polling every 3 seconds</span>}
            </div>
            {scans.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No scans yet"
                  description="Run the first scan to capture status, timing, and findings for this target."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scans.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell>
                        <ScanStatusBadge status={scan.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted">
                        {scan.statusCode != null
                          ? `HTTP ${scan.statusCode}`
                          : scan.errorMessage || "Waiting for worker"}
                      </TableCell>
                      <TableCell className="text-sm text-muted">
                        {formatDate(scan.startedAt ?? scan.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            to={`/workspaces/${workspaceId}/projects/${projectId}/monitors/${monitorId}/scans/${scan.id}`}
                          >
                            Inspect <ArrowRight />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-700/70 bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-3 text-2xl font-semibold">{children}</div>
    </section>
  );
}
