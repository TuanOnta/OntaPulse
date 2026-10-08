import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/app/providers/auth-provider";
import { ApiError } from "@/shared/api/client";

export type AuthMode = "login" | "register";
export type AuthFeedback = { message: string; requestId?: string };
export type AuthPhase = "idle" | "busy" | "done";

export type AuthCredentials = { name: string; email: string; password: string };

const GENERIC_ERROR = "Something went wrong. Try again.";

/** How long the success view stays before the redirect (prototype: 0.4 s delay + 2.2 s fill). */
export const REDIRECT_DELAY_MS = 2600;

export const DONE_TITLE: Record<AuthMode, string> = {
  login: "You're in.",
  register: "Your workspace is ready.",
};

export function toFeedback(error: unknown): AuthFeedback {
  if (error instanceof ApiError) {
    return { message: error.message, requestId: error.payload.requestId };
  }
  return { message: GENERIC_ERROR };
}

/**
 * Submits the login or registration form through AuthProvider. It owns the busy/done phase and the
 * error banner, and keeps `holdSession` true while a submit or the success view is active:
 * AuthProvider sets `user` as soon as the request resolves, and the page must not redirect before
 * the success view has been shown.
 */
export function useAuthSubmit(onRedirect: () => void) {
  const { login, register } = useAuth();
  const [phase, setPhase] = useState<AuthPhase>("idle");
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [doneMode, setDoneMode] = useState<AuthMode>("login");
  const holdSession = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const submit = useCallback(
    async (mode: AuthMode, values: AuthCredentials) => {
      if (holdSession.current) return;
      holdSession.current = true;
      setFeedback(null);
      setPhase("busy");
      try {
        if (mode === "login") await login(values.email.trim(), values.password);
        else await register(values.name.trim(), values.email.trim(), values.password);
      } catch (error) {
        holdSession.current = false;
        setFeedback(toFeedback(error));
        setPhase("idle");
        return;
      }
      setDoneMode(mode);
      setPhase("done");
      redirectTimer.current = setTimeout(onRedirect, REDIRECT_DELAY_MS);
    },
    [login, register, onRedirect],
  );

  const clearFeedback = useCallback(() => setFeedback(null), []);
  /** Dev preview helpers (?state=...) use these; production code paths never call them. */
  const preview = useCallback((next: { phase?: AuthPhase; feedback?: AuthFeedback | null }) => {
    if (next.phase) setPhase(next.phase);
    if (next.feedback !== undefined) setFeedback(next.feedback);
  }, []);

  return { phase, feedback, doneMode, holdSession, submit, clearFeedback, preview };
}
