type Env = Record<string, string | undefined>;

/** Server-side feature flag: event creation is on only when FEATURE_CREATE_EVENTS is exactly "1". */
export function createEventsEnabled(env: Env = process.env): boolean {
  return env.FEATURE_CREATE_EVENTS === "1";
}
