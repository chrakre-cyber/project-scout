/**
 * Norsk brukerspråk og skjemametadata for den nye søkeflyten (SEARCH-005). Ren data og små rene funksjoner — kan brukes av både
 * klient- og serverkode. Interne koder (statuskoder, schema-navn, JSON) vises aldri i normal brukerflyt; kodene mappes her.
 */
import { SYNTHETIC_ATTRIBUTION } from "@/domain/display-policy";
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
export const SYNTHETIC_SOURCE_LABEL = SYNTHETIC_ATTRIBUTION;

/** Hvorfor et resultat ikke vises (feiler lukket; DATA-002C). Nøytrale tekster uten annonsedata. Hvert avslag har sin egen tekst — ingenting blir «ukjent». */
export const BLOCKED_TEXT = {
  source_expired: "Kildedataene for denne annonsen er utløpt og vises ikke lenger.",
  rights_expired: "Visningsretten for denne kilden er utløpt, så annonsen vises ikke.",
  rights_revoked: "Visningsretten for denne kilden er trukket, så annonsen vises ikke.",
  rights_unknown: "Det finnes ingen gyldig visningsprofil for denne kilden, så annonsen vises ikke.",
  rights_changed: "Visningsprofilen for denne kilden er endret etter at annonsen ble hentet, så annonsen vises ikke.",
  unavailable: "Annonsen er ikke lenger tilgjengelig hos kilden.",
} as const;

// ---------------------------------------------------------------- ECON-005d: økonomivisning (faste etiketter)
/**
 * Faste statusetiketter for avledet økonomi. Alle tekster er konstanter her; visningsmodellen (`EconomicsView`) bærer bare nøkler og koder.
 * Ingen etikett kan lese som et budsjettutfall: estimat, nedre grense og scenarier er aldri «innenfor budsjett», «treff» eller «godkjent».
 */
import type { EconomicsView } from "@/domain/search-economics";

/** Hele NOK som desimalstreng → «468 723 kr» (tusenskille, eksakt; ingen flyttallsregning). */
export function formatNokString(nok: string): string {
  if (!/^\d+$/.test(nok)) return "ukjent beløp";
  return `${nok.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} kr`;
}

export const ECONOMICS_HEADING = "Anslått innkjøpskostnad til Norge";
export const ECONOMICS_LABELS = {
  estimate_not_validated: "Estimat — ikke validert",
  incomplete_lower_bound: "Minst {amount} (ufullstendig)",
  scenarios: "Scenarier — fradragsstatus er ukjent",
  not_calculated: "Ikke beregnet",
  rights_not_granted: "Ikke tilgjengelig for denne kilden",
  validated: "Validert beregning",
} as const;
/** Alltid vist sammen med økonomien: den er ingen budsjettvurdering. */
export const ECONOMICS_NOT_BUDGET = "Dette er ikke en budsjettvurdering. Estimater, nedre grenser og scenarier gir aldri «innenfor budsjett», fullt treff eller varsel.";
export const ECONOMICS_RIGHTS_TEXT = "Kilden gir ikke Merovo rett til å beregne eller vise avledet innkjøpskostnad. Ingen tall er beregnet eller vist.";

/** Overskriftstekst for en visningsmodell. Eneste sted tekst settes sammen av etikett + beløp. */
export function economicsHeadline(v: EconomicsView): string {
  switch (v.status) {
    case "unavailable": return ECONOMICS_LABELS.rights_not_granted;
    case "not_calculated": return ECONOMICS_LABELS.not_calculated;
    case "estimate": return v.landed.kind === "value" ? `${ECONOMICS_LABELS.estimate_not_validated}: ${formatNokString(v.landed.nok)}` : ECONOMICS_LABELS.estimate_not_validated;
    case "lower_bound": return v.landed.kind === "lower_bound" ? ECONOMICS_LABELS.incomplete_lower_bound.replace("{amount}", formatNokString(v.landed.minimumNok)) : ECONOMICS_LABELS.not_calculated;
    case "scenarios": return ECONOMICS_LABELS.scenarios;
    case "validated": return v.landed.kind === "value" ? `${ECONOMICS_LABELS.validated}: ${formatNokString(v.landed.nok)}` : ECONOMICS_LABELS.validated;
  }
}

