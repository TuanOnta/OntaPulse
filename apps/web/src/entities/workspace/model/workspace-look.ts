import { createRng, hashString } from "@/shared/lib/seeded-random";

/** Tone names, in the order of the prototype's `tone-0 .. tone-3`. */
export const WORKSPACE_TONES = ["info", "text", "warn", "accent"] as const;
export type WorkspaceTone = (typeof WORKSPACE_TONES)[number];

export const WAVE_VIEW = { width: 400, height: 72 } as const;
const WAVE_POINTS = 14;
const WAVE_BASELINE = 36;
const WAVE_AMPLITUDE = 46;
const MS_PER_DAY = 86_400_000;

export type WorkspaceLook = {
  tone: WorkspaceTone;
  /** SVG path for the banner waveform (viewBox 400 x 72). */
  wave: string;
  /** Negative animation delay in seconds, so cards do not pulse in sync. */
  glowDelay: number;
};

/** Smooth waveform from a seed: 15 points across the banner joined with cubic segments. */
export function wavePath(seed: number): string {
  const random = createRng(seed);
  const points: [number, number][] = [];
  for (let i = 0; i <= WAVE_POINTS; i++) {
    const x = (i / WAVE_POINTS) * WAVE_VIEW.width;
    points.push([x, WAVE_BASELINE + (random() - 0.5) * WAVE_AMPLITUDE * (i % 4 === 2 ? 1.5 : 0.8)]);
  }
  let path = `M${points[0][0]} ${points[0][1].toFixed(1)}`;
  for (let j = 1; j < points.length; j++) {
    const cx = (points[j - 1][0] + points[j][0]) / 2;
    path += ` C${cx} ${points[j - 1][1].toFixed(1)} ${cx} ${points[j][1].toFixed(1)} ${points[j][0]} ${points[j][1].toFixed(1)}`;
  }
  return path;
}

/** Each workspace keeps its own tone and waveform: both derive from a hash of its id and name. */
export function workspaceLook(workspace: { id: string; name: string }): WorkspaceLook {
  const hash = hashString(workspace.id + workspace.name);
  return {
    tone: WORKSPACE_TONES[hash % WORKSPACE_TONES.length],
    wave: wavePath(hash),
    glowDelay: -((hash % 50) / 10),
  };
}

/** Relative age: "today", "12d ago", "3 mo ago", "2 yr ago". Empty for a missing or invalid date. */
export function formatAge(value: string | null | undefined, now: number = Date.now()): string {
  const time = value ? new Date(value).getTime() : NaN;
  if (Number.isNaN(time)) return "";
  const days = Math.max(0, Math.floor((now - time) / MS_PER_DAY));
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} yr ago`;
}
