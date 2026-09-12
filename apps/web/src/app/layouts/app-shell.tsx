import { Activity, ChevronRight, LogOut, Plus, RadioTower } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/app/providers/auth-provider";
import { Button } from "@/shared/ui/button";
import { WorkspaceNavigation } from "@/widgets/workspaces/workspace-navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-slate-700/70 bg-surface px-4 py-5 lg:flex lg:min-h-screen lg:flex-col lg:border-r lg:border-b-0">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 px-2 text-lg font-semibold tracking-tight"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-signal text-slate-950">
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
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-signal/15 text-signal" : "text-muted hover:bg-white/5 hover:text-ink"}`
            }
          >
            <RadioTower className="size-4" /> Overview
          </NavLink>
          <NavLink
            to="/workspaces/new"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <Plus className="size-4" /> New workspace
          </NavLink>
        </nav>
        <WorkspaceNavigation />
        <div className="mt-6 hidden rounded-lg border border-slate-700/70 bg-slate-950/30 p-4 lg:block">
          <p className="text-xs font-medium text-muted">Signal rule</p>
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
      <main className="min-w-0 p-5 sm:p-8">{children}</main>
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
