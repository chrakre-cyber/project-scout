/**
 * ECON-005c — serverorkestrering av økonomi for én kandidat. Server-modul uten I/O: alt som krever lagring (forhandlerinput, firmaprofil) leses av kalleren
 * (`dealer-economics.ts`/lagret under firmabundet RLS) og sendes inn, slik at orkestreringen er deterministisk og testbar. Ingen avledede resultater lagres noe sted (E9).
 *
 * Rekkefølge (rettighetskontroll FØR kildefelt brukes):
 *   1. rettigheter for kilden (005b): beregningsrett per felt, separat visningsrett — matching-/visningsrett for øvrig gir ikke beregningsrett og omvendt;
 *   2. uten beregningsrett for pris: `unavailable(rights_not_granted)` — ingen annonsefelt leses; for registrering/specs: feltet leses ikke og forblir ukjent
 *      (forhandlerens egne verdier gjelder fortsatt);
 *   3. kontrollert kobling annonse ↔ kandidat: id og revisjon utledes på nytt fra DENNE annonsen (`candidate-pairing.ts`); avvik ⇒ `candidate_listing_mismatch`, ingenting bundet til kandidaten brukes;
 *   4. forhandlerinput: bare input bundet til DETTE firmaet (fra validert sesjon, aldri klient), søket, kandidaten og revisjonen, ikke foreldet (P2), og med omfang/fordeling som stemmer med de AKTUELLE kostnadslinjene;
 *   5. kildeobservasjonen (`lastSeenAt`) må være et gyldig UTC-tidspunkt og ikke senere enn nåtid (ellers `source_observation_invalid`/`_in_future`, ingen vurdering);
 *   6. ren adapter → `EconomicsInput` → økonomikjernen (ECON-004) med REGISTERPROFILEN (alle økonomiflagg `false`) → 005a-mapper → `classifyBudget` (uendret);
 *   7. visning bare med visningsrett (og beregningsrett for brukte felt, og visningsrett for avslørt pris). Uten visningsrett returneres ingen tall.
 * Estimat, nedre grense, scenarier og ukjent gir aldri positiv budsjettstatus, `isFullHit` eller varsel: konfigurasjonen kan ikke overstyres av kalleren.
 */
import { createHash } from "node:crypto";
import { toEconomicsInput } from "@/adapters/search-economics/to-economics-input";
import type { AdapterRefusal } from "@/adapters/search-economics/to-economics-input";
import { REGISTRY_ECONOMICS_PROFILE, UNCONFIRMED_HALF_UP, calculateEconomics } from "@/domain/economics";
import type { EconomicsResult } from "@/domain/economics";
import {
  ECONOMICS_FIELD_KEYS, REGISTERED_PROFILES, canDeriveEconomics, economicsDecision, retentionExpiresAt, rightsForSource,
} from "@/domain/provider-rights";
import type { EconomicsDenialReason, EconomicsFieldKey, ProviderRightsProfile, ResolvedRights } from "@/domain/provider-rights";
import { DEALER_INPUT_SCHEMA_VERSION, evaluateDealerInput, toCostAssessment, toEconomicsDisplayStatus, validateLineScopes } from "@/domain/search-economics";
import type { ConfirmationContext, DealerInputBinding, DealerProfileV1, EconomicsDisplayStatus, InputStatus, MappingOutcome, StoredDealerInput } from "@/domain/search-economics";
import { classifyBudget, costBasisOf, parseUtcInstant } from "@/domain/search-v2/budget";
import type { BudgetClassification, CandidateV2, SearchSpec } from "@/domain/search-v2/types";
import type { NormalizedListing } from "@/domain/types";
import type { CandidateAdapter } from "@/adapters/search-candidate/candidate";
import { verifyCandidatePair } from "./candidate-pairing";

const TRANSIENT_FRESH_MS = 5 * 60 * 1000; // samme som proveniens: uten lagringsrett er kildedata ferske i fem minutter

/** Det eneste regelsettet orkestreringen bruker: registerprofilen (ingen godkjent parameter) og uavklart avrunding. Kan ikke overstyres fra utsiden. */
const ECONOMICS_CONFIG = Object.freeze({ rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE });

