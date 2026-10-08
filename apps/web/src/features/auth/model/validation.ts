/**
 * Client-side validation for the auth forms. The rules mirror the API contract
 * (apps/api/src/modules/auth/auth.schema.ts and README): the API stays the authority.
 */

export const AUTH_RULES = {
  name: { min: 2, max: 80 },
  email: { max: 320 },
  password: { min: 12, max: 128 },
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AUTH_MESSAGES = {
  email: "Enter a valid email address.",
  loginPassword: "Enter your password.",
  name: "Enter your name (2 to 80 characters).",
  passwordShort: "Use at least 12 characters.",
  passwordLong: "Use 128 characters or fewer.",
} as const;

/** Each validator returns an error message, or "" when the value is valid. */
export function validateEmail(value: string): string {
  const email = value.trim();
  return EMAIL_PATTERN.test(email) && email.length <= AUTH_RULES.email.max
    ? ""
    : AUTH_MESSAGES.email;
}

export function validateLoginPassword(value: string): string {
  return value ? "" : AUTH_MESSAGES.loginPassword;
}

export function validateName(value: string): string {
  const length = value.trim().length;
  return length >= AUTH_RULES.name.min && length <= AUTH_RULES.name.max ? "" : AUTH_MESSAGES.name;
}

export function validateRegisterPassword(value: string): string {
  if (value.length < AUTH_RULES.password.min) return AUTH_MESSAGES.passwordShort;
  if (value.length > AUTH_RULES.password.max) return AUTH_MESSAGES.passwordLong;
  return "";
}

export type PasswordMeter = {
  /** Fill fraction of the meter bar, 0..1 (reaches 1 at the minimum length). */
  progress: number;
  ok: boolean;
  over: boolean;
  /** Text state, so the rule never relies on color alone. */
  rule: string;
};

export const PASSWORD_RULE_TEXT = {
  idle: "At least 12 characters",
  ok: "✓ Long enough",
  over: "Too long (128 max)",
} as const;

export function passwordMeter(length: number): PasswordMeter {
  const { min, max } = AUTH_RULES.password;
  const over = length > max;
  const ok = length >= min && !over;
  return {
    progress: Math.min(length / min, 1),
    ok,
    over,
    rule: over ? PASSWORD_RULE_TEXT.over : ok ? PASSWORD_RULE_TEXT.ok : PASSWORD_RULE_TEXT.idle,
  };
}
