/**
 * SEARCH-003 — adapter fra prototypens eksportformat `merovo.search-draft` v2 til validert `SearchSpec`
 * og domenets versjonerte JSON (`merovo.search-model` v1).
 *
 * Ren TypeScript utenfor domenelaget (domenet importerer aldri denne modulen eller prototypekode). Ingen DOM,
 * nettverk, lagring, kandidatdata eller kobling til dagens app. Prototypens eget filformat og UI er uendret.
 *
 * KONTRAKT
 *  - Input er `unknown` (et allerede parset JSON-dokument) + injisert `SearchCatalog` + eksplisitt tilleggsinput
 *    (`AdapterExtraInput`: planlagt norsk registrering og prioritet for hver utfylte farge-/materialliste).
 *  - Dokumentet valideres fullt ut (schema, versjon, nøkler, typer, enheter, grenser, katalogreferanser) før
 *    konvertering. Aldri unntak, aldri mutasjon av input, aldri delvis `SearchSpec`.
 *  - Bare v2 aksepteres. v1 avvises med beskjed om å åpne og eksportere på nytt i prototypen (ingen egen v1-migrering).
 *  - Mapping følger domenets PROTOTYPE_MAPPING. Et UTFYLT kriterium med status planned_later / not_relevant_for_matching
 *    gir et BLOKKERT resultat (`kind: "blocked"`, med feltsti, visningsnavn og grunn) uten spec og uten domeneeksport.
 *    Ingen stripping og ingen «fortsett likevel». Tomme felt blokkerer ikke. «Tom» følger prototypens eksportsemantikk
 *    (ikke 0/false): tom streng, tom liste, intervall/verdi med bare null; 0 (f.eks. «Tidligere eiere maks 0») er utfylt.
 *  - Merke/modell: prototypens verdier ER katalognøkler og slås opp direkte i katalogen (ingen fuzzy matching).
 *  - Prototypen har ingen prioritet for farge/materiale: `listPriorities` MÅ gis for hver utfylt liste; ingen standard.
 *  - Planlagt registrering utledes aldri (ikke fra karosseri, ikke fra van); må oppgis, `unspecified` er gyldig.
 *  - Kostnadslinjer: faste linjer får id = prototypens nøkkel («transport», «travel», «insurance», «prep»), egendefinerte
 *    får `custom-<n>` i dokumentrekkefølge (prototypen eksporterer ingen id). Beløp/valuta/mva./inkludering overføres uendret;
 *    ukjent beløp er `null` med valuta bevart; ingen konvertering og ingen summering; linjene øker aldri budsjettgrensen.
 *  - Slutten valideres av domenets `validateSpec` mot katalogen og serialiseres med `specToJson`.
 *
 * DUPLISERT FORMATVALIDERING (modulgrensene tillater ikke å importere prototypen): feltkatalogen i fields.ts og
 * effektkonverteringene under. Kontrakttester sammenligner dem med prototypens faktiske kode og eksport.
 */
import { mappingFor } from "@/domain/search-v2/mapping";
import { specToJson } from "@/domain/search-v2/serialization";
import type { SearchSpecJson } from "@/domain/search-v2/serialization";
import { validateSpec } from "@/domain/search-v2/validation";
import type {
  CostLine, EquipmentCriterion, Issue, PlannedRegistrationScenario, Priority, PrioritizedList, SearchCatalog, SearchSpec, VatBasis,
} from "@/domain/search-v2/types";
import type { FirstRegistration } from "@/domain/types";
import { FIELD_OPTIONS, FIXED_COST_KINDS, PRIORITY_SELECT_FIELDS, PROTOTYPE_FIELDS } from "./fields";
import type { FieldSpec } from "./fields";

export const PROTOTYPE_SCHEMA = "merovo.search-draft";
export const PROTOTYPE_VERSION = 2;

export interface AdapterExtraInput {
  /** Forhandlerens ønske. Påkrevd. */
  plannedRegistration: PlannedRegistrationScenario;
  /** Prioritet for hver UTFYLT liste. Påkrevd for utfylte lister; ignoreres for tomme lister. */
  listPriorities?: { extColor?: Priority; intColor?: Priority; material?: Priority };
}

