import { forwardRef } from "react";

import { Logo } from "./logo";

type Props = { open: boolean; controls: string; onOpen: () => void };

/** Top bar shown below 960 px: menu button, small logo, spacer that keeps the logo centred. */
export const MobileBar = forwardRef<HTMLButtonElement, Props>(function MobileBar(
  { open, controls, onOpen },
  ref,
) {
  return (
    <div className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-landing-border bg-landing-bg/[.85] px-4 py-2.5 backdrop-blur-[12px] max-[959px]:flex [&_a:focus-visible]:outline-landing-text [&_a:focus-visible]:outline-offset-[3px] [&_button:focus-visible]:outline-landing-text [&_button:focus-visible]:outline-offset-[3px]">
      <button
        aria-controls={controls}
        aria-expanded={open}
        aria-label="Open navigation"
        className="grid size-11 flex-none cursor-pointer place-items-center rounded-xl border border-transparent text-landing-muted transition-colors duration-200 hover:border-landing-border hover:bg-landing-surface hover:text-landing-text motion-reduce:transition-none"
        onClick={onOpen}
        ref={ref}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="22" viewBox="0 0 22 22" width="22">
          <path
            d="M3.5 6 H18.5 M3.5 11 H18.5 M3.5 16 H18.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.7"
          />
        </svg>
      </button>
      <Logo className="text-[20px]" size={26} />
      <span aria-hidden="true" className="w-11" />
    </div>
  );
});
