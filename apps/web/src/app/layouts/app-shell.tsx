import { Activity, ChevronRight, LogOut, Plus, RadioTower } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/app/providers/auth-provider";
import { Button } from "@/shared/ui/button";
import { SignalField } from "@/shared/ui/signal-field";
import { WorkspaceNavigation } from "@/widgets/workspaces/workspace-navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="relative min-h-screen bg-canvas lg:grid lg:grid-cols-[260px_1fr]">
      <SignalField className="fixed left-0 opacity-50 lg:left-[260px]" density="fine" />
      <aside className="relative z-20 border-b border-border/80 bg-surface/95 px-4 py-5 shadow-[12px_0_50px_rgba(0,0,0,.14)] backdrop-blur-xl lg:flex lg:min-h-screen lg:flex-col lg:border-r lg:border-b-0">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 px-2 text-lg font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl border border-signal/30 bg-signal/10 text-signal shadow-[0_0_24px_rgba(53,211,158,.12)]">
            <Activity className="size-5" />
          </span>
          OntaPulse
        </Link>
        <nav
          className="mt-8 flex gap-2 overflow-x-auto lg:flex-col"
          aria-label="Primary navigation"
        >
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "border border-signal/15 bg-signal/10 text-signal shadow-[inset_0_1px_rgba(255,255,255,.03)]" : "border border-transparent text-muted hover:bg-white/5 hover:text-ink"}`
            }
          >
            <RadioTower className="size-4" /> Overview
          </NavLink>
          <NavLink
            to="/workspaces/new"
            className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <Plus className="size-4" /> New workspace
          </NavLink>
        </nav>
        <WorkspaceNavigation />
        <div className="relative mt-6 hidden overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/35 p-4 lg:block">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-info/40 to-transparent" />
          <p className="flex items-center gap-2 text-xs font-medium text-info">
            <span className="size-1.5 rounded-full bg-info" />
            Signal rule
          </p>
          <p className="mt-2 text-sm leading-5 text-slate-300">
            Run a scan when a target changes. Findings stay attached to every run.
          </p>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-slate-700/70 pt-4 lg:mt-auto lg:pt-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="Log out">
            <LogOut />
          </Button>
        </div>
      </aside>
      <main className="relative z-10 min-w-0 p-5 sm:p-8 xl:p-10">{children}</main>
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="mb-6 flex items-center gap-1 text-sm text-muted" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span className="flex items-center gap-1" key={item.label}>
          {index > 0 && <ChevronRight className="size-3.5" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