export interface EconomicsRequest {
  /** Fra validert sesjon/membership på serveren. Klientens firma-id er aldri autoritativ og finnes ikke i dette grensesnittet utover denne verdien. */
  dealershipId: string;
  searchId: string;
  listing: NormalizedListing;
  candidate: CandidateV2;
  spec: SearchSpec;
  /** Lagret forhandlerinput funnet for nøkkelen; orkestreringen kontrollerer bindingen på nytt (forsvar i dybden). */
  stored: StoredDealerInput | null;
  /** Firmaets standardprofil (mva.-håndtering/fradrag). */
  profile: DealerProfileV1 | null;
  profiles?: readonly ProviderRightsProfile[];
  now: Date;
  /** Kandidatadapter for å verifisere paret annonse/kandidat. Standard: den registrerte (syntetiske) kilden; andre kilder avvises. */
  candidateAdapter?: CandidateAdapter | null;
}

/** Hvorfor det ikke finnes noen brukbar vurdering selv om rettighetene er i orden. */
export type NotCalculatedReason = AdapterRefusal | "candidate_listing_mismatch" | "source_observation_invalid" | "source_observation_in_future";

export interface RightsOutcome {
  /** Beregningsrett for feltene som faktisk ble brukt. */
  derive: boolean;
  display: boolean;
  reason: EconomicsDenialReason | null;
  allowedFields: EconomicsFieldKey[];
  deniedFields: EconomicsFieldKey[];
  usedFields: EconomicsFieldKey[];
}

export type EconomicsAssessment =
  | { kind: "unavailable"; reason: "rights_not_granted"; rights: RightsOutcome; budget: BudgetClassification }
  | { kind: "not_calculated"; reason: NotCalculatedReason; rights: RightsOutcome; dealerInput: InputStatus; budget: BudgetClassification }
  | {
      kind: "assessed";
      display: EconomicsDisplayStatus;
      budget: BudgetClassification;
      rights: RightsOutcome;
      dealerInput: InputStatus;
      notes: string[];
      /** Kjerneresultatet og mapping — KUN når visning er tillatt (ellers null: ingen beregnede tall forlater orkestreringen). */
      detail: { result: EconomicsResult; outcome: MappingOutcome } | null;
    };

/** Avtrykk av det som bestemmer hvilke avledede felt som kan brukes: kilde, profilversjon og rettigheter for avledet økonomi. */
export function derivedRightsDigest(r: ResolvedRights): string {
  const base = r.inForce
    ? { id: r.profile.providerId, version: r.profile.version, allow: Object.fromEntries(Object.entries(r.profile.derivedEconomics.allow).sort(([a], [b]) => (a < b ? -1 : 1))), display: r.profile.derivedEconomics.display }
    : { id: r.providerId, version: r.profileVersion, denied: r.reason };
  return createHash("sha256").update(JSON.stringify(base)).digest("hex");
}

export const confirmationContextFor = (spec: SearchSpec, rights: ResolvedRights): ConfirmationContext => ({
  costBasis: costBasisOf(spec), registrationScenario: spec.plannedRegistration.requested, rightsDigest: derivedRightsDigest(rights),
});

export const bindingFor = (dealershipId: string, searchId: string, candidate: { id: string; version: string }): DealerInputBinding =>
  ({ dealershipId, searchId, candidateId: candidate.id, candidateVersion: candidate.version, inputSchemaVersion: DEALER_INPUT_SCHEMA_VERSION });

const failBudget = (spec: SearchSpec, candidate: CandidateV2, nowIso: string): BudgetClassification => classifyBudget(spec, candidate, null, nowIso);

