/**
 * Én eksplisitt, ren konvertering mellom JSON-egnet domeneformat (`SearchSpecJson`, versjonert) og
 * intern modell (`SearchSpec`). Dette er IKKE import av gamle appagenter eller prototypefiler
 * (se mapping.ts for hvordan en senere adapter skal koble prototypeformatet til domenet).
 *
 * Format «merovo.search-model», modellversjon 1 (adskilt fra prototypens `merovo.search-draft` v2):
 *  - alle nøkler er påkrevd; usatt = `null` eller `[]` (ingen implisitte standardverdier);
 *  - enheter er eksplisitte og kontrolleres (`year`, `km`, `seats`);
 *  - penger: `amountMinor` er en heltallsstreng (høyst 2^53-1, DEC-020), valuta alltid eksplisitt, også for ukjent beløp;
 *  - førstegangsregistrering bærer sin presisjon (`year`/`month`/`date`);
 *  - ukjente versjoner, ukjente nøkler og ikke-støttede kriterier avvises; inndata muteres aldri,
 *    og feil gir aldri et delvis resultat.
 */
import { MAX_MINOR, PRIORITIES, SEARCH_MODEL_SCHEMA, SEARCH_MODEL_VERSION } from "./types";
import type {
  Appearance, CostLine, EquipmentCriterion, FirstRegistrationRange, Issue, IntRange, PrioritizedList, Result, SearchCatalog, SearchSpec,
} from "./types";
import type { FirstRegistration } from "../types";
import { firstRegistrationIssue, isPlainObject, strictObject, validateSpec } from "./validation";
import { unsupportedPrototypeField } from "./mapping";

export interface SearchSpecJson {
  schema: typeof SEARCH_MODEL_SCHEMA;
  modelVersion: typeof SEARCH_MODEL_VERSION;
  vehicle: { brand: string | null; model: string | null; variant: string | null };
  requirements: {
    modelYear: { min: number | null; max: number | null; unit: "year" } | null;
    firstRegistration: { from: FirstRegistration | null; to: FirstRegistration | null } | null;
    maxMileage: { value: number; unit: "km" } | null;
    seats: { min: number | null; max: number | null; unit: "seats" } | null;
    bodyTypes: string[];
    fuels: string[];
    transmissions: string[];
    driveTrains: string[];
  };
  appearance: {
    exteriorColors: { values: string[]; priority: string } | null;
    interiorColors: { values: string[]; priority: string } | null;
    interiorMaterials: { values: string[]; priority: string } | null;
  };
  equipment: { key: string; priority: string }[];
  budget: {
    maxTotal: { amountMinor: string; currency: "NOK" } | null;
    deviationBasisPoints: number | null;
    costs: {
      id: string; kind: string; label: string; currency: string;
      amountMinor: string | null; vatBasis: string | null; includedInBudget: boolean;
    }[];
  };
  plannedRegistration: { requested: string };
}

// ---------------------------------------------------------------- intern → JSON

