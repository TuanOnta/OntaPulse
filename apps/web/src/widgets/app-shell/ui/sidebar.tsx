import { cn } from "cn";
import { NavLink } from "react-router-dom";
import { forwardRef, type ReactNode } from "react";

import { initials } from "@/entities/workspace";
import type { Workspace } from "@/shared/types/domain";

import { Logo } from "./logo";

export type ShellUser = { name: string; email: string };
export type ShellWorkspaces = {
  status: "loading" | "ready" | "error";
  workspaces: readonly Workspace[];
};

const NAV_LINK = cn(
  "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[16px] font-medium text-landing-text-2 transition-colors duration-200 hover:bg-landing-surface hover:text-landing-text motion-reduce:transition-none",
  "aria-[current=page]:bg-landing-surface-2 aria-[current=page]:text-landing-text",
  "aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2.5 aria-[current=page]:before:-left-4 aria-[current=page]:before:w-[3px] aria-[current=page]:before:rounded-r-[3px] aria-[current=page]:before:bg-landing-accent aria-[current=page]:before:shadow-[0_0_12px_var(--color-landing-accent)] aria-[current=page]:before:content-['']",
);

function NavNote({ children }: { children: ReactNode }) {
  return <p className="px-3 py-2 text-[15px] text-landing-muted">{children}</p>;
}

function WorkspaceLinks({ status, workspaces }: ShellWorkspaces) {
  if (status === "loading") return <NavNote>Loading…</NavNote>;
  if (status === "error") return <NavNote>Unavailable.</NavNote>;
  if (workspaces.length === 0) return <NavNote>No workspaces yet.</NavNote>;
  return (
    <>
      {workspaces.map((workspace) => (
        <NavLink className={NAV_LINK} key={workspace.id} to={`/workspaces/${workspace.id}`}>
          <span
            aria-hidden="true"
            className="mx-[5px] size-2 flex-none rounded-full bg-landing-border-strong group-hover:bg-landing-text-2"
          />
          <span className="truncate">{workspace.name}</span>
        </NavLink>
      ))}
    </>
  );
}

type Props = {
  open: boolean;
  id: string;
  user: ShellUser | null;
  workspaces: ShellWorkspaces;
  onSignOut: () => void;
};

/** Primary navigation: persistent column on desktop, slide-in drawer below 960 px. */
export const Sidebar = forwardRef<HTMLElement, Props>(function Sidebar(
  { open, id, user, workspaces, onSignOut },
  ref,
) {
  return (
    <aside
      aria-label="Primary"
      className={cn(
        "sticky top-0 flex h-[100svh] flex-col gap-[22px] border-r border-landing-border bg-landing-bg-2/[.82] px-4 py-[18px] backdrop-blur-[14px] [&_a:focus-visible]:outline-landing-text [&_a:focus-visible]:outline-offset-[3px] [&_button:focus-visible]:outline-landing-text [&_button:focus-visible]:outline-offset-[3px]",
        "max-[959px]:fixed max-[959px]:top-0 max-[959px]:left-0 max-[959px]:z-40 max-[959px]:w-[min(300px,86vw)] max-[959px]:bg-landing-bg/[.97] max-[959px]:transition-[transform,visibility] max-[959px]:duration-[350ms] max-[959px]:ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:max-[959px]:transition-none",
        open
          ? "max-[959px]:translate-x-0"
          : "max-[959px]:invisible max-[959px]:-translate-x-[102%]",
      )}
      id={id}
      ref={ref}
    >
      <Logo />

      <nav aria-label="Main" className="flex flex-col gap-1">
        <NavLink className={NAV_LINK} end to="/dashboard">
          <svg
            aria-hidden="true"
            className="flex-none opacity-85"
            fill="none"
            height="20"
            viewBox="0 0 20 20"
            width="20"
          >
            <rect
              height="6"
              rx="1.8"
              stroke="currentColor"
              strokeWidth="1.5"
              width="6"
              x="2.5"
              y="2.5"
            />
            <rect
              height="6"
              rx="1.8"
              stroke="currentColor"
              strokeWidth="1.5"
              width="6"
              x="11.5"
              y="2.5"
            />
            <rect
              height="6"
              rx="1.8"
              stroke="currentColor"
              strokeWidth="1.5"
              width="6"
              x="2.5"
              y="11.5"
            />
            <rect
              height="6"
              rx="1.8"
              stroke="currentColor"
              strokeWidth="1.5"
              width="6"
              x="11.5"
              y="11.5"
            />
          </svg>
          Dashboard
        </NavLink>
        <NavLink className={NAV_LINK} to="/workspaces/new">
          <svg
            aria-hidden="true"
            className="flex-none opacity-85"
            fill="none"
            height="20"
            viewBox="0 0 20 20"
            width="20"
          >
            <path
              d="M10 4 V16 M4 10 H16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.6"
            />
          </svg>
          New workspace
        </NavLink>
      </nav>

      <section aria-labelledby={`${id}-workspaces`} className="flex min-h-0 flex-1 flex-col gap-1">
        <h2
          className="mx-3 mt-1 mb-0.5 font-mono text-[12px] leading-[normal] font-medium tracking-[.08em] text-landing-muted uppercase"
          id={`${id}-workspaces`}
        >
          Workspaces
        </h2>
        <nav
          aria-label="Workspaces"
          className="-mx-1.5 flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5"
        >
          <WorkspaceLinks {...workspaces} />
        </nav>
      </section>

      <div className="flex items-center gap-3 border-t border-landing-border pt-3.5">
        <div
          aria-hidden="true"
          className="grid size-10 flex-none place-items-center rounded-full border border-landing-border-strong bg-[linear-gradient(135deg,var(--color-landing-surface-2),var(--color-landing-border-strong))] font-display text-[15px] leading-[normal] font-bold"
        >
          {user ? initials(user.name) : ""}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-semibold">{user?.name}</div>
          <div className="truncate font-mono text-[13px] leading-[normal] text-landing-muted">
            {user?.email}
          </div>
        </div>
        <button
          aria-label="Sign out"
          className="grid size-11 flex-none cursor-pointer place-items-center rounded-xl border border-transparent text-landing-muted transition-colors duration-200 hover:border-landing-border hover:bg-landing-surface hover:text-landing-text motion-reduce:transition-none"
          onClick={onSignOut}
          title="Sign out"
          type="button"
        >
          <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20">
            <path
              d="M8 3.5 H5.5 A2 2 0 0 0 3.5 5.5 V14.5 A2 2 0 0 0 5.5 16.5 H8 M12.5 6.5 L16 10 L12.5 13.5 M16 10 H8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
});
