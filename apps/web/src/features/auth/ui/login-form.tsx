import { PasswordInput } from "@/shared/ui/password-input";

import { validateEmail, validateLoginPassword } from "../model/validation";
import { useFormFields } from "../model/use-form-fields";
import {
  AUTH_INPUT_CLASS,
  AUTH_PASSWORD_INPUT_CLASS,
  AUTH_TOGGLE_CLASS,
  AuthField,
  LockIcon,
  MailIcon,
} from "./auth-field";
import { SubmitButton } from "./submit-button";

const VALIDATORS = { email: validateEmail, password: validateLoginPassword };

type Props = {
  busy: boolean;
  onSubmit: (values: { email: string; password: string }) => void;
  /** Called when validation fails on submit (the panel shakes). */
  onInvalid: () => void;
};

/** Sign-in form. Stagger indices start at 1; the panel head uses 0. */
export function LoginForm({ busy, onSubmit, onInvalid }: Props) {
  const { values, errors, bind, validateAll } = useFormFields(VALIDATORS);

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
        onSubmit({ email: values.email, password: values.password });
      }}
    >
      <AuthField error={errors.email} icon={<MailIcon />} id="login-email" index={1} label="Email">
        <input
          {...bind("email")}
          aria-describedby="login-email-err"
          autoComplete="email"
          className={AUTH_INPUT_CLASS}
          id="login-email"
          inputMode="email"
          name="email"
          placeholder="you@company.com"
          required
          spellCheck={false}
          type="email"
        />
      </AuthField>
      <AuthField
        error={errors.password}
        icon={<LockIcon />}
        id="login-password"
        index={2}
        label="Password"
      >
        <PasswordInput
          {...bind("password")}
          aria-describedby="login-password-err"
          autoComplete="current-password"
          className={AUTH_PASSWORD_INPUT_CLASS}
          id="login-password"
          name="password"
          placeholder="Your password"
          required
          toggleClassName={AUTH_TOGGLE_CLASS}
        />
      </AuthField>
      <SubmitButton busy={busy} busyLabel="Signing in…" index={3} label="Sign in" />
    </form>
  );
}