export function specToJson(spec: SearchSpec, catalog: SearchCatalog): Result<SearchSpecJson> {
  const issues = validateSpec(spec, catalog);
  if (issues.length) return { ok: false, issues };
  const r = spec.requirements;
  const list = (l: PrioritizedList | null) => (l === null ? null : { values: [...l.values], priority: l.priority as string });
  const fr = (d: FirstRegistration | null): FirstRegistration | null => (d === null ? null : ({ ...d } as FirstRegistration));
  const json: SearchSpecJson = {
    schema: SEARCH_MODEL_SCHEMA,
    modelVersion: SEARCH_MODEL_VERSION,
    vehicle: { brand: spec.vehicle.brand, model: spec.vehicle.model, variant: spec.vehicle.variant },
    requirements: {
      modelYear: r.modelYear === null ? null : { min: r.modelYear.min, max: r.modelYear.max, unit: "year" },
      firstRegistration: r.firstRegistration === null ? null : { from: fr(r.firstRegistration.from), to: fr(r.firstRegistration.to) },
      maxMileage: r.maxMileageKm === null ? null : { value: r.maxMileageKm, unit: "km" },
      seats: r.seats === null ? null : { min: r.seats.min, max: r.seats.max, unit: "seats" },
      bodyTypes: [...r.bodyTypes],
      fuels: [...r.fuels],
      transmissions: [...r.transmissions],
      driveTrains: [...r.driveTrains],
    },
    appearance: {
      exteriorColors: list(spec.appearance.exteriorColors),
      interiorColors: list(spec.appearance.interiorColors),
      interiorMaterials: list(spec.appearance.interiorMaterials),
    },
    equipment: spec.equipment.map((e) => ({ key: e.key, priority: e.priority as string })),
    budget: {
      maxTotal: spec.budget.maxTotalNokMinor === null ? null : { amountMinor: spec.budget.maxTotalNokMinor.toString(), currency: "NOK" },
      deviationBasisPoints: spec.budget.deviationBasisPoints,
      costs: spec.budget.costs.map((c) => ({
        id: c.id, kind: c.kind, label: c.label, currency: c.currency,
        amountMinor: c.amountMinor === null ? null : c.amountMinor.toString(),
        vatBasis: c.vatBasis, includedInBudget: c.includedInBudget,
      })),
    },
    plannedRegistration: { requested: spec.plannedRegistration.requested },
  };
  return { ok: true, value: json };
}

// ---------------------------------------------------------------- JSON → intern

type Rec = Record<string, unknown>;

const MONEY_STRING = /^(0|[1-9][0-9]{0,15})$/;

