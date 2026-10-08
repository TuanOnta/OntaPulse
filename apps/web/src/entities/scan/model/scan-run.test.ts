import { describe, expect, it } from "vitest";

import { isRunBusy, isRunFinished, runLabel, runTone, toScanRun } from "./scan-run";

describe("scan run", () => {
  it("maps each scan status", () => {
    expect(toScanRun({ status: "QUEUED", findings: [] }).phase).toBe("queued");
    expect(toScanRun({ status: "RUNNING", findings: [] }).phase).toBe("running");
    expect(toScanRun({ status: "FAILED", findings: [] }).phase).toBe("failed");
    const done = toScanRun({ status: "SUCCEEDED", findings: [{}, {}] as never });
    expect(done).toEqual({ phase: "succeeded", findingCount: 2 });
  });

  it("labels and tones the terminal results", () => {
    expect(runLabel({ phase: "succeeded", findingCount: 0 })).toBe("Succeeded · no findings");
    expect(runLabel({ phase: "succeeded", findingCount: 1 })).toBe("Succeeded · 1 finding");
    expect(runLabel({ phase: "succeeded", findingCount: 3 })).toBe("Succeeded · 3 findings");
    expect(runLabel({ phase: "failed", findingCount: 0 })).toBe("Failed");
    expect(runTone({ phase: "succeeded", findingCount: 0 })).toBe("succeeded");
    expect(runTone({ phase: "succeeded", findingCount: 2 })).toBe("warn");
    expect(runTone({ phase: "running", findingCount: 0 })).toBe("running");
  });

  it("knows which runs are busy or finished", () => {
    expect(isRunBusy(undefined)).toBe(false);
    expect(isRunBusy({ phase: "queued", findingCount: 0 })).toBe(true);
    expect(isRunBusy({ phase: "running", findingCount: 0 })).toBe(true);
    expect(isRunBusy({ phase: "failed", findingCount: 0 })).toBe(false);
    expect(isRunFinished({ phase: "failed", findingCount: 0 })).toBe(true);
    expect(isRunFinished({ phase: "queued", findingCount: 0 })).toBe(false);
  });
});
