// Produsent–konsument-kontrakt: sjekkidentitetene i scripts/ci/e2e-plan.json må stemme med check()/skip()-kallene i selve nettleserskriptene.
// Testgrunnlaget her leses fra skriptenes kildekode, ikke fra planen vurdereren bruker (avvik gjorde at et vellykket ekte L4-løp ble FAIL).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateE2E } from "../scripts/ci/evaluate.mjs";
import { normalizeCheckName } from "../scripts/ci/e2e-names.mjs";
import { J3, KEYS, PLAN, e2eOutput } from "./ci/e2e-fixtures";
import { producers } from "./ci/e2e-producers";

const planNames = (k: (typeof KEYS)[number]) => [...PLAN[k].checks, ...(PLAN[k].optionalOneOf ?? []).flat()];

describe.each(KEYS)("%s: planens sjekkidentiteter mot produsenten", (k) => {
  const P = producers(k);
  it("hver planlagt sjekk produseres av et check()/skip()-kall", () => {
    const orphan = planNames(k).filter((n) => !P.some((p) => p.regex.test(n)));
    expect(orphan).toEqual([]);
  });
  it("hvert check()/skip()-kall dekkes av planen (ingen uplanlagt sjekk som ville gi UVENTET)", () => {
    // Unntak: to kryssjekker som bare finnes i emulatormodus med E2E_REQUEST_OBSERVER=1 (observatør mot emulatorlogg); de kjøres aldri i ekte modus (se statisk test under).
    const EMULATOR_ONLY = /^kryssjekk: observatøren og emulatorloggen ser de samme skrivekallene|^kryssjekk: observatørens J3-utfall er lik emulatorens$/;
    const orphan = P.filter((p) => !planNames(k).some((n) => p.regex.test(n)) && !(k === "econ006" && EMULATOR_ONLY.test(p.literal))).map((p) => `l.${p.line}: ${p.literal}`);
    expect(orphan).toEqual([]);
  });
  it("ingen planlagt identitet inneholder en HOPP-/FEIL-begrunnelse (skip()-årsaken er et eget argument)", () => {
    const skipLiterals = new Set(P.filter((p) => p.kind === "skip").map((p) => normalizeCheckName(p.literal)));
    for (const n of planNames(k)) expect(skipLiterals.has(n) ? true : !/ — (emulatoren|ekte modus|krever)/.test(n)).toBe(true);
  });
  it("planen har ingen duplikater", () => { expect(new Set(planNames(k)).size).toBe(planNames(k).length); });
});

describe("rapport med skriptets egne navn", () => {
  it("L4: ekte modus, alle tolv sjekker OK med navnene fra skriptet ⇒ PASS", () => {
    const names = producers("l4").filter((p) => p.kind === "check").map((p) => p.literal);
    const unique = [...new Set(names)];
    expect(unique).toHaveLength(12);
    const out = ["MODUS: EKTE lokal Supabase (GoTrue + PostgREST)", ...unique.map((n) => `OK  ${n}`), "12/12 sjekker OK [modus: real]"].join("\n");
    const r = evaluateE2E("l4", out, 0);
    expect(r.status, r.notes.join("\n")).toBe("PASS");
  });
  it("L4: emulator skriver samme navn som HOPP med årsak — årsaken er ikke del av identiteten, men emulator er ikke ekte modus", () => {
    const real = producers("l4").find((p) => p.kind === "skip")!.literal;
    const out = ["MODUS: EMULATOR (mini-supabase over isolert PostgreSQL) — IKKE Supabase", ...PLAN.l4.checks.map((n) => (n === real ? `HOPP ${n} — emulatoren validerer bare JWT-signatur/utløp` : `OK  ${n}`)), "11/12 sjekker OK, 1 HOPPET [modus: emulator]"].join("\n");
    expect(evaluateE2E("l4", out, 4).status).toBe("FAIL");
  });
  it("L4: ekte modus med HOPP på revokeringssjekken (med årsak) ⇒ SKIPPED, ikke PASS", () => {
    const real = producers("l4").find((p) => p.kind === "skip")!.literal;
    const out = ["MODUS: EKTE lokal Supabase (GoTrue + PostgREST)", ...PLAN.l4.checks.map((n) => (n === real ? `HOPP ${n} — en årsak` : `OK  ${n}`)), "11/12 sjekker OK, 1 HOPPET [modus: real]"].join("\n");
    expect(evaluateE2E("l4", out, 4).status).toBe("SKIPPED");
  });
  it("L4: kort navn med suffiks i OK-linje, og prefiksvarianter av et navn, aksepteres ikke (ingen prefiksmatching)", () => {
    const real = producers("l4").find((p) => p.kind === "skip")!.literal;
    const mk = (n: string) => ["MODUS: EKTE lokal Supabase (GoTrue + PostgREST)", ...PLAN.l4.checks.map((c) => `OK  ${c === real ? n : c}`), "12/12 sjekker OK [modus: real]"].join("\n");
    expect(evaluateE2E("l4", mk(real + " — noe ekstra"), 0).status).toBe("FAIL");
    expect(evaluateE2E("l4", mk(real.slice(0, -5)), 0).status).toBe("FAIL");
  });
  it("econ006: J3 som HOPP med produsentens egen årsak ⇒ DELVIS (identiteten er J3-navnet uten årsak)", () => {
    const j3 = producers("econ006").find((p) => p.kind === "check" && p.literal.startsWith("J3: appen sendte aldri dealership_id"))!.literal;
    expect(j3).toBe(J3);
    expect(PLAN.econ006.partialInReal).toEqual([J3]);
    const r = e2eOutput("econ006", { skip: [J3] });
    expect(evaluateE2E("econ006", r.out, r.rc).status).toBe("PARTIAL");
    const ok = e2eOutput("econ006", {});
    expect(evaluateE2E("econ006", ok.out, ok.rc).status).toBe("PASS");
  });
});

describe("econ006: observatørens kryssjekker kjøres bare i emulatormodus", () => {
  it("kryssjekkene ligger i grenen `else if (emu.observer)` etter ekte-modus-grenen, ikke i ekte modus", () => {
    const c = readFileSync(join(__dirname, "e2e/econ006.e2e.mjs"), "utf8");
    const real = c.indexOf('if (emu.mode === "real") {'), other = c.indexOf("} else if (emu.observer) {"), cross = c.indexOf('check("kryssjekk:');
    expect(real).toBeGreaterThan(-1);
    expect(other).toBeGreaterThan(real);
    expect(cross).toBeGreaterThan(other);
  });
});
