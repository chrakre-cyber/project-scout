/**
 * ECON-003 — gyldne økonomifixturer for de tre casene (PHEV, EV, diesel). Gjenbruker `tax-golden.ts` (ECON-001 §7-tall, oppgitt av Christian) og
 * `tax-calculator-observations.ts` (dokumenterte kalkulatorobservasjoner 18.10.2026, GR-20261018-01…03) — ingen parallelle sannheter.
 *
 * A. OFFISIELL BEREGNINGSREFERANSE — transport 0, ingen Merovo-standarder.
 *    A-observert: dokumenterte skjermbilder (prisversjoner, brukerbekreftet dato, inputantakelser) i `OBSERVED_RUNS`.
 *    A-oppgitt: de historiske EUR-casenes kjøpesum/mva./total (ECON-001 §7), oppgitt av Christian UTEN skjermbilder: status `stated_not_documented`.
 * B. MEROVO-SCENARIO — egne, merkede aritmetiske forventninger (transport, mva.-tilstand, kurs-roller). IKKE nye offisielle referanser.
 *
 * Ingen kjøretøydata her er verifisert (vekt er forhandleroppgitt testinput ⇒ avgiften er et estimat i motoren). Kurs 10,6709 er et FIXTURE-INPUT,
 * ikke en offisiell kurs. Åpne punkter (se `OPEN_ITEMS`) er ikke løst av denne filen: U-013 (mva.-avrunding), U-003, U-008 (flyttet til ECON-004).
 */
import { GOLDEN_CASES, type GoldenCase } from "./tax-golden";
import { OBSERVED_RUNS, type ObservedRun } from "./tax-calculator-observations";
import type { VatState } from "./econ-arithmetic";

export type CaseId = "CASE-001" | "CASE-002" | "CASE-003";

export const FIXTURE_FX = {
  pair: "EUR/NOK",
  rate: "10.6709",
  basis: "fixture",
  fixtureOnly: true,
  status: "test_input_not_official_rate",
  note: "Reproduserer de oppgitte kjøpesummene (ECON-001 §4.2). Samme verdi for begge roller i de offisielle casene (forutsetning: kalkulatorkjøringene brukte én kurs). Ikke en produksjonskurs.",
} as const;

export const OPEN_ITEMS = {
  "U-013": "MVA-avrunding mangler kilde. Fixturene bruker «nærmeste hele krone, halvt opp» som FIXTURE-KONVENSJON (ECON-001 §4.3); likhetstilfeller (x,5) forekommer ikke og er ikke testet. Overtatt av ECON-004.",
  "U-003": "MVA-kildenes årgang (R-DED-001). Flyttet til ECON-004; ikke undersøkt her.",
  "U-008": "Tollkurs (R-IMP-FX-001): hvilken kurs og når. Flyttet til ECON-004; fixturene bærer bare to roller med fixture-kurs.",
  "R-IMP-VAT-003": "Elbilens 300 000-fritak: anvendelse ved forhandlerimport er uavklart. CASE-002 B-scenarioene er betingede (fritak antatt, ikke bekreftet).",
  "R-IMP-VAT-002": "Mva.-grunnlag = kjøpesum + transport (+ forsikring) til innførselssted (E1P/E1X). Forsikring er 0 i fixturene (ikke oppgitt).",
  "R-DED-001": "Fradragsrett for personbil til videresalg (E1P): `recoverable`/`non_recoverable` er scenarier, aldri utledet.",
} as const;

/** Offisielle (oppgitte) verdier fra ECON-001 §7, LÅST: testen feiler hvis de endres. A-oppgitt har IKKE skjermbildedokumentasjon. */
export const OFFICIAL_STATED_LOCK: Readonly<Record<CaseId, { purchaseNok: number; vatNok: number; avgiftNok: number; totalNok: number; oneOffNok: number; scrappageNok: number }>> = {
  "CASE-001": { purchaseNok: 2689248, vatNok: 672312, avgiftNok: 529069, totalNok: 3890629, oneOffNok: 526669, scrappageNok: 2400 },
  "CASE-002": { purchaseNok: 366663, vatNok: 16666, avgiftNok: 16748, totalNok: 400077, oneOffNok: 14348, scrappageNok: 2400 },
  "CASE-003": { purchaseNok: 411491, vatNok: 102873, avgiftNok: 333723, totalNok: 848087, oneOffNok: 331323, scrappageNok: 2400 },
};

