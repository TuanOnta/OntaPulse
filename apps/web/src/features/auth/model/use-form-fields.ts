import { useCallback, useRef, useState, type ChangeEvent } from "react";

export type Validators<K extends string> = Record<K, (value: string) => string>;

/**
 * Controlled values plus per-field errors for the auth forms. Errors appear on blur (once the field
 * has a value or was already invalid), refresh while typing, and are all checked on submit.
 */
export function useFormFields<K extends string>(validators: Validators<K>) {
  const keys = Object.keys(validators) as K[];
  const [values, setValues] = useState(
    () => Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>,
  );
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
  const refs = useRef<Partial<Record<K, HTMLInputElement | null>>>({});

  const setError = useCallback((key: K, message: string) => {
    setErrors((prev) => {
      if ((prev[key] ?? "") === message) return prev;
      return { ...prev, [key]: message || undefined };
    });
  }, []);

  const bind = (key: K) => ({
    value: values[key],
    ref: (el: HTMLInputElement | null) => {
      refs.current[key] = el;
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setValues((prev) => ({ ...prev, [key]: next }));
      if (errors[key]) setError(key, validators[key](next));
    },
    onBlur: () => {
      if (values[key] !== "" || errors[key]) setError(key, validators[key](values[key]));
    },
    "aria-invalid": errors[key] ? (true as const) : undefined,
  });

  /** Validates every field; focuses the first invalid one. Returns true when all are valid. */
  const validateAll = useCallback(() => {
    const next: Partial<Record<K, string>> = {};
    let firstBad: K | null = null;
    for (const key of keys) {
      const message = validators[key](values[key]);
      if (message) {
        next[key] = message;
        firstBad ??= key;
      }
    }
    setErrors(next);
    if (firstBad) refs.current[firstBad]?.focus();
    return firstBad === null;
    // validators and keys are stable per form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  return { values, errors, bind, validateAll };
}
