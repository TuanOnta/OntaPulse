import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "@/shared/api/client";
import type { WorkspaceMember } from "@/shared/types/domain";

import { sortMembers } from "./member-permissions";

export type MembersError = { message: string; requestId?: string };

export type MembersState =
  | { status: "loading"; members: WorkspaceMember[]; error: null }
  | { status: "ready"; members: WorkspaceMember[]; error: null }
  | { status: "error"; members: WorkspaceMember[]; error: MembersError };

const GENERIC_ERROR = "Check your connection and try again.";

/** Loads `GET /workspaces/:id/members` and offers local updates after add, role change and remove. */
export function useWorkspaceMembers(workspaceId: string) {
  const [state, setState] = useState<MembersState>({
    status: "loading",
    members: [],
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api
      .workspaceMembers(workspaceId)
      .then((members) => {
        if (!ignore) setState({ status: "ready", members: sortMembers(members), error: null });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        const detail =
          error instanceof ApiError
            ? { message: error.message, requestId: error.payload.requestId }
            : { message: GENERIC_ERROR };
        setState({ status: "error", members: [], error: detail });
      });
    return () => {
      ignore = true;
    };
  }, [workspaceId, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading", members: [], error: null });
    setAttempt((value) => value + 1);
  }, []);

  const update = useCallback((change: (members: WorkspaceMember[]) => WorkspaceMember[]) => {
    setState((current) =>
      current.status === "ready"
        ? { ...current, members: sortMembers(change(current.members)) }
        : current,
    );
  }, []);

  const addMember = useCallback(
    (member: WorkspaceMember) => update((members) => [...members, member]),
    [update],
  );
  const replaceMember = useCallback(
    (member: WorkspaceMember) =>
      update((members) => members.map((item) => (item.id === member.id ? member : item))),
    [update],
  );
  const removeMember = useCallback(
    (id: string) => update((members) => members.filter((item) => item.id !== id)),
    [update],
  );

  return { ...state, reload, addMember, replaceMember, removeMember };
}
