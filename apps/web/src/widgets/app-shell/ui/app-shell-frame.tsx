import { cn } from "cn";
import type { ReactNode } from "react";

import { useDrawer } from "../model/use-drawer";
import { AmbientBackground } from "./ambient-background";
import { MobileBar } from "./mobile-bar";
import { Sidebar, type ShellUser, type ShellWorkspaces } from "./sidebar";

const SIDEBAR_ID = "app-sidebar";

type Props = {
  user: ShellUser | null;
  workspaces: ShellWorkspaces;
  onSignOut: () => void;
  onNewWorkspace: () => void;
  children: ReactNode;
};

/**
 * Frame shared by every signed-in screen: ambient background, sidebar (drawer on narrow screens),
 * mobile top bar and the content column. Data and sign-out come in through props.
 */
export function AppShellFrame({ user, workspaces, onSignOut, onNewWorkspace, children }: Props) {
  const { open, openDrawer, closeDrawer, sidebarRef, menuButtonRef } = useDrawer();

  return (
    <div className="relative min-h-[100svh] bg-landing-bg font-landing-body text-[17px] leading-normal text-landing-text">
      <AmbientBackground />
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-landing-accent focus:px-4 focus:py-2 focus:text-landing-accent-ink"
        href="#content"
      >
        Skip to content
      </a>
      <div className="relative z-[1] grid min-h-[100svh] grid-cols-[264px_minmax(0,1fr)] max-[959px]:grid-cols-[minmax(0,1fr)]">
        <Sidebar
          id={SIDEBAR_ID}
          onNewWorkspace={() => {
            closeDrawer(false);
            onNewWorkspace();
          }}
          onSignOut={onSignOut}
          open={open}
          ref={sidebarRef}
          user={user}
          workspaces={workspaces}
        />
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-30 hidden bg-black/60 transition-opacity duration-300 motion-reduce:transition-none",
            open
              ? "max-[959px]:block max-[959px]:opacity-100"
              : "pointer-events-none opacity-0 max-[959px]:block",
          )}
          data-testid="drawer-scrim"
          onClick={() => closeDrawer()}
        />
        <div className="flex min-w-0 flex-col">
          <MobileBar controls={SIDEBAR_ID} onOpen={openDrawer} open={open} ref={menuButtonRef} />
          <main
            className="mx-auto w-full max-w-[1160px] px-10 pt-11 pb-[72px] outline-none max-[959px]:px-4 max-[959px]:pt-7 max-[959px]:pb-14"
            id="content"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
