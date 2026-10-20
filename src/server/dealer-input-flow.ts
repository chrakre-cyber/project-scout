/**
 * ECON-006b — forhandlerskjema: innsending, forhåndsutfylling og firmaprofil (server-modul uten I/O; lagringen er injisert via `DealerEconomicsStore`).
 *
 * Regler:
 *  - firma kommer fra den validerte sesjonen via lagringen (RLS); skjemaverdier kan aldri bære firma, søk, kandidat eller revisjon som autoritet. Skjemaet bærer bare en OPAK,
 *    integritetsbeskyttet konfliktmarkør (aldri rå kandidat-id/leverandør-id eller revisjon) — serveren utleder kandidat og revisjon på nytt fra annonsen, regner ut markøren og avviser
 *    ved avvik (ingenting lagres);
 *  - uttrykkelig bekreftelse (`confirm` = «yes») kreves; forhåndsutfylling fra en tidligere bekreftelse bekrefter ingenting;
 *  - ingen visningsrett/beregningsrett for økonomi ⇒ ingen registrering (samme rettighetsgrense som visningen);
 *  - mangler er alltid utelatt (ukjent), aldri 0 eller dokumentert grunnlag; hele dokumentet går gjennom `parseDealerInput` og omfangskontroll mot AKTUELLE kostnadslinjer;
 *  - ingen avledede resultater lagres.
 */
import { buildDealerInputFromForm, dealerInputToFormValues, fieldForIssuePath, parseDealerProfile } from "@/domain/search-economics";
import type { DealerProfileV1, FieldErrors, FormValues, StoredDealerInput } from "@/domain/search-economics";
import type { ResolvedRights } from "@/domain/provider-rights";
import type { SearchSpec } from "@/domain/search-v2/types";
import { confirmDealerInput, saveDealerProfile, storedKey } from "./dealer-economics";
import type { DealerEconomicsStore } from "./dealer-economics";
import { makeBindingMarker, verifyBindingMarker } from "./public-ids";

export type SubmitFailure =
  | { ok: false; code: "field_errors"; errors: FieldErrors; general: string[] }
  | { ok: false; code: "stale_page" | "rights_unavailable" | "search_not_found" | "rejected" | "unavailable" };
export type SubmitOutcome = { ok: true } | SubmitFailure;

export interface DealerTargetForSubmit {
  candidate: { id: string; version: string };
  rights: ResolvedRights;
  /** Visningsmodellens status for annonsen (samme rettighetsgrense som visningen). `unavailable` ⇒ ingen registrering. */
  economicsStatus: string;
}

/**
 * Utsteder den opake konfliktmarkøren for en side (bruk i server-komponenten; sidene importerer ikke id-modulen selv — arkitekturregel DATA-002C). Feiler lukket uten gjeldende rettigheter.
 */
export function issueBindingMarker(a: { rights: ResolvedRights; searchId: string; publicId: string; draftVersion: number; candidate: { id: string; version: string } }): string {
  if (!a.rights.inForce) throw new Error("rettigheter ikke i kraft");
  return makeBindingMarker({ environment: a.rights.profile.environment, searchId: a.searchId, publicId: a.publicId, draftVersion: a.draftVersion, candidate: a.candidate });
}

/** Skjemaverdier fra FormData: bare strenger (filer og andre verdier ignoreres), siste verdi per nøkkel. */
export function formValuesOf(form: FormData): FormValues {
  const out: FormValues = {};
  for (const [k, v] of form.entries()) if (typeof v === "string" && k.length <= 80 && !k.startsWith("$ACTION")) out[k] = v;
  return out;
}

/**
 * Bekrefter forhandleropplysninger fra skjemaet. `draftVersion` er gjeldende lagrede søkeversjon (fra serveren). Ingenting lagres ved feil.
 * Rekkefølge: konflikt (side åpnet mot annen søkeversjon/annonserevisjon) → rettigheter → uttrykkelig bekreftelse + skjemavalidering → streng parsing + omfang → lagring.
 */
