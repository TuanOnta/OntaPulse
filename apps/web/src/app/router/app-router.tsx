import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { BrowserRouter } from "react-router-dom";

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
const WorkspaceCreatePage = lazy(() =>
  import("@/pages/workspace-create-page").then(({ WorkspaceCreatePage: Page }) => ({
    default: Page,
  })),
);

function RouteLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas text-muted">Loading...</div>
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

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route element={<AuthPage />}>
              <Route path="/login" element={null} />
              <Route path="/register" element={null} />
            </Route>
            <Route
              path="/dashboard"
              element={
                <Protected>
                  <DashboardPage />
                </Protected>
              }
            />
            <Route
              path="/workspaces/new"
              element={
                <Protected>
                  <WorkspaceCreatePage />
                </Protected>
              }
            />
            <Route
              path="/workspaces/:workspaceId"
              element={
                <Protected>
                  <WorkspacePage />
                </Protected>
              }
            />
            <Route
              path="/workspaces/:workspaceId/projects/:projectId"
              element={
                <Protected>
                  <ProjectPage />
                </Protected>
              }
            />
            <Route
              path="/workspaces/:workspaceId/projects/:projectId/monitors/:monitorId"
              element={
                <Protected>
                  <MonitorPage />
                </Protected>
              }
            />
            <Route
              path="/workspaces/:workspaceId/projects/:projectId/monitors/:monitorId/scans/:scanId"
              element={
                <Protected>
                  <ScanPage />
                </Protected>
              }
            />
            <Route
              path="/scans/:scanId"
              element={
                <Protected>
                  <ScanPage />
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster richColors theme="dark" />
      </AuthProvider>
    </BrowserRouter>
  );
}