export interface UnsupportedSelection {
  /** Sti i dokumentet, f.eks. «criteria.packages». */
  path: string;
  prototypeId: string;
  /** Prototypens visningsnavn. */
  label: string;
  status: "planned_later" | "not_relevant_for_matching";
  reason: string;
}

export type AdaptResult =
  | { ok: true; spec: SearchSpec; json: SearchSpecJson; origin: "user" | "demo-example" | null }
  | { ok: false; kind: "invalid" | "blocked"; issues: Issue[]; unsupported: UnsupportedSelection[] };

type Rec = Record<string, unknown>;

const isPlain = (x: unknown): x is Rec => {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return false;
  const p = Object.getPrototypeOf(x);
  return p === Object.prototype || p === null;
};
const isInt = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n);
const FIELD_BY_ID = new Map(PROTOTYPE_FIELDS.map((x) => [x.id, x]));
const PRIORITIES: readonly string[] = ["must", "nice"];
const SCENARIOS: readonly string[] = ["passenger", "van", "unspecified"];
const TOP_KEYS = ["schema", "schemaVersion", "exportedAt", "origin", "notice", "criteria", "equipment", "budget"];

// ---- effektkonvertering (kopi av prototypen; 1 hk = 735,49875 W; sammenlignes med prototypen i kontrakttest)
const HP_NUM = 73549875;
const HP_DEN = 100000;
const hpToW = (hp: number) => Math.floor((hp * HP_NUM + HP_DEN / 2) / HP_DEN);
const wToHp = (w: number) => Math.floor((w * HP_DEN * 2 + HP_NUM) / (HP_NUM * 2));
const wToKw = (w: number) => Math.floor((w + 500) / 1000);

interface Ctx {
  issues: Issue[];
  add(path: string, code: string, message: string): void;
}

/** Eksakt nøkkelsett; ukjente og manglende nøkler gir feil. Returnerer objektet (også ved feil, for videre kontroll). */
function exact(v: unknown, path: string, keys: readonly string[], c: Ctx, optional: readonly string[] = []): Rec | null {
  if (!isPlain(v)) { c.add(path, "not_object", "Må være et objekt."); return null; }
  let ok = true;
  for (const k of Object.keys(v)) if (!keys.includes(k) && !optional.includes(k)) { c.add(`${path}.${k}`, "unknown_key", "Ukjent nøkkel."); ok = false; }
  for (const k of keys) if (!Object.hasOwn(v, k)) { c.add(`${path}.${k}`, "missing_key", "Påkrevd nøkkel mangler."); ok = false; }
  return ok ? v : null;
}

// ---------------------------------------------------------------- kriterier

interface Parsed {
  /** Utfylt etter prototypens tomhetssemantikk. */
  filled: boolean;
  value: unknown;
}

const YM = /^(\d{4})(?:-(\d{2}))?$/;
function ym(s: unknown, onlyMonth: boolean): { y: number; m: number | null } | null {
  if (typeof s !== "string") return null;
  const m = YM.exec(s);
  if (!m || (onlyMonth && m[2] === undefined)) return null;
  const y = Number(m[1]);
  const mo = m[2] === undefined ? null : Number(m[2]);
  if (y < 1900 || y > 2100 || (mo !== null && (mo < 1 || mo > 12))) return null;
  return { y, m: mo };
}

