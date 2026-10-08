// DEV-005B0: sletter utløpte søkekjøringer og resultater (DEC-028) via den betrodde skriveveien.
// Bruk: SCOUT_INGEST_DATABASE_URL=… node scripts/purge-expired.mjs [batch]   (eller `npm run purge:expired`, som leser .env.local)
// Periodisk kjøring (scheduler) er ikke satt opp ennå; skriptet kan kjøres manuelt eller fra en senere jobb.
// Skriver bare antall, aldri tilkoblingsstrengen.
import { createRequire } from "node:module";
const { Client } = createRequire(import.meta.url)("pg");
const url = process.env.SCOUT_INGEST_DATABASE_URL;
if (!url) { console.error("SCOUT_INGEST_DATABASE_URL mangler"); process.exit(2); }
const batch = Number(process.argv[2] ?? 500);
if (!Number.isInteger(batch) || batch < 1 || batch > 5000) { console.error("batch må være 1–5000"); process.exit(2); }
const client = new Client({ connectionString: url });
try {
  await client.connect();
  const { rows } = await client.query("select * from private.purge_expired_search_runs($1::integer)", [batch]);
  console.log(`Slettet ${rows[0].runs_deleted} kjøring(er) og ${rows[0].results_deleted} resultat(er).`);
} catch (e) {
  console.error(`Purge feilet (${e.code ?? "ukjent"})`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
