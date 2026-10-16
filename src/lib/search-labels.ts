/**
 * Norsk brukerspråk og skjemametadata for den nye søkeflyten (SEARCH-005). Ren data og små rene funksjoner — kan brukes av både
 * klient- og serverkode. Interne koder (statuskoder, schema-navn, JSON) vises aldri i normal brukerflyt; kodene mappes her.
 */
import type { CostKind, CriterionId, VatBasis } from "@/domain/search-v2/types";

/** De faste kostnadslinjene i skjemaet. Typen er også linjens varige id. */
export const FIXED_COSTS: readonly { kind: CostKind; label: string }[] = [
  { kind: "transport", label: "Transport" },
  { kind: "travel", label: "Reise / henting" },
  { kind: "insurance", label: "Forsikring" },
  { kind: "preparation", label: "Klargjøring" },
  { kind: "conversion", label: "Ombygging" },
  { kind: "approval", label: "Godkjenning" },
];
export const CURRENCIES = ["NOK", "EUR", "SEK", "DKK", "CHF", "GBP", "PLN"] as const;
export const VAT_OPTIONS: readonly { value: VatBasis | ""; label: string }[] = [
  { value: "", label: "Ikke oppgitt" },
  { value: "incl", label: "Inkl. mva." },
  { value: "excl", label: "Ekskl. mva." },
  { value: "none", label: "Uten mva." },
];
/** Antall tomme egendefinerte rader som tilbys i tillegg til lagrede rader. */
export const BLANK_CUSTOM_ROWS = 2;
export const MAX_CUSTOM_INDEX = 99;

export const PRIORITY_LABEL = { must: "Må ha", nice: "Ønskelig" } as const;
export const SCENARIO_OPTIONS = [
  { value: "passenger", label: "Personbil", help: "Du planlegger å registrere bilen som personbil i Norge." },
  { value: "van", label: "Varebil", help: "Du ønsker å registrere bilen som varebil. Valget beviser ikke at bilen kan godkjennes som varebil, og påvirker ikke hvilke biler som passer kravene." },
  { value: "unspecified", label: "Uavklart", help: "Du har ikke bestemt det ennå. Det er et gyldig valg." },
] as const;
export const SCENARIO_LABEL = { passenger: "Personbil", van: "Varebil", unspecified: "Uavklart" } as const;

/** Kravstatus for bilen (ikke budsjett). */
export const VEHICLE_STATUS_LABEL = { match: "Oppfyller kravene", needs_review: "Må kontrolleres", excluded: "Oppfyller ikke kravene" } as const;
export const CRITERION_STATUS_LABEL = { fulfilled: "Oppfylt", not_fulfilled: "Ikke oppfylt", unknown: "Ikke oppgitt" } as const;

const CRITERION_BASE: Record<string, string> = {
  brand: "Merke", model: "Modell", variant: "Variant", modelYear: "Modellår", firstRegistration: "Førstegangsregistrering",
  maxMileage: "Kilometerstand", seats: "Antall seter", bodyTypes: "Karosseri", fuels: "Drivstoff", transmissions: "Girkasse",
  driveTrains: "Hjuldrift", exteriorColors: "Utvendig farge", interiorColors: "Interiørfarge", interiorMaterials: "Interiørmateriale",
};

/** Visningsnavn for et kriterium. `equipmentLabel` slår opp utstyrsnøkkel → norsk navn. */
export function criterionLabel(id: CriterionId, equipmentLabel: (key: string) => string | undefined): string {
  if (id.startsWith("equipment:")) {
    const key = id.slice("equipment:".length);
    return equipmentLabel(key) ?? "Utstyr";
  }
  return CRITERION_BASE[id] ?? "Krav";
}

/** Maskinlesbar grunn → norsk forklaring. Ukjent kode gir nøytral tekst (aldri rå kode). */
const REASON: Record<string, string> = {
  ok: "oppfylt",
  below_min: "under kravet", above_max: "over kravet", not_in_list: "er ikke blant de valgte",
  candidate_value_missing: "annonsen oppgir det ikke",
  different_brand: "annet merke", different_model: "annen modell",
  variant_text_not_found: "teksten finnes ikke i variantfeltet",
  registration_precision_insufficient: "registreringsdatoen er ikke oppgitt presist nok til å avgjøre",
  before_from: "registrert før startdatoen", after_to: "registrert etter sluttdatoen",
  equipment_not_stated: "annonsen oppgir ikke utstyr",
  source_contradiction: "kilden motsier seg selv",
  source_list_incomplete: "utstyrslisten er ikke fullstendig, så det kan ikke avgjøres",
  confirmed_absent: "annonsen oppgir at det mangler",
  absent_from_complete_list: "står ikke i en fullstendig utstyrsliste",
};
export function reasonLabel(code: string): string {
  return REASON[code] ?? "kan ikke vurderes";
}

/** Forklaring på hvorfor kandidatfeltet er ukjent (fra kandidatadapteren). */
export const SOURCE_NOTE: Record<string, string> = {
  not_in_source_model: "Demokilden har ikke dette feltet",
  not_stated: "Annonsen oppgir det ikke",
  unmapped: "Verdien er ikke koblet til demokatalogen",
  requires_mapped_brand: "Merket er ikke koblet til demokatalogen",
  unrepresentable: "Verdien kan ikke gjengis sikkert",
};

/** Tekst for budsjettstatus som ikke er beregnet. Brukes bare når ingen kostnadsvurdering finnes. */
export const BUDGET_NOT_CALCULATED = "Innkjøpskostnad til Norge er ikke beregnet. Annonseprisen er ikke total innkjøpskostnad, og det er ikke vurdert om bilen holder seg innenfor budsjettet.";

/** Kandidatfelt → norsk navn (forklaringene fra kandidatadapteren bruker interne feltnavn). */
export const CANDIDATE_FIELD_LABEL: Record<string, string> = {
  brandKey: "Merke", modelKey: "Modell", variant: "Variant", modelYear: "Modellår", firstRegistration: "Førstegangsregistrering",
  mileageKm: "Kilometerstand", seats: "Antall seter", bodyType: "Karosseri", fuel: "Drivstoff", transmission: "Girkasse",
  driveTrain: "Hjuldrift", exteriorColor: "Utvendig farge", interiorColor: "Interiørfarge", interiorMaterial: "Interiørmateriale",
  equipment: "Utstyr", packages: "Utstyrspakker", currentCategory: "Nåværende kategori (personbil/varebil)",
};

/** Kort kildeetikett for alle resultater i den nye søkeflyten (DEV-006C). Intern kilde-id er `synthetic-demo`. */
export const SYNTHETIC_SOURCE_LABEL = "Syntetiske demodata – ikke ekte leverandørdata";
