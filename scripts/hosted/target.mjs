// HOST-001 (forberedelse, ikke kjørt mot hosted): validering av ETT angitt hosted TESTPROSJEKT. Hosted-modus er skilt fra localhost-sperrene (som er uendret og fortsatt standard)
// og må velges uttrykkelig; alt må peke på samme prosjekt (ref) — ellers avvises det. Ren funksjon: ingen nettverk, ingen DB-forbindelse. Feilmeldinger nevner bare KATEGORI —
// aldri adresser, prosjekt-ref, passord eller nøkler. Utskrift/rapport bruker bare et fingeravtrykk (sha256 av ref, 8 tegn) og en sterkt maskert ref.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const STAGES = Object.freeze(["check-target", "h2-inspect", "h2-dry-run", "h2-apply", "h3-api", "h4-cleanup", "h4-cleanup-execute"]);
export const MODES = Object.freeze(["fresh", "upgrade"]);
const REF_RE = /^[a-z0-9]{20}$/;
const OVERRIDE_PARAMS = new Set(["host", "hostaddr", "port", "dbname", "database", "service", "options", "user", "password"]);
// TLS-policy (felles for ALLE hosted databaseklienter og CLI-forbrukere): adressen må ha nøyaktig ÉN `sslmode=verify-full` (eneste modus med uendret betydning i pg 8 og 9 og i Supabase CLI),
// ingen andre ssl-parametere, og våre egne klienter bygges av eksplisitte felt (ikke connectionString) med sertifikatkontroll. Effektiv ssl-innstilling kontrolleres med driveren.
const SSL_REQUIRED = "verify-full";
const isSslParam = (name) => name === "ssl" || name.startsWith("ssl") || name === "uselibpqcompat";

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
  const sslmodes = [];
  for (const [raw, v] of u.searchParams) {
    const name = raw.trim().toLowerCase();
    if (OVERRIDE_PARAMS.has(name)) return fail("database-adressen har parameter som kan overstyre målet");
    if (name === "sslmode") sslmodes.push(v.trim().toLowerCase());
    else if (isSslParam(name)) return fail("database-adressen har tvetydige eller overstyrende ssl-parametere (bare sslmode=verify-full er tillatt)");
  }
  if (sslmodes.length !== 1 || sslmodes[0] !== SSL_REQUIRED) return fail("database-adressen må ha nøyaktig én sslmode=verify-full (kryptert forbindelse med sertifikatkontroll)");
  const user = decodeURIComponent(u.username);
  let kind;
  if (u.hostname === `db.${ref}.supabase.co`) { if (user !== "postgres") return fail("database-bruker passer ikke til direkte tilkobling"); kind = "direct"; }
  else if (/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname)) { if (user !== `postgres.${ref}`) return fail("database-bruker peker ikke på det angitte prosjektet (pooler)"); kind = "pooler"; }
  else return fail("database-verten er ikke det angitte hosted-prosjektets");
  if (u.port !== "" && u.port !== "5432" && u.port !== "6543") return fail("database-port ikke tillatt");
  if (u.pathname !== "/postgres" && u.pathname !== "/") return fail("database-navn ikke tillatt");
  return { kind, user, password: decodeURIComponent(u.password), host: u.hostname, port: u.port === "" ? 5432 : Number(u.port) };
}

/** Eksplisitt klientkonfigurasjon for ALLE hosted databaseklienter (CLI, H3-harness, opprydding): ingen connectionString (ingen parse-overstyring), alltid TLS med sertifikatkontroll. */
function buildDbConfig(parts, env) {
  const ssl = { rejectUnauthorized: true };
  if (present(env.SCOUT_HOSTED_DB_CA_FILE)) {   // valgfri offentlig CA-fil (ikke hemmelig); uleselig fil ⇒ avvist, aldri stille fall tilbake
    try { ssl.ca = readFileSync(env.SCOUT_HOSTED_DB_CA_FILE, "utf8"); } catch { fail("CA-filen (SCOUT_HOSTED_DB_CA_FILE) kan ikke leses"); }
    if (!ssl.ca.includes("BEGIN CERTIFICATE")) fail("CA-filen inneholder ikke et sertifikat");
  }
  const cfg = { host: parts.host, port: parts.port, user: parts.user, password: parts.password, database: "postgres", ssl, connectionTimeoutMillis: 15000, statement_timeout: 30000, application_name: "scout-hosted-prep" };
  let eff;
  try { eff = new (require("pg").Client)(cfg).connectionParameters; } catch { return fail("databasedriveren kan ikke bygge konfigurasjonen"); }
  if (String(eff.host) !== parts.host || Number(eff.port) !== parts.port || eff.user !== parts.user || eff.database !== "postgres") fail("driverens effektive tilkobling avviker fra den validerte");
  if (!eff.ssl || typeof eff.ssl !== "object" || eff.ssl.rejectUnauthorized !== true) fail("driverens effektive ssl-innstilling er ikke kryptert med sertifikatkontroll");
  return cfg;
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
  const db = parseDb(env.SUPABASE_TEST_DB_URL, ref);
  buildDbConfig(db, env);   // kaster hvis effektiv ssl/tilkobling ikke er som validert
  const dbKind = db.kind;
  if (!present(env.SUPABASE_TEST_PUBLISHABLE_KEY)) fail("publishable key mangler");
  return { ref, mode: env.SCOUT_HOSTED_MODE, stage: stage ?? null, dbKind, fingerprint: fingerprintOf(ref), masked: maskRef(ref) };
}

/** Det eneste som skal vises/lagres om målet. */
export const describeTarget = (t) => ({ fingerprint: t.fingerprint, mode: t.mode, dbKind: t.dbKind });

/**
 * Konfigurasjon for en hosted databaseklient (`new pg.Client(hostedDbConfig(env, { stage }))`). Validerer hele målet (samme regler som parseHostedTarget, inkl. TLS-policyen) og returnerer
 * eksplisitte felt med `ssl: { rejectUnauthorized: true }`. Brukes av CLI, H3-harnessen og opprydding — aldri `connectionString`.
 */
export function hostedDbConfig(env, { stage } = {}) {
  parseHostedTarget(env, stage === undefined ? undefined : { stage });
  return buildDbConfig(parseDb(env.SUPABASE_TEST_DB_URL, env.SCOUT_HOSTED_PROJECT_REF), env);
}
