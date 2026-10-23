/**
 * Norsk brukerspråk og skjemametadata for den nye søkeflyten (SEARCH-005). Ren data og små rene funksjoner — kan brukes av både
 * klient- og serverkode. Interne koder (statuskoder, schema-navn, JSON) vises aldri i normal brukerflyt; kodene mappes her.
 */
import { SYNTHETIC_ATTRIBUTION } from "@/domain/display-policy";
import { DOCUMENTED_RULE_PERIOD } from "@/domain/economics/validity";
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

/**
 * Eksakt visning av NOK-streng med inntil flere desimaler (øre fra søkelinjer og forhandleroppgitte poster): ingen flyttall og ingen avrunding; minst to desimaler vises
 * når det finnes en brøkdel («1,50 kr»). Hele kroner fra kjernen vises som før. Alt annet er «ukjent beløp».
 */
export function formatNokExact(nok: string): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(nok);
  if (!m) return "ukjent beløp";
  const [, sign, whole, frac] = m;
  return `${sign}${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${frac ? `,${frac.length < 2 ? frac.padEnd(2, "0") : frac}` : ""} kr`;
}

/** PILOT-004A: tilstanden «avgiftsgrunnlaget dekker ikke datoen» (akseptdato utenfor dokumentert periode). Ingen opplysning forhandleren kan registrere retter dette. */
export const TAX_PERIOD_UNAVAILABLE = "Avgiftsgrunnlaget er ikke tilgjengelig for denne datoen.";
export const TAX_PERIOD_EXPLAIN = `Beregningen dekker avgifts- og mva.-regler for ${DOCUMENTED_RULE_PERIOD.label}. Å registrere en annen dato retter ikke dette.`;
export const ECONOMICS_HEADING = "Anslått innkjøpskostnad til Norge";
export const ECONOMICS_LABELS = {
  estimate_not_validated: "Estimat",
  incomplete_lower_bound: "Minst {amount} (ufullstendig)",
  scenarios: "Scenarier — fradragsstatus er ukjent",
  not_calculated: "Ikke beregnet",
  rights_not_granted: "Ikke tilgjengelig for denne kilden",
  validated: "Validert beregning",
} as const;
/** Alltid vist sammen med økonomien: den er ingen budsjettvurdering. */
export const ECONOMICS_NOT_BUDGET = "Dette er ikke en budsjettvurdering. Estimater, nedre grenser og scenarier gir aldri «innenfor budsjett», fullt treff eller varsel.";
export const ECONOMICS_RIGHTS_TEXT = "Kilden gir ikke Merovo rett til å beregne eller vise avledet innkjøpskostnad. Ingen tall er beregnet eller vist.";

/** PILOT-002: 0 er aldri en plassholder for ukjent; en «nedre grense» på 0 sier ingenting og vises ikke som beløp. */
export const isZeroNok = (nok: string): boolean => /^0+(\.0+)?$/.test(nok);

/** Overskriftstekst for en visningsmodell. Eneste sted tekst settes sammen av etikett + beløp. */
export function economicsHeadline(v: EconomicsView): string {
  switch (v.status) {
    case "unavailable": return ECONOMICS_LABELS.rights_not_granted;
    case "not_calculated": return ECONOMICS_LABELS.not_calculated;
    case "estimate": return v.landed.kind === "value" ? `${ECONOMICS_LABELS.estimate_not_validated}: ${formatNokString(v.landed.nok)}` : ECONOMICS_LABELS.estimate_not_validated;
    case "lower_bound": return v.landed.kind === "lower_bound" && !isZeroNok(v.landed.minimumNok) ? ECONOMICS_LABELS.incomplete_lower_bound.replace("{amount}", formatNokString(v.landed.minimumNok)) : ECONOMICS_LABELS.not_calculated;
    case "scenarios": return ECONOMICS_LABELS.scenarios;
    case "validated": return v.landed.kind === "value" ? `${ECONOMICS_LABELS.validated}: ${formatNokString(v.landed.nok)}` : ECONOMICS_LABELS.validated;
  }
}

