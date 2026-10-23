import { useEffect } from "react";

export const APP_TITLE = "OntaPulse";

/** "<title> · OntaPulse" for the browser tab and history. Plain text only; the base title returns on unmount. */
export function documentTitle(title: string | null | undefined): string {
  const name = title?.trim();
  return name ? `${name} · ${APP_TITLE}` : APP_TITLE;
}

/**
 * Names the tab after the current screen. Pass the screen's own name first and the data name (a workspace, a
 * project, a host) once it is known, so the title is useful while the data is still loading.
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = documentTitle(title);
    return () => {
      document.title = APP_TITLE;
    };
  }, [title]);
}
