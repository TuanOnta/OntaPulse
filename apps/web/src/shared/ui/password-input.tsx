import { cn } from "cn";
import { useState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "type"> & {
  id: string;
  /** Classes for the Show/Hide toggle button. */
  toggleClassName?: string;
};

/**
 * Password input with a Show/Hide toggle. It renders the input and the toggle as siblings, so the
 * parent must be `position: relative` (the toggle is absolutely placed at the right edge).
 */
export function PasswordInput({ id, className, toggleClassName, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <input className={className} id={id} type={visible ? "text" : "password"} {...props} />
      <button
        aria-controls={id}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className={cn(
          "absolute top-1.5 right-1.5 z-[2] min-h-10 cursor-pointer rounded-[10px] px-3 text-[14px] font-medium",
          toggleClassName,
        )}
        onClick={() => setVisible((value) => !value)}
        type="button"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </>
  );
}
