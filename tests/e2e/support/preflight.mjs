// TESTHJELPER (CI-001-FIX3): ren forhåndsvalidering av mål-adressene for nettleserløpene. Kjøres som FØRSTE handling i alle tre e2e-skript — før databaseklienten opprettes og
// før noen forbindelse åpnes — og igjen inne i connectBackend som ekstra vern. Manglende, ugyldig eller ikke-lokal database/API avvises uten noen DB-forbindelse eller spørring.
// Feilmeldingene nevner bare KATEGORI og vertsnavn, aldri hele adressen (som kan inneholde passord) og aldri nøkler.
// Lokal = nøyaktig vertsnavn «127.0.0.1» eller «localhost» (etter URL-parsing, så triks som «127.0.0.1@evil.example» eller «127.0.0.1.evil.example» avvises).
// URL.hostname alene er IKKE nok for databasen: node-postgres (pg-connection-string) lar query-parametere som `?host=` / `?port=` overstyre vert og port. Databaseadressen valideres derfor
// på to måter: (1) parametere som kan overstyre målet avvises (navnet URL-dekodes og sammenlignes uavhengig av store/små bokstaver, så `?%68ost=` fanges), og (2) den EFFEKTIVE
// tilkoblingskonfigurasjonen leses med samme driver som skal brukes (`new pg.Client({ connectionString })` — bare konstruktøren, ingen forbindelse) og må være lokal og lik adressens vert/port.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const OVERRIDE_PARAMS = new Set(["host", "hostaddr", "port", "dbname", "database", "service"]);

export class TargetError extends Error {
  constructor(message) { super(message); this.name = "TargetError"; }
}

function parseTarget(label, value, protocols) {
  if (typeof value !== "string" || value.trim() === "") throw new TargetError(`${label} mangler`);
  let u;
  try { u = new URL(value); } catch { throw new TargetError(`${label} er ugyldig`); }
  if (!protocols.includes(u.protocol)) throw new TargetError(`${label} er ugyldig (protokoll ${u.protocol})`);
  if (!LOCAL_HOSTS.has(u.hostname)) throw new TargetError(`Nekter å kjøre mot ikke-lokal ${label} (vert: ${u.hostname || "ukjent"})`);
  return value;
}

function parseDatabase(label, value) {
  parseTarget(label, value, ["postgres:", "postgresql:"]);
  const u = new URL(value);
  for (const [rawName] of u.searchParams) {
    const name = rawName.trim().toLowerCase();
    if (OVERRIDE_PARAMS.has(name)) throw new TargetError(`${label} har parameter som kan overstyre tilkoblingsmålet (${name}); avvist`);
  }
  let eff;
  try { eff = new (require("pg").Client)({ connectionString: value }).connectionParameters; } catch { throw new TargetError(`${label} er ugyldig (kan ikke tolkes av databasedriveren)`); }
  const host = String(eff.host ?? "");
  if (!LOCAL_HOSTS.has(host)) throw new TargetError(`Nekter å kjøre mot ikke-lokal ${label} (effektiv vert: ${host || "ukjent"})`);
  if (host !== u.hostname || (u.port !== "" && Number(eff.port) !== Number(u.port))) throw new TargetError(`${label}: driverens effektive vert/port avviker fra adressen; avvist`);
  return value;
}

/**
 * @param {{ mode?: "real" | "emulator", env?: Record<string, string | undefined> }} [opts]
 * @returns {{ mode: "real" | "emulator", dbUrl: string, apiUrl: string | null, hasPublishableKey: boolean }}
 */
export function preflightTargets({ mode = process.env.E2E_SUPABASE_MODE === "real" ? "real" : "emulator", env = process.env } = {}) {
  const dbUrl = parseDatabase("database (SUPABASE_TEST_DB_URL)", env.SUPABASE_TEST_DB_URL);
  if (mode !== "real") return { mode, dbUrl, apiUrl: null, hasPublishableKey: false }; // emulatoren lager sin egen lokale API
  const apiUrl = parseTarget("Supabase-API (SUPABASE_TEST_URL)", env.SUPABASE_TEST_URL, ["http:", "https:"]);
  if (typeof env.SUPABASE_TEST_PUBLISHABLE_KEY !== "string" || env.SUPABASE_TEST_PUBLISHABLE_KEY.trim() === "") throw new TargetError("publishable key (SUPABASE_TEST_PUBLISHABLE_KEY) mangler");
  return { mode, dbUrl, apiUrl, hasPublishableKey: true };
}

/** Observatørens mål (CI-001, J3): bare lokalt http-mål (127.0.0.1/localhost, uten innlogging i adressen). Kaster TargetError uten å skrive ut adressen. */
export function assertLocalHttpTarget(label, value) {
  const v = parseTarget(label, value, ["http:"]);
  const u = new URL(v);
  if (u.username || u.password) throw new TargetError(`${label} har innlogging i adressen; avvist`);
  return v;
}
