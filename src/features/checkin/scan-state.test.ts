import { describe, expect, it } from "vitest";
import { initialScan, scanReducer, type ScanState } from "./scan-state";

const ok = { kind: "OK", buyer: "Ana" } as const;

describe("scanReducer", () => {
  it("idle -> validating on submit", () => {
    expect(scanReducer(initialScan, { type: "submit" })).toEqual({ phase: "validating" });
  });

  it("blocks duplicate submit while validating", () => {
    const s: ScanState = { phase: "validating" };
    expect(scanReducer(s, { type: "submit" })).toBe(s);
  });

  it("ignores camera/submit events while showing a result (frozen)", () => {
    const s: ScanState = { phase: "result", outcome: ok };
    expect(scanReducer(s, { type: "submit" })).toBe(s);
    expect(scanReducer(s, { type: "resolve", outcome: { kind: "NOT_FOUND" } })).toBe(s);
  });

  it("validating -> result on resolve", () => {
    expect(scanReducer({ phase: "validating" }, { type: "resolve", outcome: ok })).toEqual({ phase: "result", outcome: ok });
  });

  it("resolve is ignored when idle", () => {
    expect(scanReducer(initialScan, { type: "resolve", outcome: ok })).toBe(initialScan);
  });

  it("result -> idle only via explicit next", () => {
    expect(scanReducer({ phase: "result", outcome: ok }, { type: "next" })).toEqual(initialScan);
  });

  it("validating -> idle on abort (e.g. 401 redirect)", () => {
    expect(scanReducer({ phase: "validating" }, { type: "abort" })).toEqual(initialScan);
  });
});