export function specFromJson(input: unknown, catalog: SearchCatalog): Result<SearchSpec> {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });

  if (!isPlainObject(input)) return { ok: false, issues: [{ path: "", code: "not_object", message: "Søkemodellen må være et JSON-objekt." }] };
  // Versjon først: andre versjoner kan ha andre nøkler, så det gis ingen følgefeil.
  if (input.schema !== SEARCH_MODEL_SCHEMA) return { ok: false, issues: [{ path: "schema", code: "wrong_schema", message: `Ukjent skjema; forventet «${SEARCH_MODEL_SCHEMA}».` }] };
  if (input.modelVersion !== SEARCH_MODEL_VERSION) {
    return { ok: false, issues: [{ path: "modelVersion", code: "unsupported_version", message: `Ikke støttet modellversjon (${typeof input.modelVersion === "number" ? input.modelVersion : "ugyldig"}); støttet: ${SEARCH_MODEL_VERSION}.` }] };
  }

  const strict = (v: unknown, path: string, keys: readonly string[]) => strictObject(v, path, keys, add);
  const str = (v: unknown, path: string): string | null => { if (typeof v === "string") return v; add(path, "not_string", "Må være tekst."); return null; };
  const strOrNull = (v: unknown, path: string): string | null => (v === null ? null : str(v, path));
  const int = (v: unknown, path: string): number | null => { if (typeof v === "number" && Number.isSafeInteger(v)) return v; add(path, "not_integer", "Må være et heltall."); return null; };
  const intOrNull = (v: unknown, path: string): number | null => (v === null ? null : int(v, path));
  const strArray = (v: unknown, path: string): string[] | null => {
    if (!Array.isArray(v)) { add(path, "not_array", "Må være en liste."); return null; }
    const out: string[] = [];
    v.forEach((x, i) => { const s = str(x, `${path}[${i}]`); if (s !== null) out.push(s); });
    return out.length === v.length ? out : null;
  };
  const unit = (v: unknown, path: string, expected: string) => { if (v !== expected) add(path, "wrong_unit", `Enheten må være «${expected}».`); };
  const moneyString = (v: unknown, path: string): bigint | null => {
    if (typeof v !== "string" || !MONEY_STRING.test(v)) { add(path, "invalid_amount", "Beløp må være en heltallsstreng i minste enhet (ikke et JSON-tall)."); return null; }
    const n = BigInt(v);
    if (n > MAX_MINOR) { add(path, "invalid_amount", "Beløpet er større enn 2^53-1."); return null; }
    return n;
  };
  const fr = (v: unknown, path: string): FirstRegistration | null => {
    if (v === null) return null;
    const e = firstRegistrationIssue(v);
    if (e) { add(path, "invalid_date", e); return null; }
    return { ...(v as Rec) } as unknown as FirstRegistration;
  };
  const prio = (v: unknown, path: string): "must" | "nice" | null => {
    if (typeof v === "string" && (PRIORITIES as readonly string[]).includes(v)) return v as "must" | "nice";
    add(path, "invalid_priority", "Prioritet må være «must» eller «nice»."); return null;
  };
  const plist = (v: unknown, path: string): PrioritizedList | null => {
    if (v === null) return null;
    const o = strict(v, path, ["values", "priority"]);
    if (!o) return null;
    const values = strArray(o.values, `${path}.values`);
    const priority = prio(o.priority, `${path}.priority`);
    return values && priority ? { values, priority } : null;
  };
  const range = (v: unknown, path: string, unitName: string): IntRange | null => {
    if (v === null) return null;
    const o = strict(v, path, ["min", "max", "unit"]);
    if (!o) return null;
    unit(o.unit, `${path}.unit`, unitName);
    return { min: intOrNull(o.min, `${path}.min`), max: intOrNull(o.max, `${path}.max`) };
  };

  const top = strict(input, "", ["schema", "modelVersion", "vehicle", "requirements", "appearance", "equipment", "budget", "plannedRegistration"]);
  if (!top) return { ok: false, issues };

  // ---- vehicle
  const vo = strict(top.vehicle, "vehicle", ["brand", "model", "variant"]);
  const vehicle = vo ? { brand: strOrNull(vo.brand, "vehicle.brand"), model: strOrNull(vo.model, "vehicle.model"), variant: strOrNull(vo.variant, "vehicle.variant") } : null;

  // ---- requirements
  const ro = strict(top.requirements, "requirements", ["modelYear", "firstRegistration", "maxMileage", "seats", "bodyTypes", "fuels", "transmissions", "driveTrains"]);
  let requirements: SearchSpec["requirements"] | null = null;
  if (ro) {
    const modelYear = range(ro.modelYear, "requirements.modelYear", "year");
    const seats = range(ro.seats, "requirements.seats", "seats");
    let firstRegistration: FirstRegistrationRange | null = null;
    if (ro.firstRegistration !== null) {
      const fo = strict(ro.firstRegistration, "requirements.firstRegistration", ["from", "to"]);
      if (fo) firstRegistration = { from: fr(fo.from, "requirements.firstRegistration.from"), to: fr(fo.to, "requirements.firstRegistration.to") };
    }
    let maxMileageKm: number | null = null;
    if (ro.maxMileage !== null) {
      const mo = strict(ro.maxMileage, "requirements.maxMileage", ["value", "unit"]);
      if (mo) { unit(mo.unit, "requirements.maxMileage.unit", "km"); maxMileageKm = int(mo.value, "requirements.maxMileage.value"); }
    }
    const bodyTypes = strArray(ro.bodyTypes, "requirements.bodyTypes");
    const fuels = strArray(ro.fuels, "requirements.fuels");
    const transmissions = strArray(ro.transmissions, "requirements.transmissions");
    const driveTrains = strArray(ro.driveTrains, "requirements.driveTrains");
    if (bodyTypes && fuels && transmissions && driveTrains) {
      requirements = {
        modelYear, firstRegistration, maxMileageKm, seats,
        bodyTypes: bodyTypes as never, fuels: fuels as never, transmissions: transmissions as never, driveTrains: driveTrains as never,
      };
    }
  }

  // ---- appearance
  const ao = strict(top.appearance, "appearance", ["exteriorColors", "interiorColors", "interiorMaterials"]);
  const appearance: Appearance | null = ao
    ? { exteriorColors: plist(ao.exteriorColors, "appearance.exteriorColors"), interiorColors: plist(ao.interiorColors, "appearance.interiorColors"), interiorMaterials: plist(ao.interiorMaterials, "appearance.interiorMaterials") }
    : null;

  // ---- equipment
  const equipment: EquipmentCriterion[] = [];
  if (!Array.isArray(top.equipment)) add("equipment", "not_array", "Må være en liste.");
  else {
    top.equipment.forEach((e, i) => {
      const p = `equipment[${i}]`;
      const eo = strict(e, p, ["key", "priority"]);
      if (!eo) return;
      const key = str(eo.key, `${p}.key`);
      const priority = prio(eo.priority, `${p}.priority`);
      if (key !== null && unsupportedPrototypeField(key)) { add(`${p}.key`, "criterion_not_supported", `Kriteriet «${key}» er ikke et boolsk utstyrskriterium og støttes ikke i søkemodell ${SEARCH_MODEL_VERSION}.`); return; }
      if (key !== null && priority !== null) equipment.push({ key, priority });
    });
  }

  // ---- budget
  const bo = strict(top.budget, "budget", ["maxTotal", "deviationBasisPoints", "costs"]);
  let budget: SearchSpec["budget"] | null = null;
  if (bo) {
    let maxTotalNokMinor: bigint | null = null;
    let maxOk = true;
    if (bo.maxTotal !== null) {
      const mo = strict(bo.maxTotal, "budget.maxTotal", ["amountMinor", "currency"]);
      if (mo) {
        if (mo.currency !== "NOK") add("budget.maxTotal.currency", "currency_not_nok", "Budsjettet må være i NOK.");
        maxTotalNokMinor = moneyString(mo.amountMinor, "budget.maxTotal.amountMinor");
      } else maxOk = false;
    }
    const deviationBasisPoints = intOrNull(bo.deviationBasisPoints, "budget.deviationBasisPoints");
    const costs: CostLine[] = [];
    let costsOk = true;
    if (!Array.isArray(bo.costs)) { add("budget.costs", "not_array", "Må være en liste."); costsOk = false; }
    else {
      bo.costs.forEach((c, i) => {
        const p = `budget.costs[${i}]`;
        const co = strict(c, p, ["id", "kind", "label", "currency", "amountMinor", "vatBasis", "includedInBudget"]);
        if (!co) { costsOk = false; return; }
        const id = str(co.id, `${p}.id`);
        const kind = str(co.kind, `${p}.kind`);
        const label = str(co.label, `${p}.label`);
        const currency = str(co.currency, `${p}.currency`);
        const amountMinor = co.amountMinor === null ? null : moneyString(co.amountMinor, `${p}.amountMinor`);
        const amountBad = co.amountMinor !== null && amountMinor === null;
        const vatBasis = strOrNull(co.vatBasis, `${p}.vatBasis`);
        if (typeof co.includedInBudget !== "boolean") add(`${p}.includedInBudget`, "not_boolean", "Må være ja eller nei.");
        if (id === null || kind === null || label === null || currency === null || amountBad || typeof co.includedInBudget !== "boolean" || (co.vatBasis !== null && vatBasis === null)) { costsOk = false; return; }
        costs.push({ id, kind: kind as CostLine["kind"], label, currency, amountMinor, vatBasis: vatBasis as CostLine["vatBasis"], includedInBudget: co.includedInBudget });
      });
    }
    if (maxOk && costsOk && !(bo.maxTotal !== null && maxTotalNokMinor === null)) budget = { maxTotalNokMinor, deviationBasisPoints, costs };
  }

  // ---- plannedRegistration
  const po = strict(top.plannedRegistration, "plannedRegistration", ["requested"]);
  const requested = po ? str(po.requested, "plannedRegistration.requested") : null;

  if (issues.length || !vehicle || !requirements || !appearance || !budget || requested === null) {
    return { ok: false, issues: issues.length ? issues : [{ path: "", code: "invalid_structure", message: "Ugyldig struktur." }] };
  }
  const spec: SearchSpec = { vehicle, requirements, appearance, equipment, budget, plannedRegistration: { requested: requested as never } };
  const semantic = validateSpec(spec, catalog);
  return semantic.length ? { ok: false, issues: semantic } : { ok: true, value: spec };
}
