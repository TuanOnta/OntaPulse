import { Activity, ArrowRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-provider";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { BlurFade } from "@/shared/ui/blur-fade";

function AuthFrame({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[1.1fr_.9fr]">
      <section className="hidden border-r border-slate-700/70 bg-surface p-10 lg:flex lg:flex-col">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <span className="grid size-9 place-items-center rounded-lg bg-signal text-slate-950">
            <Activity />
          </span>{" "}
          OntaPulse
        </div>
        <div className="my-auto max-w-md">
          <p className="text-sm font-medium text-signal">Website monitoring, without the noise.</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink">
            Know which change needs your attention.
          </h1>
          <p className="mt-5 leading-7 text-muted">
            Organize targets, trigger an inspection, and keep every finding in its scan history.
          </p>
        </div>
        <p className="text-sm text-muted">Operational clarity for teams that ship.</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 text-lg font-semibold lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-signal text-slate-950">
              <Activity className="size-5" />
            </span>{" "}
            OntaPulse
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
          <BlurFade className="mt-7">{children}</BlurFade>
          <p className="mt-6 text-sm text-muted">{footer}</p>
        </div>
      </section>
    </main>
  );
}

function getMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong. Try again.";
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await login(String(values.get("email")), String(values.get("password")));
      navigate("/dashboard");
    } catch (error) {
      toast.error(getMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title="Welcome back"
      description="Sign in to inspect your monitoring workspace."
      footer={
        <>
          New to OntaPulse?{" "}
          <Link className="text-signal hover:underline" to="/register">
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? (
            "Signing in…"
          ) : (
            <>
              Sign in <ArrowRight />
            </>
          )}
        </Button>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password"));
    if (password.length < 12) return toast.error("Use a password of at least 12 characters.");
    setBusy(true);
    try {
      await register(String(values.get("name")), String(values.get("email")), password);
      navigate("/dashboard");
    } catch (error) {
      toast.error(getMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthFrame
      title="Create your workspace"
      description="Start with a secure account and your first monitoring workspace."
      footer={
        <>
          Already have an account?{" "}
          <Link className="text-signal hover:underline" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" minLength={2} maxLength={80} autoComplete="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={12}
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-muted">At least 12 characters.</p>
        </div>
        <Button className="w-full" type="submit" disabled={busy}>
          {busy ? (
            "Creating account…"
          ) : (
            <>
              Create account <ArrowRight />
            </>
          )}
        </Button>
      </form>
    </AuthFrame>
  );
}
