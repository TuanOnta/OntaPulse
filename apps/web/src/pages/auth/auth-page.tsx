import { Suspense, useCallback, useEffect, useMemo } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/app/providers/auth-provider";
import { useAuthSubmit, type AuthMode } from "@/features/auth";
import { AuthPanel } from "@/widgets/auth-panel";
import {
  AUTH_KEYFRAMES,
  AUTH_PROGRESS,
  LandingScene,
  createProgressBus,
  readDevFlags,
} from "@/widgets/landing-scene";

const AUTH_PATHS: Record<AuthMode, string> = { login: "/login", register: "/register" };
const DASHBOARD_PATH = "/dashboard";
const SIDE_NOTE = "HTTP/HTTPS targets · checks every 1 min to 24 h · public URLs only";

function modeFromPath(pathname: string): AuthMode {
  return pathname.startsWith(AUTH_PATHS.register) ? "register" : "login";
}

/**
 * /login and /register: the auth screen (apps/web/references/auth-prototype.html). Both routes
 * render this page; the active tab follows the URL, so switching tabs does not remount the page or
 * restart the 3D scene.
 */
export function AuthPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const mode = modeFromPath(pathname);

  const goToDashboard = useCallback(() => navigate(DASHBOARD_PATH, { replace: true }), [navigate]);
  const { phase, feedback, doneMode, holdSession, submit, clearFeedback, preview } =
    useAuthSubmit(goToDashboard);

  // The orb shows RUNNING while a request is in flight, the finished look otherwise.
  const progress = useMemo(() => createProgressBus(AUTH_PROGRESS.idle), []);
  useEffect(() => {
    progress.set(phase === "busy" ? AUTH_PROGRESS.busy : AUTH_PROGRESS.idle);
  }, [phase, progress]);

  // Dev-only previews of the prototype states (?state=error|loading|success).
  useEffect(() => {
    const { state } = readDevFlags();
    if (!state) return;
    if (state === "error") {
      preview({
        feedback: {
          message:
            mode === "register"
              ? "An account with this email already exists."
              : "Invalid email or password.",
          requestId: "req-demo-7f3a",
        },
      });
    }
    if (state === "loading") preview({ phase: "busy" });
    if (state === "success") preview({ phase: "done" });
    // Runs once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isLoading && user && !holdSession.current) {
    return <Navigate replace to={DASHBOARD_PATH} />;
  }

  function changeMode(next: AuthMode) {
    if (next === mode) return;
    clearFeedback();
    navigate(AUTH_PATHS[next], { replace: true });
  }

  return (
    <div className="relative min-h-[100svh] overflow-x-clip bg-landing-bg font-landing-body text-[17px] leading-normal text-landing-text [&_a:focus-visible]:outline-landing-text [&_a:focus-visible]:outline-offset-[3px]">
      <Suspense fallback={null}>
        <LandingScene keyframes={AUTH_KEYFRAMES} progress={progress} />
      </Suspense>

      <div className="relative z-[1] flex min-h-[100svh] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-8 py-[18px]">
          <Link
            className="inline-flex min-h-11 items-center gap-2.5 font-display text-[22px] font-bold text-landing-text hover:text-landing-text"
            to="/"
          >
            <svg aria-hidden="true" height="30" viewBox="0 0 30 30" width="30">
              <circle
                className="stroke-landing-accent"
                cx="15"
                cy="15"
                fill="none"
                r="13"
                strokeOpacity=".5"
                strokeWidth="1.5"
              />
              <path
                className="stroke-landing-accent"
                d="M3 16 H10 L13 8 L17 23 L20 16 H27"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            OntaPulse
          </Link>
          <Link
            className="inline-flex min-h-11 items-center gap-2 px-1 text-[16px] text-landing-muted hover:text-landing-text"
            to="/"
          >
            <span aria-hidden="true">←</span> Back to home
          </Link>
        </header>

        <main className="relative flex flex-1 items-center justify-end px-[clamp(24px,8vw,120px)] pt-4 pb-14 max-[959px]:justify-center max-[959px]:px-5 max-[959px]:pt-2 max-[959px]:pb-10">
          <p className="absolute bottom-7 left-8 max-w-[360px] font-mono text-[13px] text-landing-muted max-[959px]:hidden">
            {SIDE_NOTE}
          </p>
          <AuthPanel
            doneMode={doneMode}
            feedback={feedback}
            mode={mode}
            onModeChange={changeMode}
            onSubmit={(target, values) => void submit(target, values)}
            phase={phase}
          />
        </main>
      </div>
    </div>
  );
}
