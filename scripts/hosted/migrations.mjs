// HOST-001 (forberedelse): migrasjonslisten i repoet, klassifisering av hva et mål-database har anvendt, og skille mellom TOMT prosjekt og OPPGRADERING av eksisterende database. Rene funksjoner.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Migrasjoner som aldri er anvendt hostet (kartlagt i docs/econ/forslag-supabase-kontroll.md); brukes bare til merknader. */
export const KNOWN_NEVER_APPLIED_HOSTED = Object.freeze(["20261021090000", "20261022090000", "20261023090000"]);
export const DATA002D_VERSION = "20261022090000";

export function repoMigrationList(dir = "supabase/migrations") {
  return readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort().map((f) => ({ version: f.slice(0, 14), name: f.slice(15, -4), sha256: createHash("sha256").update(readFileSync(join(dir, f))).digest("hex") }));
}
export const repoHash = (list) => createHash("sha256").update(list.map((m) => `${m.version}:${m.sha256}`).join("\n")).digest("hex");

/** applied: versjoner fra supabase_migrations.schema_migrations (ev. tom). */
export function classifyMigrations(applied, repoList) {
  const a = [...new Set(applied)].sort();
  const versions = repoList.map((m) => m.version);
  const unknownApplied = a.filter((v) => !versions.includes(v));
  const base = { appliedCount: a.length, repoCount: versions.length, unknownApplied };
  if (a.length === 0) return { kind: "empty", ...base, pending: versions };
  if (unknownApplied.length) return { kind: "diverged", ...base, pending: [], reason: "anvendte versjoner som ikke finnes i repoet" };
  const prefix = versions.slice(0, a.length);
  if (a.some((v, i) => v !== prefix[i])) return { kind: "diverged", ...base, pending: [], reason: "anvendte versjoner er ikke et sammenhengende prefiks av repoets rekkefølge (hull)" };
  const pending = versions.slice(a.length);
  return { kind: pending.length ? "prefix" : "current", ...base, pending };
}
export const includesDataMigration = (cls) => cls.kind === "current" || (cls.kind === "prefix" && !cls.pending.includes(DATA002D_VERSION));
