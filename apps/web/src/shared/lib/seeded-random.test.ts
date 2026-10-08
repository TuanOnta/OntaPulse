import { describe, expect, it } from "vitest";

import { createRng, hashString } from "./seeded-random";

describe("hashString", () => {
  it("is stable and distinguishes inputs", () => {
    expect(hashString("w1MrScraper Platform")).toBe(hashString("w1MrScraper Platform"));
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("")).toBe(2166136261);
  });

  it("matches the FNV-1a reference value for 'a'", () => {
    expect(hashString("a")).toBe(0xe40c292c);
  });
});

describe("createRng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays in [0, 1) and differs per seed", () => {
    const a = createRng(1);
    const b = createRng(2);
    const values = Array.from({ length: 50 }, () => a());
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(values[0]).not.toBe(b());
  });
});
