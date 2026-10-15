/**
 * Vurdering av en kandidat mot et søk: krav og ønsker med forklaring per kriterium. Rent og deterministisk.
 *
 * Regler (MEROVO_SEARCH_SPEC §4, produktnotat 15.10.2026):
 *  - Kjent brudd på et «must» → `excluded` (har forrang over ukjent).
 *  - Ukjent opplysning for et «must» (og ingen kjent brudd) → `needs_review`, aldri `match`.
 *  - Alle «must» oppfylt → `match`. «nice» kan være fulfilled/not_fulfilled/unknown og påvirker ALDRI status.
 *  - ELLER innen en liste; OG mellom kriterier og mellom utstyrselementer.
 *  - Utstyr er «mangler» bare ved bekreftet fravær eller fullstendig kildeliste; ellers ukjent.
 *    Pakker beviser ikke enkeltutstyr. Registreringsår beviser ikke modellår.
 *  - Planlagt norsk registrering og kandidatens nåværende kategori brukes ikke i kravvurderingen
 *    (varebilscenario er ikke et karosserifilter).
 * Spec antas validert (`validateSpec`/`specFromJson`).
 */
import type { FirstRegistration } from "../types";
import { firstRegistrationBounds, firstRegistrationIssue } from "./validation";
import type {
  CandidateV2, CriterionExplanation, CriterionId, CriterionStatus, EquipmentFacts, Priority, SearchSpec, SourceCapabilities, VehicleEvaluation,
} from "./types";

const fold = (s: string) => s.normalize("NFC").toLowerCase();

interface Verdict { status: CriterionStatus; reason: string }
const ok = (reason = "ok"): Verdict => ({ status: "fulfilled", reason });
const bad = (reason: string): Verdict => ({ status: "not_fulfilled", reason });
const unknown = (reason = "candidate_value_missing"): Verdict => ({ status: "unknown", reason });

function intInRange(value: number | null, range: { min: number | null; max: number | null }): Verdict {
  if (value === null || !Number.isFinite(value)) return unknown();
  if (range.min !== null && value < range.min) return bad("below_min");
  if (range.max !== null && value > range.max) return bad("above_max");
  return ok();
}

function listMember(value: string | null, allowed: readonly string[]): Verdict {
  if (value === null) return unknown();
  return allowed.includes(value) ? ok() : bad("not_in_list");
}

/**
 * Førstegangsregistrering. Kandidatens dato har sin egen presisjon og dekker et tidsrom [tidligst, senest];
 * grensene tolkes på sin presisjon (fra: første dag i perioden, til: siste dag). Avgjøres bare når
 * HELE kandidatperioden ligger på samme side; ellers ukjent.
 */
function firstRegistrationVerdict(
  candidate: CandidateV2["firstRegistration"], range: { from: FirstRegistration | null; to: FirstRegistration | null },
): Verdict {
  if (candidate === null || firstRegistrationIssue(candidate) !== null) return unknown();
  const c = firstRegistrationBounds(candidate);
  let undecided = false;
  if (range.from !== null) {
    const lowest = firstRegistrationBounds(range.from).earliest;
    if (c.latest < lowest) return bad("before_from");
    if (c.earliest < lowest) undecided = true;
  }
  if (range.to !== null) {
    const highest = firstRegistrationBounds(range.to).latest;
    if (c.earliest > highest) return bad("after_to");
    if (c.latest > highest) undecided = true;
  }
  return undecided ? unknown("registration_precision_insufficient") : ok();
}

function equipmentVerdict(key: string, facts: EquipmentFacts | null): Verdict {
  if (facts === null) return unknown("equipment_not_stated");
  const present = facts.present.includes(key);
  const absent = facts.absent.includes(key);
  if (present && absent) return unknown("source_contradiction");
  if (present) return ok();
  if (absent) return bad("confirmed_absent");
  return facts.listComplete ? bad("absent_from_complete_list") : unknown("source_list_incomplete");
}

