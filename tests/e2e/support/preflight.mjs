// TESTHJELPER (CI-001-FIX3): ren forhåndsvalidering av mål-adressene for nettleserløpene. Kjøres som FØRSTE handling i alle tre e2e-skript — før databaseklienten opprettes og
// før noen forbindelse åpnes — og igjen inne i connectBackend som ekstra vern. Manglende, ugyldig eller ikke-lokal database/API avvises uten noen DB-forbindelse eller spørring.
// Feilmeldingene nevner bare KATEGORI og vertsnavn, aldri hele adressen (som kan inneholde passord) og aldri nøkler.
// Lokal = nøyaktig vertsnavn «127.0.0.1» eller «localhost» (etter URL-parsing, så triks som «127.0.0.1@evil.example» eller «127.0.0.1.evil.example» avvises).
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

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

/**
 * @param {{ mode?: "real" | "emulator", env?: Record<string, string | undefined> }} [opts]
 * @returns {{ mode: "real" | "emulator", dbUrl: string, apiUrl: string | null, hasPublishableKey: boolean }}
 */
export function preflightTargets({ mode = process.env.E2E_SUPABASE_MODE === "real" ? "real" : "emulator", env = process.env } = {}) {
  const dbUrl = parseTarget("database (SUPABASE_TEST_DB_URL)", env.SUPABASE_TEST_DB_URL, ["postgres:", "postgresql:"]);
  if (mode !== "real") return { mode, dbUrl, apiUrl: null, hasPublishableKey: false }; // emulatoren lager sin egen lokale API
  const apiUrl = parseTarget("Supabase-API (SUPABASE_TEST_URL)", env.SUPABASE_TEST_URL, ["http:", "https:"]);
  if (typeof env.SUPABASE_TEST_PUBLISHABLE_KEY !== "string" || env.SUPABASE_TEST_PUBLISHABLE_KEY.trim() === "") throw new TargetError("publishable key (SUPABASE_TEST_PUBLISHABLE_KEY) mangler");
  return { mode, dbUrl, apiUrl, hasPublishableKey: true };
}
