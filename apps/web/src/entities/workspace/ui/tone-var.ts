import type { WorkspaceTone } from "../model/workspace-look";

/** Tone colour handed to a card or hero as `--t`; every tinted part derives from it. */
export const TONE_VAR: Record<WorkspaceTone, string> = {
  info: "[--t:var(--color-landing-info)]",
  text: "[--t:var(--color-landing-text)]",
  warn: "[--t:var(--color-landing-warn)]",
  accent: "[--t:var(--color-landing-accent)]",
};
