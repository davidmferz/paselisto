import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Usage: DATABASE_URL=... pnpm db:migrate  (also seeds the single event from EVENT_* env if present)
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  neonConfig.webSocketConstructor = ws;
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8"));
    const { EVENT_SLUG, EVENT_NAME, EVENT_PRICE_CENTS, EVENT_CAPACITY } = process.env;
    if (EVENT_SLUG && EVENT_NAME && EVENT_PRICE_CENTS && EVENT_CAPACITY) {
      await pool.query(
        `insert into events(id, slug, name, price_cents, capacity) values ($1,$1,$2,$3,$4)
         on conflict (id) do update set name = excluded.name,
           price_cents = excluded.price_cents, capacity = excluded.capacity`,
        [EVENT_SLUG, EVENT_NAME, Number(EVENT_PRICE_CENTS), Number(EVENT_CAPACITY)],
      );
      console.log(`Seeded event "${EVENT_SLUG}"`);
    } else {
      console.log("EVENT_* env not set: skipped event seed");
    }
    console.log("Migration complete");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
