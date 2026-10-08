import type { SceneTier } from "../model/scene-config";

export type DevFlags = {
  debug: boolean;
  quality?: SceneTier;
  reduceMotion: boolean;
  webglOff: boolean;
  /** Auth screen preview: ?tab=register, ?state=error|loading|success. */
  tab?: "login" | "register";
  state?: "error" | "loading" | "success";
};

const NONE: DevFlags = { debug: false, reduceMotion: false, webglOff: false };

/**
 * URL flags from the prototype (?debug, ?quality=low|high, ?motion=reduce, ?webgl=off). They only
 * work on the dev server; in production builds this returns no flags.
 */
export function readDevFlags(search: string = window.location.search): DevFlags {
  if (!import.meta.env.DEV) return NONE;
  const params = new URLSearchParams(search);
  const quality = params.get("quality");
  return {
    debug: params.has("debug"),
    quality: quality === "low" || quality === "high" ? quality : undefined,
    reduceMotion: params.get("motion") === "reduce",
    webglOff: params.get("webgl") === "off",
    tab:
      params.get("tab") === "register"
        ? "register"
        : params.get("tab") === "login"
          ? "login"
          : undefined,
    state: ["error", "loading", "success"].includes(params.get("state") ?? "")
      ? (params.get("state") as DevFlags["state"])
      : undefined,
  };
}
