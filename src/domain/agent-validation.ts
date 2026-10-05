/**
 * Validering av søkeagenter og krav til aktivering (DEV-004).
 *
 * Kilder: SPRINT_1_HANDOFF DEV-004 («navn, minst merke/modell eller avklart
 * bredere filter, retail-input, positivt minimum bidrag, reserve og
 * active-status»), PRODUCT_SPEC §4, IMPORT_ENGINE_SPEC «Inputs»,
 * OPPORTUNITY_SCORE (T > 0) og DEC-018/020/023.
 *
 * To nivåer:
 * 1. Gyldig utkast: alle oppgitte verdier er gyldige. Kan lagres (ikke aktiv).
 * 2. Klar for aktivering: gyldig utkast + alle aktiveringskrav oppfylt.
 * Samme regler håndheves i databasen (CHECK), som er den autoritative grensen.
 *
 * Filtre: `null` / tom liste = «alle» (ingen begrensning).
 * Forutsetninger: `null` = ikke oppgitt (blokkerer aktivering), aldri 0.
 */
import { isSupportedCurrency } from "./currency";
import type { AgentAssumptions, AgentFilters, BodyType, Fuel, Transmission } from "./types";

export const NAME_MAX = 120;
export const TEXT_FILTER_MAX = 60;
export const YEAR_MIN = 1900;
/** Øvre årsgrense: inneværende år + 1 (årsmodeller kommer før kalenderåret). */
export const yearMaxAllowed = (now = new Date()) => now.getUTCFullYear() + 1;
export const MILEAGE_MAX_KM = 2_000_000;

export const FUELS: readonly Fuel[] = ["petrol", "diesel", "electric", "hybrid", "plugin_hybrid", "other"];
export const TRANSMISSIONS: readonly Transmission[] = ["manual", "automatic"];
export const BODY_TYPES: readonly BodyType[] = ["sedan", "estate", "suv", "hatchback", "coupe", "convertible", "van", "other"];
/** Land som kan velges som filter (europeiske markeder). Ikke en liste over tilkoblede kilder. */
export const COUNTRY_CODES = ["DE", "AT", "NL", "BE", "LU", "FR", "IT", "ES", "DK", "SE", "PL", "CZ", "CH"] as const;

export type AgentField =
  | "name" | "make" | "model" | "variant" | "yearMin" | "yearMax" | "maxMileageKm" | "fuels" | "transmissions"
  | "bodyTypes" | "countryCodes" | "maxPrice" | "broadSearchConfirmed" | "retailAmount" | "retailVat"
  | "retailRegistrationTaxes" | "minimumContribution" | "reserveAmount" | "reserveVatBasis";

export type FieldErrors = Partial<Record<AgentField, string>>;

export interface AgentDraft {
  name: string;
  filters: AgentFilters;
  broadSearchConfirmed: boolean;
  assumptions: AgentAssumptions;
}

/** Feil i et utkast. Tomt objekt = gyldig og kan lagres. */
export function validateDraft(d: AgentDraft, now = new Date()): FieldErrors {
  const e: FieldErrors = {};
  const f = d.filters;
  const name = d.name.trim();
  if (name.length < 1 || name.length > NAME_MAX) e.name = `Navn må være 1–${NAME_MAX} tegn.`;

  for (const key of ["make", "model", "variant"] as const) {
    const v = f[key];
    if (v !== null && (v.trim() !== v || v.length < 1 || v.length > TEXT_FILTER_MAX)) e[key] = `Maks ${TEXT_FILTER_MAX} tegn, uten innledende/avsluttende mellomrom.`;
  }
  if (f.model !== null && f.make === null) e.model = "Modell krever merke.";
  if (f.variant !== null && f.model === null) e.variant = "Variant krever modell.";

  const yMax = yearMaxAllowed(now);
  for (const key of ["yearMin", "yearMax"] as const) {
    const v = f[key];
    if (v !== null && (!Number.isInteger(v) || v < YEAR_MIN || v > yMax)) e[key] = `Årsmodell må være et heltall ${YEAR_MIN}–${yMax}.`;
  }
  if (!e.yearMin && !e.yearMax && f.yearMin !== null && f.yearMax !== null && f.yearMin > f.yearMax) {
    e.yearMax = "Til-år kan ikke være før fra-år.";
  }
  if (f.maxMileageKm !== null && (!Number.isInteger(f.maxMileageKm) || f.maxMileageKm < 1 || f.maxMileageKm > MILEAGE_MAX_KM)) {
    e.maxMileageKm = `Maks kilometer må være et heltall 1–${MILEAGE_MAX_KM.toLocaleString("nb-NO")}.`;
  }
  const subset = <T extends string>(values: readonly T[], allowed: readonly string[]) =>
    values.every((v) => allowed.includes(v)) && new Set(values).size === values.length;
  if (!subset(f.fuels, FUELS)) e.fuels = "Ugyldig drivstoffvalg.";
  if (!subset(f.transmissions, TRANSMISSIONS)) e.transmissions = "Ugyldig girvalg.";
  if (!subset(f.bodyTypes, BODY_TYPES)) e.bodyTypes = "Ugyldig karosserivalg.";
  if (!subset(f.countryCodes, COUNTRY_CODES)) e.countryCodes = "Ugyldig landvalg.";
  if (f.maxPrice !== null && (!isPositiveSafe(f.maxPrice.amountMinor) || !isSupportedCurrency(f.maxPrice.currency))) {
    e.maxPrice = "Maks annonsepris må være et positivt beløp i en støttet valuta (ingen omregning).";
  }

  const a = d.assumptions;
  const nok = (m: { amountMinor: number; currency: string } | null, allowZero: boolean) =>
    m === null || (m.currency === "NOK" && Number.isSafeInteger(m.amountMinor) && (allowZero ? m.amountMinor >= 0 : m.amountMinor > 0));
  if (!nok(a.retail.expectedRetailTotal, false)) e.retailAmount = "Forventet salgspris må være et positivt beløp i NOK.";
  if (!nok(a.minimumContribution, false)) e.minimumContribution = "Minimum bidrag må være større enn 0 kr (NOK).";
  if (!nok(a.preparationReserve.amount, true)) e.reserveAmount = "Klargjøringsreserve må være 0 kr eller mer (NOK).";
  return e;
}

