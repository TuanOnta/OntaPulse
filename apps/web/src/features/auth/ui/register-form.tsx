import { cn } from "cn";

import { PasswordInput } from "@/shared/ui/password-input";

import { useFormFields } from "../model/use-form-fields";
import {
  AUTH_RULES,
  passwordMeter,
  validateEmail,
  validateName,
  validateRegisterPassword,
} from "../model/validation";
import {
  AUTH_INPUT_CLASS,
  AUTH_PASSWORD_INPUT_CLASS,
  AUTH_TOGGLE_CLASS,
  AuthField,
  LockIcon,
  MailIcon,
  UserIcon,
} from "./auth-field";
import { SubmitButton } from "./submit-button";

const VALIDATORS = {
  name: validateName,
  email: validateEmail,
  password: validateRegisterPassword,
};

type Props = {
  busy: boolean;
  onSubmit: (values: { name: string; email: string; password: string }) => void;
  onInvalid: () => void;
};

/** Registration form with the live password rule and meter. Stagger indices start at 1. */
export function RegisterForm({ busy, onSubmit, onInvalid }: Props) {
  const { values, errors, bind, validateAll } = useFormFields(VALIDATORS);
  const meter = passwordMeter(values.password.length);

  return (
    <form
      className="flex flex-col gap-[18px]"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        if (!validateAll()) {
          onInvalid();
          return;
        }
        onSubmit({ name: values.name, email: values.email, password: values.password });
      }}
    >
      <AuthField error={errors.name} icon={<UserIcon />} id="reg-name" index={1} label="Name">
        <input
          {...bind("name")}
          aria-describedby="reg-name-err"
          autoComplete="name"
          className={AUTH_INPUT_CLASS}
          id="reg-name"
          name="name"
          placeholder="Your name"
          required
          type="text"
        />
      </AuthField>
      <AuthField error={errors.email} icon={<MailIcon />} id="reg-email" index={2} label="Email">
        <input
          {...bind("email")}
          aria-describedby="reg-email-err"
          autoComplete="email"
          className={AUTH_INPUT_CLASS}
          id="reg-email"
          inputMode="email"
          name="email"
          placeholder="you@company.com"
          required
          spellCheck={false}
          type="email"
        />
      </AuthField>
      <AuthField
        below={
          <>
            <div
              aria-hidden="true"
              className="h-[3px] overflow-hidden rounded-[3px] bg-landing-border"
            >
              <span
                className={cn(
                  "block h-full w-full origin-left rounded-[3px] bg-landing-muted transition-[transform,background-color] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
                  meter.ok && "bg-landing-accent shadow-[0_0_10px_rgb(94_242_160/0.6)]",
                  meter.over && "bg-landing-danger",
                )}
                style={{ transform: `scaleX(${meter.progress})` }}
              />
            </div>
            <p
              className="flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-[12px] leading-[normal] text-landing-muted"
              id="reg-password-hint"
            >
              <span className={cn(meter.ok && "text-landing-status-text")}>{meter.rule}</span>
              <span>
                {values.password.length} / {AUTH_RULES.password.max}
              </span>
            </p>
          </>
        }
        error={errors.password}
        icon={<LockIcon />}
        id="reg-password"
        index={3}
        label="Password"
      >
        <PasswordInput
          {...bind("password")}
          aria-describedby="reg-password-hint reg-password-err"
          autoComplete="new-password"
          className={AUTH_PASSWORD_INPUT_CLASS}
          id="reg-password"
          name="password"
          placeholder="Create a password"
          required
          toggleClassName={AUTH_TOGGLE_CLASS}
        />
      </AuthField>
      <SubmitButton busy={busy} busyLabel="Creating account…" index={4} label="Create account" />
    </form>
  );
}
