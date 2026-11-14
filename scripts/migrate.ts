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
    // EVENT_* is SEED-ONLY: it creates the first event if missing and fills its NULL fields.
    // It never overwrites an existing event (the DB is the source of truth afterwards).
    const { EVENT_SLUG, EVENT_NAME, EVENT_PRICE_CENTS, EVENT_CAPACITY } = process.env;
    if (EVENT_SLUG && EVENT_NAME && EVENT_PRICE_CENTS && EVENT_CAPACITY) {
      const startsRaw = process.env.EVENT_STARTS_AT?.trim();
      let startsAt: string | null = null;
      if (startsRaw) {
        const t = new Date(startsRaw);
        if (Number.isNaN(t.getTime())) throw new Error(`EVENT_STARTS_AT is not a valid ISO date: "${startsRaw}"`);
        startsAt = t.toISOString();
      }
      const venue = process.env.EVENT_VENUE?.trim() || null;
      const contact = process.env.EVENT_CONTACT?.trim() || null;
      const description = process.env.EVENT_DESCRIPTION?.trim() || null;
      const ins = await pool.query(
        `insert into events(id, slug, name, price_cents, capacity) values ($1,$1,$2,$3,$4)
         on conflict (id) do nothing`,
        [EVENT_SLUG, EVENT_NAME, Number(EVENT_PRICE_CENTS), Number(EVENT_CAPACITY)],
      );
      console.log(ins.rowCount ? `Seeded event "${EVENT_SLUG}"` : `Event "${EVENT_SLUG}" already exists: left untouched`);
      const fill = await pool.query(
        `update events set
           starts_at = coalesce(starts_at, $2::timestamptz),
           venue = coalesce(venue, $3),
           contact_email = coalesce(contact_email, $4),
           description = coalesce(description, $5)
         where id = $1
           and (starts_at is null or venue is null or contact_email is null or description is null)`,
        [EVENT_SLUG, startsAt, venue, contact, description],
      );
      console.log(`Backfilled null fields of "${EVENT_SLUG}" from EVENT_* (${fill.rowCount ?? 0} row(s) touched)`);
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