function readField(spec: FieldSpec, val: unknown, path: string, c: Ctx): Parsed | null {
  const bad = (msg: string, code = "invalid_value") => { c.add(path, code, `${spec.label}: ${msg}`); return null; };
  const intOrNull = (n: unknown, p: string, min: number, max: number): number | null | undefined => {
    if (n === null) return null;
    if (!isInt(n) || n < min || n > max) { c.add(p, "out_of_range", `${spec.label}: heltall mellom ${min} og ${max} (eller null).`); return undefined; }
    return n;
  };
  switch (spec.kind) {
    case "brand": case "model": {
      if (typeof val !== "string") return bad("må være tekst.", "not_string");
      return { filled: val.trim() !== "", value: val };
    }
    case "select": case "radio": {
      // Prototypens import: «alle» ("") eller et gyldig valg.
      if (typeof val !== "string") return bad("må være tekst.", "not_string");
      if (val !== "" && !(FIELD_OPTIONS[spec.id] ?? []).includes(val)) return bad("ukjent valg.", "unknown_option");
      return { filled: val !== "", value: val };
    }
    case "towbar": case "equipSelect": {
      // Prototypens import krever et gyldig valg (tom verdi eksporteres aldri for disse).
      if (typeof val !== "string") return bad("må være tekst.", "not_string");
      if (!(FIELD_OPTIONS[spec.id] ?? []).includes(val)) return bad("ukjent valg.", "unknown_option");
      return { filled: true, value: val };
    }
    case "variant": case "text": {
      if (typeof val !== "string" || val.length > (spec.maxLength ?? 60)) return bad("ugyldig tekst.");
      return { filled: val.trim() !== "", value: val };
    }
    case "month": {
      if (typeof val !== "string" || (val.trim() !== "" && ym(val, true) === null)) return bad("ugyldig måned (ÅÅÅÅ-MM).");
      return { filled: val.trim() !== "", value: val };
    }
    case "multi": case "colors": case "packages": {
      const max = spec.kind === "packages" ? 10 : 40;
      if (!Array.isArray(val) || val.length > max || !val.every((x) => typeof x === "string" && (spec.kind !== "packages" || x.length <= 60)) || new Set(val).size !== val.length) {
        return bad("ugyldig liste (tekstverdier, ingen duplikater).");
      }
      const allowed = FIELD_OPTIONS[spec.id];
      if (allowed) {
        const unknown = (val as string[]).findIndex((x) => !allowed.includes(x));
        if (unknown >= 0) { c.add(`${path}[${unknown}]`, "unknown_option", `${spec.label}: ukjent valg.`); return null; }
      }
      return { filled: val.length > 0, value: [...val] };
    }
    case "range": {
      const o = exact(val, path, ["from", "to", "unit"], c);
      if (!o) return null;
      if (o.unit !== spec.unit) return bad(`enheten må være «${spec.unit}».`, "wrong_unit");
      const from = intOrNull(o.from, `${path}.from`, spec.min!, spec.max!);
      const to = intOrNull(o.to, `${path}.to`, spec.min!, spec.max!);
      if (from === undefined || to === undefined) return null;
      if (from !== null && to !== null && from > to) { c.add(path, "min_above_max", `${spec.label}: «til» kan ikke være mindre enn «fra».`); return null; }
      return { filled: from !== null || to !== null, value: { from, to } };
    }
    case "max": {
      const o = exact(val, path, ["value", "unit", "bound"], c);
      if (!o) return null;
      if (o.unit !== spec.unit) return bad(`enheten må være «${spec.unit}».`, "wrong_unit");
      if (o.bound !== (spec.minimum ? "min" : "max")) return bad(`grensen må være «${spec.minimum ? "min" : "max"}».`, "wrong_bound");
      const value = intOrNull(o.value, `${path}.value`, spec.min!, spec.max!);
      if (value === undefined) return null;
      return { filled: value !== null, value };
    }
    case "regrange": {
      const o = exact(val, path, ["from", "to", "format"], c);
      if (!o) return null;
      if (o.format !== "ÅÅÅÅ[-MM]") return bad("format må være «ÅÅÅÅ[-MM]».", "wrong_unit");
      const side = (s: unknown, p: string): FirstRegistration | null | undefined => {
        if (s === null) return null;
        const r = ym(s, false);
        if (!r) { c.add(p, "invalid_date", `${spec.label}: ugyldig dato (ÅÅÅÅ eller ÅÅÅÅ-MM).`); return undefined; }
        return r.m === null ? { precision: "year", year: r.y } : { precision: "month", year: r.y, month: r.m };
      };
      const from = side(o.from, `${path}.from`);
      const to = side(o.to, `${path}.to`);
      if (from === undefined || to === undefined) return null;
      return { filled: from !== null || to !== null, value: { from, to } };
    }
    case "weight": {
      const o = exact(val, path, ["type", "max", "unit"], c);
      if (!o) return null;
      if (o.unit !== "kg") return bad("enheten må være «kg».", "wrong_unit");
      if (o.type !== "" && o.type !== "curb" && o.type !== "gross") return bad("ukjent vekttype.");
      const max = intOrNull(o.max, `${path}.max`, 100, 10000);
      if (max === undefined) return null;
      if (max !== null && o.type === "") { c.add(`${path}.type`, "missing_dependency", `${spec.label}: vekttype må velges når en vekt er oppgitt.`); return null; }
      return { filled: max !== null || o.type !== "", value: { type: o.type, max } };
    }
    case "consumption": {
      const o = exact(val, path, ["unit", "max", "perUnit"], c);
      if (!o) return null;
      if (o.perUnit !== "100 km") return bad("perUnit må være «100 km».", "wrong_unit");
      if (o.unit !== "" && o.unit !== "l100" && o.unit !== "kwh100") return bad("ukjent forbruksenhet.", "wrong_unit");
      if (o.max !== null) {
        const m = typeof o.max === "string" ? /^(\d{1,3})(?:\.(\d))?$/.exec(o.max) : null;
        if (!m) return bad("ugyldig forbruksverdi.");
        const tenths = Number(m[1]) * 10 + Number(m[2] ?? 0);
        if (tenths < 1 || tenths > 1000) { c.add(`${path}.max`, "out_of_range", `${spec.label}: verdien må være mellom 0,1 og 100.`); return null; }
        if (o.unit === "") { c.add(`${path}.unit`, "missing_dependency", `${spec.label}: enhet må velges når en verdi er oppgitt.`); return null; }
      }
      return { filled: o.max !== null || o.unit !== "", value: { unit: o.unit, max: o.max } };
    }
    case "power": {
      const o = exact(val, path, ["unit", "from", "to", "approxKw", "normalizedWatts"], c);
      if (!o) return null;
      if (o.unit !== "hk" && o.unit !== "kW") return bad("enheten må være «hk» eller «kW».", "wrong_unit");
      const hp = o.unit === "hk";
      const [lo, hi] = hp ? [1, 3000] : [1, 2200];
      const from = intOrNull(o.from, `${path}.from`, lo, hi);
      const to = intOrNull(o.to, `${path}.to`, lo, hi);
      const approx = exact(o.approxKw, `${path}.approxKw`, ["from", "to"], c);
      const nw = exact(o.normalizedWatts, `${path}.normalizedWatts`, ["from", "to"], c);
      if (from === undefined || to === undefined || !approx || !nw) return null;
      let ok = true;
      for (const [side, shown] of [["from", from], ["to", to]] as const) {
        const w = nw[side];
        const a = approx[side];
        if (shown === null) {
          if (w !== null) { c.add(`${path}.normalizedWatts.${side}`, "inconsistent", `${spec.label}: normalizedWatts.${side} uten oppgitt verdi.`); ok = false; }
          if (a !== null) { c.add(`${path}.approxKw.${side}`, "inconsistent", `${spec.label}: approxKw.${side} uten oppgitt verdi.`); ok = false; }
          continue;
        }
        const back = hp ? wToHp : wToKw;
        if (!isInt(w) || w < 1 || w > 4_000_000 || back(w) !== shown) { c.add(`${path}.normalizedWatts.${side}`, "inconsistent", `${spec.label}: normalizedWatts.${side} stemmer ikke med oppgitt effekt.`); ok = false; }
        const kw = hp ? wToKw(hpToW(shown)) : shown;
        if (a !== kw) { c.add(`${path}.approxKw.${side}`, "inconsistent", `${spec.label}: approxKw.${side} stemmer ikke med oppgitt effekt.`); ok = false; }
      }
      if (ok && from !== null && to !== null && from > to) { c.add(path, "min_above_max", `${spec.label}: «til» kan ikke være mindre enn «fra».`); ok = false; }
      return ok ? { filled: from !== null || to !== null, value: null } : null;
    }
    default:
      return bad("ukjent felttype.");
  }
}

