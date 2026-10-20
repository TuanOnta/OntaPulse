import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ApiError, api } from "@/shared/api/client";
import { getErrorMessage } from "@/shared/lib/api-error";
import type { CheckSettings } from "@/shared/types/domain";

export type CheckSettingsError = { message: string; requestId?: string };

type State =
  | { status: "loading" }
  | { status: "ready"; settings: CheckSettings }
  | { status: "error"; error: CheckSettingsError };

const GENERIC_ERROR = "Check your connection and try again.";

/**
 * Security check settings of one monitor (`GET /monitors/:id/check-settings`) and the on/off switch for the
 * security posture check (`PATCH`). The switch is optimistic and rolls back with a toast when the API refuses,
 * for example when the role is not allowed.
 */
export function useCheckSettings(monitorId: string) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [probesSaving, setProbesSaving] = useState(false);
  const alive = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    api
      .checkSettings(monitorId)
      .then((settings) => {
        if (!ignore) setState({ status: "ready", settings });
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setState({
          status: "error",
          error:
            error instanceof ApiError
              ? { message: error.message, requestId: error.payload.requestId }
              : { message: GENERIC_ERROR },
        });
      });
    return () => {
      ignore = true;
    };
  }, [monitorId, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  const setSecurityPosture = useCallback(
    async (enabled: boolean) => {
      if (state.status !== "ready") return;
      const previous = state.settings;
      setSaving(true);
      setState({ status: "ready", settings: { ...previous, securityPostureEnabled: enabled } });
      try {
        const saved = await api.updateCheckSettings(monitorId, { securityPostureEnabled: enabled });
        if (alive.current) setState({ status: "ready", settings: saved });
      } catch (error) {
        if (!alive.current) return;
        setState({ status: "ready", settings: previous });
        toast.error(getErrorMessage(error));
      } finally {
        if (alive.current) setSaving(false);
      }
    },
    [monitorId, state],
  );

  /**
   * Turns the exposed-file checks on. Not optimistic: the API must accept the acknowledgment first, so this waits
   * for the answer and throws the API error for the confirmation dialog to show.
   */
  const enablePathProbes = useCallback(async () => {
    const saved = await api.updateCheckSettings(monitorId, {
      pathProbesEnabled: true,
      pathProbesAcknowledged: true,
    });
    if (alive.current) setState({ status: "ready", settings: saved });
  }, [monitorId]);

  /** Turns them off (no acknowledgment needed). Optimistic, rolled back with a toast when the API refuses. */
  const disablePathProbes = useCallback(async () => {
    if (state.status !== "ready") return;
    const previous = state.settings;
    setProbesSaving(true);
    setState({
      status: "ready",
      settings: { ...previous, pathProbesEnabled: false, pathProbesAcknowledgedAt: null },
    });
    try {
      const saved = await api.updateCheckSettings(monitorId, { pathProbesEnabled: false });
      if (alive.current) setState({ status: "ready", settings: saved });
    } catch (error) {
      if (!alive.current) return;
      setState({ status: "ready", settings: previous });
      toast.error(getErrorMessage(error));
    } finally {
      if (alive.current) setProbesSaving(false);
    }
  }, [monitorId, state]);

  return {
    ...state,
    saving,
    probesSaving,
    reload,
    setSecurityPosture,
    enablePathProbes,
    disablePathProbes,
  };
}
