export type Config = {
  pey: { apiKey: string; webhookSecret: string; baseUrl: string };
  databaseUrl: string;
  organizerPassword: string;
  sessionSecret: string;
  appUrl: string;
  event: { slug: string; name: string; priceCents: number; capacity: number };
};

type Env = Record<string, string | undefined>;

const REQUIRED = [
  "PEY_API_KEY",
  "PEY_WEBHOOK_SECRET",
  "DATABASE_URL",
  "ORGANIZER_PASSWORD",
  "SESSION_SECRET",
  "EVENT_SLUG",
  "EVENT_NAME",
  "EVENT_PRICE_CENTS",
  "EVENT_CAPACITY",
  "APP_URL",
] as const;

const DEFAULT_PEY_BASE_URL = "https://api.pey.mx";

function positiveInt(name: string, raw: string): number {
  if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return Number(raw);
}

export function parseConfig(env: Env): Config {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")}`);
  const e = env as Record<(typeof REQUIRED)[number], string>;
  return {
    pey: {
      apiKey: e.PEY_API_KEY,
      webhookSecret: e.PEY_WEBHOOK_SECRET,
      baseUrl: env.PEY_BASE_URL || DEFAULT_PEY_BASE_URL,
    },
    databaseUrl: e.DATABASE_URL,
    organizerPassword: e.ORGANIZER_PASSWORD,
    sessionSecret: e.SESSION_SECRET,
    appUrl: e.APP_URL,
    event: {
      slug: e.EVENT_SLUG,
      name: e.EVENT_NAME,
      priceCents: positiveInt("EVENT_PRICE_CENTS", e.EVENT_PRICE_CENTS),
      capacity: positiveInt("EVENT_CAPACITY", e.EVENT_CAPACITY),
    },
  };
}

let cached: Config | undefined;
export function getConfig(): Config {
  return (cached ??= parseConfig(process.env));
}
