/**
 * Tunable values for the landing "signal orb" scene, ported from SCENE_CONFIG in
 * apps/web/references/landing-prototype.html. Colors for accent/info/warn/danger/muted come from the
 * `--color-landing-*` CSS tokens at creation time; only the three dot and core tones live here.
 */

export type SceneTier = "high" | "low";

export type TierConfig = {
  dots: number;
  dotSize: number;
  targets: number;
  dust: number;
  dprMax: number;
  parallax: boolean;
  fov: number;
  /** MSAA only on the high tier. */
  antialias: boolean;
};

export type Keyframe = {
  f: number;
  x: number;
  y: number;
  s: number;
  rotX: number;
  opacity: number;
  xN: number;
  yN: number;
  sN: number;
  opacityN: number;
};

export const SCENE_SEED = 20260;
export const CAMERA_Z = 11;

export const TIERS: Record<SceneTier, TierConfig> = {
  high: {
    dots: 14000,
    dotSize: 0.0125,
    targets: 14,
    dust: 260,
    dprMax: 2,
    parallax: true,
    fov: 40,
    antialias: true,
  },
  low: {
    dots: 5200,
    dotSize: 0.02,
    targets: 8,
    dust: 90,
    dprMax: 1.5,
    parallax: false,
    fov: 46,
    antialias: false,
  },
};

/** Narrow viewport or coarse pointer selects the `low` tier (checked once, at creation). */
export const LOW_TIER_QUERY = "(max-width: 767px), (pointer: coarse)";
export const FINE_POINTER_QUERY = "(pointer: fine)";

export const SCENE_COLORS = { dot: "#3F6B5B", core: "#040807", neutral: "#4A5A54" } as const;

/** CSS custom properties (Tailwind theme tokens) the scene reads once at creation. */
export const TOKEN_NAMES = {
  accent: "--color-landing-accent",
  info: "--color-landing-info",
  warn: "--color-landing-warn",
  danger: "--color-landing-danger",
  muted: "--color-landing-muted",
} as const;

/** Hub direction on the unit sphere. */
export const HUB_DIR: readonly [number, number, number] = [0.3, 0.22, 0.93];
/** Fake key light (world space). */
export const LIGHT_DIR: readonly [number, number, number] = [-0.5, 0.6, 0.65];

export const HUB_PULSE = {
  /** Seconds between hub pulses: [DONE, RUNNING]. */
  interval: [2.8, 1.3],
  duration: 4.6,
  maxAngle: 2.9,
} as const;
export const ARRIVAL = { duration: 1.9, maxAngle: 0.8 } as const;
export const PACKET = { travel: 2.2, period: [5.2, 8.2] } as const;

/** Below this viewport width (px) the orb is centered and dimmed. */
export const NARROW_BELOW = 960;
/** Scroll progress above which rendering drops to ~30 fps. */
export const IDLE_THROTTLE_FROM = 3.0;
export const IDLE_FRAME_SECONDS = 1 / 30;
/** Frames slower than this (smoothed) count towards an adaptive pixel-ratio drop. */
export const SLOW_FRAME_SECONDS = 0.026;
export const SLOW_FRAMES_BEFORE_DROP = 90;
export const DPR_STEP = 0.25;
export const DPR_SCALE_MIN = 0.5;

export const MAX_ARCS = 16;
export const MAX_PULSES = 6;
export const TRAIL = 8;
export const ARC_SEGMENTS = 40;
export const INTRO_SECONDS = 2.4;

/**
 * Scroll keyframes. f = sectionIndex + 0.5 (hero, how, result, features, cta). From the result
 * section onward the orb holds the same horizon pose. x/y = orb position, s = orb radius in world
 * units (N = narrow layout), rotX tilts the orb.
 */
export const KEYFRAMES: readonly Keyframe[] = [
  {
    f: 0.5,
    x: 3.1,
    y: 0,
    s: 2.55,
    rotX: 0.28,
    opacity: 1,
    xN: 0,
    yN: -2.3,
    sN: 1.7,
    opacityN: 0.42,
  },
  {
    f: 1.5,
    x: 3.0,
    y: 0,
    s: 2.65,
    rotX: 0.2,
    opacity: 1,
    xN: 0,
    yN: -2.0,
    sN: 1.8,
    opacityN: 0.38,
  },
  {
    f: 2.5,
    x: 0,
    y: -6.7,
    s: 5.2,
    rotX: -0.85,
    opacity: 0.85,
    xN: 0,
    yN: -4.5,
    sN: 2.9,
    opacityN: 0.35,
  },
  {
    f: 3.5,
    x: 0,
    y: -6.7,
    s: 5.2,
    rotX: -0.85,
    opacity: 0.85,
    xN: 0,
    yN: -4.5,
    sN: 2.9,
    opacityN: 0.35,
  },
  {
    f: 4.5,
    x: 0,
    y: -6.7,
    s: 5.2,
    rotX: -0.85,
    opacity: 0.85,
    xN: 0,
    yN: -4.5,
    sN: 2.9,
    opacityN: 0.35,
  },
];

/** Ordered landing section ids; the scroll keyframes depend on this order. */
export const SECTION_IDS = ["hero", "how", "result", "features", "cta"] as const;

/**
 * Auth screen pose (apps/web/references/auth-prototype.html): every keyframe is the same single
 * pose, orb large on the left, centered and dimmed behind the panel on narrow screens. Only the
 * lifecycle weights change, driven by the progress value (see AUTH_PROGRESS).
 */
const AUTH_POSE = {
  x: -3.3,
  y: 0,
  s: 2.9,
  rotX: 0.25,
  opacity: 1,
  xN: 0,
  yN: 0.2,
  sN: 2.3,
  opacityN: 0.55,
} as const;
export const AUTH_KEYFRAMES: readonly Keyframe[] = [0.5, 1.5, 2.5, 3.5, 4.5].map((f) => ({
  f,
  ...AUTH_POSE,
}));

/** Progress values the auth page feeds the scene: finished look, and RUNNING while submitting. */
export const AUTH_PROGRESS = { idle: 0.5, busy: 1.5 } as const;
