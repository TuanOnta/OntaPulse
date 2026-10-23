import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppShell } from "@/app/layouts/app-shell";
import { AuthProvider, useAuth } from "@/app/providers/auth-provider";
import { Toaster } from "@/shared/ui/sonner";
const DashboardPage = lazy(() =>
  import("@/pages/dashboard/dashboard-page").then(({ DashboardPage: Page }) => ({ default: Page })),
);
const LandingPage = lazy(() =>
  import("@/pages/landing/landing-page").then(({ LandingPage: Page }) => ({ default: Page })),
);
const AuthPage = lazy(() =>
  import("@/pages/auth/auth-page").then(({ AuthPage: Page }) => ({ default: Page })),
);
const MonitorPage = lazy(() =>
  import("@/pages/monitor/monitor-page").then(({ MonitorPage: Page }) => ({ default: Page })),
);
const ProjectPage = lazy(() =>
  import("@/pages/project/project-page").then(({ ProjectPage: Page }) => ({ default: Page })),
);
const ScanPage = lazy(() =>
  import("@/pages/scan/scan-page").then(({ ScanPage: Page }) => ({ default: Page })),
);
const WorkspacePage = lazy(() =>
  import("@/pages/workspace/workspace-page").then(({ WorkspacePage: Page }) => ({ default: Page })),
);

function RouteLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas text-muted">Loading...</div>
  );
}

/** Shown in the content area while a screen's code loads, so the sidebar stays on screen. */
function ContentLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="h-40 animate-pulse rounded-[22px] border border-landing-border bg-landing-surface/60 motion-reduce:animate-none"
      role="status"
    />
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-canvas text-muted">
        Loading workspace…
      </div>
    );
  return user ? children : <Navigate to="/" replace />;
}

function Home() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <RouteLoading />;
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

/**
 * The signed-in screens share one layout route: the app shell is mounted once and only the screen inside it
 * changes, so the workspace list, the sidebar and the open dialogs survive navigation.
 */
function AppLayout() {
  return (
    <Protected>
      <AppShell>
        <Suspense fallback={<ContentLoading />}>
          <Outlet />
        </Suspense>
      </AppShell>
    </Protected>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<AuthPage />}>
          <Route path="/login" element={null} />
          <Route path="/register" element={null} />
        </Route>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId" element={<ProjectPage />} />
          <Route
            path="/workspaces/:workspaceId/projects/:projectId/monitors/:monitorId"
            element={<MonitorPage />}
          />
          <Route
            path="/workspaces/:workspaceId/projects/:projectId/monitors/:monitorId/scans/:scanId"
            element={<ScanPage />}
          />
          <Route path="/scans/:scanId" element={<ScanPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster richColors theme="dark" />
      </AuthProvider>
    </BrowserRouter>
  );
}
