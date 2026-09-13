import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-provider";
import { LandingAuthCard, type AuthMode } from "@/features/auth/landing-auth-card";
import { ApiError } from "@/shared/api/client";

export type { AuthMode } from "@/features/auth/landing-auth-card";

export function LandingAuthPanel({
  mode,
  onModeChange,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password"));

    if (mode === "register" && password.length < 12) {
      toast.error("Use a password of at least 12 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await login(String(values.get("email")), password);
      } else {
        await register(String(values.get("name")), String(values.get("email")), password);
      }
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <LandingAuthCard busy={busy} mode={mode} onModeChange={onModeChange} onSubmit={submit} />;
}
