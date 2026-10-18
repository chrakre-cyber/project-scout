/**
 * Kalkulatorobservasjoner 18.10.2026 (GR-20261018-01…03): bildenes integritet og motorens samsvar med observert sluttbeløp.
 * Samsvar er validering, ikke kalibrering: ingen regel/sats er endret for å treffe, og ørebeløp er visningsverdier (ikke belegg for mellomavrunding, U-012).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateNorwegianVehicleTax } from "@/domain/tax";
import { OBSERVED_RUNS } from "./fixtures/tax-calculator-observations";

const ROOT = join(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "docs/tax/golden-runs/2026-10-18/MANIFEST.json"), "utf8")) as { files: Array<{ file: string; bytes: number; sha256: string }> };

/** Eksakt desimalstreng → to desimaler, halvt opp (kun visningsavrunding). */
function toTwoDecimals(exact: string): string {
  const [i = "0", f = ""] = exact.split(".");
  const scaled = BigInt(i) * 1000n + BigInt((f + "000").slice(0, 3)); // tre desimaler
  const r = (scaled + 5n) / 10n;
  return `${r / 100n}.${String(r % 100n).padStart(2, "0")}`;
}

describe("skjermbildene i docs/tax/golden-runs/2026-10-18 er uendret", () => {
  it("SHA-256 og størrelse stemmer med MANIFEST.json for alle ni filer", () => {
    expect(manifest.files).toHaveLength(9);
    for (const f of manifest.files) {
      const b = readFileSync(join(ROOT, f.file));
      expect(b.length, f.file).toBe(f.bytes);
      expect(createHash("sha256").update(b).digest("hex"), f.file).toBe(f.sha256);
    }
  });
  it("alle versjonsbilder i fixturen finnes i manifestet", () => {
    const files = new Set(manifest.files.map((f) => f.file));
    for (const r of OBSERVED_RUNS) for (const v of r.versions) expect(files.has(v.file), v.file).toBe(true);
  });
});

describe("motoren mot observert kalkulatorresultat (18.10.2026)", () => {
  for (const run of OBSERVED_RUNS) {
    it(`${run.id}: sluttkrav = observert total avgift; engangsavgift og vrakpant stemmer med visningsverdiene`, () => {
      const r = calculateNorwegianVehicleTax(run.input);
      expect(r.status).toBe("calculated_unverified");
      expect(r.blocked).toEqual([]);
      expect(r.finalClaim?.totalRegistrationTaxesNok).toBe(run.expectedTotalNok);
      expect(r.finalClaim?.scrappageDepositNok).toBe(2400);
      for (const v of run.versions) {
        expect(Number(v.totalAvgift), v.file).toBe(run.expectedTotalNok);
        if (v.breakdown) {
          expect(toTwoDecimals(r.oneOffTaxExact!), v.file).toBe(v.breakdown.oneOff);
          expect(v.breakdown.scrappage).toBe("2400.00");
        }
      }
    });
    it(`${run.id}: resultatet er fortsatt et ikke-godkjent estimat (klasse 1 finnes og alle anvendte regler er E1, men profilen er ikke godkjent)`, () => {
      const r = calculateNorwegianVehicleTax(run.input);
      expect(r.validation).toMatchObject({ status: "estimate_not_approved", profileApproved: false, class1References: 3 });
      expect(r.finalClaim?.validation.status).toBe("estimate_not_approved");
    });
  }

  it("prisversjoner holdes adskilt: totalen avhenger ikke av pris i motoren, men ingen versjon uten fullt inputbilde regnes som dokumentert input", () => {
    for (const run of OBSERVED_RUNS) {
      const prices = new Set(run.versions.map((v) => v.priceNok));
      const unlinked = run.versions.filter((v) => !v.fullInputDocumented);
      if (prices.size > 1) expect(unlinked.length, run.id).toBeGreaterThan(0);
    }
    expect(OBSERVED_RUNS[0]!.versions.map((v) => v.priceNok)).toEqual([600000, 2600000]);
    expect(OBSERVED_RUNS[1]!.versions.map((v) => v.priceNok)).toEqual([350000, 300000]);
    expect(OBSERVED_RUNS[2]!.versions.map((v) => v.priceNok)).toEqual([350000]);
  });

  it("visningssummen av avrundede delposter er høyere enn totalen: totalen vises uten øre (observasjon, ikke regelbelegg)", () => {
    for (const run of OBSERVED_RUNS) for (const v of run.versions) {
      if (!v.breakdown) continue;
      const sumOre = Math.round((Number(v.breakdown.oneOff) + Number(v.breakdown.scrappage)) * 100);
      expect(sumOre, v.file).toBeGreaterThan(Number(v.breakdown.total) * 100);
      expect(Math.floor(sumOre / 100), v.file).toBe(Number(v.breakdown.total));
    }
  });

  it("PHEV: motoren blokkerer wltp_combined (testantakelsen «vektet kombinert» er nødvendig og er ikke observert)", () => {
    const phev = OBSERVED_RUNS[0]!;
    const r = calculateNorwegianVehicleTax({ ...phev.input, co2: { gramsPerKm: 140, method: "wltp_combined" } });
    expect(r.status).toBe("blocked");
    expect(r.blocked.map((b) => b.code)).toContain("phev_requires_weighted_combined_co2");
  });

  it("EV: resultatet er uavhengig av CO₂-antakelsen (CO₂-felt ikke observert)", () => {
    const ev = OBSERVED_RUNS[1]!;
    const a = calculateNorwegianVehicleTax(ev.input);
    const b = calculateNorwegianVehicleTax({ ...ev.input, co2: { gramsPerKm: null, method: "unspecified" } });
    expect(b.status).toBe("calculated_unverified");
    expect(b.finalClaim?.totalRegistrationTaxesNok).toBe(a.finalClaim?.totalRegistrationTaxesNok);
  });
});
