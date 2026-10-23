import { createContext, useContext, type ReactNode } from "react";

import { useWorkspaces } from "./use-workspaces";

type WorkspacesValue = ReturnType<typeof useWorkspaces>;

const WorkspacesContext = createContext<WorkspacesValue | null>(null);

/**
 * Loads the workspace list once and shares it (list, status, `reload`) with everything inside, so the
 * sidebar and the page content always show the same data and a retry refreshes both.
 */
export function WorkspacesProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaces();
  return <WorkspacesContext.Provider value={value}>{children}</WorkspacesContext.Provider>;
}

export function useWorkspacesContext(): WorkspacesValue {
  const value = useContext(WorkspacesContext);
  if (!value) throw new Error("useWorkspacesContext must be used inside WorkspacesProvider");
  return value;
}

/**
 * The shared list when there is one, or null outside a provider. Features that only add to the list (the
 * create form) use this so they still work where no shell wraps them.
 */
export function useOptionalWorkspacesContext(): WorkspacesValue | null {
  return useContext(WorkspacesContext);
}