const GENERIC_REASON = "Forutsetning mangler eller er ikke dokumentert.";
/** Koder fra økonomikjernen/mapperen → brukerspråk. Ukjent kode vises som generell tekst, aldri som rå kode. */
export const ECONOMICS_REASON_TEXT: Record<string, string> = {
  // estimat
  purchase_price_listing_claim: "Kjøpesummen er en annonsepåstand, ikke bekreftet kjøpsgrunnlag.",
  vat_rules_unapproved: "Mva.-reglene er ikke godkjent for validering.",
  rounding_unconfirmed: "Avrundingsregelen er ikke bekreftet.",
  customs_fx_rule_unconfirmed: "Regelen for tollkurs er ikke bekreftet.",
  customs_fx_fallback_acquisition_rate: "Anskaffelseskursen er brukt som tollkurs.",
  customs_duty_ordinary_rate_unapproved: "Ordinær tollsats er ikke godkjent.",
  deduction_status_dealer_stated: "Fradragsstatus er oppgitt av forhandler.",
  deduction_rule_unapproved: "Fradragsregelen er ikke godkjent.",
  foreign_vat_exclusion_dealer_stated: "Utenlandsk mva. er oppgitt av forhandler.",
  tax_estimate: "Engangsavgiften er et estimat.",
  tax_profile_not_approved: "Avgiftsprofilen er ikke godkjent.",
  transport_default_assumed: "Transport er en antakelse.",
  assumed_default_amount: "Et beløp er en antakelse.",
  amount_scenario_assumption: "Et beløp bygger på et scenario.",
  charges_excluded_by_scenario: "Avgifter er utelatt i et scenario.",
  ev_qualification_stated: "Elbilkvalifikasjon er en påstand.",
  customs_acceptance_date_expected: "Akseptdatoen for tolldeklarasjonen er forventet, ikke faktisk.",
  customs_fx_suspension_unverified: "Suspensjon av tollkurs er ikke kontrollert.",
  fx_dates_missing: "Kursdato mangler.",
  ev_threshold_components_unconfirmed: "Grunnlaget for elbilgrensen er ikke bekreftet.",
  purchase_commission_deduction_unverified: "Fradrag for innkjøpsprovisjon er ikke verifisert.",
  // ufullstendig / mangler
  acquisition_fx_missing: "Kurs for kjøpesummen mangler.", customs_fx_missing: "Tollkurs mangler.", customs_fx_period_missing: "Tollkursens gyldighetsperiode mangler.",
  customs_fx_suspended: "Tollkursen er suspendert.", customs_acceptance_date_unknown: "Akseptdato for tolldeklarasjonen er ukjent.",
  customs_acceptance_date_outside_documented_period: "Akseptdatoen ligger utenfor dokumentert periode.",
  transport_unknown: "Transport til innførselsstedet er ukjent.", transport_after_border_unknown: "Transport etter innførselsstedet er ukjent.",
  insurance_unknown: "Forsikring er ukjent.", loading_handling_unknown: "Lasting og håndtering er ukjent.", transportToBorder: "Transport til innførselsstedet er ukjent.",
  transportAfterBorder: "Transport etter innførselsstedet er ukjent.", insurance: "Forsikring er ukjent.", loading_handling: "Lasting og håndtering er ukjent.",
  tax_blocked: "Engangsavgiften kan ikke beregnes med opplysningene som finnes.", components_missing: "Kostnadskomponenter mangler.",
  vat_handling_unknown: "Mva.-håndtering er ukjent.", unresolved_vat_recoverability: "Fradragsstatus er ukjent (to scenarier).",
  foreign_vat_exclusion_undocumented: "Utenlandsk mva. er ikke dokumentert utelatt.", ev_qualification_unresolved: "Elbilkvalifikasjon er uavklart.",
  commission_role_unknown: "Provisjonens rolle er ukjent.", commission_price_inclusion_unknown: "Det er ukjent om provisjon ligger i prisen.", commission_in_price_deduction_unresolved: "Fradrag for provisjon i prisen er uavklart.",
  payment_cost_nature_unknown: "Betalingskostnadenes art er ukjent.", vat_base_charge_unclassified: "En avgift er ikke klassifisert for mva.-grunnlaget.",
  rounding_tie_unresolved: "Avrunding er uavklart.", ev_threshold_basis_not_documented_for_import_type: "Elbilgrensen er ikke dokumentert for denne innførselstypen.",
  acquisition_used: "Kjøpesummen er ikke løst.", customs_value_components: "Tollverdien mangler komponenter.", import_vat: "Import-mva. er ikke beregnet.",
  "charges.customsDuty": "Tollavgift er ukjent (ordinær sats gjelder bare når den er dokumentert).", "charges.climateGas": "Klimagassavgift er ukjent.", "charges.registrationFee": "Registreringsgebyr er ukjent.",
  vat_recoverability: "Fradragsstatus er ukjent (økonomisk kost har to scenarier).", loadingHandling: "Lasting og håndtering er ukjent.",
  transport_to_border: "Transport til innførselsstedet er ukjent.", ev_threshold_basis_not_documented: "Grunnlaget for elbilgrensen er ikke dokumentert.", scenario_unspecified: "Registreringsscenarioet er ikke oppgitt.",
  import_vat_base_incomplete: "Mva.-grunnlaget er ufullstendig.", import_vat_rounding_tie: "Mva. har uavklart avrunding.", total_registration_taxes: "Registreringsavgifter er ikke beregnet.",
  // ikke beregnet
  no_dealer_context: "Forhandleropplysninger er ikke koblet til dette søket.", no_result: "Ingen beregning finnes.", economics_blocked: "Beregningen er blokkert av ugyldig eller manglende grunnlag.",
  scenario_not_supported: "Registreringsscenarioet støttes ikke (bare personbil).", scenario_not_supported_by_economics: "Registreringsscenarioet støttes ikke (bare personbil).",
  price_missing: "Annonsen oppgir ikke pris.", price_not_allowed: "Kilden gir ikke rett til å bruke prisen.", invalid_now: "Beregningstidspunktet er ugyldig.",
  candidate_listing_mismatch: "Annonsen og kandidaten hører ikke sammen. Forhandleropplysninger er ikke brukt.",
  source_observation_invalid: "Kildens observasjonstidspunkt er ugyldig.", source_observation_in_future: "Kildens observasjonstidspunkt ligger i fremtiden.",
  cash_requirement_not_calculated: "Kontantbehovet er ikke beregnet.", assessment_not_validated: "Vurderingen er ikke validert.",
};
const VALIDITY_TEXT: Record<string, string> = {
  source_data: "kildedataene er for gamle", rights_profile: "kildens rettighetsprofil er utløpt", technical_cap_24h: "vurderingen er eldre enn 24 timer", documented_rule_period: "den dokumenterte regelperioden er utløpt",
  customs_fx_validTo: "tollkursens gyldighet er utløpt", dealer_acquisition_fx_validUntil: "oppgitt kurs for kjøpesummen er utløpt", dealer_customs_fx_validTo: "oppgitt tollkurs er utløpt",
};
/** Fast tekst for en årsakskode, inkludert de sammensatte kodene fra mapperen (`validity_exhausted:*`, `cost_line_*`, `economics_*`, `cash_requirement_*`). Ukjent kode ⇒ generell tekst, aldri rå kode. */
export function economicsReasonText(code: string): string {
  const exact = ECONOMICS_REASON_TEXT[code];
  if (exact) return exact;
  const v = /^validity_exhausted:(.+)$/.exec(code);
  if (v) return `Beregningen er utløpt: ${VALIDITY_TEXT[v[1]!] ?? "en gyldighetsgrense er nådd"}.`;
  if (code.startsWith("cost_line_")) return "En kostnadslinje i søket er ikke fullt avklart.";
  const e = /^economics_(blocked|incomplete|estimate)$/.exec(code);
  if (e) return e[1] === "blocked" ? "Beregningen er blokkert." : e[1] === "incomplete" ? "Beregningen er ufullstendig." : "Beregningen er et estimat.";
  if (code.startsWith("cash_requirement_")) return "Kontantbehovet er ikke fullt beregnet.";
  return GENERIC_REASON;
}

