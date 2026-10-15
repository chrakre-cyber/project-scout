/**
 * Semantisk validering av en intern SearchSpec mot en injisert katalog. Ren funksjon: muterer ikke
 * inndata, kaster ikke på uventet form og returnerer alle feil (ingen delvis resultat).
 * Tekst behandles som data: den lagres/sammenlignes uendret og tolkes aldri som instruks eller HTML.
 */
import type { FirstRegistration } from "../types";
import { isSupportedCurrency } from "../currency";
import {
  BODY_TYPES, COST_KINDS, COST_LABEL_MAX, DRIVE_TRAINS, FUELS, MAX_COST_LINES, MAX_MINOR, PLANNED_SCENARIOS, PRIORITIES,
  SINGLE_COST_KINDS, TRANSMISSIONS, VAT_BASES,
} from "./types";
import type { Issue, SearchCatalog, SearchSpec } from "./types";

export const LIMITS = {
  modelYear: { min: 1950, max: 2100 },
  registrationYear: { min: 1900, max: 2100 },
  mileageKm: { min: 1, max: 2_000_000 },
  seats: { min: 1, max: 20 },
  variantMax: 100,
  deviationMaxBp: 10_000,
} as const;

const CONTROL = /[\u0000-\u001f\u007f]/;
const COST_ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;

const isInt = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);

/** Tekst som data: ikke-tom, uten styretegn, uten omkringliggende mellomrom (ingen stille endring). */
export function textIssue(value: unknown, max: number): "not_string" | "empty" | "too_long" | "control_chars" | "untrimmed" | null {
  if (typeof value !== "string") return "not_string";
  if (value === "") return "empty";
  if (value.length > max) return "too_long";
  if (CONTROL.test(value)) return "control_chars";
  if (value !== value.trim()) return "untrimmed";
  return null;
}

const TEXT_MESSAGES = {
  not_string: "Må være tekst.",
  empty: "Kan ikke være tom.",
  too_long: "For lang tekst.",
  control_chars: "Inneholder ugyldige tegn.",
  untrimmed: "Har mellomrom først eller sist.",
} as const;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Gyldig førstegangsregistrering med presisjon, eller en feilkode. */
export function firstRegistrationIssue(fr: unknown): string | null {
  if (typeof fr !== "object" || fr === null) return "Må være en dato med presisjon.";
  const f = fr as Record<string, unknown>;
  const { precision, year, month, day } = f;
  if (precision !== "year" && precision !== "month" && precision !== "date") return "Presisjon må være year, month eller date.";
  const allowed = precision === "year" ? ["precision", "year"] : precision === "month" ? ["precision", "year", "month"] : ["precision", "year", "month", "day"];
  if (Object.keys(f).some((k) => !allowed.includes(k)) || allowed.some((k) => !(k in f))) return "Feltene stemmer ikke med presisjonen (ingen oppdiktet måned eller dag).";
  if (!isInt(year) || year < LIMITS.registrationYear.min || year > LIMITS.registrationYear.max) return `År må være et heltall mellom ${LIMITS.registrationYear.min} og ${LIMITS.registrationYear.max}.`;
  if (precision === "year") return null;
  if (!isInt(month) || month < 1 || month > 12) return "Måned må være 1–12.";
  if (precision === "month") return null;
  if (!isInt(day) || day < 1 || day > daysInMonth(year, month)) return "Ugyldig dag i måneden.";
  return null;
}

/** Tidligste og seneste mulige dato (ÅÅÅÅMMDD som heltall) for en gyldig registrering. */
export function firstRegistrationBounds(fr: FirstRegistration): { earliest: number; latest: number } {
  if (fr.precision === "date") {
    const v = fr.year * 10000 + fr.month * 100 + fr.day;
    return { earliest: v, latest: v };
  }
  if (fr.precision === "month") {
    return { earliest: fr.year * 10000 + fr.month * 100 + 1, latest: fr.year * 10000 + fr.month * 100 + daysInMonth(fr.year, fr.month) };
  }
  return { earliest: fr.year * 10000 + 101, latest: fr.year * 10000 + 1231 };
}

function dupes(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) out.push(v);
    seen.add(v);
  }
  return out;
}

