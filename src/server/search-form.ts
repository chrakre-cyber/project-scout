/**
 * Søkeskjemaet (FormData) ↔ søkemodell v1 (`SearchSpec`). Ren funksjon, ingen I/O og ingen React.
 *
 * Tre ting holdes adskilt (SEARCH-005):
 *  1. RÅ SKJEMATILSTAND (`FormValues`, tekst slik brukeren skrev den) — brukes bare til å tegne skjemaet på nytt ved feil;
 *  2. VERSJONERT DOKUMENT (`SearchSpecJson`, `merovo.search-model` v1, heltallsstrenger for penger) — det som lagres;
 *  3. INTERN MODELL (`SearchSpec`, `bigint`) — det domenet vurderer. `bigint` krysser aldri en JSON- eller servergrense.
 *
 * Regler:
 *  - Ingenting blir 0/false av seg selv: tomt felt = «ikke satt». Kostnadsbeløp: tomt = ukjent (valuta bevares), «0» = eksplisitt 0.
 *  - Prioritet for en utfylt farge-/materialliste og planlagt registrering må velges uttrykkelig (ingen standard).
 *  - Kostnadslinjer har stabile id-er: faste linjer bruker typen som id, egendefinerte får en tilfeldig id første gang de lagres
 *    og beholder den (skjult felt) uansett sletting/omrekkefølge. Prototypens posisjonsbaserte `custom-<n>` brukes aldri.
 *  - Firma, aktiv-status, versjon og andre servergrunner leses ALDRI herfra (se `actions.ts`).
 *  - Til slutt valideres hele spesifikasjonen av domenets `validateSpec` mot katalogen; feil fra domenet blir feltfeil.
 */
import { isSupportedCurrency, minorDigits } from "@/domain/currency";
import { firstRegistrationIssue, LIMITS } from "@/domain/search-v2/validation";
import { specToJson } from "@/domain/search-v2/serialization";
import type { SearchSpecJson } from "@/domain/search-v2/serialization";
import { validateSpec } from "@/domain/search-v2/validation";
import { emptySpec } from "@/domain/search-v2/factory";
import {
  BODY_TYPES, COST_LABEL_MAX, DRIVE_TRAINS, FUELS, MAX_COST_LINES, MAX_MINOR, SINGLE_COST_KINDS, TRANSMISSIONS,
} from "@/domain/search-v2/types";
import type {
  CostKind, CostLine, EquipmentCriterion, PlannedRegistrationScenario, Priority, PrioritizedList, SearchCatalog, SearchSpec, VatBasis,
} from "@/domain/search-v2/types";
import type { FirstRegistration } from "@/domain/types";
import { BLANK_CUSTOM_ROWS, FIXED_COSTS, MAX_CUSTOM_INDEX } from "@/lib/search-labels";

export type FormValues = Record<string, string | string[]>;
export type FormErrors = Record<string, string>;

export interface ParsedSearchForm {
  /** Navn og spesifikasjon bare når ALT er gyldig. Ugyldig skjema gir aldri en delvis spesifikasjon. */
  ok: boolean;
  name: string | null;
  spec: SearchSpec | null;
  json: SearchSpecJson | null;
  /** Feil per skjemafelt (nøkkel = feltnavn). */
  errors: FormErrors;
  /** Feil uten eget felt. */
  general: string[];
  /** Råverdier for å tegne skjemaet på nytt. */
  values: FormValues;
}

const CUSTOM_ID = /^c-[0-9a-f]{12}$/;

const SCENARIOS: readonly PlannedRegistrationScenario[] = ["passenger", "van", "unspecified"];
const PRIORITIES: readonly Priority[] = ["must", "nice"];
const NAME_MAX = 120;

// ---------------------------------------------------------------- hjelpere

const str = (v: FormDataEntryValue | null | undefined): string => (typeof v === "string" ? v : "");
const strip = (s: string) => s.replace(/[\s  ]/g, "");

/** Positivt/ikke-negativt heltall i skjemaet (norsk tusenskille tillatt). */
function parseInteger(raw: string): number | null | "invalid" {
  const s = strip(raw);
  if (s === "") return null;
  if (!/^\d{1,9}$/.test(s)) return "invalid";
  return Number(s);
}

