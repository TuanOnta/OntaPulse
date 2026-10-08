import { useState } from "react";
import { Link } from "react-router-dom";

import { LandingAuthPanel, type AuthMode } from "@/features/auth/landing-auth-panel";

/**
 * Interim /login and /register page: hosts the existing auth panel until the auth screens get
 * their own approved prototype.
 */
export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-5 py-12 text-ink">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link className="text-sm text-muted-foreground hover:text-ink" to="/">
          ← Back to OntaPulse
        </Link>
        <LandingAuthPanel mode={mode} onModeChange={setMode} />
      </div>
    </div>
  );
}