// ---------------------------------------------------------------- budsjett

const MONEY = /^\d{1,13}$/;
function readMoney(m: unknown, path: string, c: Ctx): { minor: bigint; currency: string } | null {
  const o = exact(m, path, ["amountMinor", "currency"], c);
  if (!o) return null;
  if (typeof o.amountMinor !== "string" || !MONEY.test(o.amountMinor) || typeof o.currency !== "string") { c.add(path, "invalid_amount", "Ugyldig beløp (heltallsstreng i minste enhet og valuta)."); return null; }
  return { minor: BigInt(o.amountMinor), currency: o.currency };
}

interface BudgetParts { maxTotalNokMinor: bigint | null; deviationBasisPoints: number | null; costs: CostLine[] }

function readBudget(b: unknown, c: Ctx): BudgetParts | null {
  const o = exact(b, "budget", ["currency", "maxPurchaseCost", "deviation", "costs"], c, ["note"]);
  if (!o) return null;
  const before = c.issues.length;
  if (o.currency !== "NOK") c.add("budget.currency", "currency_not_nok", "Budsjettet må være i NOK.");
  if (o.note !== undefined && typeof o.note !== "string") c.add("budget.note", "not_string", "Må være tekst.");
  let max: bigint | null = null;
  if (o.maxPurchaseCost !== null) {
    const m = readMoney(o.maxPurchaseCost, "budget.maxPurchaseCost", c);
    if (m) {
      if (m.currency !== "NOK") c.add("budget.maxPurchaseCost.currency", "currency_not_nok", "Maks innkjøpskostnad må være i NOK.");
      max = m.minor;
    }
  }
  let bp: number | null = null;
  const d = exact(o.deviation, "budget.deviation", ["enabled", "basisPoints", "maxAllowed"], c);
  if (d) {
    if (typeof d.enabled !== "boolean") c.add("budget.deviation.enabled", "not_boolean", "Må være ja eller nei.");
    else if (d.enabled) {
      if (!isInt(d.basisPoints) || d.basisPoints < 0 || d.basisPoints > 10000) c.add("budget.deviation.basisPoints", "out_of_range", "Basispunkter må være et heltall 0–10 000 når avvik er på.");
      else bp = d.basisPoints;
    } else if (d.basisPoints !== null) c.add("budget.deviation.basisPoints", "inconsistent", "Avvik er av, men har en verdi.");
    // maxAllowed er avledet og overføres ikke; et skadet/selvmotsigende dokument godtas likevel ikke.
    if (d.maxAllowed !== null) {
      const mm = readMoney(d.maxAllowed, "budget.deviation.maxAllowed", c);
      if (mm) {
        const expected = d.enabled === true && max !== null && bp !== null ? (max * (10000n + BigInt(bp))) / 10000n : null;
        if (expected === null || mm.currency !== "NOK" || mm.minor !== expected) c.add("budget.deviation.maxAllowed", "inconsistent", "maxAllowed stemmer ikke med budsjett og avvik.");
      }
    } else if (d.enabled === true && max !== null && bp !== null) c.add("budget.deviation.maxAllowed", "inconsistent", "maxAllowed mangler selv om avvik og budsjett er satt.");
  }
  const costs: CostLine[] = [];
  if (!Array.isArray(o.costs)) c.add("budget.costs", "not_array", "Må være en liste.");
  else {
    let custom = 0;
    o.costs.forEach((raw, i) => {
      const p = `budget.costs[${i}]`;
      const co = exact(raw, p, ["kind", "label", "currency", "amount", "vatBasis", "includedInBudget"], c);
      if (!co) return;
      const n0 = c.issues.length;
      if (typeof co.kind !== "string") c.add(`${p}.kind`, "not_string", "Må være tekst.");
      if (typeof co.label !== "string") c.add(`${p}.label`, "not_string", "Må være tekst.");
      if (typeof co.currency !== "string") c.add(`${p}.currency`, "not_string", "Må være tekst.");
      if (typeof co.includedInBudget !== "boolean") c.add(`${p}.includedInBudget`, "not_boolean", "Må være ja eller nei.");
      if (co.vatBasis !== "" && co.vatBasis !== "incl" && co.vatBasis !== "excl" && co.vatBasis !== "none") c.add(`${p}.vatBasis`, "invalid_vat_basis", "Ugyldig mva.-grunnlag.");
      let amountMinor: bigint | null = null;
      if (co.amount !== null) {
        const a = readMoney(co.amount, `${p}.amount`, c);
        if (a) {
          if (a.currency !== co.currency) c.add(`${p}.amount.currency`, "inconsistent", "Valuta på linjen og i beløpet er ulike.");
          amountMinor = a.minor;
        }
      }
      const fixed = typeof co.kind === "string" && Object.hasOwn(FIXED_COST_KINDS, co.kind);
      if (typeof co.kind === "string" && !fixed && co.kind !== "custom") c.add(`${p}.kind`, "invalid_kind", "Ukjent kostnadstype.");
      if (c.issues.length > n0) return;
      const kind = co.kind as string;
      const id = fixed ? kind : `custom-${++custom}`;
      costs.push({
        id,
        kind: fixed ? FIXED_COST_KINDS[kind]! : "custom",
        label: co.label as string,
        currency: co.currency as string,
        amountMinor,
        vatBasis: co.vatBasis === "" ? null : (co.vatBasis as VatBasis),
        includedInBudget: co.includedInBudget as boolean,
      });
    });
  }
  return c.issues.length > before ? null : { maxTotalNokMinor: max, deviationBasisPoints: bp, costs };
}