/** Eksakt desimalbeløp → minste enhet som bigint. Ingen flyttall. `null` = tomt, `"invalid"` = ugyldig. */
export function parseMinor(raw: string, digits: number): bigint | null | "invalid" {
  const s = strip(raw).replace(",", ".");
  if (s === "") return null;
  const m = /^(\d{1,16})(?:\.(\d+))?$/.exec(s);
  if (!m) return "invalid";
  const frac = m[2] ?? "";
  if (frac.length > digits) return "invalid";
  const minor = BigInt(m[1]! + frac.padEnd(digits, "0"));
  return minor > MAX_MINOR ? "invalid" : minor;
}

/** Prosent (0–100, høyst to desimaler) → basispunkter, eksakt. */
export function parsePercentBp(raw: string): number | null | "invalid" {
  const s = strip(raw).replace(",", ".").replace(/%$/, "");
  if (s === "") return null;
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return "invalid";
  const bp = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  return bp > LIMITS.deviationMaxBp ? "invalid" : bp;
}

/** ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD → registrering med den presisjonen brukeren oppga (ingen oppdiktet måned/dag). */
export function parseRegistration(raw: string): FirstRegistration | null | "invalid" {
  const s = raw.trim();
  if (s === "") return null;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(s);
  if (!m) return "invalid";
  const fr: FirstRegistration = m[3] !== undefined
    ? { precision: "date", year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }
    : m[2] !== undefined ? { precision: "month", year: Number(m[1]), month: Number(m[2]) } : { precision: "year", year: Number(m[1]) };
  return firstRegistrationIssue(fr) === null ? fr : "invalid";
}

function formatRegistration(fr: FirstRegistration | null): string {
  if (fr === null) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return fr.precision === "year" ? String(fr.year) : fr.precision === "month" ? `${fr.year}-${p(fr.month)}` : `${fr.year}-${p(fr.month)}-${p(fr.day)}`;
}

/** Minste enhet → visningsstreng som parseMinor leser tilbake uten tap («750 000», «1 250,50»). */
export function minorToField(minor: bigint, digits = 2): string {
  const s = minor.toString().padStart(digits + 1, "0");
  const whole = s.slice(0, s.length - digits).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = digits ? s.slice(-digits) : "";
  return frac && /[1-9]/.test(frac) ? `${whole},${frac}` : whole;
}

