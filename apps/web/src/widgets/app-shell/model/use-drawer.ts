import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/** Viewport width (px) below which the sidebar becomes a drawer. */
export const DRAWER_BELOW = 960;
const WIDE_QUERY = `(min-width: ${DRAWER_BELOW}px)`;

/**
 * Open/close state of the mobile navigation drawer. Opening moves focus to the first link inside
 * the sidebar; closing from the keyboard or the scrim returns focus to the menu button. A route
 * change or a resize to the desktop layout closes it without moving focus.
 */
export function useDrawer() {
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();

  const openDrawer = useCallback(() => {
    setOpen(true);
    // The sidebar is `invisible` until the next paint, so focus it on the next frame.
    requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>("a")?.focus());
  }, []);

  const closeDrawer = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, closeDrawer]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(WIDE_QUERY);
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return { open, openDrawer, closeDrawer, sidebarRef, menuButtonRef };
}