/** Reservetekst for en kode uten egen tekst. Innholdsløs: vises ikke som egen punktlinje i usikkerhetslisten (PILOT-004A). */
export const GENERIC_REASON = "Forutsetning mangler eller er ikke dokumentert.";
/** Koder fra økonomikjernen/mapperen → brukerspråk. Ukjent kode vises som generell tekst, aldri som rå kode. */
export const ECONOMICS_REASON_TEXT: Record<string, string> = {
  // estimat
  purchase_price_listing_claim: "Kjøpesummen er en annonsepåstand, ikke bekreftet kjøpsgrunnlag.",
  demo_economics_inputs: "Beregnet med syntetiske demoforutsetninger (ikke forhandlerens egne opplysninger).",
  vat_rules_unapproved: "Mva. må kontrolleres før kjøp.",
  rounding_unconfirmed: "Avrundingsregelen er ikke bekreftet.",
  customs_fx_rule_unconfirmed: "Regelen for tollkurs er ikke bekreftet.",
  customs_fx_fallback_acquisition_rate: "Anskaffelseskursen er brukt som tollkurs.",
  customs_duty_ordinary_rate_unapproved: "Tollsatsen må kontrolleres før kjøp.",
  deduction_status_dealer_stated: "Fradragsstatus er oppgitt av forhandler.",
  deduction_rule_unapproved: "Fradragsregelen må kontrolleres før kjøp.",
  foreign_vat_exclusion_dealer_stated: "Utenlandsk mva. er oppgitt av forhandler.",
  foreign_vat_exclusion_demo_assumed: "Utenlandsk mva. er en syntetisk demoantakelse.",
  deduction_status_demo_assumed: "Fradragsstatus er en syntetisk demoantakelse.",
  tax_estimate: "Engangsavgiften er et estimat.",
  tax_profile_not_approved: "Avgiftsgrunnlaget må kontrolleres før kjøp.",
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
  customs_acceptance_date_outside_documented_period: TAX_PERIOD_UNAVAILABLE,
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
  cash_requirement_not_calculated: "Kontantbehovet er ikke beregnet.", assessment_not_validated: "Vurderingen må kontrolleres før kjøp.",
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
  demo_fixture: "Beregnet med syntetiske demoforutsetninger — ikke bekreftede forhandleropplysninger. Registrer egne opplysninger for å erstatte dem.",
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

/**
 * PILOT-002: søkelinjens behandling, men uten å motsi motoren. En søkelinje (f.eks. transport 8 000 kr ekskl. mva.) kan være «støttes ikke» som SØKELINJE (ingen mva.-regel for tillegg ⇒ ikke lagt til),
 * mens motoren allerede har en egen, oppgitt transportpost (forhandleropplysning/demoforutsetning) som er med i estimatet. Teksten skiller disse: linjen er ikke brukt, transporten i estimatet er oppgitt separat.
 */
export const SEARCH_LINE_ENGINE_TRANSPORT_NOTE = "ikke brukt fra søket (støttes ikke). Transporten som er med i estimatet er oppgitt separat i forhandleropplysningene";
export function searchLineText(row: { kind: string; treatment: keyof typeof LINE_TREATMENT_TEXT }, engineTransportIncluded: boolean): string {
  if (row.kind === "transport" && engineTransportIncluded && (row.treatment === "unsupported" || row.treatment === "unknown_amount" || row.treatment === "unmapped_unknown_scope")) return SEARCH_LINE_ENGINE_TRANSPORT_NOTE;
  return LINE_TREATMENT_TEXT[row.treatment];
}

// ---------------------------------------------------------------- ECON-006a: forklaring av beløp og usikkerhet (faste tekster)
import type { BasisKey, BasisSummaryKey, FormFieldKey, RowId, RowState, UncertaintyCategory } from "@/domain/search-economics";

/** Hovedmerkingen er «Estimat» med «Endelig kostnad må kontrolleres før kjøp» (ECONOMICS_LABELS, RULES_NOT_APPROVED). «Ikke rådgivning» er et tillegg og erstatter ikke forklaringen av hva som er usikkert. */
export const ECONOMICS_NOT_ADVICE = "Ikke rådgivning.";
export const ECONOMICS_UNCERTAINTY_INTRO = "Hva som er usikkert i dette tallet:";
export const GROSS_OUTLAY_TITLE = "Brutto utlegg";
export const GROSS_OUTLAY_EXPLAIN =
  "Samlet utlegg for kjøpesum, transport, forsikring, mva. og registreringsavgifter, uavhengig av hvem som betaler når. Det er ikke nødvendigvis kontantbetaling ved grensen: kjøpesum, transport, mva. og avgifter forfaller til ulike tidspunkter, og mva.-registrerte rapporterer import-mva. i mva-meldingen.";
export const ECONOMIC_COST_TITLE = "Kostnad etter mva.-fradrag";
export const ECONOMIC_COST_EXPLAIN = "Estimert total justert for fradrag av import-mva. Er fradragsstatus ukjent, vises to scenarier i stedet for ett tall.";
export const BREAKDOWN_TITLE = "Slik er beløpet bygget opp";
export const BREAKDOWN_CAPTION = "Poster i brutto utlegg, med tilstand og grunnlag";
export const BREAKDOWN_BASIS_NOTE = "Grunnlag for beregningen (kommer ikke i tillegg)";
export const ASSUMPTIONS_TITLE = "Forutsetninger";
export const RULES_NOT_APPROVED = "Endelig kostnad må kontrolleres før kjøp. Avgift og mva. er beregnet av Merovo og er ikke en offisiell beregning.";
export const SEARCH_COSTS_TITLE = "Dine valgte tillegg fra søket";
export const SEARCH_COSTS_NOTE = "Tilleggene du la inn i søket er informasjon om hva som er regnet med eller ikke. De er ikke en budsjettvurdering.";
export const MISSING_TITLE = "Dette må oppgis for å beregne mer";
export const DEALER_FORM_NOT_AVAILABLE = "Skjema for forhandleropplysninger er ikke tilgjengelig i appen ennå.";
export const NOT_COLLECTABLE_TEXT = "kan ikke registreres ennå";
export const COVERAGE_DISCLAIMER = "Det betyr ikke at tallene er riktige eller endelige — endelig kostnad må kontrolleres før kjøp.";

export const ROW_LABEL: Record<RowId, string> = {
  purchase: "Kjøpesum", transport_to_border: "Transport til innførselsstedet", transport_after_border: "Transport etter innførselsstedet", insurance: "Forsikring",
  loading_handling: "Lasting og håndtering", import_vat: "Import-mva.", one_off_tax: "Engangsavgift", scrappage_deposit: "Vrakpant",
  climate_gas: "Klimagassavgift", registration_fee: "Registreringsgebyr", import_levy: "Importavgift", other_known: "Annen kjent kostnad", commission_separate: "Provisjon (betalt i tillegg)",
  payment_cost: "Betalingskostnad", other_rounding: "Avrundingsdifferanse (øvrige kostnader)",
  customs_value: "Tollverdi", customs_duty: "Tollavgift", import_vat_base: "Mva.-grunnlag",
};
export const STATE_LABEL: Record<RowState, string> = { known: "oppgitt eller beregnet", assumed: "antakelse", unknown: "ukjent", lower_bound: "nedre grense", not_applicable: "ikke relevant", excluded_by_scenario: "utelatt etter scenarioantakelse (regnet som 0)" };
export const BASIS_LABEL: Record<BasisKey, string> = {
  listing_claim: "Annonsepåstand — ikke dokumentasjon", dealer_entered: "Oppgitt av forhandler", demo_assumption: "Syntetisk demoantakelse", document: "Tilbud eller dokument", assumed: "Antakelse (standardverdi eller scenario)",
  stated_input: "Oppgitt i beregningen", engine_estimate: "Beregnet av Merovo — estimat", computed: "Beregnet av Merovo", ordinary_rate_unapproved: "Ordinær sats fra tolltariffen — må kontrolleres", unresolved: "Ikke avklart",
};
export const BASIS_SUMMARY_LABEL: Record<BasisSummaryKey, string> = {
  listing_claim_only: "Beløpene bygger på annonsepåstander.", dealer_stated: "Beløpene bygger på forhandleroppgitte opplysninger.", demo_assumptions: "Beløpene bygger på annonsepris og syntetiske demoantakelser.", partly_documented: "Noen kostnadsposter bygger på tilbud eller dokumenter.",
};
export const coverageText = (documented: number, known: number): string =>
  `Dokumentasjonsdekning: ${documented} av ${known} kjente kostnadsposter har tilbud eller dokument som grunnlag.`;
/** Gruppetittel for demoens syntetiske antakelser (ECON-003-2). */
export const UNCERTAINTY_INPUT_BASIS_DEMO_TITLE = "Opplysninger som er annonsepåstander eller syntetiske demoantakelser";
export const UNCERTAINTY_GROUP_TITLE: Record<UncertaintyCategory, string> = {
  rule: "Dette må kontrolleres før kjøp", input_basis: "Opplysninger som er påstander eller forhandleroppgitt", assumption: "Antakelser",
  missing: "Mangler (gir nedre grense eller ikke beregnet)", not_collected: "Ikke innsamlet i appen ennå", other: "Annet",
};
export const FIELD_LABEL: Record<FormFieldKey, string> = {
  propulsion: "Drivlinje (med dokumentert grunnlag)", tax_weight: "Avgiftsvekt", co2: "CO₂ og målemetode", first_registration: "Første registrering", norwegian_registration: "Norsk registreringsdato",
  customs_date: "Akseptdato for tolldeklarasjon", foreign_vat: "Utenlandsk mva. (dokumentert utelatt)", fx_acquisition: "Kurs for kjøpesum", fx_customs: "Tollkurs",
  transport_to_border: "Transport til innførselsstedet", transport_after_border: "Transport etter innførselsstedet", insurance: "Forsikring", loading_handling: "Lasting og håndtering",
  deduction: "Fradragsstatus for import-mva.", vat_handling: "Mva.-håndtering", listing_price_basis: "Dokumentert prisgrunnlag (brutto/netto) — mangler i annonsen",
  ev_qualification: "Kvalifikasjon for elbilfritak", commission: "Provisjon", payment_costs: "Betalingskostnader", import_levies: "Andre avgifter ved innførsel",
};
export const FX_ROLE_LABEL = { acquisition: "Kurs for kjøpesum", customs: "Tollkurs" } as const;
export const FX_SOURCE_LABEL = {
  official_customs: "Tolletatens kurs", bank: "Bankkurs", dealer_entered: "Forhandleroppgitt kurs — estimat", demo_assumption: "Syntetisk demokurs — ikke en markedskurs", fixture: "Testkurs — ikke en offisiell kurs", none: "Kilde ikke oppgitt",
} as const;
export const CUSTOMS_DATE_KIND_LABEL = { actual_acceptance: "faktisk akseptdato", expected_scenario: "forventet akseptdato (scenario)", unknown: "ukjent" } as const;
export const REGISTRATION_DATE_KIND_LABEL: Record<string, string> = { expected: "forventet", actual: "faktisk" };
export const VAT_RECOVERABILITY_LABEL = { recoverable: "fradrag oppgitt", non_recoverable: "ikke fradrag oppgitt", unknown: "ukjent (to scenarier)" } as const;
export const VAT_HANDLING_LABEL = { registered_reports_in_vat_return: "registrert: rapporteres i mva-meldingen", not_registered_pays_at_import: "ikke registrert: betales ved innførsel", unknown: "ukjent" } as const;
export const ASSUMPTION_SOURCE_LABEL: Record<string, string> = { dealer_entered: "oppgitt av forhandler", dealer_profile: "firmaets standard" };

// ---------------------------------------------------------------- ECON-006b: forhandlerskjema og firmaprofil
export const DF_TITLE = "Forhandleropplysninger";
export const DF_INTRO = "Opplysningene er dine egne og gjelder bare denne annonserevisjonen i dette søket. Tomt felt betyr «ikke oppgitt» (ukjent) — aldri 0 og aldri dokumentert. Annonsens egne påstander fylles ikke ut for deg og er ikke dokumentasjon.";
export const DF_NOT_VALIDATED = "Selv med bekreftede opplysninger er resultatet et estimat. Endelig kostnad må kontrolleres før kjøp. Skjemaet gir ingen budsjettvurdering.";
export const DF_CLAIMS_TITLE = "Annonsens påstander (ikke dokumentasjon)";
export const DF_CONFIRM_LABEL = "Jeg bekrefter at opplysningene over er mine egne, og at de gjelder denne annonserevisjonen i dette søket.";
export const DF_SUBMIT = "Bekreft og lagre";
export const DF_CANCEL = "Tilbake til detaljene";
export const DF_OPEN_LINK = "Registrer eller endre forhandleropplysninger";
export const DF_FIX_LINK = "Registrer";
export const DF_UNAVAILABLE = "Økonomi kan ikke vises for denne kilden, så det registreres ingen forhandleropplysninger her.";
export const DF_PREFILL: Record<"current" | "previous_revision" | "none", string | null> = {
  current: "Skjemaet er fylt ut fra din forrige bekreftelse for denne annonserevisjonen. Gjennomgå og bekreft på nytt for å lagre.",
  previous_revision: "Annonsen er endret siden forrige bekreftelse. Skjemaet er forhåndsutfylt fra den tidligere bekreftelsen, men den er ikke brukt i beregningen. Gjennomgå hver opplysning og bekreft på nytt.",
  none: null,
};
export const DF_SAVED = "Forhandleropplysningene er bekreftet. Vurderingen er beregnet på nytt (ingenting av resultatet er lagret).";
export const DF_OUTCOME_TEXT: Record<"stale_page" | "rights_unavailable" | "search_not_found" | "rejected" | "unavailable" | "not_logged_in" | "not_found", string> = {
  stale_page: "Annonsen eller søket er endret siden du åpnet skjemaet. Ingenting er lagret. Åpne skjemaet på nytt, gjennomgå opplysningene og bekreft på nytt.",
  rights_unavailable: DF_UNAVAILABLE,
  search_not_found: "Fant ikke søket i ditt firma. Ingenting er lagret.",
  rejected: "Databasen avviste opplysningene. Ingenting er lagret.",
  unavailable: "Lagringen feilet. Ingenting er lagret. Prøv igjen.",
  not_logged_in: "Du må være innlogget og knyttet til et firma for å registrere opplysninger.",
  not_found: "Fant ikke annonsen eller søket. Ingenting er lagret.",
};
export const DF_ERROR_SUMMARY = "Opplysningene ble ikke lagret. Rett feltene som er merket.";
export const DF_GENERAL_ERROR = "Opplysningene kunne ikke godkjennes av valideringen. Ingenting er lagret.";
export const DF_FIELD_ERROR: Record<string, string> = {
  required: "Må fylles ut.", invalid_value: "Ugyldig valg.", invalid_amount: "Oppgi et beløp i hele kroner eller med inntil to desimaler (for eksempel 8000 eller 8000,50).",
  invalid_integer: "Oppgi et helt tall.", invalid_date: "Oppgi en gyldig dato i formatet ÅÅÅÅ-MM-DD (år-måned: ÅÅÅÅ-MM, år: ÅÅÅÅ) som passer til valgt presisjon.", invalid_rate: "Oppgi en kurs større enn 0 (for eksempel 10,6709).",
  too_long: "Teksten er tom, for lang eller har ugyldige tegn.", split_mismatch: "Fordelingen må summere nøyaktig til linjens beløp.", choose_one: "Velg først hva som oppgis (beløp eller ikke relevant).",
  must_be_empty: "Skal være tomt for dette valget.",
};

export const DF_GROUP = {
  propulsion: "Drivlinje", taxWeight: "Avgiftsvekt", co2: "CO₂-utslipp", firstReg: "Første registrering", noReg: "Norsk registrering", customs: "Tolldeklarasjon", foreignVat: "Utenlandsk mva. i prisen",
  fxAcq: "Kurs: kjøpesum", fxCust: "Kurs: tollverdi", costs: "Kostnader", scopes: "Kostnadslinjer i søket", vat: "Mva. og fradrag", evidence: "Henvisning", confirm: "Bekreftelse",
} as const;
export const DF_GROUP_HELP: Partial<Record<keyof typeof DF_GROUP, string>> = {
  propulsion: "Annonsens drivstoff er en påstand og er ikke fylt ut. Velg «Ukjent» der du ikke vet, og oppgi grunnlaget for det du vet.",
  taxWeight: "Forhandler uten dokumentasjon gir et estimat.",
  firstReg: "Presisjonen må stemme med verdien. Det oppdiktes ingen måned eller dag.",
  noReg: "Tomt = beregningsdatoen brukes som standard og merkes slik.",
  customs: "Dato for tolldeklarasjonen. Forventet dato er en antakelse.",
  foreignVat: "Utenlandsk mva. må være dokumentert utelatt fra prisen for at prisen skal regnes som netto. Annonsepåstand er ikke et valg.",
  fxAcq: "Gjelder bare annonser i annen valuta enn NOK. Kursen er forhandleroppgitt og merkes som estimat. Kilde og dato er påkrevd.",
  fxCust: "Kursen som brukes til tollverdien. Kilde og dato er påkrevd.",
  costs: "Tomt = ikke oppgitt (ukjent). Skriv 0 bare hvis kostnaden faktisk er 0.",
  scopes: "Si hva hver transport- og forsikringslinje i søket dekker, slik at ingenting telles to ganger. Ubekreftet = linjen telles ikke som del av innkjøpskostnaden.",
  vat: "Tomt = ikke satt for denne annonsen; firmaprofilen kan gjelde. «Ukjent» er et uttrykkelig valg som overstyrer profilen.",
};
export const DF_FIELD: Record<string, string> = {
  prop_piston: "Stempelmotor", prop_chargeable: "Ladbar utenfra", prop_fuel: "Drivstoff for forbrenningsmotor", prop_hybrid: "Hybridisering", prop_basis: "Grunnlag for drivlinjen",
  tw_kg: "Avgiftsvekt (kg)", tw_basis: "Grunnlag for vekten", co2_g: "CO₂ (g/km)", co2_method: "Målemetode",
  fr_precision: "Presisjon", fr_value: "Verdi (ÅÅÅÅ-MM-DD, ÅÅÅÅ-MM eller ÅÅÅÅ)", fr_basis: "Grunnlag",
  nr_date: "Norsk registreringsdato", nr_kind: "Er datoen forventet eller faktisk?", cd_kind: "Type dato", cd_date: "Dato for tolldeklarasjon",
  fv_treatment: "Utenlandsk mva.", fv_evidence: "Dokumentasjon",
  fxA_pair: "Valutapar", fxA_rate: "Kurs (NOK per enhet)", fxA_source: "Kilde (hvor kursen er hentet)", fxA_quotedAt: "Dato kursen ble notert", fxA_effectiveAt: "Gjelder fra (valgfri)", fxA_validUntil: "Gyldig til og med (valgfri)",
  fxC_pair: "Valutapar", fxC_rate: "Kurs (NOK per enhet)", fxC_source: "Kilde (hvor kursen er hentet)", fxC_quotedAt: "Dato kursen ble notert", fxC_effectiveAt: "Gjelder fra (valgfri)", fxC_validFrom: "Gyldig fra (valgfri)", fxC_validTo: "Gyldig til og med (valgfri)",
  tb_amount: "Transport til innførselsstedet (kr)", ins_amount: "Forsikring til innførselsstedet (kr)",
  ta_mode: "Transport etter innførselsstedet", lh_mode: "Lasting og håndtering", cg_mode: "Klimagassavgift", rf_mode: "Registreringsgebyr",
  deduction: "Fradragsstatus for import-mva.", vatHandling: "Mva.-håndtering ved import", evidenceRef: "Henvisning til dokumentasjon (valgfri)", confirm: "Bekreftelse",
};
export const DF_OPTION = {
  unset: "Ikke oppgitt", unknown: "Ukjent", yes: "Ja", no: "Nei",
  fuel: { diesel: "Diesel", petrol: "Bensin", other: "Annet" },
  hybrid: { none: "Ingen", non_chargeable_hybrid: "Ikke-ladbar hybrid" },
  basis: { dealer_entered: "Oppgitt av meg (ingen dokumentasjon)", vehicle_register: "Kjøretøyregister", type_approval: "Typegodkjenning" },
  weightBasis: { eu_type_approval_minimum_mass: "EU-typegodkjenning (minimumsmasse)", vehicle_register: "Kjøretøyregister", dealer_entered: "Oppgitt av meg (ingen dokumentasjon)" },
  co2: { wltp_combined: "WLTP kombinert", wltp_weighted_combined: "WLTP vektet kombinert (ladbar hybrid)", epa_nrcan: "EPA/NRCan", nedc: "NEDC", not_wltp_or_nedc_approved: "Verken WLTP eller NEDC", unspecified: "Metode ikke oppgitt" },
  precision: { day: "Dag", month: "Måned", year: "År", unknown: "Ukjent", none: "Ingen (ikke registrert)" },
  regKind: { expected: "Forventet", actual: "Faktisk" },
  customsKind: { expected_scenario: "Forventet (antakelse)", actual_acceptance: "Faktisk akseptdato", unknown: "Ukjent" },
  foreignVat: { excluded_documented: "Dokumentert utelatt fra prisen", unconfirmed: "Ikke bekreftet" },
  foreignVatEvidence: { invoice_or_contract: "Faktura eller avtale", dealer_entered: "Oppgitt av meg (ingen dokumentasjon)" },
  chargeMode: { amount: "Beløp", not_applicable: "Ikke relevant (begrunn)" },
  scope: { unconfirmed: "Ikke bekreftet", to_border: "Frem til innførselsstedet", after_border: "Etter innførselsstedet", other: "Annet (ikke del av innførselen)", split: "Fordelt" },
  deduction: { recoverable: "Fradragsberettiget", non_recoverable: "Ikke fradragsberettiget", unknown: "Ukjent" },
  vatHandling: { registered_reports_in_vat_return: "Mva.-registrert: rapporteres i mva.-melding", not_registered_pays_at_import: "Ikke mva.-registrert: betales ved innførsel", unknown: "Ukjent" },
} as const;
export const DF_CHARGE_NOTE = "Begrunnelse (kort)";
export const DF_CHARGE_AMOUNT = "Beløp (kr)";
export const DF_SPLIT_TO = "Til innførselsstedet (kr)";
export const DF_SPLIT_AFTER = "Etter innførselsstedet (kr)";
export const DF_LINE_AMOUNT = "Beløp i søket";
export const DF_NO_SCOPE_LINES = "Søket har ingen transport- eller forsikringslinjer.";
export const DF_PROFILE_NOW = "Firmaprofilens standard";
export const DF_PROFILE_NOT_SET = "ikke satt";

export const DP_TITLE = "Firmaprofil for økonomi";
export const DP_INTRO = "Standardverdier for hele firmaet. De brukes bare der en annonse ikke har sin egen bekreftede verdi — en bekreftet verdi for en annonse overstyres aldri av profilen. Tomt = ingen standard (ukjent). Profilen gjør ikke noe tall dokumentert eller validert.";
export const DP_SAVED = "Firmaprofilen er lagret.";
export const DP_SUBMIT = "Lagre firmaprofil";
export const DP_LINK = "Firmaprofil for økonomi";

/** Mangelfelt (forklaringen) → anker i forhandlerskjemaet. */
export const FIELD_ANCHOR: Record<FormFieldKey, string> = {
  propulsion: "propulsion", tax_weight: "taxWeight", co2: "co2", first_registration: "firstReg", norwegian_registration: "noReg", customs_date: "customs", foreign_vat: "foreignVat",
  fx_acquisition: "fxAcq", fx_customs: "fxCust", transport_to_border: "tb_amount", transport_after_border: "transportAfterBorder", insurance: "ins_amount", loading_handling: "loadingHandling",
  deduction: "vat", vat_handling: "vat", listing_price_basis: "costs", ev_qualification: "costs", commission: "costs", payment_costs: "costs", import_levies: "costs",
};

// ---------------------------------------------------------------- ECON-003-2: anslått innkjøpskostnad til Norge (sammendrag)
// Norsk UI-språk. Alt er et estimat; ingen intern terminologi, ingen «0 kr» som plassholder, ingen «Minst 0 kr».
export const SUMMARY_TITLE = "Estimert innkjøpskostnad til Norge";
export const SUMMARY_TOTAL_LABEL = "Estimert total til Norge";
export const SUMMARY_TOTAL_SCOPE = "inkl. engangsavgift og mva.";
export const SUMMARY_PARTIAL_LABEL = "Foreløpig delsum — ufullstendig";
export const SUMMARY_PARTIAL_NOTE = "Ikke en total: opplysninger mangler.";
export const SUMMARY_LINE_LABEL: Record<"purchase" | "registration_tax" | "vat" | "transport" | "other", string> = {
  purchase: "Kjøpesum", registration_tax: "Engangsavgift", vat: "MVA", transport: "Transport", other: "Øvrige poster",
};
export const SUMMARY_LINE_UNKNOWN = "ikke beregnet";
export const SUMMARY_LINE_ASSUMED = "antatt";
export const SUMMARY_ESTIMATE_NOTE = "Estimat basert på annonsepris og forhandlerens opplysninger. Ikke en offisiell avgiftsberegning.";
export const SUMMARY_PRICE_CLAIM_NOTE = "Kjøpesummen er annonsepris (ikke bekreftet tilbud).";
export const SUMMARY_VAT_SCOPE_NOTE = "Fradragsrett for mva. er ikke lagt til grunn i totalen.";
export const SUMMARY_TRANSPORT_NOTE = "Transport er bare med når den er oppgitt.";
export const SUMMARY_SCENARIO_EV_NOTE = "Totalen avhenger av om elbilfritaket gjelder. Det er ikke bekreftet.";
export const SUMMARY_SCENARIO_GENERIC_NOTE = "Totalen avhenger av et forhold som ikke er avklart. Hvert scenario er vist.";
export const SUMMARY_DEMO_LABEL = "Demo-estimat";
export const SUMMARY_DEMO_NOTE = "Demo-estimat: bilens tekniske data, kurs og transport er syntetiske demoforutsetninger, ikke fra en leverandør.";
export const SUMMARY_FX_TITLE = "Kurser brukt i estimatet";
export const SUMMARY_FX_NONE = "Ingen kurs er brukt (kjøpesum i NOK).";
export const SUMMARY_UNAVAILABLE_HEADLINE = "Estimert innkjøpskostnad til Norge: ikke beregnet";
export const SUMMARY_UNAVAILABLE_LEAD = "Kan ikke beregnes ennå";
export const SUMMARY_MISSING_INTRO = "Mangler";
export const SUMMARY_MISSING_MORE = "m.fl.";
export const SUMMARY_MISSING_DETAIL_TITLE = "Dette mangler for å beregne";
export const SUMMARY_MISSING_REFINE_TITLE = "Dette gjør estimatet sikrere";
/** PILOT-002: den ENESTE budsjettnotisen (kort, detalj og sidebanner), gyldig i alle økonomitilstander. Den påstår aldri at innkjøpskostnaden «ikke er beregnet» — den tilstanden eies av sammendraget (`SUMMARY_UNAVAILABLE_HEADLINE`). */
export const SUMMARY_BUDGET_NOTE = "Annonseprisen er ikke total innkjøpskostnad. Budsjettvurdering er ikke gjort.";

