// Fixtures for vurderingen av nettleserløp (L4b/L5a/L5b): bygger stdout slik skriptene skriver den, fra den fastlåste planen scripts/ci/e2e-plan.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Key = "l4" | "econ006" | "econ006d";
export interface Plan { title: string; checks: string[]; partialInReal: string[]; optionalOneOf?: string[][]; logins: number; timeoutSec: number }
export const PLAN: Record<Key, Plan> = JSON.parse(readFileSync(join(__dirname, "../../scripts/ci/e2e-plan.json"), "utf8"));
export const KEYS: Key[] = ["l4", "econ006", "econ006d"];

export interface Spec { mode?: "real" | "emulator" | "none"; fail?: string[]; skip?: string[]; drop?: string[]; extra?: string[]; dup?: string[]; summary?: string | null; optional?: number; failExtra?: string }

/** stdout fra ett løp. `skip` = navn som rapporteres som HOPP; `fail` = navn som FEIL; `drop` = navn som utelates; `extra` = ukjente OK-sjekker. */
export function e2eOutput(key: Key, s: Spec = {}): { out: string; rc: number } {
  const mode = s.mode ?? "real";
  const names = PLAN[key].checks.filter((n) => !(s.drop ?? []).includes(n));
  const opt = PLAN[key].optionalOneOf?.[0]?.[s.optional ?? 0];
  const all = [...names, ...(opt ? [opt] : []), ...(s.extra ?? []), ...(s.dup ?? [])];
  const lines = all.map((n) => ((s.fail ?? []).includes(n) ? `FEIL ${n} — ${s.failExtra ?? "sjekk feilet"}` : (s.skip ?? []).includes(n) ? `HOPP ${n} — ekte modus: ikke mulig` : `OK   ${n}`.replace("OK   ", "OK  ")));
  const failed = lines.filter((l) => l.startsWith("FEIL")).length, skipped = lines.filter((l) => l.startsWith("HOPP")).length;
  const ok = lines.length - failed - skipped;
  const modeLine = mode === "real" ? "MODUS: EKTE lokal Supabase (GoTrue + PostgREST)" : mode === "emulator" ? "MODUS: EMULATOR (mini-supabase over isolert PostgreSQL) — IKKE Supabase" : "";
  const summary = s.summary === null ? "" : s.summary ?? `${ok}/${lines.length} sjekker OK${failed ? `, ${failed} FEIL` : ""}${skipped ? `, ${skipped} HOPPET (regnes IKKE som bestått — delvis dekning)` : ""} [modus: ${mode === "real" ? "real" : "emulator"}]`;
  const out = ["bygger uendret app …", modeLine, "starter …", ...lines, "", summary].filter((l) => l !== "" || true).join("\n");
  return { out, rc: failed ? 1 : skipped ? 4 : 0 };
}

/** Filer for evaluateDir: et fullstendig, ekte-modus-løp der alle sjekker er OK (også J3 — hypotetisk; i dag gir ekte modus HOPP på J3). */
export function e2eFiles(over: Partial<Record<Key, { out: string; rc: number | null } | null>> = {}): Record<string, string> {
  const files: Record<string, string> = {};
  for (const k of KEYS) {
    const v = k in over ? over[k] : e2eOutput(k);
    if (v === null || v === undefined) continue;
    files[`e2e-${k}.out`] = v.out;
    if (v.rc !== null) files[`e2e-${k}.rc`] = String(v.rc);
  }
  return files;
}
export const J3 = "J3: appen sendte aldri dealership_id i skrivekall for forhandlerinput (firma settes av databasen)";
