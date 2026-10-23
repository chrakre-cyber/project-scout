/**
 * ECON-003-2 — syntetiske demoforutsetninger for den KURATERTE syntetiske BMW iX3-demoen (og bare den). Server-modul, ren (ingen I/O).
 *
 * Hvorfor: uten forhandlerinput viser økonomikjernen bevisst «ikke beregnet» (annonsen kan ikke oppgi vekt, CO₂, drivlinjegrunnlag, kurs …). For den offentlige produktomvisningen
 * gir denne modulen den ene kuraterte demobilen eksplisitte, MERKEDE INPUT — aldri ferdige beløp. Alle tall som vises kommer fortsatt fra den vanlige veien
 * (`assessEconomics` → adapter → `calculateEconomics` → rettighetsgrensen → visningsmodell); ingenting her inneholder en total, en avgift eller en mva.-verdi.
 *
 * Skillet (fail-closed):
 *  - Bare `synthetic-demo` med syntetisk proveniens og syntetisk rettighetsprofil, annonse-id `dix3-001`, og bare når annonsens egne fakta fortsatt stemmer med forutsetningene
 *    (BMW iX3 Inspiring, første registrering 03/2024, netto EUR 36 950). Avviker noe ⇒ ingen demoforutsetninger.
 *  - Annonser fra leverandør/sandbox/live og alle andre syntetiske annonser får aldri disse; uten input forblir de «ikke beregnet».
 *  - Forhandlerens egen lagrede input er alltid autoritativ: finnes en (også en foreldet), brukes aldri demoforutsetningene.
 *  - Elbilfritakets kvalifikasjon og fradragsrett/mva.-håndtering antas IKKE; motoren viser derfor scenarioområde (ikke ett oppdiktet tall).
 */
import { DEALER_INPUT_SCHEMA_VERSION } from "@/domain/search-economics";
import type { DealerInputV1, StoredDealerInput } from "@/domain/search-economics";
import type { ResolvedRights } from "@/domain/provider-rights";
import type { CandidateV2, SearchSpec } from "@/domain/search-v2/types";
import { DEMO_VEHICLE, isCuratedDemoVehicle } from "./curated-demo";
import { bindingFor, confirmationContextFor } from "./search-economics";

export { DEMO_VEHICLE, isCuratedDemoVehicle };

/**
 * Demokursen: gjenbrukt fra den dokumenterte syntetiske presentasjonsserien (`docs/tax/demo-series.json` → `fxNokPerEur`: «11.50 (SYNTETISK, dato 2026-10-15; ikke Tolletatens kurs)»).
 * Ikke en markedskurs, ikke Tolletatens kurs, ikke live. En test holder verdien lik dokumentet.
 */
export const DEMO_FX_NOK_PER_EUR = "11.50";
const FX_LABEL = "Syntetisk demokurs (docs/tax/demo-series.json) — ikke en markedskurs";

/** Eksplisitte demo-id-er for tilfellet uten forhandlerkontekst (bindingen sammenlignes bare for likhet; ingen firmadata). */
export const DEMO_DEALERSHIP_ID = "demo-fixture";
export const DEMO_SEARCH_ID = "demo-fixture";
export const DEMO_CONFIRMED_BY = "demo-fixture";

const day = (d: Date): string => d.toISOString().slice(0, 10);
const plusDays = (d: Date, n: number): string => day(new Date(d.getTime() + n * 86_400_000));

/**
 * De eksplisitte demo-INPUTENE (ingen beløp som er resultater). Syntetiske antakelser:
 *  - drivlinje BEV, avgiftsvekt 2 260 kg, CO₂ 0 g/km (WLTP), første registrering 03/2024 — alt `dealer_entered` (udokumentert demoverdi ⇒ estimat);
 *  - utenlandsk mva. «dokumentert utelatt» (netto eksportpris, brutto 43 970 er ikke et beregningsinput) — forhandleroppgitt;
 *  - transport 8 000 NOK ekskl. mva. til innførselsstedet; ingen forsikring, lasting, klimagass eller registreringsgebyr (uttrykkelig oppgitt som ingen — ellers ville totalen blitt en nedre grense);
 *  - kurs EUR/NOK 11,50 for både kjøpesum og toll (adskilte roller), gyldig 14 dager fra beregningsdagen; akseptdato = beregningsdagen (forventet scenario);
 *  - norsk registreringsdato oppgis ikke (motoren bruker beregningsdagen og merker den som standard);
 *  - IKKE oppgitt: elbilkvalifikasjon (samles ikke inn), fradragsrett og mva.-håndtering (forblir ukjent).
 * Datoene følger beregningstidspunktet slik at demoens syntetiske kurs aldri «utløper» i seg selv (som demoens fornyede observasjonstider); regelprofilen og kildeobservasjonens
 * gyldighet er uendret og feiler fortsatt lukket (f.eks. etter avgiftsprofilens sluttdato 2026-12-31).
 */
export function demoDealerInput(now: Date): DealerInputV1 {
  const today = day(now);
  return {
    schemaVersion: DEALER_INPUT_SCHEMA_VERSION,
    propulsion: { pistonCombustionEngine: false, externallyChargeable: true, combustionFuel: null, hybridization: null, basis: "dealer_entered" },
    taxWeight: { kg: 2260, basis: "dealer_entered" },
    co2: { gramsPerKm: 0, method: "wltp_combined" },
    firstRegistration: { precision: "month", value: `${DEMO_VEHICLE.firstRegistration.year}-${String(DEMO_VEHICLE.firstRegistration.month).padStart(2, "0")}`, basis: "dealer_entered" },
    customsDate: { date: today, kind: "expected_scenario" },
    foreignVat: { treatment: "excluded_documented", evidence: "dealer_entered" },
    fx: {
      acquisition: { pair: "EUR/NOK", rate: DEMO_FX_NOK_PER_EUR, sourceLabel: FX_LABEL, effectiveAt: today, quotedAt: today, validUntil: plusDays(now, 14) },
      customs: { pair: "EUR/NOK", rate: DEMO_FX_NOK_PER_EUR, sourceLabel: FX_LABEL, quotedAt: today, validFrom: today, validTo: plusDays(now, 14) },
    },
    transportToBorder: { amount: "8000" },
    transportAfterBorder: { state: "not_applicable", basis: "demo" },
    loadingHandling: { state: "not_applicable", basis: "demo" },
    insurance: { amount: "0" },
    climateGas: { state: "not_applicable", basis: "demo" },
    registrationFee: { state: "not_applicable", basis: "demo" },
  };
}

/** Lagret-input-form (samme som en forhandlers bekreftelse) slik at vanlig orkestrering kjører uendret. `confirmedBy` er tydelig demo, ikke en bruker. */
export function demoStoredInput(a: { dealershipId: string; searchId: string; candidate: CandidateV2; spec: SearchSpec; rights: ResolvedRights; now: Date }): StoredDealerInput {
  return {
    binding: bindingFor(a.dealershipId, a.searchId, a.candidate),
    input: demoDealerInput(a.now),
    context: confirmationContextFor(a.spec, a.rights),
    confirmedBy: DEMO_CONFIRMED_BY,
    confirmedAt: a.now.toISOString(),
  };
}
