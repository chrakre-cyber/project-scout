/**
 * ECON-005c — ren adapter: annonse + søk + eksplisitte forhandleropplysninger → `EconomicsInput` (ECON-004). Ingen I/O, klokke, DB, rettighetsoppslag eller UI;
 * rettigheter kommer inn som ferdig oppløst sett av kildefelt som får brukes (`allowedFields`, beregningsrett per felt fra 005b). Adapteren oppgraderer aldri noe:
 *
 *  - annonsepåstander forblir annonsepåstander: pris har bevis `listing_claim`; drivlinje fra annonsen brukes ikke (propulsion uten forhandlergrunnlag er ukjent med
 *    `listing_claim`, som avgiftsmotoren blokkerer); annonsevekt er `reference_listing`; annonse-CO₂ får metode `unspecified` (aldri «WLTP combined»);
 *    brutto/netto-grunnlag brukes bare med eksplisitt belegg på annonsen; utenlandsk mva. kommer aldri fra annonsen;
 *  - datopresisjon bevares (dag/måned/år/ukjent); norsk registreringsdato uten forhandlerinput er standard = beregningsdato og merkes `defaulted`;
 *  - ukjent er ukjent: manglende felt blir `null`/`"unknown"`/`{state:"unknown"}`, aldri 0 og aldri produktantakelse (transportstandard settes ikke);
 *  - mva.-håndtering og fradragsstatus: kandidatoverstyring > firmaprofil > `null` (ukjent). «Forhandler» som avsendertype brukes ikke;
 *  - kurser er forhandleroppgitte (`dealer_entered`) med kilde og dato bevart; fallback til anskaffelseskurs som tollkurs brukes ikke;
 *  - søkets transport-/forsikringslinjer mappes til økonomiinput BARE når forhandleren har bekreftet omfang (plan P1), med linjens eksakte beløp; ellers forblir
 *    komponenten ukjent og linjen behandles av 005a-mapperen (ingen dobbelttelling, ingen forsvunnet linje). Linjer med mva.-grunnlag `excl`/ukjent eller valuta ≠ NOK mappes ikke.
 *
 * Ikke samlet inn i 005c (utelates, ikke gjettes): provisjon, betalingskostnader, importavgifter, øvrige kostnader, elbilkvalifikasjon, tollavgift. Utelatt betyr «ikke oppgitt»,
 * og listes i `notes` slik at visningslaget kan si det.
 */
import type { EconomicsInput, FxQuote } from "@/domain/economics";
import type { TaxInput } from "@/domain/tax";
import type { NormalizedListing } from "@/domain/types";
import type { EconomicsFieldKey } from "@/domain/provider-rights";
import { toLineScopes, validateLineScopes } from "@/domain/search-economics";
import type { DealerCharge, DealerFx, DealerInputV1, DealerProfileV1, LineScope } from "@/domain/search-economics";
import type { CostLine, SearchSpec } from "@/domain/search-v2/types";

export type AdapterRefusal = "scenario_not_supported" | "price_not_allowed" | "price_missing" | "invalid_now";

export interface AdapterInput {
  listing: NormalizedListing;
  spec: SearchSpec;
  /** Forhandlerinput som er `fresh` og tilhører dette firmaet/søket/kandidaten (kontrollert av serveren). `null` = ingen. */
  dealer: { input: DealerInputV1; confirmedBy: string; confirmedAt: string } | null;
  profile: DealerProfileV1 | null;
  /** Kildefelt serveren har beregningsrett for. Felt som ikke er med, leses ikke. */
  allowedFields: ReadonlySet<EconomicsFieldKey>;
  /** UTC ISO 8601 (injisert). */
  now: string;
}

export type AdapterResult =
  | { ok: true; input: EconomicsInput; lineScopes: Record<string, LineScope>; usedListingFields: EconomicsFieldKey[]; notes: string[] }
  | { ok: false; reason: AdapterRefusal };

/** Øre → NOK-desimalstreng uten tap (heltall når øre = 0). */
export function minorToNokString(minor: bigint): string {
  const whole = minor / 100n, ore = minor % 100n;
  return ore === 0n ? whole.toString() : `${whole}.${ore.toString().padStart(2, "0")}`;
}

const NOT_COLLECTED = ["commission_not_collected", "payment_costs_not_collected", "import_levies_not_collected", "other_costs_not_collected", "ev_qualification_not_collected", "customs_duty_not_collected"];

const charge = (c: DealerCharge | undefined): Exclude<EconomicsInput["transportAfterBorder"], undefined> | undefined => {
  if (c === undefined) return undefined;
  return "amount" in c ? { amount: c.amount, basis: "dealer_entered" } : c;
};

