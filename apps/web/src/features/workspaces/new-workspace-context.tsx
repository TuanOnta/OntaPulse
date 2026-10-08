import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { NewWorkspaceDialog } from "./new-workspace-dialog";

type NewWorkspaceValue = { openNewWorkspace: () => void };

const NewWorkspaceContext = createContext<NewWorkspaceValue | null>(null);

/** Owns the "New workspace" dialog so the sidebar, the dashboard header and the create card can open it. */
export function NewWorkspaceProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openNewWorkspace = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openNewWorkspace }), [openNewWorkspace]);

  return (
    <NewWorkspaceContext.Provider value={value}>
      {children}
      <NewWorkspaceDialog onOpenChange={setOpen} open={open} />
    </NewWorkspaceContext.Provider>
  );
}

export function useNewWorkspace(): NewWorkspaceValue {
  const value = useContext(NewWorkspaceContext);
  if (!value) throw new Error("useNewWorkspace must be used inside NewWorkspaceProvider");
  return value;
}