function bpToField(bp: number): string {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? String(whole) : `${whole},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

/** 12 tilfeldige hex-tegn til varig id for en egendefinert kostnadslinje (`c-<hex>`). Kan injiseres i tester. */
function defaultRandomHex(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- skjema → spesifikasjon

export interface ParseOptions {
  /** Kilde til nye egendefinerte kostnads-id-er (hex, 12 tegn). */
  newCostId?: () => string;
}

export function readFormValues(form: FormData): FormValues {
  const v: FormValues = {};
  for (const k of ["name", "brand", "model", "variant", "modelYearMin", "modelYearMax", "regFrom", "regTo", "maxMileageKm",
    "seatsMin", "seatsMax", "plannedRegistration", "budgetMax", "budgetDeviation",
    "exteriorColorsPriority", "interiorColorsPriority", "interiorMaterialsPriority"]) v[k] = str(form.get(k));
  for (const k of ["bodyTypes", "fuels", "transmissions", "driveTrains", "exteriorColors", "interiorColors", "interiorMaterials"]) {
    v[k] = form.getAll(k).filter((x): x is string => typeof x === "string");
  }
  for (const key of form.keys()) {
    if (key.startsWith("eq:") || key.startsWith("cost.") || key.startsWith("custom.")) v[key] = str(form.get(key));
  }
  return v;
}

const asStr = (v: FormValues, k: string): string => (typeof v[k] === "string" ? (v[k] as string) : "");
const asList = (v: FormValues, k: string): string[] => (Array.isArray(v[k]) ? (v[k] as string[]) : []);

export function parseSearchForm(form: FormData, catalog: SearchCatalog, options: ParseOptions = {}): ParsedSearchForm {
  return parseSearchFormValues(readFormValues(form), catalog, options);
}

export function parseSearchFormValues(values: FormValues, catalog: SearchCatalog, options: ParseOptions = {}): ParsedSearchForm {
  const errors: FormErrors = {};
  const general: string[] = [];
  const err = (field: string, msg: string) => { errors[field] ??= msg; };
  const newId = options.newCostId ?? defaultRandomHex;

  // ---- navn
  const nameRaw = asStr(values, "name");
  const name = nameRaw.trim();
  if (name === "") err("name", "Gi søket et navn.");
  else if (name.length > NAME_MAX) err("name", `Navnet kan ha høyst ${NAME_MAX} tegn.`);
  else if (/[\u0000-\u001f\u007f]/.test(name)) err("name", "Navnet inneholder ugyldige tegn.");

  // ---- bil
  const brand = asStr(values, "brand").trim() || null;
  const model = asStr(values, "model").trim() || null;
  const variantRaw = asStr(values, "variant");
  const variant = variantRaw.trim() || null;
  if (model && !brand) err("model", "Velg merke først.");
  if (variant && !model) err("variant", "Velg modell før du skriver variant.");

  // ---- krav
  const intRange = (minKey: string, maxKey: string, lim: { min: number; max: number }, unit: string) => {
    const a = parseInteger(asStr(values, minKey));
    const b = parseInteger(asStr(values, maxKey));
    if (a === "invalid") err(minKey, "Må være et heltall.");
    if (b === "invalid") err(maxKey, "Må være et heltall.");
    for (const [k, x] of [[minKey, a], [maxKey, b]] as const) {
      if (typeof x === "number" && (x < lim.min || x > lim.max)) err(k, `Må være mellom ${lim.min} og ${lim.max} ${unit}.`);
    }
    const lo = typeof a === "number" ? a : null;
    const hi = typeof b === "number" ? b : null;
    if (lo !== null && hi !== null && lo > hi) err(maxKey, "Til-verdien kan ikke være lavere enn fra-verdien.");
    if (a === "invalid" || b === "invalid") return { range: null, bad: true as const };
    return { range: lo === null && hi === null ? null : { min: lo, max: hi }, bad: false as const };
  };
  const modelYear = intRange("modelYearMin", "modelYearMax", LIMITS.modelYear, "");
  const seats = intRange("seatsMin", "seatsMax", LIMITS.seats, "seter");

  const regFrom = parseRegistration(asStr(values, "regFrom"));
  const regTo = parseRegistration(asStr(values, "regTo"));
  if (regFrom === "invalid") err("regFrom", "Skriv ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD med en gyldig dato.");
  if (regTo === "invalid") err("regTo", "Skriv ÅÅÅÅ, ÅÅÅÅ-MM eller ÅÅÅÅ-MM-DD med en gyldig dato.");

  const mileage = parseInteger(asStr(values, "maxMileageKm"));
  if (mileage === "invalid") err("maxMileageKm", "Må være et heltall i km.");
  else if (mileage !== null && (mileage < LIMITS.mileageKm.min || mileage > LIMITS.mileageKm.max)) {
    err("maxMileageKm", `Må være mellom ${LIMITS.mileageKm.min} og ${LIMITS.mileageKm.max.toLocaleString("nb-NO")} km.`);
  }

  const enumList = <T extends string>(key: string, allowed: readonly T[], what: string): T[] => {
    const picked = asList(values, key);
    const out: T[] = [];
    for (const x of picked) {
      if (!(allowed as readonly string[]).includes(x)) err(key, `Ugyldig valg for ${what}.`);
      else if (!out.includes(x as T)) out.push(x as T);
    }
    return out;
  };
  const bodyTypes = enumList("bodyTypes", BODY_TYPES, "karosseri");
  const fuels = enumList("fuels", FUELS.filter((f) => f !== "other"), "drivstoff");
  const transmissions = enumList("transmissions", TRANSMISSIONS, "girkasse");
  const driveTrains = enumList("driveTrains", DRIVE_TRAINS, "hjuldrift");

  // ---- farger/materiale: en felles prioritet, valgt uttrykkelig
  const prioList = (key: string, label: string): PrioritizedList | null => {
    const picked = asList(values, key).filter((x, i, a) => a.indexOf(x) === i);
    const prio = asStr(values, `${key}Priority`);
    if (picked.length === 0) {
      if (prio !== "") err(`${key}Priority`, `Du har valgt prioritet, men ingen ${label}.`);
      return null;
    }
    if (!(PRIORITIES as readonly string[]).includes(prio)) { err(`${key}Priority`, "Velg om dette er «Må ha» eller «Ønskelig»."); return null; }
    return { values: picked, priority: prio as Priority };
  };
  const exteriorColors = prioList("exteriorColors", "utvendige farger");
  const interiorColors = prioList("interiorColors", "interiørfarger");
  const interiorMaterials = prioList("interiorMaterials", "interiørmaterialer");

  // ---- utstyr: hvert element har egen prioritet; ukjente nøkler avvises (ingen stille bortfall)
  const equipment: EquipmentCriterion[] = [];
  for (const key of Object.keys(values).filter((k) => k.startsWith("eq:")).sort()) {
    const equipKey = key.slice(3);
    const p = asStr(values, key);
    if (p === "") continue;
    if (!catalog.hasEquipment(equipKey)) { general.push(`Ukjent utstyr «${equipKey.slice(0, 40)}». Siden kan være utdatert; last den på nytt.`); continue; }
    if (!(PRIORITIES as readonly string[]).includes(p)) { err(key, "Ugyldig prioritet."); continue; }
    equipment.push({ key: equipKey, priority: p as Priority });
  }

  // ---- registrering
  const scenarioRaw = asStr(values, "plannedRegistration");
  let scenario: PlannedRegistrationScenario | null = null;
  if (scenarioRaw === "") err("plannedRegistration", "Velg planlagt norsk registrering. «Uavklart» er et gyldig valg.");
  else if (!(SCENARIOS as readonly string[]).includes(scenarioRaw)) err("plannedRegistration", "Ugyldig valg.");
  else scenario = scenarioRaw as PlannedRegistrationScenario;

  // ---- budsjett (kan være usatt i utkast; ugyldig verdi lagres aldri)
  const maxRaw = parseMinor(asStr(values, "budgetMax"), 2);
  let maxTotalNokMinor: bigint | null = null;
  if (maxRaw === "invalid") err("budgetMax", "Ugyldig beløp. Bruk tall med høyst to desimaler, f.eks. 750 000.");
  else if (maxRaw !== null) {
    if (maxRaw <= 0n) err("budgetMax", "Budsjettet må være større enn 0. La feltet stå tomt hvis budsjett ikke er satt.");
    else maxTotalNokMinor = maxRaw;
  }
  const devRaw = parsePercentBp(asStr(values, "budgetDeviation"));
  if (devRaw === "invalid") err("budgetDeviation", "Prisavviket må være 0–100 % med høyst to desimaler.");
  const deviationBasisPoints = devRaw === "invalid" ? null : devRaw;
  if (deviationBasisPoints !== null && maxTotalNokMinor === null && maxRaw !== "invalid") err("budgetDeviation", "Prisavvik krever et budsjett.");

  const costs: CostLine[] = [];
  const costLine = (prefix: string, id: string, kind: CostKind, label: string): void => {
    const currency = asStr(values, `${prefix}.currency`).trim() || "NOK";
    if (!isSupportedCurrency(currency)) { err(`${prefix}.currency`, "Valutaen støttes ikke."); return; }
    const digits = minorDigits(currency) ?? 2;
    const amount = parseMinor(asStr(values, `${prefix}.amount`), digits);
    if (amount === "invalid") err(`${prefix}.amount`, `Ugyldig beløp. Bruk tall med høyst ${digits} desimaler, eller la feltet stå tomt hvis beløpet er ukjent.`);
    const vat = asStr(values, `${prefix}.vat`);
    if (vat !== "" && !["incl", "excl", "none"].includes(vat)) err(`${prefix}.vat`, "Ugyldig mva.-grunnlag.");
    costs.push({
      id, kind, label, currency,
      amountMinor: amount === "invalid" ? null : amount,
      vatBasis: vat === "" ? null : (vat as VatBasis),
      includedInBudget: asStr(values, `${prefix}.included`) === "true",
    });
  };
  for (const { kind, label } of FIXED_COSTS) {
    if (asStr(values, `cost.${kind}.use`) === "true") costLine(`cost.${kind}`, kind, kind, label);
  }
  const customIdx = [...new Set(Object.keys(values).flatMap((k) => { const m = /^custom\.(\d{1,2})\./.exec(k); return m ? [Number(m[1])] : []; }))]
    .filter((n) => n <= MAX_CUSTOM_INDEX).sort((a, b) => a - b);
  const usedIds = new Set<string>(FIXED_COSTS.map((f) => f.kind));
  for (const i of customIdx) {
    const p = `custom.${i}`;
    if (asStr(values, `${p}.remove`) === "true") continue;
    const rawId = asStr(values, `${p}.id`).trim();
    const label = asStr(values, `${p}.label`).trim();
    const touched = rawId !== "" || label !== "" || asStr(values, `${p}.amount`).trim() !== "";
    if (!touched) continue; // tom, ubrukt rad
    if (label === "") { err(`${p}.label`, "Gi kostnadslinjen en beskrivelse."); continue; }
    if (label.length > COST_LABEL_MAX) { err(`${p}.label`, `Beskrivelsen kan ha høyst ${COST_LABEL_MAX} tegn.`); continue; }
    if (/[\u0000-\u001f\u007f]/.test(label)) { err(`${p}.label`, "Beskrivelsen inneholder ugyldige tegn."); continue; }
    let id = rawId;
    if (id !== "" && !CUSTOM_ID.test(id)) { err(`${p}.label`, "Ugyldig linje-id. Last siden på nytt."); continue; }
    if (id === "") do { id = `c-${newId()}`; } while (usedIds.has(id));
    if (usedIds.has(id)) { err(`${p}.label`, "Samme kostnadslinje er oppgitt flere ganger. Last siden på nytt."); continue; }
    usedIds.add(id);
    costLine(p, id, "custom", label);
  }
  if (costs.length > MAX_COST_LINES) general.push(`Høyst ${MAX_COST_LINES} kostnadslinjer.`);

  // ---- bygg spesifikasjonen og la domenet validere (katalog + alle grenser)
  let spec: SearchSpec | null = null;
  let json: SearchSpecJson | null = null;
  const fieldErrors = Object.keys(errors).length + general.length;
  if (fieldErrors === 0 && scenario !== null) {
    const candidate: SearchSpec = {
      ...emptySpec(),
      vehicle: { brand, model, variant },
      requirements: {
        modelYear: modelYear.range,
        firstRegistration: regFrom === null && regTo === null ? null : { from: regFrom === "invalid" ? null : regFrom, to: regTo === "invalid" ? null : regTo },
        maxMileageKm: typeof mileage === "number" ? mileage : null,
        seats: seats.range,
        bodyTypes, fuels, transmissions, driveTrains,
      },
      appearance: { exteriorColors, interiorColors, interiorMaterials },
      equipment,
      budget: { maxTotalNokMinor, deviationBasisPoints, costs },
      plannedRegistration: { requested: scenario },
    };
    const issues = validateSpec(candidate, catalog);
    if (issues.length) for (const i of issues) {
      const field = fieldForPath(i.path);
      if (field) err(field, i.message);
      else general.push(`${i.message} (${i.path || "søket"})`);
    } else {
      const j = specToJson(candidate, catalog);
      if (j.ok) { spec = candidate; json = j.value; }
      else for (const i of j.issues) general.push(i.message);
    }
  }
  const ok = spec !== null && json !== null && Object.keys(errors).length === 0 && general.length === 0;
  return { ok, name: ok ? name : null, spec: ok ? spec : null, json: ok ? json : null, errors, general, values };
}

/** Domenets feilsti → skjemafelt (så feilen vises ved riktig felt). */
export function fieldForPath(path: string): string | null {
  const direct: Record<string, string> = {
    "vehicle.brand": "brand", "vehicle.model": "model", "vehicle.variant": "variant",
    "requirements.modelYear": "modelYearMin", "requirements.modelYear.min": "modelYearMin", "requirements.modelYear.max": "modelYearMax",
    "requirements.seats": "seatsMin", "requirements.seats.min": "seatsMin", "requirements.seats.max": "seatsMax",
    "requirements.firstRegistration": "regFrom", "requirements.firstRegistration.from": "regFrom", "requirements.firstRegistration.to": "regTo",
    "requirements.maxMileageKm": "maxMileageKm",
    "requirements.bodyTypes": "bodyTypes", "requirements.fuels": "fuels", "requirements.transmissions": "transmissions", "requirements.driveTrains": "driveTrains",
    "budget.maxTotalNokMinor": "budgetMax", "budget.deviationBasisPoints": "budgetDeviation",
    "plannedRegistration.requested": "plannedRegistration",
  };
  if (direct[path]) return direct[path]!;
  let m = /^appearance\.(exteriorColors|interiorColors|interiorMaterials)(?:\.|$)/.exec(path);
  if (m) return m[1]!;
  m = /^budget\.costs\[(\d+)\]/.exec(path);
  if (m) return null; // radnummer i spesifikasjonen ≠ rad i skjemaet; vises som generell feil
  return null;
}

// ---------------------------------------------------------------- spesifikasjon → skjema

const emptyCosts = (): Record<string, string> => ({});

export function emptyFormValues(): FormValues {
  return {
    name: "", brand: "", model: "", variant: "", modelYearMin: "", modelYearMax: "", regFrom: "", regTo: "", maxMileageKm: "",
    seatsMin: "", seatsMax: "", bodyTypes: [], fuels: [], transmissions: [], driveTrains: [],
    exteriorColors: [], exteriorColorsPriority: "", interiorColors: [], interiorColorsPriority: "", interiorMaterials: [], interiorMaterialsPriority: "",
    plannedRegistration: "", budgetMax: "", budgetDeviation: "", ...emptyCosts(),
  };
}

export function specToFormValues(name: string, spec: SearchSpec): FormValues {
  const v = emptyFormValues();
  v.name = name;
  v.brand = spec.vehicle.brand ?? "";
  v.model = spec.vehicle.model ?? "";
  v.variant = spec.vehicle.variant ?? "";
  const r = spec.requirements;
  v.modelYearMin = r.modelYear?.min?.toString() ?? "";
  v.modelYearMax = r.modelYear?.max?.toString() ?? "";
  v.regFrom = formatRegistration(r.firstRegistration?.from ?? null);
  v.regTo = formatRegistration(r.firstRegistration?.to ?? null);
  v.maxMileageKm = r.maxMileageKm?.toString() ?? "";
  v.seatsMin = r.seats?.min?.toString() ?? "";
  v.seatsMax = r.seats?.max?.toString() ?? "";
  v.bodyTypes = [...r.bodyTypes]; v.fuels = [...r.fuels]; v.transmissions = [...r.transmissions]; v.driveTrains = [...r.driveTrains];
  const a = spec.appearance;
  v.exteriorColors = a.exteriorColors ? [...a.exteriorColors.values] : []; v.exteriorColorsPriority = a.exteriorColors?.priority ?? "";
  v.interiorColors = a.interiorColors ? [...a.interiorColors.values] : []; v.interiorColorsPriority = a.interiorColors?.priority ?? "";
  v.interiorMaterials = a.interiorMaterials ? [...a.interiorMaterials.values] : []; v.interiorMaterialsPriority = a.interiorMaterials?.priority ?? "";
  for (const e of spec.equipment) v[`eq:${e.key}`] = e.priority;
  v.plannedRegistration = spec.plannedRegistration.requested;
  const b = spec.budget;
  v.budgetMax = b.maxTotalNokMinor === null ? "" : minorToField(b.maxTotalNokMinor);
  v.budgetDeviation = b.deviationBasisPoints === null ? "" : bpToField(b.deviationBasisPoints);
  let custom = 0;
  for (const c of b.costs) {
    const digits = minorDigits(c.currency) ?? 2;
    const base = (SINGLE_COST_KINDS as readonly string[]).includes(c.kind) ? `cost.${c.kind}` : `custom.${custom++}`;
    if (base.startsWith("cost.")) v[`${base}.use`] = "true"; else { v[`${base}.id`] = c.id; v[`${base}.label`] = c.label; }
    v[`${base}.amount`] = c.amountMinor === null ? "" : minorToField(c.amountMinor, digits);
    v[`${base}.currency`] = c.currency;
    v[`${base}.vat`] = c.vatBasis ?? "";
    v[`${base}.included`] = c.includedInBudget ? "true" : "";
  }
  return v;
}

/** Antall egendefinerte rader skjemaet skal tegne: lagrede rader + tomme plasser. */
export function customRowCount(values: FormValues): number {
  const idx = Object.keys(values).flatMap((k) => { const m = /^custom\.(\d{1,2})\./.exec(k); return m ? [Number(m[1])] : []; });
  return Math.min(MAX_CUSTOM_INDEX + 1, (idx.length ? Math.max(...idx) + 1 : 0) + BLANK_CUSTOM_ROWS);
}