/** Forhandleropplysninger: tilstand → tekst. */
export const DEALER_INPUT_TEXT = {
  none: "Ingen bekreftede forhandleropplysninger for denne annonsen.",
  in_use: "Beregnet med bekreftede forhandleropplysninger.",
  needs_reconfirmation: "Forhandleropplysningene må bekreftes på nytt og er ikke brukt.",
} as const;
export const STALE_REASON_TEXT: Record<string, string> = {
  candidate_version_changed: "annonsen er endret", cost_basis_changed: "kostnadslinjene i søket er endret", scenario_changed: "registreringsscenarioet er endret",
  rights_changed: "kildens rettigheter er endret", fx_expired: "oppgitt kurs er utløpt", schema_version_changed: "skjemaversjonen er endret", line_scopes_invalid: "omfanget av en kostnadslinje stemmer ikke med linjen",
};
export const staleReasonText = (code: string): string => STALE_REASON_TEXT[code] ?? "forutsetningene er endret";
export const ECONOMICS_NOTE_TEXT: Record<string, string> = {
  commission_not_collected: "Provisjon er ikke innsamlet.", payment_costs_not_collected: "Betalingskostnader er ikke innsamlet.", import_levies_not_collected: "Andre importavgifter er ikke innsamlet.",
  other_costs_not_collected: "Øvrige kostnader er ikke innsamlet.", ev_qualification_not_collected: "Elbilkvalifikasjon er ikke innsamlet.", customs_duty_not_collected: "Tollavgift er ikke innsamlet (ordinær sats gjelder bare når den er dokumentert).",
  propulsion_unknown_no_dealer_basis: "Drivlinje er ukjent: annonsens drivstoff er ingen dokumentasjon.", price_basis_unknown: "Prisgrunnlaget (brutto/netto) er ikke dokumentert.",
  norwegian_registration_defaulted_to_as_of: "Norsk registreringsdato er satt til beregningsdatoen.", deduction_status_unknown: "Fradragsstatus er ukjent.", vat_handling_unknown: "Mva.-håndtering er ukjent.",
  line_scope_invalid_not_used: "Omfang for en kostnadslinje er ugyldig og ikke brukt.", line_scope_for_unknown_line_ignored: "Omfang for en ukjent kostnadslinje er ignorert.",
};
export const economicsNoteText = (code: string): string => ECONOMICS_NOTE_TEXT[code] ?? "Opplysning mangler.";
export const LINE_TREATMENT_TEXT = {
  mapped_to_input: "inngår i beregningen (telles én gang)", added_to_total: "lagt til som valgt kostnad", unmapped_unknown_scope: "omfang ikke bekreftet",
  unknown_amount: "beløp ukjent", unsupported: "støttes ikke (ikke regnet med)", not_included: "ikke inkludert i budsjettet",
} as const;