/** Kriterier som snevrer inn et søk uten merke. Modell/variant krever merke og teller ikke her. */
export function narrowingCriteria(f: AgentFilters): string[] {
  const c: string[] = [];
  if (f.yearMin !== null || f.yearMax !== null) c.push("årsmodell");
  if (f.maxMileageKm !== null) c.push("maks kilometer");
  if (f.fuels.length) c.push("drivstoff");
  if (f.transmissions.length) c.push("gir");
  if (f.bodyTypes.length) c.push("karosseri");
  if (f.countryCodes.length) c.push("land");
  if (f.maxPrice !== null) c.push("maks annonsepris");
  return c;
}

/**
 * Hva som mangler før agenten kan aktiveres. Tom liste = klar.
 * R7 / DEC-023: uten merke kreves (a) uttrykkelig bekreftet bredt søk og
 * (b) minst ett annet strukturert kriterium. «Alle» på alt er aldri avklart.
 */
export function activationIssues(d: AgentDraft, now = new Date()): string[] {
  const issues: string[] = [];
  if (Object.keys(validateDraft(d, now)).length) issues.push("Agenten har ugyldige felt.");
  if (d.filters.make === null) {
    if (!d.broadSearchConfirmed) issues.push("Velg merke, eller bekreft uttrykkelig at du vil søke på tvers av merker.");
    if (narrowingCriteria(d.filters).length === 0) issues.push("Søk uten merke må ha minst ett annet kriterium (f.eks. karosseri, drivstoff, år, km, land eller pris).");
  }
  const a = d.assumptions;
  if (a.retail.expectedRetailTotal === null) issues.push("Forventet norsk salgspris er ikke oppgitt.");
  if (a.retail.priceBasis.vat === null) issues.push("Oppgi om salgsprisen inkluderer mva.");
  if (a.retail.priceBasis.registrationTaxes === null) issues.push("Oppgi om salgsprisen inkluderer registreringsavgifter.");
  if (a.minimumContribution === null) issues.push("Minimum bidrag er ikke oppgitt.");
  if (a.preparationReserve.amount === null) issues.push("Klargjøringsreserve er ikke oppgitt (0 kr er et gyldig valg).");
  if (a.preparationReserve.vatBasis === null) issues.push("Oppgi mva.-basis for klargjøringsreserven.");
  return issues;
}

function isPositiveSafe(n: number) {
  return Number.isSafeInteger(n) && n > 0;
}

export const EMPTY_FILTERS: AgentFilters = {
  make: null, model: null, variant: null, yearMin: null, yearMax: null, maxMileageKm: null,
  fuels: [], transmissions: [], bodyTypes: [], countryCodes: [], maxPrice: null,
};

export const EMPTY_ASSUMPTIONS: AgentAssumptions = {
  retail: { expectedRetailTotal: null, priceBasis: { vat: null, registrationTaxes: null } },
  minimumContribution: null,
  preparationReserve: { amount: null, vatBasis: null },
};
