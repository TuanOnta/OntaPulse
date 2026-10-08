import { describe, expect, it } from "vitest";

import {
  AUTH_MESSAGES,
  passwordMeter,
  validateEmail,
  validateLoginPassword,
  validateName,
  validateRegisterPassword,
} from "./validation";

describe("validateEmail", () => {
  it("accepts a normal address and trims surrounding spaces", () => {
    expect(validateEmail("  person@example.com ")).toBe("");
  });

  it.each(["", "person", "person@", "person@example", "per son@example.com"])(
    "rejects %j",
    (value) => {
      expect(validateEmail(value)).toBe(AUTH_MESSAGES.email);
    },
  );

  it("rejects an address longer than 320 characters", () => {
    expect(validateEmail(`${"a".repeat(310)}@example.com`)).toBe(AUTH_MESSAGES.email);
  });
});

describe("validateName", () => {
  it("requires 2 to 80 characters after trimming", () => {
    expect(validateName(" a ")).toBe(AUTH_MESSAGES.name);
    expect(validateName("Jo")).toBe("");
    expect(validateName("x".repeat(80))).toBe("");
    expect(validateName("x".repeat(81))).toBe(AUTH_MESSAGES.name);
  });
});

describe("password validation", () => {
  it("login only needs a value", () => {
    expect(validateLoginPassword("")).toBe(AUTH_MESSAGES.loginPassword);
    expect(validateLoginPassword("x")).toBe("");
  });

  it("register needs 12 to 128 characters and does not trim", () => {
    expect(validateRegisterPassword("x".repeat(11))).toBe(AUTH_MESSAGES.passwordShort);
    expect(validateRegisterPassword("x".repeat(12))).toBe("");
    expect(validateRegisterPassword(" ".repeat(12))).toBe("");
    expect(validateRegisterPassword("x".repeat(128))).toBe("");
    expect(validateRegisterPassword("x".repeat(129))).toBe(AUTH_MESSAGES.passwordLong);
  });
});

describe("passwordMeter", () => {
  it("fills up to the minimum length and reports a text rule", () => {
    expect(passwordMeter(0)).toMatchObject({ progress: 0, ok: false, over: false });
    expect(passwordMeter(6).progress).toBe(0.5);
    expect(passwordMeter(12)).toMatchObject({ progress: 1, ok: true, rule: "✓ Long enough" });
  });

  it("flags passwords that are too long", () => {
    expect(passwordMeter(129)).toMatchObject({ ok: false, over: true, rule: "Too long (128 max)" });
  });
});
