import { describe, expect, it } from "vitest";
import { createEventsEnabled } from "./flag";

describe("createEventsEnabled", () => {
  it('is on only when FEATURE_CREATE_EVENTS is exactly "1"', () => {
    expect(createEventsEnabled({ FEATURE_CREATE_EVENTS: "1" })).toBe(true);
    for (const v of [undefined, "", "0", "true", " 1", "yes"]) {
      expect(createEventsEnabled({ FEATURE_CREATE_EVENTS: v })).toBe(false);
    }
  });
});