export function assessEconomics(req: EconomicsRequest): EconomicsAssessment {
  const nowIso = req.now.toISOString();
  const profiles = req.profiles ?? REGISTERED_PROFILES;
  const rights = rightsForSource(req.listing.source, req.now, profiles);
  const allowed = ECONOMICS_FIELD_KEYS.filter((f) => canDeriveEconomics(rights, [f]));
  const denied = ECONOMICS_FIELD_KEYS.filter((f) => !allowed.includes(f));
  const none = (reason: EconomicsDenialReason | null, used: EconomicsFieldKey[] = []): RightsOutcome => ({ derive: false, display: false, reason, allowedFields: [...allowed], deniedFields: [...denied], usedFields: used });

  // Rettighetsbeslutningen for økonomiens MINSTEKRAV (pris): bærer vurderingens ekte beregnings-/visningsrett også på tidlige avslag, slik at visningsgrensen kan skille et reelt
  // rettighetsavslag («unavailable») fra at beregningen stoppet tidlig for en bruker som har visningsrett («ikke beregnet» med årsaker).
  const base = economicsDecision(rights, ["price"], ["price"]);
  const early = (): RightsOutcome => ({ derive: base.derive, display: base.display, reason: base.reason, allowedFields: [...allowed], deniedFields: [...denied], usedFields: [] });

  // 1–2. Uten beregningsrett for pris leses ingen annonsefelt.
  if (!allowed.includes("price")) {
    const d = economicsDecision(rights, ["price"], ["price"]);
    return { kind: "unavailable", reason: "rights_not_granted", rights: none(d.reason ?? "field_not_granted"), budget: failBudget(req.spec, req.candidate, nowIso) };
  }

  // 3. Kontrollert kobling annonse ↔ kandidat (id og revisjon utledet på nytt fra DENNE annonsen) før noe bundet til kandidaten brukes.
  const pair = verifyCandidatePair({ listing: req.listing, candidate: req.candidate, rights, adapter: req.candidateAdapter });
  if (!pair.ok) return { kind: "not_calculated", reason: "candidate_listing_mismatch", rights: early(), dealerInput: { status: "foreign" }, budget: failBudget(req.spec, req.candidate, nowIso) };

  // 4. Forhandlerinput bundet til firma (fra sesjonen) + søk + kandidat + revisjon, ikke foreldet, og omfanget stemmer med DE AKTUELLE kostnadslinjene.
  const binding = bindingFor(req.dealershipId, req.searchId, req.candidate);
  const context = confirmationContextFor(req.spec, rights);
  let inputStatus = evaluateDealerInput(req.stored, { binding, context, now: nowIso });
  if (inputStatus.status === "fresh" && req.stored && validateLineScopes(req.stored.input.lineScopes, req.spec.budget.costs).length > 0) {
    inputStatus = { status: "stale_needs_reconfirmation", reasons: ["line_scopes_invalid"] };
  }
  const dealer = inputStatus.status === "fresh" && req.stored ? { input: req.stored.input, confirmedBy: req.stored.confirmedBy, confirmedAt: req.stored.confirmedAt } : null;

  // 5. Kildeobservasjonen må være et gyldig UTC-tidspunkt og ikke senere enn nåtid (som proveniensen): ellers ingen brukbar vurdering.
  const retrievedMs = parseUtcInstant(req.listing.lastSeenAt);
  if (retrievedMs === null) return { kind: "not_calculated", reason: "source_observation_invalid", rights: early(), dealerInput: inputStatus, budget: failBudget(req.spec, req.candidate, nowIso) };
  if (retrievedMs > req.now.getTime()) return { kind: "not_calculated", reason: "source_observation_in_future", rights: early(), dealerInput: inputStatus, budget: failBudget(req.spec, req.candidate, nowIso) };

  // 6. Ren adapter → kjerne → mapper → classifyBudget (uendret).
  const adapted = toEconomicsInput({ listing: req.listing, spec: req.spec, dealer, profile: req.profile, allowedFields: new Set(allowed), now: nowIso });
  if (!adapted.ok) return { kind: "not_calculated", reason: adapted.reason, rights: early(), dealerInput: inputStatus, budget: failBudget(req.spec, req.candidate, nowIso) };

  const result = calculateEconomics(adapted.input, ECONOMICS_CONFIG);
  const profile = rights.inForce ? rights.profile : null; // price tillatt ⇒ profilen er i kraft
  const retention = profile ? retentionExpiresAt(profile, new Date(retrievedMs)) : null;
  const sourceUntil = (retention ?? new Date(retrievedMs + TRANSIENT_FRESH_MS)).toISOString();
  const outcome = toCostAssessment({
    result, spec: req.spec, candidate: { id: req.candidate.id, version: req.candidate.version }, now: nowIso,
    profileRef: `${result.tax.vehicleProfile ?? "no-vehicle-profile"}@economics-registry`,
    rightsLimit: { label: "rights_profile", untilExclusive: profile?.validUntil ?? null },
    sourceDataLimit: { label: "source_data", untilExclusive: sourceUntil },
    extraLimits: inputStatus.status === "fresh" ? inputStatus.expiryLimits : [],
    lineScopes: adapted.lineScopes,
  });
  const budget = classifyBudget(req.spec, req.candidate, outcome.assessment, nowIso);

  // 7. Visning: egen rett; avslører prisen ⇒ krever visningsrett for pris. Ingen tall uten visningsrett.
  const decision = economicsDecision(rights, adapted.usedListingFields, ["price"]);
  const display = toEconomicsDisplayStatus({ result, outcome, rights: { canDerive: decision.derive, canDisplay: decision.display } });
  const rightsOutcome: RightsOutcome = { derive: decision.derive, display: decision.display, reason: decision.reason, allowedFields: [...allowed], deniedFields: [...denied], usedFields: adapted.usedListingFields };
  return { kind: "assessed", display, budget, rights: rightsOutcome, dealerInput: inputStatus, notes: adapted.notes, detail: decision.display ? { result, outcome } : null };
}
