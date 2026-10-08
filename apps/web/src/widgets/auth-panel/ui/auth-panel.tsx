import { cn } from "cn";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import {
  DONE_TITLE,
  LoginForm,
  RegisterForm,
  staggerStyle,
  type AuthFeedback,
  type AuthMode,
  type AuthPhase,
} from "@/features/auth";

import { usePanelMotion } from "../model/use-panel-motion";
import { DoneView } from "./done-view";
import { HeartbeatTrace } from "./heartbeat-trace";

const TAB_ORDER: readonly AuthMode[] = ["login", "register"];
const TAB_LABEL: Record<AuthMode, string> = { login: "Sign in", register: "Create account" };

const COPY: Record<AuthMode, { title: string; lead: string }> = {
  login: { title: "Welcome back", lead: "Sign in to see your workspaces and scans." },
  register: { title: "Create your account", lead: "We'll set up your first workspace for you." },
};

type Props = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  phase: AuthPhase;
  feedback: AuthFeedback | null;
  /** Which form was submitted, for the success title. */
  doneMode: AuthMode;
  onSubmit: (mode: AuthMode, values: { name: string; email: string; password: string }) => void;
};

function PanelHead({ mode }: { mode: AuthMode }) {
  return (
    <div
      className="flex animate-auth-rise flex-col gap-2 motion-reduce:animate-none"
      style={staggerStyle(0)}
    >
      <h1 className="font-display text-[34px] leading-[1.1] font-bold tracking-[-.02em]">
        {COPY[mode].title}
      </h1>
      <p className="text-[16px] text-landing-text-2">{COPY[mode].lead}</p>
    </div>
  );
}

function Banner({ feedback }: { feedback: AuthFeedback }) {
  return (
    <div
      className="flex animate-auth-drop items-start gap-3 rounded-[14px] border border-landing-failed-border bg-landing-danger/[.08] px-4 py-3.5 motion-reduce:animate-none"
      role="alert"
    >
      <span
        aria-hidden="true"
        className="mt-px inline-flex size-[22px] flex-none items-center justify-center rounded-full border-[1.5px] border-landing-danger-text font-mono text-[13px] leading-[normal] font-semibold text-landing-danger-text"
      >
        !
      </span>
      <div>
        <strong className="block text-[16px] font-semibold text-landing-danger-strong">
          {feedback.message}
        </strong>
        {feedback.requestId ? (
          <small className="mt-0.5 block font-mono text-[12px] leading-[normal] text-landing-muted">
            Request ID: {feedback.requestId}
          </small>
        ) : null}
      </div>
    </div>
  );
}

function ViewPanel({
  mode,
  active,
  children,
}: {
  mode: AuthMode;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-labelledby={`auth-tab-${mode}`}
      className="flex flex-col gap-6"
      hidden={!active}
      id={`auth-view-${mode}`}
      role="tabpanel"
    >
      {children}
    </div>
  );
}

/** The auth card: heartbeat trace, tabs, error banner, sign-in / create-account views, success. */
export function AuthPanel({ mode, onModeChange, phase, feedback, doneMode, onSubmit }: Props) {
  const { ref, shake, onPointerMove } = usePanelMotion<HTMLElement>();
  const tabRefs = useRef<Partial<Record<AuthMode, HTMLButtonElement | null>>>({});
  const busy = phase === "busy";

  // A new error banner shakes the card once, as in the prototype.
  useEffect(() => {
    if (feedback) shake();
  }, [feedback, shake]);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: AuthMode) {
    let index = TAB_ORDER.indexOf(current);
    if (event.key === "ArrowRight" || event.key === "ArrowLeft")
      index = (index + 1) % TAB_ORDER.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = TAB_ORDER.length - 1;
    else return;
    event.preventDefault();
    const next = TAB_ORDER[index];
    onModeChange(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section
      aria-label="Account"
      className="auth-panel flex w-full max-w-[460px] animate-auth-panel flex-col gap-6 rounded-[28px] border border-landing-border bg-landing-surface/[.94] p-8 shadow-[0_30px_80px_rgb(0_0_0/0.45)] max-[480px]:rounded-[22px] max-[480px]:px-5 max-[480px]:py-6 motion-reduce:animate-none"
      data-tab={mode}
      onPointerMove={onPointerMove}
      ref={ref}
    >
      <HeartbeatTrace />

      {phase === "done" ? (
        <DoneView title={DONE_TITLE[doneMode]} />
      ) : (
        <>
          <div
            aria-label="Account"
            className="relative flex gap-1 rounded-full border border-landing-border bg-landing-bg p-1"
            role="tablist"
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1 bottom-1 left-1 z-0 w-[calc((100%-12px)/2)] rounded-full bg-landing-surface-2 shadow-[inset_0_0_0_1px_var(--color-landing-border-strong),0_6px_18px_rgb(0_0_0/0.35)] transition-transform duration-[400ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
                mode === "register" && "translate-x-[calc(100%+4px)]",
              )}
            />
            {TAB_ORDER.map((tab) => (
              <button
                aria-controls={`auth-view-${tab}`}
                aria-selected={mode === tab}
                className={cn(
                  "relative z-[1] min-h-11 flex-1 cursor-pointer rounded-full px-2.5 text-[16px] font-medium whitespace-nowrap transition-colors duration-200 hover:text-landing-text motion-reduce:transition-none",
                  mode === tab ? "text-landing-text" : "text-landing-muted",
                )}
                id={`auth-tab-${tab}`}
                key={tab}
                onClick={() => onModeChange(tab)}
                onKeyDown={(event) => onTabKeyDown(event, tab)}
                ref={(el) => {
                  tabRefs.current[tab] = el;
                }}
                role="tab"
                tabIndex={mode === tab ? 0 : -1}
                type="button"
              >
                {TAB_LABEL[tab]}
              </button>
            ))}
          </div>

          {feedback ? <Banner feedback={feedback} /> : null}

          <ViewPanel active={mode === "login"} mode="login">
            <PanelHead mode="login" />
            <LoginForm
              busy={busy && mode === "login"}
              onInvalid={shake}
              onSubmit={(values) => onSubmit("login", { name: "", ...values })}
            />
          </ViewPanel>
          <ViewPanel active={mode === "register"} mode="register">
            <PanelHead mode="register" />
            <RegisterForm
              busy={busy && mode === "register"}
              onInvalid={shake}
              onSubmit={(values) => onSubmit("register", values)}
            />
          </ViewPanel>
        </>
      )}
    </section>
  );
}