function fxQuote(f: DealerFx): FxQuote {
  const q: FxQuote = { pair: f.pair, rate: f.rate, source: { kind: "dealer_entered", ref: f.sourceLabel }, effectiveAt: f.effectiveAt ?? null, quotedAt: f.quotedAt };
  if (f.validUntil !== undefined) q.validUntil = f.validUntil;
  if (f.validFrom !== undefined) q.validFrom = f.validFrom;
  if (f.validTo !== undefined) q.validTo = f.validTo;
  return q;
}

const mappable = (c: CostLine): c is CostLine & { amountMinor: bigint } =>
  c.includedInBudget && c.amountMinor !== null && c.currency === "NOK" && (c.vatBasis === "incl" || c.vatBasis === "none");

export function toEconomicsInput(a: AdapterInput): AdapterResult {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(a.now)) return { ok: false, reason: "invalid_now" };
  if (a.spec.plannedRegistration.requested !== "passenger") return { ok: false, reason: "scenario_not_supported" };
  if (!a.allowedFields.has("price")) return { ok: false, reason: "price_not_allowed" };
  const lp = a.listing.price;
  if (lp === null) return { ok: false, reason: "price_missing" };

  const d = a.dealer?.input ?? null;
  const notes = [...NOT_COLLECTED];
  const used: EconomicsFieldKey[] = ["price"];
  const scopes = toLineScopes(d?.lineScopes);
  const knownIds = new Set(a.spec.budget.costs.map((c) => c.id));
  for (const id of Object.keys(scopes)) if (!knownIds.has(id)) { delete scopes[id]; notes.push("line_scope_for_unknown_line_ignored"); }

  // ---- pris: annonsepåstand. Brutto/netto bare med eksplisitt belegg; ellers ukjent (beløpet brukes da ikke som løst kjøpsgrunnlag).
  const evidenced = lp.basisEvidence !== null && lp.basisEvidence !== "";
  const priceBasis = evidenced && (lp.basis === "net" || lp.basis === "gross") ? lp.basis : "unknown";
  if (priceBasis === "unknown") notes.push("price_basis_unknown");
  const price: EconomicsInput["price"] = {
    currency: lp.stated.currency, priceBasis, use: "advertised", evidence: "listing_claim",
    advertisedNet: priceBasis === "net" ? lp.stated.amount : null, advertisedGross: priceBasis === "gross" ? lp.stated.amount : null,
  };
  if (d?.foreignVat) price.foreignVat = { treatment: d.foreignVat.treatment, evidence: d.foreignVat.evidence };

  // ---- tekniske avgiftsinput: forhandler med grunnlag, ellers ukjent. Annonsens drivstoff brukes ikke.
  const propulsion: TaxInput["propulsion"] = d?.propulsion
    ? { pistonCombustionEngine: d.propulsion.pistonCombustionEngine, externallyChargeable: d.propulsion.externallyChargeable, combustionFuel: d.propulsion.combustionFuel, hybridization: d.propulsion.hybridization, evidence: d.propulsion.basis }
    : { pistonCombustionEngine: null, externallyChargeable: null, combustionFuel: null, hybridization: null, evidence: "listing_claim" };
  if (!d?.propulsion) notes.push("propulsion_unknown_no_dealer_basis");

  let norwegianTaxWeight: TaxInput["norwegianTaxWeight"];
  if (d?.taxWeight) norwegianTaxWeight = { kg: d.taxWeight.kg, basis: d.taxWeight.basis };
  else if (a.allowedFields.has("specs") && a.listing.specs.curbWeightKg !== null) { norwegianTaxWeight = { kg: a.listing.specs.curbWeightKg, basis: "reference_listing" }; used.push("specs"); }
  else norwegianTaxWeight = { kg: null, basis: "unverified" };

  let co2: TaxInput["co2"];
  if (d?.co2) co2 = { gramsPerKm: d.co2.gramsPerKm, method: d.co2.method };
  else if (a.allowedFields.has("specs") && a.listing.specs.co2 !== null) {
    co2 = { gramsPerKm: a.listing.specs.co2.gramsPerKm, method: a.listing.specs.co2.testMethod === "NEDC" ? "nedc" : "unspecified" };
    if (!used.includes("specs")) used.push("specs");
  } else co2 = { gramsPerKm: null, method: "unspecified" };

  // Registreringsfeltet leses BARE når beregningsrett er gitt og forhandleren ikke har oppgitt egen verdi (rettighetskontroll før lesing).
  let firstRegistration: TaxInput["firstRegistration"] = { precision: "unknown", value: null };
  if (d?.firstRegistration) firstRegistration = { precision: d.firstRegistration.precision, value: d.firstRegistration.value };
  else if (a.allowedFields.has("registration")) {
    const fr = a.listing.specs.firstRegistration;
    if (fr !== null) {
      const p2 = (n: number) => String(n).padStart(2, "0");
      firstRegistration = fr.precision === "date" ? { precision: "day", value: `${fr.year}-${p2(fr.month)}-${p2(fr.day)}` }
        : fr.precision === "month" ? { precision: "month", value: `${fr.year}-${p2(fr.month)}` } : { precision: "year", value: String(fr.year) };
      used.push("registration");
    }
  }

  const asOf = a.now.slice(0, 10);
  const norwegianRegistration: TaxInput["norwegianRegistration"] = d?.norwegianRegistration
    ? { date: d.norwegianRegistration.date, kind: d.norwegianRegistration.kind }
    : { date: asOf, kind: "expected", defaulted: true };
  if (!d?.norwegianRegistration) notes.push("norwegian_registration_defaulted_to_as_of");

  // ---- søkets transport-/forsikringslinjer med bekreftet omfang (P1): linjens eksakte beløp til riktig komponent, hvis forhandleren ikke har oppgitt komponenten selv
  let transportToBorder: EconomicsInput["transportToBorder"] = d?.transportToBorder ? { amount: d.transportToBorder.amount, basis: "dealer_entered" } : undefined;
  let transportAfter = charge(d?.transportAfterBorder);
  let insurance: EconomicsInput["insurance"] = d?.insurance ? { amount: d.insurance.amount, basis: "dealer_entered" } : undefined;
  for (const c of a.spec.budget.costs) {
    if (!mappable(c)) continue;
    // Bare omfang som er gyldig mot DENNE linjen (type, og for split: sum = linjens beløp) kan gi økonomiinput; ugyldig omfang går videre til mapperen (uavklart) men aldri til kjernen.
    if (d?.lineScopes?.[c.id] !== undefined && validateLineScopes({ [c.id]: d.lineScopes[c.id]! }, [c]).length > 0) { notes.push("line_scope_invalid_not_used"); continue; }
    const s = scopes[c.id];
    if (c.kind === "transport" && s !== undefined && s !== "unconfirmed") {
      if (s === "to_border" && transportToBorder === undefined) transportToBorder = { amount: minorToNokString(c.amountMinor), basis: "dealer_entered" };
      else if (s === "after_border" && transportAfter === undefined) transportAfter = { amount: minorToNokString(c.amountMinor), basis: "dealer_entered" };
      else if (typeof s === "object") {
        if (transportToBorder === undefined) transportToBorder = { amount: minorToNokString(s.split.toBorderMinor), basis: "dealer_entered" };
        if (transportAfter === undefined) transportAfter = { amount: minorToNokString(s.split.afterBorderMinor), basis: "dealer_entered" };
      }
    } else if (c.kind === "insurance" && s === "to_border" && insurance === undefined) insurance = { amount: minorToNokString(c.amountMinor), basis: "dealer_entered" };
  }

  // ---- mva.-håndtering og fradrag: kandidat > firmaprofil > ukjent (null)
  const stamp = (kind: "dealer_entered" | "dealer_profile") => (kind === "dealer_entered" && a.dealer ? { kind, by: a.dealer.confirmedBy, at: a.dealer.confirmedAt } : { kind });
  const deduction = d?.deduction !== undefined ? { value: d.deduction, source: stamp("dealer_entered") }
    : a.profile?.deduction !== undefined ? { value: a.profile.deduction, source: stamp("dealer_profile") } : null;
  const vatHandling = d?.vatHandling !== undefined ? { value: d.vatHandling, source: stamp("dealer_entered") }
    : a.profile?.vatHandling !== undefined ? { value: a.profile.vatHandling, source: stamp("dealer_profile") } : null;
  if (deduction === null) notes.push("deduction_status_unknown");
  if (vatHandling === null) notes.push("vat_handling_unknown");

  const fx: EconomicsInput["fx"] = {};
  if (d?.fx?.acquisition) fx.acquisition = fxQuote(d.fx.acquisition);
  if (d?.fx?.customs) fx.customs = fxQuote(d.fx.customs);

  const input: EconomicsInput = {
    price, fx,
    customsDate: d?.customsDate ?? { date: null, kind: "unknown" },
    transportToBorder: transportToBorder ?? "unknown",
    transportAfterBorder: transportAfter ?? { state: "unknown" },
    loadingHandling: charge(d?.loadingHandling) ?? { state: "unknown" },
    insurance: insurance ?? "unknown",
    taxInput: { vehicleClass: "passenger_car_m1", propulsion, norwegianTaxWeight, co2, firstRegistration, norwegianRegistration },
    deduction, vatHandling,
    charges: { climateGas: charge(d?.climateGas) ?? { state: "unknown" }, registrationFee: charge(d?.registrationFee) ?? { state: "unknown" } },
    asOf,
  };
  return { ok: true, input, lineScopes: scopes, usedListingFields: used, notes };
}
