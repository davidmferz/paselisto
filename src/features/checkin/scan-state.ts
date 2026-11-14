export type ScanOutcome =
  | { kind: "OK"; buyer: string }
  | { kind: "ALREADY_USED"; usedAt: string }
  | { kind: "NOT_FOUND" }
  | { kind: "NOT_PAID" }
  | { kind: "ERROR" };

export type ScanState = { phase: "idle" } | { phase: "validating" } | { phase: "result"; outcome: ScanOutcome };

export type ScanEvent =
  | { type: "submit" }
  | { type: "resolve"; outcome: ScanOutcome }
  | { type: "abort" }
  | { type: "next" };

export const initialScan: ScanState = { phase: "idle" };

/** idle -> validating -> result -> idle (only via explicit "next"). Anything else is ignored. */
export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case "submit":
      return state.phase === "idle" ? { phase: "validating" } : state;
    case "resolve":
      return state.phase === "validating" ? { phase: "result", outcome: event.outcome } : state;
    case "abort":
      return state.phase === "validating" ? initialScan : state;
    case "next":
      return state.phase === "result" ? initialScan : state;
  }
}
