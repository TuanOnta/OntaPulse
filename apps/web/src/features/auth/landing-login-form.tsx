import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth-provider";
import { getErrorMessage } from "@/shared/lib/api-error";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

export function LandingLoginForm() {
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
      toast.error(getErrorMessage(error, "Could not sign in. Try again."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="w-full max-w-md space-y-4 rounded-xl border border-[#76634d] bg-[#3a3027] p-6"
      onSubmit={submit}
    >
      <div>
        <p className="text-xs font-medium tracking-[.16em] text-[#d8b47c]">WELCOME BACK</p>
        <h2 className="mt-2 text-2xl font-semibold">Sign in to your workspace</h2>
      </div>
      <div>
        <Label htmlFor="landing-email">Email</Label>
        <Input
          className="mt-2 bg-[#2b251e]"
          id="landing-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <Label htmlFor="landing-password">Password</Label>
        <Input
          className="mt-2 bg-[#2b251e]"
          id="landing-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button className="w-full" disabled={busy}>
        {busy ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