const RUN_OF: Record<CaseId, string> = { "CASE-001": "GR-20261018-01", "CASE-002": "GR-20261018-02", "CASE-003": "GR-20261018-03" };

export interface EconCaseFixture {
  id: CaseId;
  label: string;
  golden: GoldenCase;
  observedRun: ObservedRun;
  advertisedNetPriceEur: number;
  /** Beløp utenfor mva.-grunnlaget: bare CASE-002 (elbil), og anvendelsen er uavklart (R-IMP-VAT-003). */
  vatExemptionNok: number;
  vatExemptionStatus: "not_applicable" | "assumed_application_open";
  vehicleData: { status: "unverified_test_input"; weightBasis: string; note: string };
  officialStatedProvenance: "stated_not_documented";
}

export const ECON_CASES: readonly EconCaseFixture[] = GOLDEN_CASES.map((golden) => {
  const id = golden.id as CaseId;
  const observedRun = OBSERVED_RUNS.find((r) => r.id === RUN_OF[id])!;
  return {
    id,
    label: golden.label,
    golden,
    observedRun,
    advertisedNetPriceEur: golden.documented.advertisedNetPriceEur,
    vatExemptionNok: id === "CASE-002" ? 300000 : 0,
    vatExemptionStatus: id === "CASE-002" ? "assumed_application_open" : "not_applicable",
    vehicleData: { status: "unverified_test_input", weightBasis: golden.input.norwegianTaxWeight.basis, note: "Vekt/CO₂/drivlinje er testinput (forhandleroppgitt/utledet), ikke verifisert; motoren merker avgiften som estimat." },
    officialStatedProvenance: "stated_not_documented",
  } as const;
});

export interface MeroVoExpectation {
  /** kjøpesum (anskaffelseskurs) + transport — for fixturene lik tollverdien. */
  customsValueNok: number;
  importVatNok: number;
  totalRegistrationTaxesNok: number;
  importCashRequirementNok: number;
  landedRecoverableNok: number;
  landedNonRecoverableNok: number;
}

/** B: Merovo-scenario, transport 8 000 (`assumed-default`), begge kurs-roller = fixturekurs. Forventninger fra ECON-001 §7.B (arithmetikk, ikke offisielt validert). */
export const MEROVO_DEFAULT_TRANSPORT_NOK = 8000;
export const MEROVO_DEFAULT_EXPECTED: Readonly<Record<CaseId, MeroVoExpectation>> = {
  "CASE-001": { customsValueNok: 2697248, importVatNok: 674312, totalRegistrationTaxesNok: 529069, importCashRequirementNok: 3900629, landedRecoverableNok: 3226317, landedNonRecoverableNok: 3900629 },
  "CASE-002": { customsValueNok: 374663, importVatNok: 18666, totalRegistrationTaxesNok: 16748, importCashRequirementNok: 410077, landedRecoverableNok: 391411, landedNonRecoverableNok: 410077 },
  "CASE-003": { customsValueNok: 419491, importVatNok: 104873, totalRegistrationTaxesNok: 333723, importCashRequirementNok: 858087, landedRecoverableNok: 753214, landedNonRecoverableNok: 858087 },
};

/** B (syntetisk): kurs-roller. CASE-003 med anskaffelseskurs 10,6709 og en SYNTETISK tollkurs 10,7000 (ikke en offisiell eller foreslått kurs). Håndregnet. */
export const FX_ROLES_SCENARIO = {
  id: "B-FX-ROLES-CASE-003",
  caseId: "CASE-003" as CaseId,
  acquisitionFxRate: "10.6709",
  customsFxRate: "10.7000",
  customsFxStatus: "synthetic_test_assumption",
  transportNok: 8000,
  expected: {
    acquisitionUsedNok: 411491, // 38 562 × 10,6709 = 411 491,25 → 411 491
    customsValueNok: 420613, // 38 562 × 10,7000 = 412 613,40 → 412 613; + 8 000
    importVatNok: 105153, // 25 % × 420 613 = 105 153,25 → 105 153
    totalRegistrationTaxesNok: 333723,
    importCashRequirementNok: 858367,
    landedRecoverableNok: 753214, // påvirkes ikke av tollkursen (mva. utelatt)
    landedNonRecoverableNok: 858367,
  },
} as const;

export const VAT_STATES: readonly VatState[] = ["recoverable", "non_recoverable", "unknown"];
