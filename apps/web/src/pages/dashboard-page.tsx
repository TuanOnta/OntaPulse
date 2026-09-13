import { ArrowRight, Crown, Layers3, Plus, RadioTower, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/app/layouts/app-shell";
import { api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import { formatDate } from "@/shared/lib/format";
import type { Workspace } from "@/shared/types/domain";
import { BlurFade } from "@/shared/ui/blur-fade";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { PageHeading } from "@/shared/ui/page-heading";
import { BorderBeam } from "@/shared/ui/signal-field";
import { Skeleton } from "@/shared/ui/skeleton";

export function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .workspaces()
      .then(setWorkspaces)
      .catch((error) => toast.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  const managedCount = workspaces.filter(
    (workspace) => workspace.role === "OWNER" || workspace.role === "ADMIN",
  ).length;
  const metrics = [
    {
      icon: Layers3,
      label: "Workspaces",
      value: workspaces.length,
      color: "text-info",
      tint: "bg-info/10",
    },
    {
      icon: Crown,
      label: "Managed by you",
      value: managedCount,
      color: "text-highlight",
      tint: "bg-highlight/10",
    },
    {
      icon: ShieldCheck,
      label: "Access protected",
      value: "Always",
      color: "text-signal",
      tint: "bg-signal/10",
    },
  ];

  return (
    <AppShell>
      <BlurFade>
        <section className="relative mb-8 overflow-hidden rounded-[1.75rem] border border-border bg-gradient-to-br from-surface-raised via-surface to-card p-6 shadow-[0_25px_80px_rgba(0,0,0,.28)] sm:p-8">
          <BorderBeam />
          <div className="signal-grid pointer-events-none absolute inset-0 opacity-[0.08] [mask-image:linear-gradient(to_right,transparent,black)]" />
          <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-signal/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <div className="mb-5 flex items-center gap-2 text-sm text-signal">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-50 motion-reduce:animate-none" />
                  <span className="relative size-2 rounded-full bg-signal" />
                </span>
                Command center online
              </div>
              <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                Everything you monitor, one signal away.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Move from workspace to endpoint and keep every operational decision in context.
              </p>
            </div>
            <Button asChild size="lg" className="w-fit shadow-[0_12px_32px_rgba(53,211,158,.15)]">
              <Link to="/workspaces/new">
                <Plus /> New workspace
              </Link>
            </Button>
          </div>
        </section>
      </BlurFade>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {metrics.map(({ icon: Icon, label, value, color, tint }, index) => (
          <BlurFade delay={0.06 + index * 0.05} key={label}>
            <div className="flex items-center gap-4 rounded-xl border border-slate-700/60 bg-surface/70 p-4 shadow-[inset_0_1px_rgba(255,255,255,.025)]">
              <span className={`grid size-10 place-items-center rounded-xl ${tint} ${color}`}>
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-xl font-semibold tracking-tight">{loading ? "—" : value}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            </div>
          </BlurFade>
        ))}
      </div>

      <PageHeading
        title="Monitoring workspaces"
        description="Choose a workspace to inspect projects, targets, and the scans behind them."
      />
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <Skeleton className="h-44 rounded-2xl" key={key} />
          ))}
        </div>
      ) : workspaces.length === 0 ? (
        <EmptyState
          title="No workspaces yet"
          description="Create a workspace before you add a project or monitor a target."
          action={
            <Button asChild>
              <Link to="/workspaces/new">
                <Plus /> Create workspace
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace, index) => (
            <BlurFade delay={index * 0.05} key={workspace.id}>
              <Link
                className="group relative block overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-surface to-card p-5 shadow-[0_14px_40px_rgba(0,0,0,.14)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_20px_55px_rgba(0,0,0,.28)] motion-reduce:transform-none"
                to={`/workspaces/${workspace.id}`}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="flex items-start justify-between">
                  <span className="grid size-11 place-items-center rounded-xl border border-signal/20 bg-signal/10 text-sm font-semibold text-signal shadow-[0_0_24px_rgba(53,211,158,.08)]">
                    {workspace.name.slice(0, 1).toUpperCase()}
                  </span>
                  <ArrowRight className="size-4 text-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-signal motion-reduce:transform-none" />
                </div>
                <h2 className="mt-8 text-lg font-semibold tracking-tight">{workspace.name}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1">
                    <Users className="size-3" /> {workspace.role?.toLowerCase() ?? "member"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <RadioTower className="size-3 text-info" /> Joined{" "}
                    {formatDate(workspace.joinedAt)}
                  </span>
                </div>
              </Link>
            </BlurFade>
          ))}
        </div>
      )}
    </AppShell>
  );
}