export function evaluateCandidate(spec: SearchSpec, c: CandidateV2): VehicleEvaluation {
  const criteria: CriterionExplanation[] = [];
  const push = (criterion: CriterionId, priority: Priority, v: Verdict) => criteria.push({ criterion, priority, status: v.status, reason: v.reason });

  // ---- identitet (absolutte krav)
  const v = spec.vehicle;
  if (v.brand !== null) push("brand", "must", c.brandKey === null ? unknown() : c.brandKey === v.brand ? ok() : bad("different_brand"));
  if (v.model !== null) push("model", "must", c.modelKey === null ? unknown() : c.modelKey === v.model && (c.brandKey === null || c.brandKey === v.brand) ? ok() : bad("different_model"));
  if (v.variant !== null) push("variant", "must", c.variant === null ? unknown() : fold(c.variant).includes(fold(v.variant)) ? ok() : bad("variant_text_not_found"));

  // ---- krav
  const r = spec.requirements;
  if (r.modelYear !== null) push("modelYear", "must", intInRange(c.modelYear, r.modelYear)); // aldri utledet av firstRegistration
  if (r.firstRegistration !== null) push("firstRegistration", "must", firstRegistrationVerdict(c.firstRegistration, r.firstRegistration));
  if (r.maxMileageKm !== null) push("maxMileage", "must", c.mileageKm === null ? unknown() : c.mileageKm <= r.maxMileageKm ? ok() : bad("above_max"));
  if (r.seats !== null) push("seats", "must", intInRange(c.seats, r.seats));
  if (r.bodyTypes.length) push("bodyTypes", "must", listMember(c.bodyType, r.bodyTypes)); // bare karosseriet, aldri planlagt registrering
  if (r.fuels.length) push("fuels", "must", listMember(c.fuel, r.fuels));
  if (r.transmissions.length) push("transmissions", "must", listMember(c.transmission, r.transmissions));
  if (r.driveTrains.length) push("driveTrains", "must", listMember(c.driveTrain, r.driveTrains));

  // ---- farge/interiør (en prioritet pr. liste)
  const a = spec.appearance;
  if (a.exteriorColors) push("exteriorColors", a.exteriorColors.priority, listMember(c.exteriorColor, a.exteriorColors.values));
  if (a.interiorColors) push("interiorColors", a.interiorColors.priority, listMember(c.interiorColor, a.interiorColors.values));
  if (a.interiorMaterials) push("interiorMaterials", a.interiorMaterials.priority, listMember(c.interiorMaterial, a.interiorMaterials.values));

  // ---- utstyr (hvert element for seg; pakker (c.packages) brukes ikke)
  for (const e of spec.equipment) push(`equipment:${e.key}`, e.priority, equipmentVerdict(e.key, c.equipment));

  const must = criteria.filter((x) => x.priority === "must");
  const excludedBy = must.filter((x) => x.status === "not_fulfilled").map((x) => x.criterion);
  const unknownMust = must.filter((x) => x.status === "unknown").map((x) => x.criterion);
  const wish = (s: CriterionStatus) => criteria.filter((x) => x.priority === "nice" && x.status === s).map((x) => x.criterion);

  return {
    status: excludedBy.length ? "excluded" : unknownMust.length ? "needs_review" : "match",
    criteria,
    excludedBy,
    unknownMust,
    wishes: { fulfilled: wish("fulfilled"), notFulfilled: wish("not_fulfilled"), unknown: wish("unknown") },
  };
}

/**
 * Kriterier i søket som kilden verken kan hente eller vurdere (må opplyses før aktivering; ingen stille bortfall).
 * Utstyr styres av `capabilities.equipment`.
 */
export function criteriaSourceCannotSupply(spec: SearchSpec, caps: SourceCapabilities): CriterionId[] {
  const wanted: CriterionId[] = [];
  const v = spec.vehicle, r = spec.requirements, a = spec.appearance;
  if (v.brand !== null) wanted.push("brand");
  if (v.model !== null) wanted.push("model");
  if (v.variant !== null) wanted.push("variant");
  if (r.modelYear !== null) wanted.push("modelYear");
  if (r.firstRegistration !== null) wanted.push("firstRegistration");
  if (r.maxMileageKm !== null) wanted.push("maxMileage");
  if (r.seats !== null) wanted.push("seats");
  if (r.bodyTypes.length) wanted.push("bodyTypes");
  if (r.fuels.length) wanted.push("fuels");
  if (r.transmissions.length) wanted.push("transmissions");
  if (r.driveTrains.length) wanted.push("driveTrains");
  if (a.exteriorColors) wanted.push("exteriorColors");
  if (a.interiorColors) wanted.push("interiorColors");
  if (a.interiorMaterials) wanted.push("interiorMaterials");
  const missing = wanted.filter((id) => (caps.fields as Record<string, boolean | undefined>)[id] !== true);
  if (!caps.equipment) for (const e of spec.equipment) missing.push(`equipment:${e.key}`);
  return missing;
}
