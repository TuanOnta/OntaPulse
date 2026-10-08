import { describe, expect, it } from "vitest";

import { WORKSPACE_TONES, formatAge, wavePath, workspaceLook } from "./workspace-look";

const NAMES = [
  ["w1", "MrScraper Platform"],
  ["w2", "Personal projects"],
  ["w3", "Client — Glam by Qody"],
  ["w4", "Open-source status pages"],
] as const;

describe("workspaceLook", () => {
  it("gives the same workspace the same look every time", () => {
    const a = workspaceLook({ id: "w1", name: "MrScraper Platform" });
    const b = workspaceLook({ id: "w1", name: "MrScraper Platform" });
    expect(a).toEqual(b);
  });

  it("derives a known tone and a negative glow delay below 5 s", () => {
    for (const [id, name] of NAMES) {
      const look = workspaceLook({ id, name });
      expect(WORKSPACE_TONES).toContain(look.tone);
      expect(look.glowDelay).toBeLessThanOrEqual(0);
      expect(look.glowDelay).toBeGreaterThan(-5);
    }
  });

  it("spreads different workspaces over more than one tone", () => {
    const tones = new Set(NAMES.map(([id, name]) => workspaceLook({ id, name }).tone));
    expect(tones.size).toBeGreaterThan(1);
  });
});

describe("wavePath", () => {
  it("starts at x=0, ends at x=400 and has 14 cubic segments", () => {
    const path = wavePath(12345);
    expect(path.startsWith("M0 ")).toBe(true);
    expect(path.match(/C/g)).toHaveLength(14);
    expect(path.endsWith(" 400 " + path.split(" ").at(-1))).toBe(true);
  });

  it("is deterministic per seed and differs between seeds", () => {
    expect(wavePath(7)).toBe(wavePath(7));
    expect(wavePath(7)).not.toBe(wavePath(8));
  });

  it("keeps every point inside the 72 px banner", () => {
    const ys = [...wavePath(99).matchAll(/(?:M\d+(?:\.\d+)? |\d+(?:\.\d+)? )(\d+\.\d)/g)].map((m) =>
      Number(m[1]),
    );
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(72);
    }
  });
});

describe("formatAge", () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

  it("uses today, days, months and years", () => {
    expect(formatAge(daysAgo(0), now)).toBe("today");
    expect(formatAge(daysAgo(1), now)).toBe("1d ago");
    expect(formatAge(daysAgo(29), now)).toBe("29d ago");
    expect(formatAge(daysAgo(30), now)).toBe("1 mo ago");
    expect(formatAge(daysAgo(359), now)).toBe("11 mo ago");
    expect(formatAge(daysAgo(360), now)).toBe("1 yr ago");
    expect(formatAge(daysAgo(800), now)).toBe("2 yr ago");
  });

  it("never goes negative for a date in the future", () => {
    expect(formatAge(new Date(now + 86_400_000 * 3).toISOString(), now)).toBe("today");
  });

  it("returns an empty string for missing or invalid dates", () => {
    expect(formatAge(undefined, now)).toBe("");
    expect(formatAge(null, now)).toBe("");
    expect(formatAge("not a date", now)).toBe("");
  });
});

/**
 * Verbatim copy of the algorithms in apps/web/references/dashboard-prototype.html (card v2), used to
 * prove the port produces the same tone, waveform and glow delay for the same workspace.
 */
function prototypeHash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function prototypeRng(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function prototypeWavePath(seed: number) {
  const r = prototypeRng(seed);
  const pts: number[][] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 400;
    pts.push([x, 36 + (r() - 0.5) * 46 * (i % 4 === 2 ? 1.5 : 0.8)]);
  }
  let d = "M" + pts[0][0] + " " + pts[0][1].toFixed(1);
  for (let j = 1; j < pts.length; j++) {
    const cx = (pts[j - 1][0] + pts[j][0]) / 2;
    d +=
      " C" +
      cx +
      " " +
      pts[j - 1][1].toFixed(1) +
      " " +
      cx +
      " " +
      pts[j][1].toFixed(1) +
      " " +
      pts[j][0] +
      " " +
      pts[j][1].toFixed(1);
  }
  return d;
}

describe("parity with the prototype algorithms", () => {
  it.each<[string, string]>([
    ...NAMES.map(([id, name]): [string, string] => [id, name]),
    ["abc123", "Staging — API"],
    ["550e8400-e29b-41d4-a716-446655440000", "日本 監視"],
  ])("workspace %s / %s", (id, name) => {
    const h = prototypeHash(id + name);
    const look = workspaceLook({ id, name });
    expect(look.wave).toBe(prototypeWavePath(h));
    expect(WORKSPACE_TONES.indexOf(look.tone)).toBe(h % 4);
    expect(look.glowDelay).toBe(-((h % 50) / 10));
  });
});