// ---------------------------------------------------------------- tilleggsinput

function readExtra(x: unknown, c: Ctx): { scenario: PlannedRegistrationScenario | null; prio: Record<string, Priority>; bad: boolean } | null {
  if (!isPlain(x)) { c.add("extra", "missing_input", "Tilleggsinput mangler (planlagt registrering må oppgis)."); return null; }
  const before = c.issues.length;
  for (const k of Object.keys(x)) if (k !== "plannedRegistration" && k !== "listPriorities") c.add(`extra.${k}`, "unknown_key", "Ukjent nøkkel i tilleggsinput.");
  let scenario: PlannedRegistrationScenario | null = null;
  if (!Object.hasOwn(x, "plannedRegistration") || x.plannedRegistration === undefined) c.add("extra.plannedRegistration", "missing_input", "Planlagt norsk registrering må oppgis (passenger, van eller unspecified).");
  else if (typeof x.plannedRegistration !== "string" || !SCENARIOS.includes(x.plannedRegistration)) c.add("extra.plannedRegistration", "invalid_scenario", "Ugyldig registreringsscenario.");
  else scenario = x.plannedRegistration as PlannedRegistrationScenario;
  const prio: Record<string, Priority> = {};
  if (x.listPriorities !== undefined) {
    if (!isPlain(x.listPriorities)) c.add("extra.listPriorities", "not_object", "Må være et objekt.");
    else for (const [k, v] of Object.entries(x.listPriorities)) {
      if (k !== "extColor" && k !== "intColor" && k !== "material") c.add(`extra.listPriorities.${k}`, "unknown_key", "Ukjent liste.");
      else if (typeof v !== "string" || !PRIORITIES.includes(v)) c.add(`extra.listPriorities.${k}`, "invalid_priority", "Prioritet må være «must» eller «nice».");
      else prio[k] = v as Priority;
    }
  }
  return { scenario, prio, bad: c.issues.length > before || scenario === null };
}

