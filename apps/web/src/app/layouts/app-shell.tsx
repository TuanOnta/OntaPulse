import { ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/app/providers/auth-provider";
import { WorkspacesProvider, useWorkspacesContext } from "@/entities/workspace";
import { AppShellFrame } from "@/widgets/app-shell";

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { status, workspaces } = useWorkspacesContext();

  async function handleSignOut() {
    await logout();
    navigate("/");
  }

  return (
    <AppShellFrame onSignOut={handleSignOut} user={user} workspaces={{ status, workspaces }}>
      {children}
    </AppShellFrame>
  );
}

/**
 * Frame for every signed-in screen (sidebar, mobile drawer, content column). It loads the workspace
 * list once and shares it with the sidebar and with the page inside (`useWorkspacesContext`).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspacesProvider>
      <ShellFrame>{children}</ShellFrame>
    </WorkspacesProvider>
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