export function validateSpec(spec: SearchSpec, catalog: SearchCatalog): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  const text = (path: string, value: unknown, max: number) => {
    const t = textIssue(value, max);
    if (t) add(path, t, TEXT_MESSAGES[t]);
    return t === null;
  };

  // ---- bilidentitet
  const v = spec.vehicle;
  if (v.brand !== null) {
    if (typeof v.brand !== "string" || !catalog.hasBrand(v.brand)) add("vehicle.brand", "unknown_brand", "Ukjent merke i katalogen.");
  }
  if (v.model !== null) {
    if (v.brand === null) add("vehicle.model", "model_requires_brand", "Modell krever merke.");
    else if (typeof v.model !== "string" || typeof v.brand !== "string" || !catalog.hasModel(v.brand, v.model)) add("vehicle.model", "unknown_model", "Ukjent modell for valgt merke.");
  }
  if (v.variant !== null) {
    if (v.model === null) add("vehicle.variant", "variant_requires_model", "Variant krever modell.");
    // Fritekst: ingen sjekk mot katalogen.
    text("vehicle.variant", v.variant, LIMITS.variantMax);
  }

  // ---- krav
  const r = spec.requirements;
  const intRange = (path: string, range: { min: number | null; max: number | null } | null, lim: { min: number; max: number }) => {
    if (range === null) return;
    if (range.min === null && range.max === null) add(path, "empty_range", "Intervallet har ingen grense; bruk «ikke satt» i stedet.");
    for (const side of ["min", "max"] as const) {
      const x = range[side];
      if (x !== null && (!isInt(x) || x < lim.min || x > lim.max)) add(`${path}.${side}`, "out_of_range", `Må være et heltall mellom ${lim.min} og ${lim.max}.`);
    }
    if (isInt(range.min) && isInt(range.max) && range.min > range.max) add(path, "min_above_max", "Fra-verdien er høyere enn til-verdien.");
  };
  intRange("requirements.modelYear", r.modelYear, LIMITS.modelYear);
  intRange("requirements.seats", r.seats, LIMITS.seats);
  if (r.maxMileageKm !== null && (!isInt(r.maxMileageKm) || r.maxMileageKm < LIMITS.mileageKm.min || r.maxMileageKm > LIMITS.mileageKm.max)) {
    add("requirements.maxMileageKm", "out_of_range", `Må være et heltall mellom ${LIMITS.mileageKm.min} og ${LIMITS.mileageKm.max} km.`);
  }
  if (r.firstRegistration !== null) {
    const fr = r.firstRegistration;
    if (fr.from === null && fr.to === null) add("requirements.firstRegistration", "empty_range", "Intervallet har ingen grense; bruk «ikke satt» i stedet.");
    let okSides = true;
    for (const side of ["from", "to"] as const) {
      const d = fr[side];
      if (d === null) continue;
      const e = firstRegistrationIssue(d);
      if (e) { add(`requirements.firstRegistration.${side}`, "invalid_date", e); okSides = false; }
    }
    if (okSides && fr.from && fr.to && firstRegistrationBounds(fr.from).earliest > firstRegistrationBounds(fr.to).latest) {
      add("requirements.firstRegistration", "from_after_to", "Fra-datoen ligger etter til-datoen.");
    }
  }
  const enumList = <T extends string>(path: string, list: readonly T[], allowed: readonly string[]) => {
    if (!Array.isArray(list)) { add(path, "not_array", "Må være en liste."); return; }
    list.forEach((x, i) => { if (!allowed.includes(x)) add(`${path}[${i}]`, "invalid_value", "Ugyldig verdi."); });
    for (const d of dupes(list)) add(path, "duplicate", `Verdien «${d}» er oppgitt flere ganger.`);
  };
  enumList("requirements.bodyTypes", r.bodyTypes, BODY_TYPES);
  enumList("requirements.fuels", r.fuels, FUELS);
  enumList("requirements.transmissions", r.transmissions, TRANSMISSIONS);
  enumList("requirements.driveTrains", r.driveTrains, DRIVE_TRAINS);

  // ---- farge/interiør (prioritert liste) og utstyr
  const prioList = (path: string, list: { values: string[]; priority: string } | null, has: (k: string) => boolean) => {
    if (list === null) return;
    if (!PRIORITIES.includes(list.priority as never)) add(`${path}.priority`, "invalid_priority", "Prioritet må være «must» eller «nice».");
    if (!Array.isArray(list.values) || list.values.length === 0) { add(`${path}.values`, "empty_list", "Listen må ha minst ett valg; bruk «ikke satt» i stedet."); return; }
    list.values.forEach((k, i) => { if (typeof k !== "string" || !has(k)) add(`${path}.values[${i}]`, "unknown_key", "Ukjent valg i katalogen."); });
    for (const d of dupes(list.values)) add(`${path}.values`, "duplicate", `Valget «${d}» er oppgitt flere ganger.`);
  };
  prioList("appearance.exteriorColors", spec.appearance.exteriorColors, (k) => catalog.hasExteriorColor(k));
  prioList("appearance.interiorColors", spec.appearance.interiorColors, (k) => catalog.hasInteriorColor(k));
  prioList("appearance.interiorMaterials", spec.appearance.interiorMaterials, (k) => catalog.hasInteriorMaterial(k));

  spec.equipment.forEach((e, i) => {
    if (typeof e.key !== "string" || !catalog.hasEquipment(e.key)) add(`equipment[${i}].key`, "unknown_equipment", "Ukjent utstyr i katalogen.");
    if (!PRIORITIES.includes(e.priority as never)) add(`equipment[${i}].priority`, "invalid_priority", "Prioritet må være «must» eller «nice».");
  });
  for (const d of dupes(spec.equipment.map((e) => e.key))) add("equipment", "duplicate", `Utstyret «${d}» er oppgitt flere ganger.`);

  // ---- budsjett
  const b = spec.budget;
  if (b.maxTotalNokMinor !== null && (typeof b.maxTotalNokMinor !== "bigint" || b.maxTotalNokMinor <= 0n || b.maxTotalNokMinor > MAX_MINOR)) {
    add("budget.maxTotalNokMinor", "invalid_amount", "Budsjettet må være et positivt beløp i NOK (øre) og høyst 2^53-1.");
  }
  if (b.deviationBasisPoints !== null && (!isInt(b.deviationBasisPoints) || b.deviationBasisPoints < 0 || b.deviationBasisPoints > LIMITS.deviationMaxBp)) {
    add("budget.deviationBasisPoints", "out_of_range", "Prisavviket må være 0–10 000 basispunkter (0–100 %).");
  }
  if (!Array.isArray(b.costs)) add("budget.costs", "not_array", "Må være en liste.");
  else {
    if (b.costs.length > MAX_COST_LINES) add("budget.costs", "too_many", `Høyst ${MAX_COST_LINES} kostnadslinjer.`);
    const ids = new Set<string>();
    const kinds = new Set<string>();
    b.costs.forEach((c, i) => {
      const p = `budget.costs[${i}]`;
      if (typeof c.id !== "string" || !COST_ID.test(c.id)) add(`${p}.id`, "invalid_id", "Ugyldig id (små bokstaver, tall, - og _; høyst 40 tegn).");
      else if (ids.has(c.id)) add(`${p}.id`, "duplicate", `Kostnadslinjen «${c.id}» finnes flere ganger.`);
      else ids.add(c.id);
      if (!COST_KINDS.includes(c.kind)) add(`${p}.kind`, "invalid_kind", "Ugyldig kostnadstype.");
      else if (SINGLE_COST_KINDS.includes(c.kind)) {
        if (kinds.has(c.kind)) add(`${p}.kind`, "duplicate", `Kostnadstypen «${c.kind}» kan bare forekomme én gang.`);
        kinds.add(c.kind);
      }
      text(`${p}.label`, c.label, COST_LABEL_MAX);
      if (typeof c.currency !== "string" || !isSupportedCurrency(c.currency)) add(`${p}.currency`, "unsupported_currency", "Valutaen støttes ikke.");
      if (c.amountMinor !== null && (typeof c.amountMinor !== "bigint" || c.amountMinor < 0n || c.amountMinor > MAX_MINOR)) {
        add(`${p}.amountMinor`, "invalid_amount", "Beløpet må være 0 eller mer og høyst 2^53-1 (minste enhet); tomt = ukjent.");
      }
      if (c.vatBasis !== null && !VAT_BASES.includes(c.vatBasis)) add(`${p}.vatBasis`, "invalid_vat_basis", "Ugyldig mva.-grunnlag.");
      if (typeof c.includedInBudget !== "boolean") add(`${p}.includedInBudget`, "not_boolean", "Må være ja eller nei.");
    });
  }

  // ---- planlagt registrering
  if (!PLANNED_SCENARIOS.includes(spec.plannedRegistration.requested)) add("plannedRegistration.requested", "invalid_scenario", "Ugyldig registreringsscenario.");

  return issues;
}
