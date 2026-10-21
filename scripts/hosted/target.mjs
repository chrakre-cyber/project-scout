// HOST-001 (forberedelse, ikke kjørt mot hosted): validering av ETT angitt hosted TESTPROSJEKT. Hosted-modus er skilt fra localhost-sperrene (som er uendret og fortsatt standard)
// og må velges uttrykkelig; alt må peke på samme prosjekt (ref) — ellers avvises det. Ren funksjon: ingen nettverk, ingen DB-forbindelse. Feilmeldinger nevner bare KATEGORI —
// aldri adresser, prosjekt-ref, passord eller nøkler. Utskrift/rapport bruker bare et fingeravtrykk (sha256 av ref, 8 tegn) og en sterkt maskert ref.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const STAGES = Object.freeze(["check-target", "h2-inspect", "h2-dry-run", "h2-apply", "h3-api", "h4-cleanup", "h4-cleanup-execute"]);
export const MODES = Object.freeze(["fresh", "upgrade"]);
const REF_RE = /^[a-z0-9]{20}$/;
const OVERRIDE_PARAMS = new Set(["host", "hostaddr", "port", "dbname", "database", "service", "options", "user", "password"]);
const SSL_OK = new Set(["require", "verify-ca", "verify-full"]);

export class HostedTargetError extends Error {
  constructor(category) { super(`hosted-mål avvist: ${category}`); this.name = "HostedTargetError"; this.category = category; }
}
const fail = (c) => { throw new HostedTargetError(c); };
const present = (v) => typeof v === "string" && v.trim() !== "";

export const fingerprintOf = (ref) => createHash("sha256").update(`scout-hosted:${ref}`).digest("hex").slice(0, 8);
export const maskRef = (ref) => `${ref.slice(0, 2)}…${ref.slice(-2)}`;

function parseApi(value, ref) {
  let u;
  try { u = new URL(value); } catch { return fail("API-adresse ugyldig"); }
  if (u.protocol !== "https:" || u.hostname !== `${ref}.supabase.co` || u.username || u.password || u.port || (u.pathname !== "/" && u.pathname !== "") || u.search || u.hash) return fail("API-adressen er ikke nøyaktig det angitte prosjektets https-adresse");
}

function parseDb(value, ref) {
  let u;
  try { u = new URL(value); } catch { return fail("database-adresse ugyldig"); }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return fail("database-adresse har feil protokoll");
  for (const [raw] of u.searchParams) if (OVERRIDE_PARAMS.has(raw.trim().toLowerCase())) return fail("database-adressen har parameter som kan overstyre målet");
  const ssl = u.searchParams.get("sslmode");
  if (ssl !== null && !SSL_OK.has(ssl.toLowerCase())) return fail("database-adressen tillater ukryptert forbindelse");
  const user = decodeURIComponent(u.username);
  let kind;
  if (u.hostname === `db.${ref}.supabase.co`) { if (user !== "postgres") return fail("database-bruker passer ikke til direkte tilkobling"); kind = "direct"; }
  else if (/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)) { if (user !== `postgres.${ref}`) return fail("database-bruker peker ikke på det angitte prosjektet (pooler)"); kind = "pooler"; }
  else return fail("database-verten er ikke det angitte hosted-prosjektets");
  if (u.port !== "" && u.port !== "5432" && u.port !== "6543") return fail("database-port ikke tillatt");
  if (u.pathname !== "/postgres" && u.pathname !== "/") return fail("database-navn ikke tillatt");
  let eff;
  try { eff = new (require("pg").Client)({ connectionString: value }).connectionParameters; } catch { return fail("database-adressen kan ikke tolkes av databasedriveren"); }
  if (String(eff.host ?? "") !== u.hostname) return fail("driverens effektive vert avviker fra adressen");
  return kind;
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ stage?: string }} [opts] stage: trinnet som skal kjøres; SCOUT_HOSTED_STAGE må være nøyaktig dette (hvert trinn krever egen tillatelse)
 * @returns {{ ref: string, mode: "fresh" | "upgrade", stage: string | null, dbKind: "direct" | "pooler", fingerprint: string, masked: string }}
 */
export function parseHostedTarget(env, { stage } = {}) {
  if (stage !== undefined && !STAGES.includes(stage)) fail("ukjent trinn");
  const ref = env.SCOUT_HOSTED_PROJECT_REF;
  if (!present(ref) || !REF_RE.test(ref)) fail("prosjekt-ref mangler eller har ugyldig form");
  if (env.SCOUT_HOSTED_CONFIRM !== `TESTPROSJEKT:${ref}`) fail("bekreftelsen «TESTPROSJEKT:<ref>» mangler eller gjelder et annet prosjekt");
  if (!MODES.includes(env.SCOUT_HOSTED_MODE ?? "")) fail("modus må velges uttrykkelig (fresh = tomt prosjekt, upgrade = eksisterende database)");
  if (stage !== undefined && env.SCOUT_HOSTED_STAGE !== stage) fail("trinnet er ikke uttrykkelig tillatt (SCOUT_HOSTED_STAGE)");
  if (!present(env.SUPABASE_TEST_URL)) fail("API-adresse mangler");
  parseApi(env.SUPABASE_TEST_URL, ref);
  if (!present(env.SUPABASE_TEST_DB_URL)) fail("database-adresse mangler");
  const dbKind = parseDb(env.SUPABASE_TEST_DB_URL, ref);
  if (!present(env.SUPABASE_TEST_PUBLISHABLE_KEY)) fail("publishable key mangler");
  return { ref, mode: env.SCOUT_HOSTED_MODE, stage: stage ?? null, dbKind, fingerprint: fingerprintOf(ref), masked: maskRef(ref) };
}

/** Det eneste som skal vises/lagres om målet. */
export const describeTarget = (t) => ({ fingerprint: t.fingerprint, mode: t.mode, dbKind: t.dbKind });