// ---------------------------------------------------------------- hovedfunksjon

export function adaptPrototypeDraft(input: unknown, catalog: SearchCatalog, extra: unknown): AdaptResult {
  const issues: Issue[] = [];
  const unsupported: UnsupportedSelection[] = [];
  const c: Ctx = { issues, add: (path, code, message) => { issues.push({ path, code, message }); } };
  const invalid = (): AdaptResult => ({ ok: false, kind: "invalid", issues, unsupported });
  try {
    if (!isPlain(input)) { c.add("", "not_object", "Utkastet må være et JSON-objekt."); return invalid(); }
    if (input.schema !== PROTOTYPE_SCHEMA) { c.add("schema", "wrong_schema", `Ikke et Merovo-søkeutkast (forventet «${PROTOTYPE_SCHEMA}»).`); return invalid(); }
    if (input.schemaVersion === 1) { c.add("schemaVersion", "v1_not_supported", "Versjon 1-filer støttes ikke her. Åpne filen i forhåndsvisningen og eksporter den på nytt (versjon 2)."); return invalid(); }
    if (input.schemaVersion !== PROTOTYPE_VERSION) { c.add("schemaVersion", "unsupported_version", `Ikke støttet utkastversjon (${typeof input.schemaVersion === "number" ? input.schemaVersion : "ugyldig"}); støttet: ${PROTOTYPE_VERSION}.`); return invalid(); }

    for (const k of Object.keys(input)) if (!TOP_KEYS.includes(k)) c.add(k, "unknown_key", "Ukjent toppnivånøkkel.");
    let origin: "user" | "demo-example" | null = null;
    if (input.origin !== undefined) {
      if (input.origin !== "user" && input.origin !== "demo-example") c.add("origin", "invalid_value", "Ugyldig origin.");
      else origin = input.origin;
    }
    for (const k of ["exportedAt", "notice"]) if (input[k] !== undefined && typeof input[k] !== "string") c.add(k, "not_string", "Må være tekst.");
    for (const k of ["criteria", "equipment", "budget"]) if (!isPlain(input[k])) c.add(k, !Object.hasOwn(input, k) ? "missing_key" : "not_object", "Må være et objekt.");
    const criteria = isPlain(input.criteria) ? input.criteria : null;
    const equipmentDoc = isPlain(input.equipment) ? input.equipment : null;

    // «Ødelagt støttet del» = noe som hindrer at en spec kan bygges av de støttede verdiene. Feil i felt adapteren ikke kan
    // overføre (ustøttede) hindrer IKKE validering av de støttede verdiene: alle feil skal rapporteres samlet.
    let broken = false;
    for (const k of ["criteria", "equipment", "budget"]) if (!isPlain(input[k])) broken = true;

    // ---- kriterier
    const parsed = new Map<string, Parsed>();
    if (criteria) {
      for (const id of Object.keys(criteria)) {
        const spec = FIELD_BY_ID.get(id);
        const path = `criteria.${id}`;
        if (!spec) { c.add(path, "unknown_key", "Ukjent felt."); continue; }
        const row = mappingFor("field", id);
        const p = readField(spec, criteria[id], path, c);
        if (!p) { if (!row || row.status === "supported_now") broken = true; continue; }
        if (!row) { c.add(path, "mapping_missing", `Feltet «${spec.label}» mangler i mappingtabellen.`); broken = true; continue; }
        if (!p.filled) continue;
        if (row.status !== "supported_now") {
          unsupported.push({ path, prototypeId: id, label: spec.label, status: row.status, reason: row.note });
          continue;
        }
        parsed.set(id, p);
      }
    }

    // Avhengighet (prototypens validering): utfylt pakke krever valgt modell (og dermed merke). Pakkenavn selv kan ikke
    // valideres uten en pakkekatalog; feltet er uansett ikke overførbart.
    if (unsupported.some((u) => u.prototypeId === "packages") && !parsed.has("model")) {
      c.add("criteria.packages", "missing_dependency", "Utstyrspakke krever valgt modell.");
    }

    // ---- utstyr (boolsk, prioritet per element)
    const equipment: EquipmentCriterion[] = [];
    const eqBefore = issues.length;
    if (equipmentDoc) {
      for (const key of Object.keys(equipmentDoc)) {
        const path = `equipment.${key}`;
        const e = exact(equipmentDoc[key], path, ["priority"], c);
        if (!e) continue;
        if (typeof e.priority !== "string" || !PRIORITIES.includes(e.priority)) { c.add(`${path}.priority`, "invalid_priority", "Prioritet må være «must» eller «nice»."); continue; }
        if (PRIORITY_SELECT_FIELDS.includes(key)) {
          // Hengerfeste/cruise/klima: prioriteten hører til kriteriet i «criteria» (som blokkeres hvis utfylt).
          if (!criteria || !Object.hasOwn(criteria, key) || !parsed.has(key) && !unsupported.some((u) => u.prototypeId === key)) c.add(path, "priority_without_value", "Prioritet uten valgt verdi.");
          continue;
        }
        if (!catalog.hasEquipment(key)) { c.add(path, "unknown_equipment", "Ukjent utstyr i katalogen."); continue; }
        equipment.push({ key, priority: e.priority as Priority });
      }
    }

    if (issues.length > eqBefore) broken = true;

    // ---- budsjett og tilleggsinput
    const budget = isPlain(input.budget) ? readBudget(input.budget, c) : null;
    const ex = readExtra(extra, c);
    if (!budget || !ex || ex.bad) broken = true;

    // ---- lister med eksplisitt prioritet (ingen standard)
    const list = (id: string): PrioritizedList | null => {
      const p = parsed.get(id);
      if (!p) return null;
      const prio = ex?.prio[id];
      if (prio === undefined) { broken = true; if (ex) c.add(`extra.listPriorities.${id}`, "missing_input", `Prioritet (must/nice) må oppgis for utfylt liste «${FIELD_BY_ID.get(id)!.label}».`); return null; }
      return { values: p.value as string[], priority: prio };
    };
    const exteriorColors = list("extColor");
    const interiorColors = list("intColor");
    const interiorMaterials = list("material");

    if (broken || !ex || ex.scenario === null || !budget) return invalid();

    const range = (id: string) => {
      const p = parsed.get(id);
      return p ? { min: (p.value as { from: number | null }).from, max: (p.value as { to: number | null }).to } : null;
    };
    const str = (id: string) => {
      const p = parsed.get(id);
      return p ? (p.value as string) : null; // uendret tekst; domenet avviser uriktige mellomrom i stedet for at adapteren endrer dem
    };
    const fr = parsed.get("firstReg")?.value as { from: FirstRegistration | null; to: FirstRegistration | null } | undefined;
    const listOf = (id: string) => (parsed.get(id)?.value as string[] | undefined) ?? [];
    const spec: SearchSpec = {
      vehicle: { brand: str("brand"), model: str("model"), variant: str("variant") },
      requirements: {
        modelYear: range("modelYear"),
        firstRegistration: fr ? { from: fr.from, to: fr.to } : null,
        maxMileageKm: (parsed.get("mileage")?.value as number | undefined) ?? null,
        seats: range("seats"),
        bodyTypes: listOf("body") as never,
        fuels: listOf("fuel") as never,
        transmissions: listOf("gear") as never,
        driveTrains: listOf("drive") as never,
      },
      appearance: { exteriorColors, interiorColors, interiorMaterials },
      equipment,
      budget,
      plannedRegistration: { requested: ex.scenario },
    };
    // Støttede verdier valideres alltid mot domenet, også når dokumentet har ustøttede valg eller andre feil.
    issues.push(...validateSpec(spec, catalog));
    if (issues.length) return invalid();
    if (unsupported.length) return { ok: false, kind: "blocked", issues: [], unsupported };
    const json = specToJson(spec, catalog);
    if (!json.ok) { issues.push(...json.issues); return invalid(); }
    return { ok: true, spec, json: json.value, origin };
  } catch {
    issues.push({ path: "", code: "invalid_structure", message: "Ugyldig struktur." });
    return invalid();
  }
}