export async function submitDealerInputForm(a: {
  store: DealerEconomicsStore; searchId: string; spec: SearchSpec; draftVersion: number;
  /** Den offentlige (opake) annonse-id-en annonsen ble løst fra. */
  publicId: string; target: DealerTargetForSubmit; form: FormValues;
  /** Injiserbar nøkkel (tester); standard er SCOUT_PUBLIC_ID_KEY / syntetisk pepper. */
  markerKey?: string;
}): Promise<SubmitOutcome> {
  const f = a.form;
  if (!a.target.rights.inForce) return { ok: false, code: "rights_unavailable" };
  const parts = { environment: a.target.rights.profile.environment, searchId: a.searchId, publicId: a.publicId, draftVersion: a.draftVersion, candidate: a.target.candidate };
  if (!verifyBindingMarker(f.bindingMarker, parts, a.markerKey)) return { ok: false, code: "stale_page" };
  if (a.target.economicsStatus === "unavailable") return { ok: false, code: "rights_unavailable" };
  const { raw, errors } = buildDealerInputFromForm(f, a.spec.budget.costs);
  if (f.confirm !== "yes") errors.confirm = "required";
  if (Object.keys(errors).length > 0) return { ok: false, code: "field_errors", errors, general: [] };
  const res = await confirmDealerInput(a.store, { searchId: a.searchId, candidate: a.target.candidate, spec: a.spec, rights: a.target.rights, raw });
  if (res.ok) return { ok: true };
  if (res.code === "invalid_input" || res.code === "invalid_search") {
    // Reserve: parseren/omfangskontrollen fant noe skjemaet ikke fanget. Knyttes til felt når mulig; ellers generell feil (uten verdier).
    const fe: FieldErrors = {};
    const general: string[] = [];
    for (const i of res.issues ?? []) {
      const field = fieldForIssuePath(i.path);
      if (field) fe[field] = fe[field] ?? "invalid_value"; else general.push(i.code);
    }
    if (res.code === "invalid_search" || (Object.keys(fe).length === 0 && general.length === 0)) general.push("invalid_input");
    return { ok: false, code: "field_errors", errors: fe, general: [...new Set(general)] };
  }
  return { ok: false, code: res.code };
}

/**
 * Forhåndsutfylling til gjennomgang: gjeldende bekreftelse for (kandidat, revisjon) hvis den finnes; ellers den nyeste bekreftelsen for samme kandidat fra en tidligere revisjon.
 * Det er KUN utfylling av skjemaet — ingenting bekreftes, og en tidligere revisjons bekreftelse brukes aldri i beregningen.
 */
export function selectPrefill(stored: ReadonlyMap<string, StoredDealerInput>, candidate: { id: string; version: string }): { values: FormValues; source: "current" | "previous_revision" | "none" } {
  const exact = stored.get(storedKey(candidate.id, candidate.version));
  if (exact) return { values: dealerInputToFormValues(exact.input), source: "current" };
  let best: StoredDealerInput | null = null;
  for (const st of stored.values()) {
    if (st.binding.candidateId !== candidate.id) continue;
    if (best === null || st.confirmedAt > best.confirmedAt) best = st;
  }
  return best ? { values: dealerInputToFormValues(best.input), source: "previous_revision" } : { values: {}, source: "none" };
}

// ---------------------------------------------------------------- firmaprofil
export const profileToFormValues = (p: DealerProfileV1 | null): FormValues => ({ p_vatHandling: p?.vatHandling ?? "", p_deduction: p?.deduction ?? "" });

export async function submitDealerProfileForm(store: DealerEconomicsStore, form: FormValues): Promise<SubmitOutcome> {
  const raw: Record<string, unknown> = { schemaVersion: 1 };
  const errors: FieldErrors = {};
  for (const [name, key, set] of [["p_vatHandling", "vatHandling", ["registered_reports_in_vat_return", "not_registered_pays_at_import", "unknown"]], ["p_deduction", "deduction", ["recoverable", "non_recoverable", "unknown"]]] as const) {
    const v = (form[name] ?? "").trim();
    if (v === "") continue; // ikke satt = ingen standard (ukjent)
    if ((set as readonly string[]).includes(v)) raw[key] = v; else errors[name] = "invalid_value";
  }
  if (Object.keys(errors).length > 0) return { ok: false, code: "field_errors", errors, general: [] };
  if (!parseDealerProfile(raw).ok) return { ok: false, code: "field_errors", errors: {}, general: ["invalid_input"] };
  const res = await saveDealerProfile(store, raw);
  if (res.ok) return { ok: true };
  return res.code === "invalid_input" ? { ok: false, code: "field_errors", errors: {}, general: ["invalid_input"] } : { ok: false, code: res.code };
}
