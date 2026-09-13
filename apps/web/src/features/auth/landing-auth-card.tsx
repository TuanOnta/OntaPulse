import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, RadioTower, UserRound } from "lucide-react";
import { useState, type FormEvent, type MouseEvent, type ReactNode } from "react";

import { Input } from "@/shared/ui/input";

export type AuthMode = "login" | "register";

type Props = {
  busy: boolean;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

type FieldName = "name" | "email" | "password" | null;

const beams = [
  {
    className:
      "top-0 left-0 h-px w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent",
    animate: { left: ["-50%", "100%"] },
    delay: 0,
  },
  {
    className: "top-0 right-0 h-1/2 w-px bg-gradient-to-b from-transparent via-info to-transparent",
    animate: { top: ["-50%", "100%"] },
    delay: 0.7,
  },
  {
    className:
      "right-0 bottom-0 h-px w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent",
    animate: { right: ["-50%", "100%"] },
    delay: 1.4,
  },
  {
    className:
      "bottom-0 left-0 h-1/2 w-px bg-gradient-to-b from-transparent via-info to-transparent",
    animate: { bottom: ["-50%", "100%"] },
    delay: 2.1,
  },
];

export function LandingAuthCard({ busy, mode, onModeChange, onSubmit }: Props) {
  const reduceMotion = useReducedMotion();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<FieldName>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-280, 280], [5, -5]);
  const rotateY = useTransform(mouseX, [-280, 280], [-5, 5]);

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left - rect.width / 2);
    mouseY.set(event.clientY - rect.top - rect.height / 2);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  function iconClass(field: FieldName) {
    return `pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 transition-colors ${
      focusedField === field ? "text-primary" : "text-muted-foreground"
    }`;
  }

  return (
    <div
      id="access"
      className="relative mx-auto w-full max-w-md scroll-mt-8"
      style={{ perspective: 1200 }}
    >
      <div className="absolute -inset-10 -z-10 rounded-full bg-primary/10 blur-3xl" />
      <motion.div
        className="relative"
        style={reduceMotion ? undefined : { rotateX, rotateY }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="group relative">
          <motion.div
            className="absolute -inset-px rounded-[1.65rem] opacity-50 blur-sm"
            animate={reduceMotion ? undefined : { opacity: [0.28, 0.65, 0.28] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ boxShadow: "0 0 24px oklch(0.78 0.15 160 / .16)" }}
          />
          <div className="pointer-events-none absolute -inset-px overflow-hidden rounded-[1.65rem]">
            {beams.map((beam) => (
              <motion.span
                animate={reduceMotion ? undefined : beam.animate}
                className={beam.className}
                key={beam.delay}
                transition={{
                  duration: 2.9,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 1.1,
                  delay: beam.delay,
                }}
              />
            ))}
          </div>

          <div className="relative overflow-hidden rounded-[1.65rem] border border-border/90 bg-card/90 p-5 shadow-[0_32px_100px_oklch(0.11_0.02_164/.55)] backdrop-blur-xl sm:p-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.035]"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, oklch(0.94 0.018 160) .5px, transparent .5px), linear-gradient(45deg, oklch(0.94 0.018 160) .5px, transparent .5px)",
                backgroundSize: "30px 30px",
              }}
            />

            <AnimatePresence mode="wait" initial={false}>
              <motion.form
                className="relative space-y-4"
                key={mode}
                initial={reduceMotion ? false : { opacity: 0, x: mode === "login" ? -14 : 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={
                  reduceMotion ? { opacity: 0 } : { opacity: 0, x: mode === "login" ? 14 : -14 }
                }
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
                onSubmit={onSubmit}
              >
                <div className="mb-7 text-center">
                  <motion.div
                    className="relative mx-auto grid size-11 place-items-center overflow-hidden rounded-full border border-primary/25 bg-primary/10 text-primary"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.65 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                  >
                    <RadioTower className="size-5" />
                    <span className="absolute inset-0 bg-gradient-to-br from-primary/15 to-transparent" />
                  </motion.div>
                  <motion.h2
                    className="mt-4 text-xl font-semibold tracking-[-0.035em]"
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduceMotion ? 0 : 0.08 }}
                  >
                    {mode === "login" ? "Welcome back" : "Start monitoring"}
                  </motion.h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {mode === "login"
                      ? "Sign in to your operational command center."
                      : "Create an account and monitor your first endpoint."}
                  </p>
                </div>

                {mode === "register" && (
                  <FieldShell active={focusedField === "name"}>
                    <label className="sr-only" htmlFor="access-name">
                      Name
                    </label>
                    <UserRound className={iconClass("name")} />
                    <Input
                      id="access-name"
                      name="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onFocus={() => setFocusedField("name")}
                      onBlur={() => setFocusedField(null)}
                      className="h-11 border-transparent bg-background/55 pl-10 focus-visible:border-primary/45 focus-visible:bg-background/80"
                      placeholder="Your name"
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      required
                    />
                  </FieldShell>
                )}

                <FieldShell active={focusedField === "email"}>
                  <label className="sr-only" htmlFor="access-email">
                    Email address
                  </label>
                  <Mail className={iconClass("email")} />
                  <Input
                    id="access-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    className="h-11 border-transparent bg-background/55 pl-10 focus-visible:border-primary/45 focus-visible:bg-background/80"
                    placeholder="Email address"
                    autoComplete="email"
                    required
                  />
                </FieldShell>

                <FieldShell active={focusedField === "password"}>
                  <label className="sr-only" htmlFor="access-password">
                    Password
                  </label>
                  <LockKeyhole className={iconClass("password")} />
                  <Input
                    id="access-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    className="h-11 border-transparent bg-background/55 px-10 focus-visible:border-primary/45 focus-visible:bg-background/80"
                    placeholder={mode === "register" ? "At least 12 characters" : "Password"}
                    minLength={mode === "register" ? 12 : undefined}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                  />
                  <button
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </FieldShell>

                {mode === "register" && (
                  <p className="-mt-1 text-xs text-muted-foreground">Use at least 12 characters.</p>
                )}

                <motion.button
                  className="group/button relative mt-2 w-full rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
                  whileHover={reduceMotion ? undefined : { scale: 1.015 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                  type="submit"
                  disabled={busy}
                >
                  <span className="absolute inset-0 rounded-lg bg-primary/25 blur-lg opacity-0 transition-opacity group-hover/button:opacity-100" />
                  <span className="relative flex h-11 items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
                    {busy && (
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={reduceMotion ? undefined : { x: ["-160%", "260%"] }}
                        transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }}
                      />
                    )}
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        className="relative flex items-center gap-2"
                        key={busy ? "busy" : mode}
                        initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
                      >
                        {busy
                          ? mode === "login"
                            ? "Signing in…"
                            : "Creating account…"
                          : mode === "login"
                            ? "Sign in"
                            : "Create account"}
                        {!busy && (
                          <ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" />
                        )}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </motion.button>

                <p className="pt-1 text-center text-xs text-muted-foreground">
                  {mode === "login" ? "New to OntaPulse?" : "Already have an account?"}{" "}
                  <button
                    className="font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                    type="button"
                    onClick={() => onModeChange(mode === "login" ? "register" : "login")}
                  >
                    {mode === "login" ? "Create an account" : "Sign in"}
                  </button>
                </p>
              </motion.form>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
      <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
        Secure session cookies. Your credentials are never exposed to the browser runtime.
      </p>
    </div>
  );
}

function FieldShell({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <motion.div
      className="relative"
      animate={{ scale: active ? 1.01 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <span
        aria-hidden="true"
        className={`absolute -inset-px rounded-lg bg-gradient-to-r from-primary/35 via-info/20 to-primary/35 transition-opacity ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="relative overflow-hidden rounded-lg">{children}</div>
    </motion.div>
  );
}
