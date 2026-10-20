/**
 * Landed-cost-kjernen (ECON-004): rene funksjoner, eksakt heltalls-/rasjonal aritmetikk, ingen I/O. Avgiften kommer fra avgiftsmotoren (ECON-002, uendret).
 * Ingen regel her er godkjent som produksjonsregel: mva.-sats/tollverdigrunnlag (R-IMP-VAT-001/-002), elbilfritak (R-IMP-VAT-003), avrunding (U-013),
 * tollkurs (U-008) og fradragsrett (R-DED-001) styres av `EconomicsProfile`. Så lenge profilen ikke er godkjent kan resultatet aldri bli `validated`.
 * Kildebelegg (ikke godkjenning): reviews/ECON-004-kildevurdering.md og docs/tax/sources.json (T53–T69).
 */
import { calculateNorwegianVehicleTax, classifyPowertrain, type TaxPowertrain, type TaxResult } from "@/domain/tax";
import { ordinaryDutyCoverage } from "./customs-tariff";
import { CUSTOMS_FX_REGIME_FROM_ISO, DOCUMENTED_RULE_PERIOD, isWithinDocumentedPeriod } from "./validity";
import {
  MAX_AMOUNT, MAX_RATE, MIN_RATE, add, cmp, fromInt, isZero, mul, norm, parseDecimal, parsePublishedDecimal, roundToWhole, subFloor0, toDecimalString, toExactDecimalString,
  type Rat, type RoundingPolicy,
} from "./rational";
import {
  REGISTRY_ECONOMICS_PROFILE,
  type AmountBasis, type AmountInput, type AmountMeta, type ChargeState, type CustomsAcceptanceDate, type DeductionStatus, type EconBlocker, type EconomicsConfig, type EconomicsInput,
  type EconomicsResult, type EstimateReason, type EvThresholdBasis, type FxQuote, type FxRoleResult, type OtherCostItem, type TaxLine, type Total, type VatBaseTreatment, type VatHandling,
  type VatRecoverability, type VatScenarioId,
} from "./types";

/** R-IMP-VAT-001: 25 % av grunnlaget (T56, T63). Ikke godkjent regel. */
const VAT_RATE: Rat = { n: 25n, d: 100n };
/** R-IMP-VAT-003: fritaksbeløp for elbil fra 2026-01-01 (T63 § 6-8, T35). Målegrunnlag ved ordinær innførsel: tollverdi (R-IMP-VAT-004, E1P; ikke godkjent). */
const EV_EXEMPTION_THRESHOLD: Rat = fromInt(300_000n);
const FX_SOURCE_KINDS: readonly FxQuote["source"]["kind"][] = ["official_customs", "bank", "dealer_entered", "fixture"];
const AMOUNT_BASES: readonly AmountBasis[] = ["dealer_entered", "quoted", "assumed_default", "scenario_assumption"];
const ACCEPTED_STATUS_SOURCES = ["dealer_entered", "dealer_profile"];
const VAT_BASE_TREATMENTS: readonly VatBaseTreatment[] = ["in_base", "outside_base", "unknown"];
const COMMISSION_ROLES = ["purchase_commission", "sales_or_brokerage_commission", "unknown"] as const;
const PAYMENT_NATURES = ["separate_payment_cost", "included_in_goods_price", "unknown"] as const;
const FOREIGN_VAT_TREATMENTS = ["excluded_documented", "unconfirmed"] as const;
const FOREIGN_VAT_EVIDENCE = ["invoice_or_contract", "dealer_entered", "listing_claim"] as const;

const isIsoDate = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

interface Ctx {
  blockers: EconBlocker[];
  estimate: Set<EstimateReason>;
  incomplete: string[];
  warnings: string[];
  ties: string[];
  /** Avrundingslikhet i noen verdi: utfallet avhenger av en uavklart policy, så totalen er en nedre grense. */
  tieHit: boolean;
  rounding: RoundingPolicy;
}

const block = (c: Ctx, code: EconBlocker["code"], message: string, field?: string) => { c.blockers.push({ code, message, ...(field ? { field } : {}) }); };

/** Ikke-negativt beløp innen skranken; ellers blokkering. `allowZero=false` for priser. */
function amount(c: Ctx, field: string, s: unknown, allowZero: boolean): Rat | null {
  const r = parseDecimal(s);
  if (!r) { block(c, "invalid_amount", `${field}: ugyldig beløp (ikke-negativ desimalstreng uten fortegn/eksponent/tusenskille kreves)`, field); return null; }
  if (cmp(r, fromInt(MAX_AMOUNT)) > 0) { block(c, "amount_out_of_range", `${field}: over teknisk grense`, field); return null; }
  if (!allowZero && isZero(r)) { block(c, "invalid_amount", `${field}: må være større enn 0`, field); return null; }
  return r;
}

function amountInput(c: Ctx, field: string, a: AmountInput | undefined): Rat | null {
  if (!a || typeof a !== "object" || !AMOUNT_BASES.includes(a.basis)) { block(c, "invalid_amount", `${field}: beløp og grunnlag (basis) kreves`, field); return null; }
  if (a.basis === "scenario_assumption") c.estimate.add("amount_scenario_assumption");
  if (a.basis === "assumed_default") c.estimate.add("assumed_default_amount");
  return amount(c, field, a.amount, true);
}

/** Rund av én verdi. Likhet (x,5) med uavklart policy ⇒ minste kandidat brukes og totalen merkes som nedre grense. */
function round(c: Ctx, label: string, r: Rat): bigint {
  const x = roundToWhole(r, c.rounding);
  if (x.tie && c.rounding.status !== "approved") {
    c.tieHit = true;
    c.ties.push(`${label}: ${x.candidates.halfUp} (half_up) / ${x.candidates.halfEven} (half_even)`);
    return x.candidates.halfUp < x.candidates.halfEven ? x.candidates.halfUp : x.candidates.halfEven;
  }
  return x.value;
}

const emptyFx = (status: FxRoleResult["status"], reason?: string): FxRoleResult => ({
  status, rate: null, raw: null, pair: null, source: null, effectiveAt: null, quotedAt: null, validFrom: null, validTo: null, suspension: null, ...(reason ? { reason } : {}),
});

/** Normaliserer og validerer ett kursutsagn. Råkurs deles på omregningsenheten nøyaktig én gang. */
function normalizeQuote(c: Ctx, f: string, q: FxQuote): { rate: Rat; raw: { rate: string; unit: 1 | 100 } | null } | null {
  const bad = (m: string) => { block(c, "invalid_fx_quote", `${f}: ${m}`, f); return null; };
  let fromRaw: Rat | null = null;
  let raw: { rate: string; unit: 1 | 100 } | null = null;
  if (q.raw !== undefined) {
    const unit = q.raw?.unit;
    const r = parsePublishedDecimal(q.raw?.rate);
    if (!r || (unit !== 1 && unit !== 100)) return bad("raw: kurs eller omregningsenhet (1 eller 100) er ugyldig");
    fromRaw = norm({ n: r.n, d: r.d * BigInt(unit) });
    raw = { rate: q.raw.rate, unit };
  }
  const fromRate = q.rate === undefined ? null : parseDecimal(q.rate);
  if (q.rate !== undefined && !fromRate) return bad("rate: ugyldig normalisert kurs");
  if (fromRate && fromRaw && cmp(fromRate, fromRaw) !== 0) return bad("rate og raw/unit er ikke konsistente (normalisering skal skje nøyaktig én gang)");
  const rate = fromRaw ?? fromRate;
  if (!rate) return bad("kurs mangler (oppgi rate eller raw)");
  if (cmp(rate, MIN_RATE) < 0 || cmp(rate, MAX_RATE) > 0) return bad("kurs utenfor teknisk grense");
  return { rate, raw };
}

/** Validerer ett kursutsagn. `customs` bruker gyldighetsperiode mot akseptdato; `acquisition` bruker effectiveAt/validUntil mot beregningsdato. */
function checkQuote(
  c: Ctx, role: "acquisition" | "customs", q: FxQuote, currency: string, asOf: string, allowFixture: boolean,
  accept: { date: string | null; kind: CustomsAcceptanceDate["kind"] }, onCustoms: (x: { rateValidOnDate: boolean | null; suspended: boolean }) => void,
): { rate: Rat; raw: { rate: string; unit: 1 | 100 } | null } | null {
  const f = `fx.${role}`;
  const bad = (m: string) => { block(c, "invalid_fx_quote", `${f}: ${m}`, f); return null; };
  if (!q || typeof q !== "object") return bad("ugyldig kursobjekt");
  if (q.pair !== `${currency}/NOK`) return bad(`kursparet ${String(q.pair)} samsvarer ikke med ${currency}/NOK`);
  if (!q.source || !FX_SOURCE_KINDS.includes(q.source.kind)) return bad("kursens kilde (source.kind) mangler eller er ugyldig");
  if ((q.fixtureOnly || q.source.kind === "fixture") && !allowFixture) return bad("fixture-/testkurs er ikke en produksjonskurs");
  const n = normalizeQuote(c, f, q);
  if (!n) return null;
  for (const k of ["effectiveAt", "quotedAt", "validUntil", "validFrom", "validTo"] as const) {
    const v = q[k];
    if (v !== null && v !== undefined && !isIsoDate(v)) return bad(`${k} er ikke en gyldig ISO-dato`);
  }
  if (role === "acquisition") {
    if (q.effectiveAt && q.effectiveAt > asOf) return bad("kursen gjelder etter beregningsdatoen");
    if (q.validUntil && q.validUntil < asOf) return bad("kursen er utløpt per beregningsdatoen");
    if (!q.effectiveAt || !q.quotedAt) c.estimate.add("fx_dates_missing");
    return n;
  }
  // Tollkurs (U-008): gyldighetsperiode mot deklarasjonens akseptdato; fremtidige, forhåndspubliserte perioder er tillatt.
  if (!q.quotedAt) c.estimate.add("fx_dates_missing");
  if (q.validFrom && q.validTo && q.validFrom > q.validTo) return bad("validFrom er etter validTo");
  const hasPeriod = Boolean(q.validFrom && q.validTo);
  if (!hasPeriod) c.incomplete.push("customs_fx_period_missing");
  // Akseptdatoens status (ukjent/forventet) registreres i hovedflyten, uavhengig av kursgren. Her kontrolleres bare perioden.
  let rateValidOnDate: boolean | null = null;
  if (accept.kind !== "unknown" && accept.date && hasPeriod) {
    rateValidOnDate = accept.date >= q.validFrom! && accept.date <= q.validTo!;
    if (!rateValidOnDate) return bad(`kursperioden ${q.validFrom}–${q.validTo} dekker ikke akseptdatoen ${accept.date}`);
  }
  const suspension = q.suspension ?? "unknown";
  if (!["not_suspended_confirmed", "suspended", "unknown"].includes(suspension)) return bad("suspension: ugyldig verdi");
  const suspended = suspension === "suspended";
  if (suspended) c.incomplete.push("customs_fx_suspended"); // fastsatt kurs gjelder ikke; Norges Banks daglige kurs trengs (ikke i kjernen)
  else if (suspension === "unknown") c.estimate.add("customs_fx_suspension_unverified");
  onCustoms({ rateValidOnDate, suspended });
  return suspended ? null : n;
}

const fxUsed = (q: FxQuote, rate: Rat, raw: FxRoleResult["raw"], status: FxRoleResult["status"] = "used"): FxRoleResult => ({
  status, rate: toExactDecimalString(rate) ?? toDecimalString(rate, 12), raw, pair: q.pair, source: q.source, effectiveAt: q.effectiveAt ?? null, quotedAt: q.quotedAt ?? null,
  validFrom: q.validFrom ?? null, validTo: q.validTo ?? null, suspension: q.suspension ?? "unknown",
});

/** Beløpspost som kan være ukjent: ukjent/udefinert ⇒ `missing`, aldri 0. */
function chargeAmount(c: Ctx, field: string, s: ChargeState | undefined, missing: string[]): Rat | null {
  if (!s || ("state" in s && s.state === "unknown")) { missing.push(field); return null; }
  if ("state" in s) {
    if (s.state === "excluded_by_scenario") { c.estimate.add("charges_excluded_by_scenario"); return fromInt(0n); }
    return fromInt(0n); // not_applicable
  }
  return amountInput(c, field, s);
}

function taxLine(t: TaxResult): TaxLine {
  const claim = t.finalClaim;
  return {
    status: t.status === "calculated" ? "approved" : t.status === "calculated_unverified" ? "estimate" : "blocked",
    engineStatus: t.status,
    oneOffTaxNok: claim ? BigInt(claim.oneOffTaxNok) : null,
    scrappageDepositNok: claim ? BigInt(claim.scrappageDepositNok) : null,
    totalRegistrationTaxesNok: claim ? BigInt(claim.totalRegistrationTaxesNok) : null,
    vehicleProfile: t.validation?.vehicleProfile ?? null,
    estimateReasons: t.validation ? [...t.validation.estimateReasons] : [],
    blockers: t.blocked.map((b) => b.code),
  };
}

/** Heltalls-NOK til resultatfeltene. Alle beløpsposter er avrundet til hele NOK før summering; en brøk her er en intern feil (telleren er aldri et beløp alene). */
const wholeNok = (r: Rat): bigint => {
  if (r.d !== 1n) throw new Error("intern feil: beløpsfelt er ikke hele NOK");
  return r.n;
};

const notCalculated = (reasons: string[]): Total => ({ kind: "not_calculated", reasons });

/** Kvalifikasjon for elbilfritaket (kriterier, T63 § 6-8 / T62 / T57). Avgiftsmotorens drivlinje brukes bare til å utelukke (stempelmotor ⇒ ikke «bare elektrisitet»). */
function evQualification(c: Ctx, input: EconomicsInput, engine: TaxPowertrain | null): "qualifies" | "does_not_qualify" | "unresolved" | "not_applicable_vehicle" {
  const q = input.evQualification;
  const keys = ["batteryOnlyPropulsion", "externallyChargeableBattery", "passengerVehicle", "notPreviouslyRegisteredInNorway"] as const;
  const vals = q ? keys.map((k) => q[k]) : [];
  if (q && vals.some((v) => v !== null && typeof v !== "boolean")) { block(c, "inconsistent_ev_qualification", "evQualification: verdiene må være true, false eller null", "evQualification"); return "unresolved"; }
  const allTrue = Boolean(q) && vals.every((v) => v === true);
  if (engine === "ice" || engine === "phev") {
    if (allTrue) block(c, "inconsistent_ev_qualification", `evQualification: kriteriene oppgir kvalifisert elbil, men avgiftsmotoren klassifiserer drivlinjen som ${engine} (stempelmotor)`, "evQualification");
    return "not_applicable_vehicle";
  }
  if (!q) return "unresolved";
  if (vals.some((v) => v === false)) return "does_not_qualify";
  if (!allTrue) return "unresolved";
  // Alle kriterier er påstått oppfylt. Ukjent drivlinje i avgiftsmotoren kan ikke bekrefte det ⇒ forblir uavklart (konservativt).
  return engine === null ? "unresolved" : "qualifies";
}

export function calculateEconomics(input: EconomicsInput, config: EconomicsConfig): EconomicsResult {
  const c: Ctx = { blockers: [], estimate: new Set(), incomplete: [], warnings: [], ties: [], tieHit: false, rounding: config.rounding };
  const profile = config.profile ?? REGISTRY_ECONOMICS_PROFILE;
  /** Beløpspost i hele NOK etter den eksisterende, uttrykkelige avrundingspolicyen (likhet ⇒ nedre grense). Resultatfeltene er alltid heltall; telleren brukes aldri alene. */
  const whole = (label: string, r: Rat): Rat => fromInt(round(c, label, r));
  /**
   * Avrunding av et beløp som TREKKES FRA (tollverdien): ved likhet og uavklart policy er `low`/`high` de støttede kandidatene (half_up/half_even). Et fradrag bidrar til
   * en nedre grense med sin HØYESTE kandidat (størst fradrag ⇒ lavest tollverdi og mva.); `low` brukes bare til å kontrollere at fradraget ikke overstiger kjøpesummen.
   */
  const wholeDeduction = (label: string, r: Rat): { low: Rat; high: Rat } => {
    const x = roundToWhole(r, c.rounding);
    if (x.tie && c.rounding.status !== "approved") {
      c.tieHit = true;
      c.ties.push(`${label}: ${x.candidates.halfUp} (half_up) / ${x.candidates.halfEven} (half_even) [fradrag: høyeste kandidat brukes i nedre grense]`);
      const lo = x.candidates.halfUp < x.candidates.halfEven ? x.candidates.halfUp : x.candidates.halfEven;
      const hi = x.candidates.halfUp < x.candidates.halfEven ? x.candidates.halfEven : x.candidates.halfUp;
      return { low: fromInt(lo), high: fromInt(hi) };
    }
    return { low: fromInt(x.value), high: fromInt(x.value) };
  };
  const asOf = input.asOf;
  const asOfOk = isIsoDate(asOf);
  if (!asOfOk) block(c, "invalid_date", "asOf: ugyldig ISO-dato", "asOf");

  // --- Kjøpsgrunnlag (annonsert / forhandlerjustert / brukt holdes adskilt) ---
  const p = input.price;
  const currency = p?.currency;
  const currencyOk = typeof currency === "string" && /^[A-Z]{3}$/.test(currency);
  if (!currencyOk) block(c, "invalid_currency", "price.currency: ISO 4217-kode (tre store bokstaver) kreves", "price.currency");
  const optAmount = (field: string, v: string | null | undefined): string | null => (v === null || v === undefined ? null : amount(c, field, v, false) ? v : null);
  const advertisedGross = optAmount("price.advertisedGross", p?.advertisedGross);
  const advertisedNet = optAmount("price.advertisedNet", p?.advertisedNet);
  const dealerAdjusted = optAmount("price.dealerAdjusted", p?.dealerAdjusted);
  let usedAmount: string | null = null;
  let usedBasis: EconomicsResult["acquisition"]["used"]["basis"] = "unknown";
  if (p?.use === "dealer_adjusted") {
    if (dealerAdjusted === null) block(c, "dealer_adjusted_missing", "price.dealerAdjusted kreves når forhandlerjustert pris velges", "price.dealerAdjusted");
    usedAmount = dealerAdjusted;
    usedBasis = "dealer_adjusted";
  } else if (p?.priceBasis === "net") {
    usedAmount = advertisedNet;
    usedBasis = "net_claimed";
    if (advertisedNet === null && !c.blockers.some((b) => b.field === "price.advertisedNet")) block(c, "invalid_amount", "price.advertisedNet kreves når annonsen oppgir netto", "price.advertisedNet");
  } else {
    usedBasis = p?.priceBasis === "gross" ? "gross_only" : "unknown";
  }
  const purchaseBasisResolved = usedAmount !== null && usedBasis !== "gross_only" && usedBasis !== "unknown";
  if (!purchaseBasisResolved && !c.blockers.length) c.incomplete.push(usedBasis === "gross_only" ? "purchase_basis_gross_only" : "purchase_basis_unknown");
  if (purchaseBasisResolved && p.evidence === "listing_claim") c.estimate.add("purchase_price_listing_claim");

  // --- Utenlandsk mva. i prisen (T88, vareførselshåndboken § 6-11): refusjonsrett/mva.-fri pris utledes aldri av annonsetekst eller en oppgitt nettopris alene ---
  // Uten dokumentert utelukkelse er den oppgitte prisen bare en nedre grense for tollverdiens pris (utenlandsk mva. kan inngå i prisen).
  const customsExtra: string[] = [];
  const fv = p?.foreignVat;
  let fvDocumented = false;
  if (fv !== undefined && (typeof fv !== "object" || fv === null || !FOREIGN_VAT_TREATMENTS.includes(fv.treatment) || !FOREIGN_VAT_EVIDENCE.includes(fv.evidence))) {
    block(c, "invalid_classification", "price.foreignVat: ugyldig behandling eller bevis", "price.foreignVat");
  } else if (fv) {
    if (fv.treatment === "excluded_documented" && fv.evidence === "listing_claim") c.warnings.push("utenlandsk mva.: en annonsepåstand dokumenterer ikke at kjøperen slipper å belastes avgiften; tollverdiens pris er en nedre grense");
    fvDocumented = fv.treatment === "excluded_documented" && fv.evidence !== "listing_claim";
    if (fvDocumented && fv.evidence === "dealer_entered") c.estimate.add("foreign_vat_exclusion_dealer_stated");
  }
  if (purchaseBasisResolved && !fvDocumented) {
    c.incomplete.push("foreign_vat_exclusion_undocumented");
    customsExtra.push("prisen kan inneholde utenlandsk mva.: utelukkelse er ikke dokumentert (T88)");
  }

  // --- Datoer: beregningsdato, akseptdato for deklarasjon og norsk registreringsdato holdes adskilt ---
  const cd = input.customsDate ?? { date: null, kind: "unknown" as const };
  if (!["actual_acceptance", "expected_scenario", "unknown"].includes(cd.kind) || (cd.date !== null && cd.date !== undefined && !isIsoDate(cd.date))) {
    block(c, "invalid_date", "customsDate: ugyldig dato eller type", "customsDate");
  }
  const accept = { date: isIsoDate(cd.date) ? cd.date : null, kind: cd.kind === "actual_acceptance" || cd.kind === "expected_scenario" ? cd.kind : ("unknown" as const) };
  if (accept.kind !== "unknown" && !accept.date) block(c, "invalid_date", "customsDate: dato kreves når type er actual_acceptance eller expected_scenario", "customsDate");

  // Akseptdatoens status gjelder tidfestingen av tollavgiftssats, mva.-regler og kurs (tollavgiftsloven § 2-2, mval. § 3-29 (2)) og er uavhengig av valuta og kursgren.
  if (accept.kind === "unknown" || !accept.date) c.incomplete.push("customs_acceptance_date_unknown");
  else if (accept.kind === "expected_scenario") c.estimate.add("customs_acceptance_date_expected");
  // Gyldighetsvakt (B1): akseptdato utenfor den dokumenterte perioden (2026) ⇒ incomplete uavhengig av valuta, kursfallback og eksplisitt toll. Beløp som avhenger av 2026-reglene
  // (mva., elbilgrense, tollsats) beregnes ikke — hverken som estimat eller som nedre grense for det aktuelle året.
  const outOfPeriod = accept.kind !== "unknown" && accept.date !== null && !isWithinDocumentedPeriod(accept.date);
  const periodReason = `akseptdato ${accept.date} er utenfor den dokumenterte perioden ${DOCUMENTED_RULE_PERIOD.label} (${DOCUMENTED_RULE_PERIOD.fromIso}–${DOCUMENTED_RULE_PERIOD.toIso}): mva.-sats, elbilgrense og tollsats er ikke dokumentert for denne datoen, så avhengige beløp er ikke beregnet`;
  if (outOfPeriod) c.incomplete.push("customs_acceptance_date_outside_documented_period");

  // --- Kurser: to separate roller ---
  const nok = currency === "NOK";
  let acqRate: Rat | null = null;
  let custRate: Rat | null = null;
  let acqFx: FxRoleResult = emptyFx("not_calculated", "anskaffelseskurs mangler");
  let custFx: FxRoleResult = emptyFx("not_calculated", "tollkurs mangler");
  let rateValidOnDate: boolean | null = null;
  if (nok) {
    acqRate = custRate = fromInt(1n);
    acqFx = { ...emptyFx("not_needed"), rate: "1", pair: "NOK/NOK" };
    custFx = { ...emptyFx("not_needed"), rate: "1", pair: "NOK/NOK" };
  } else if (currencyOk && asOfOk) {
    const allowFixture = config.allowFixtureFxQuotes === true;
    const noop = () => undefined;
    const aq = input.fx?.acquisition;
    if (aq) { const n = checkQuote(c, "acquisition", aq, currency, asOf, allowFixture, accept, noop); if (n) { acqRate = n.rate; acqFx = fxUsed(aq, n.rate, n.raw); } }
    else c.incomplete.push("acquisition_fx_missing");
    const cq = input.fx?.customs;
    let customsSuspended = false;
    if (cq) {
      const n = checkQuote(c, "customs", cq, currency, asOf, allowFixture, accept, (x) => { rateValidOnDate = x.rateValidOnDate; customsSuspended = x.suspended; });
      if (n) { custRate = n.rate; custFx = fxUsed(cq, n.rate, n.raw); }
      else if (customsSuspended) custFx = { ...fxUsed(cq, normalizeQuote(c, "fx.customs", cq)?.rate ?? fromInt(0n), cq.raw ?? null, "not_calculated"), rate: null, reason: "fastsatt tollkurs er suspendert; Norges Banks daglige kurs gjelder (ikke i kjernen)" };
    } else if (input.fx?.customsFallback === "use_acquisition_rate_assumed" && aq && acqRate) {
      custRate = acqRate;
      custFx = { ...fxUsed(aq, acqRate, acqFx.raw, "assumed_from_acquisition"), reason: "tollkurs antatt lik anskaffelseskurs (uttrykkelig antakelse)" };
      c.estimate.add("customs_fx_fallback_acquisition_rate");
    } else c.incomplete.push("customs_fx_missing");
    if (!profile.customsFxRuleApproved) c.estimate.add("customs_fx_rule_unconfirmed");
    // Eget, uttrykkelig restpunkt: kursregimet før 3.9.2026 er bare lest i veiledning (T53). Gyldighetsvakten (2026) godkjenner ikke dette.
    if (accept.kind !== "unknown" && accept.date !== null && !outOfPeriod && accept.date < CUSTOMS_FX_REGIME_FROM_ISO) {
      c.warnings.push(`tollkurs: akseptdato ${accept.date} er før ${CUSTOMS_FX_REGIME_FROM_ISO}; kursregimet før dette er bare lest i veiledning (T53) og er ikke godkjent eller kildebelagt som regel (restpunkt U-008)`);
    }
  }

  // --- Transport (til/etter innførselsstedet), forsikring, lasting/håndtering: hver post telles én gang ---
  const missing: string[] = [];
  let toBorder: Rat | null = null;
  let toBorderBasis: EconomicsResult["transportToBorderBasis"] = null;
  if (input.transportToBorder === "unknown") { toBorderBasis = "unknown"; c.incomplete.push("transport_unknown"); }
  else if (input.transportToBorder === undefined) {
    if (config.transportDefaultNok !== undefined) {
      toBorder = amount(c, "config.transportDefaultNok", config.transportDefaultNok, true);
      toBorderBasis = "assumed_default";
      c.estimate.add("transport_default_assumed");
    } else { toBorderBasis = "unknown"; c.incomplete.push("transport_unknown"); }
  } else { toBorder = amountInput(c, "transportToBorder", input.transportToBorder); toBorderBasis = input.transportToBorder.basis; }
  const metaOf = (s: ChargeState | "unknown" | undefined): AmountMeta => !s || s === "unknown" || ("state" in s && s.state === "unknown") ? { kind: "unknown" } : "state" in s ? { kind: s.state } : { kind: "amount", basis: s.basis };
  const afterBorder = chargeAmount(c, "transportAfterBorder", input.transportAfterBorder, missing);
  if (afterBorder === null && !c.blockers.length) c.incomplete.push("transport_after_border_unknown");
  let insurance: Rat | null = null;
  if (input.insurance === undefined || input.insurance === "unknown") c.incomplete.push("insurance_unknown");
  else insurance = amountInput(c, "insurance", input.insurance);
  const lhMissing: string[] = [];
  const loading = chargeAmount(c, "loadingHandling", input.loadingHandling, lhMissing);
  if (loading === null && lhMissing.length) c.incomplete.push("loading_handling_unknown");

  // --- Øvrige kjente kostnader ---
  // Avgifter som oppstår ved innførsel (mval. § 4-11) vurderes hver for seg: tollavgift (nedenfor, etter drivlinjeklassifisering), klimagassavgift og andre
  // importavgifter klassifiseres som «i grunnlaget», «utenfor» eller ukjent. Registreringsgebyr (Statens vegvesen) er ikke en importavgift.
  const ch = input.charges ?? {};
  let others = fromInt(0n);
  // Forklaringsmetadata (ECON-006a-FIX1): hvilke kjente poster «øvrige kostnader» består av. Samme tall som legges til `others`; ingen regel eller avrunding her.
  const otherItems: OtherCostItem[] = [];
  const addOther = (id: OtherCostItem["id"], label: string | null, a: Rat, basis: AmountBasis) => {
    others = add(others, a);
    otherItems.push({ id, label, amount: toExactDecimalString(a) ?? toDecimalString(a, 12), basis });
  };
  let baseExtra = fromInt(0n);
  let baseComplete = true;
  const classify = (field: string, label: string, v: unknown): VatBaseTreatment => {
    if (v === undefined) return "unknown";
    if (!VAT_BASE_TREATMENTS.includes(v as VatBaseTreatment)) { block(c, "invalid_classification", `${field}: ugyldig behandling mot mva.-grunnlaget`, field); return "unknown"; }
    void label;
    return v as VatBaseTreatment;
  };
  const applyBase = (treatment: VatBaseTreatment, a: Rat, label: string) => {
    if (isZero(a)) return;
    if (treatment === "in_base") baseExtra = add(baseExtra, a);
    else if (treatment === "unknown") { baseComplete = false; c.incomplete.push("vat_base_charge_unclassified"); c.warnings.push(`${label}: ukjent om beløpet er en avgift som beregnes ved innførsel (mval. § 4-11); mva.-grunnlaget er en nedre grense`); }
  };
  const climateRaw = chargeAmount(c, "charges.climateGas", ch.climateGas, missing);
  const climate = climateRaw ? whole("klimagassavgift", climateRaw) : null;
  if (climate) { applyBase(classify("charges.climateGasVatBase", "klimagassavgift", ch.climateGasVatBase), climate, "klimagassavgift"); addOther("climate_gas", null, climate, (ch.climateGas as AmountInput).basis); }
  const regFee = chargeAmount(c, "charges.registrationFee", ch.registrationFee, missing);
  if (regFee) addOther("registration_fee", null, regFee, (ch.registrationFee as AmountInput).basis); // Statens vegvesens gebyr: ikke importavgift, aldri i grunnlaget
  for (const [i, lv] of (ch.importLevies ?? []).entries()) {
    const raw = amountInput(c, `charges.importLevies[${i}]`, lv);
    const tr = classify(`charges.importLevies[${i}].vatBase`, lv?.label ?? "importavgift", lv?.vatBase);
    if (raw) { const a = whole(`importavgift ${String(lv?.label ?? i)}`, raw); applyBase(tr, a, String(lv?.label ?? "importavgift")); addOther("import_levy", String(lv?.label ?? ""), a, lv.basis); }
  }
  for (const [i, o] of (ch.otherKnown ?? []).entries()) {
    const a = amountInput(c, `charges.otherKnown[${i}]`, o);
    if (a) addOther("other_known", String(o?.label ?? ""), a, o.basis);
  }

  // --- Provisjon til mellommann: innkjøpsprovisjon og salgs-/meglerprovisjon behandles ulikt; ukjent rolle forblir ukjent (T87/T88) ---
  // Beløp avrundes til hele NOK én gang (eksisterende policy); samme tall brukes i kostnaden og i tollverdien.
  let commissionInCustomsValue = fromInt(0n);
  let commissionDeducted = fromInt(0n); // innkjøpsprovisjon i prisen som er skilt ut (§ 6-11 (1) e), vilkår oppgitt oppfylt (høyeste avrundingskandidat ved likhet)
  let commissionDeductPossible = fromInt(0n); // i prisen, uavklart om den kan skilles ut: tollverdien er en nedre grense (laveste mulige = alt skilt ut, høyeste kandidat)
  let deductionsLow = fromInt(0n); // samme beløp med laveste kandidat: bare til kontroll mot kjøpesummen
  for (const [i, cm] of (input.commission ?? []).entries()) {
    const f = `commission[${i}]`;
    const cond = (cm as { deductionConditionsMet?: unknown } | undefined)?.deductionConditionsMet;
    if (!cm || typeof cm !== "object" || !COMMISSION_ROLES.includes(cm.role) || ![true, false, null].includes(cm.paidSeparatelyFromPrice as boolean | null) || ![undefined, true, false, null].includes(cond as boolean | null | undefined)) { block(c, "invalid_classification", `${f}: ugyldig rolle, betalingsmåte eller vilkår`, f); continue; }
    const raw = amountInput(c, `${f}.amount`, cm.amount);
    if (!raw) continue;
    if (cm.paidSeparatelyFromPrice === null) {
      c.incomplete.push("commission_price_inclusion_unknown"); customsExtra.push("provisjon: ukjent om betalt i tillegg til prisen"); missing.push(f);
      // Ukjent betalingsmåte: en støttet fullføring er at provisjonen allerede ligger i kjøpesummen og, hvis det er en innkjøpsprovisjon (rolle ikke salgsprovisjon, vilkår ikke oppgitt
      // som ikke oppfylt), kan skilles ut av tollverdien (§ 6-11 (1) e). Kostnaden ligger da ikke i tillegg til prisen, så den utelates fra nedre grense (ingen dobbelttelling og
      // ingen bekreftet inkludering), men den laveste mulige tollverdien (alt skilt ut, høyeste avrundingskandidat) må bevares for mva. og totaler.
      if (cm.role !== "sales_or_brokerage_commission" && cond !== false) {
        const d = wholeDeduction(`provisjon ${f}`, raw);
        deductionsLow = add(deductionsLow, d.low);
        commissionDeductPossible = add(commissionDeductPossible, d.high);
      }
      continue;
    }
    if (cm.paidSeparatelyFromPrice === false) {
      // Allerede i prisen: anskaffelseskostnaden er uendret (ingen dobbelttelling). Innkjøpsprovisjon pålagt kjøperen og inkludert i prisen KAN trekkes ut av tollverdien (§ 6-11 (1) e, T88).
      if (cm.role === "sales_or_brokerage_commission") continue; // salgs-/meglerprovisjon i prisen er prisen (§ 6-3); ikke fradragsberettiget
      if (cond === false) continue; // vilkårene er oppgitt ikke oppfylt: ingen utskilling
      // Fradrag: ved avrundingslikhet brukes den HØYESTE kandidaten (størst fradrag ⇒ laveste tollverdi) slik at nedre grenser aldri overstiger en støttet fullføring.
      const d = wholeDeduction(`provisjon ${f}`, raw);
      deductionsLow = add(deductionsLow, d.low);
      if (cm.role === "purchase_commission" && cond === true) { commissionDeducted = add(commissionDeducted, d.high); c.estimate.add("purchase_commission_deduction_unverified"); }
      else {
        // vilkår ikke oppgitt (eller rolle ukjent): tollverdien kan være lavere enn hele kjøpesummen. Det høyeste beløpet er ikke en nedre grense; laveste mulige brukes.
        commissionDeductPossible = add(commissionDeductPossible, d.high);
        c.incomplete.push("commission_in_price_deduction_unresolved");
        customsExtra.push(`provisjon i prisen (${f}): uavklart om den kan skilles ut av tollverdien (innkjøpsprovisjon, § 6-11 (1) e)`);
      }
      continue;
    }
    const a = whole(`provisjon ${f}`, raw); // tillegg/kostnad: laveste kandidat er en trygg nedre grense
    addOther("commission_separate", null, a, cm.amount.basis); // betalt i tillegg: kostnad, én gang
    if (cm.role === "sales_or_brokerage_commission") commissionInCustomsValue = add(commissionInCustomsValue, a); // legges til tollverdien (§ 6-10 (1) a nr. 1)
    else if (cm.role === "unknown") { c.incomplete.push("commission_role_unknown"); customsExtra.push("provisjon: rolle ukjent (innkjøps- eller salgsprovisjon)"); }
    // purchase_commission: kostnad, ikke i tollverdien
  }

  {
    // Provisjon som skilles ut av prisen kan ikke overstige kjøpesummen (kontroll før ugyldig input stopper beregningen).
    const priceForCheck = usedAmount !== null && purchaseBasisResolved ? parseDecimal(usedAmount) : null;
    if (priceForCheck && custRate && cmp(deductionsLow, fromInt(roundToWhole(mul(priceForCheck, custRate), c.rounding).value)) > 0) {
      block(c, "invalid_classification", "provisjon som skilles ut av prisen er større enn kjøpesummen (tollkurs)", "commission");
    }
  }

  // --- Betalingskostnader: ingen generell behandling; selvstendig kostnad skilles fra beløp som inngår i vareprisen ---
  for (const [i, pc] of (input.paymentCosts ?? []).entries()) {
    const f = `paymentCosts[${i}]`;
    if (!pc || typeof pc !== "object" || !PAYMENT_NATURES.includes(pc.nature)) { block(c, "invalid_classification", `${f}: ugyldig art`, f); continue; }
    const rawPc = amountInput(c, `${f}.amount`, pc.amount);
    if (!rawPc) continue;
    const a = whole(`betalingskostnad ${f}`, rawPc);
    if (pc.nature === "separate_payment_cost") addOther("payment_cost", String(pc.label ?? ""), a, pc.amount.basis); // selvstendig kostnad: utenfor tollverdi (§ 6-10 (2): tilleggene er uttømmende)
    else if (pc.nature === "included_in_goods_price") c.warnings.push(`${f} (${String(pc.label)}): inngår i vederlaget til selger og er allerede i prisen; legges ikke til en gang til`);
    else { c.incomplete.push("payment_cost_nature_unknown"); customsExtra.push(`betalingskostnad «${String(pc.label)}»: ukjent om selvstendig kostnad eller del av vareprisen`); missing.push(f); }
  }

  // --- Avgift (ECON-002) ---
  const tax = calculateNorwegianVehicleTax(input.taxInput, config.taxProfile);
  const taxL = taxLine(tax);
  if (taxL.status === "blocked") c.incomplete.push("tax_blocked");
  else {
    if (taxL.status === "estimate") c.estimate.add("tax_estimate");
    if (tax.validation && !tax.validation.profileApproved) c.estimate.add("tax_profile_not_approved");
  }

  // --- Fradragsstatus og mva-håndtering: to uavhengige akser; bare uttrykkelig forhandleroppgitt godtas ---
  const d: DeductionStatus | null = input.deduction ?? null;
  const dedAcceptedSource = d !== null && ACCEPTED_STATUS_SOURCES.includes(d.source?.kind);
  const dedAccepted = dedAcceptedSource && (d!.value === "recoverable" || d!.value === "non_recoverable");
  if (d && !dedAcceptedSource) c.warnings.push(`fradragsstatus ignorert: kilde «${String(d.source?.kind)}» godtas ikke (annonsetekst/antakelse gir ikke fradragsrett)`);
  const recov: VatRecoverability = dedAccepted ? d!.value : "unknown";
  const h = input.vatHandling ?? null;
  const hAcceptedSource = h !== null && ACCEPTED_STATUS_SOURCES.includes(h.source?.kind);
  const hAccepted = hAcceptedSource && (h!.value === "registered_reports_in_vat_return" || h!.value === "not_registered_pays_at_import");
  if (h && !hAcceptedSource) c.warnings.push(`mva-håndtering ignorert: kilde «${String(h.source?.kind)}» godtas ikke (utledes ikke av annonse eller av ordet «forhandler»)`);
  const handling: VatHandling = hAccepted ? h!.value : "unknown";
  if (!hAccepted) c.incomplete.push("vat_handling_unknown");
  if (handling === "not_registered_pays_at_import" && recov === "recoverable") {
    block(c, "inconsistent_vat_status", "fradragsrett (recoverable) forutsetter registrert avgiftssubjekt (mval. § 8-1), men mva-håndtering sier ikke registrert", "vatHandling");
  }
  if (dedAccepted) {
    if (d!.source.kind === "dealer_entered") c.estimate.add("deduction_status_dealer_stated");
    if (!profile.deductionRuleApproved) c.estimate.add("deduction_rule_unapproved");
  } else c.incomplete.push("unresolved_vat_recoverability");

  // --- Elbilfritak: kvalifikasjon og målegrunnlag adskilt fra drivlinjeklassifiseringen ---
  const engine: TaxPowertrain | null = tax.powertrain ?? classifyPowertrain(input.taxInput.propulsion);
  const qual = evQualification(c, input, engine);
  const basisIn: EvThresholdBasis = input.evThresholdBasis ?? "customs_value";
  if (!["customs_value", "undocumented_import_type"].includes(basisIn)) block(c, "invalid_amount", "evThresholdBasis: ugyldig verdi (kjøretøypris alene er ikke et regelalternativ)", "evThresholdBasis");

  // --- Tollavgift (mval. § 4-11: tollavgift inngår i mva.-grunnlaget). Ordinær sats 0 brukes bare når klassifisering og tariffgyldighet dekker tilfellet; ukjent blir aldri 0 ---
  let dutyRat: Rat | null = null;
  let dutyBasis: EconomicsResult["customsDuty"]["basis"] = "unknown";
  const coverage = ordinaryDutyCoverage({ vehicleClass: input.taxInput?.vehicleClass, powertrain: engine, acceptanceDate: accept.date });
  if (ch.customsDuty === undefined) {
    if (coverage.covered) {
      dutyRat = fromInt(0n);
      dutyBasis = "ordinary_rate_tariff_2026";
      if (!profile.vatRulesApproved) c.estimate.add("customs_duty_ordinary_rate_unapproved");
      c.warnings.push("tollavgift: ordinær sats 0 (Tolltariffen 2026, personbil 87.03, T83); endringer i tolltariffen etter 1.1.2026 er ikke kontrollert");
    } else {
      missing.push("charges.customsDuty");
      c.warnings.push(`tollavgift ukjent: ordinær sats 0 brukes ikke fordi ${coverage.reason}`);
    }
  } else {
    const dutyRaw = chargeAmount(c, "charges.customsDuty", ch.customsDuty, missing);
    const a = dutyRaw === null ? null : whole("tollavgift", dutyRaw);
    if (a !== null) {
      dutyRat = a;
      dutyBasis = "state" in ch.customsDuty ? "stated_not_applicable" : "explicit";
      if ("state" in ch.customsDuty) others = add(others, a); else addOther("customs_duty", null, a, ch.customsDuty.basis);
      if (!isZero(a) && coverage.covered) c.warnings.push("oppgitt tollavgift > 0 avviker fra ordinær sats 0 i Tolltariffen 2026 (kan skyldes særtiltak); oppgitt beløp brukes og inngår i mva.-grunnlaget");
    }
  }
  if (dutyRat === null) baseComplete = false;

  // --- Ugyldig input stopper her ---
  if (c.blockers.length) {
    const reasons = c.blockers.map((b) => `${b.code}: ${b.message}`);
    return {
      status: "blocked", blockers: c.blockers,
      dates: { asOf: asOfOk ? asOf : null, customsAcceptance: { date: accept.date, kind: accept.kind, rateValidOnDate: null }, norwegianRegistration: { date: input.taxInput?.norwegianRegistration?.date ?? null, kind: input.taxInput?.norwegianRegistration?.kind ?? null } },
      acquisition: { advertisedGross, advertisedNet, dealerAdjusted, used: { amount: usedAmount, currency: String(currency), selected: p?.use === "dealer_adjusted" ? "dealer_adjusted" : "advertised", basis: usedBasis, evidence: p?.evidence }, purchaseBasisResolved: false, acquisitionUsedNok: null, acquisitionUsedRaw: null },
      fx: { acquisition: acqFx, customs: custFx }, transportToBorderNok: null, transportToBorderBasis: toBorderBasis, transportAfterBorderNok: null, insuranceNok: null, loadingHandlingNok: null, commissionInCustomsValueNok: null, customsValueNok: null,
      customsDuty: { nok: null, basis: "unknown" }, importVatBaseNok: null,
      importVat: { status: "not_calculated", valueNok: null, scenarios: [], ev: { qualification: qual, thresholdBasis: null, engineClassification: engine }, reasons },
      importVatSettlement: { status: "not_calculated", handling: { value: handling, accepted: hAccepted, source: h?.source ?? null }, rows: [], excludedScenarios: [] },
      tax: taxL, costMeta: { transportAfterBorder: { kind: "unknown" }, insurance: { kind: "unknown" }, loadingHandling: { kind: "unknown" }, otherItems: [], othersNok: null }, importCashRequirement: notCalculated(reasons), estimatedLandedCost: notCalculated(reasons),
      vatRecoverability: { value: "unknown", accepted: false, source: null }, estimateReasons: [...c.estimate], incompleteReasons: [...new Set(c.incomplete)], warnings: c.warnings, roundingTies: [],
    };
  }

  // --- Kjøpesum (anskaffelseskurs) og tollverdi (tollkurs) ---
  const price = usedAmount === null ? null : parseDecimal(usedAmount)!;
  const acqNok = price && acqRate && purchaseBasisResolved ? round(c, "kjøpesum (anskaffelseskurs)", mul(price, acqRate)) : null;
  const acqRaw = price && acqRate && purchaseBasisResolved ? toDecimalString(mul(price, acqRate), 4) : null;
  const custPurchase = price && custRate && purchaseBasisResolved ? round(c, "kjøpesum (tollkurs)", mul(price, custRate)) : null;
  const toBorderNok = toBorder ? round(c, "transport til innførselsstedet", toBorder) : toBorder === null ? null : 0n;
  const afterBorderNok = afterBorder ? round(c, "transport etter innførselsstedet", afterBorder) : afterBorder === null ? null : 0n;
  const insuranceNok = insurance ? round(c, "forsikring", insurance) : insurance === null ? null : 0n;
  const loadingNok = loading ? round(c, "lasting og håndtering", loading) : loading === null ? null : 0n;
  const customsKnown = custPurchase !== null && toBorderNok !== null;
  const deductions = add(commissionDeducted, commissionDeductPossible);
  // Laveste mulige tollverdi når utskilling er uavklart (nedre grense); `customsComplete` er da false og feltet `customsValueNok` er null.
  const customsValueRat = customsKnown ? add(add(add(add(subFloor0(fromInt(custPurchase), deductions), fromInt(toBorderNok)), fromInt(insuranceNok ?? 0n)), fromInt(loadingNok ?? 0n)), commissionInCustomsValue) : null;
  const customsComplete = insuranceNok !== null && loadingNok !== null && customsExtra.length === 0;
  const vatBaseRat = customsValueRat ? add(customsValueRat, add(baseExtra, dutyRat ?? fromInt(0n))) : null;
  const customsValueNok = customsValueRat && customsComplete ? wholeNok(customsValueRat) : null;
  if (!profile.vatRulesApproved) c.estimate.add("vat_rules_unapproved");
  if (!profile.roundingApproved || c.rounding.status !== "approved") c.estimate.add("rounding_unconfirmed");

  // --- Import-mva. per scenario ---
  // Elbilgrensen måles mot tollverdien (bilpris + frakt + forsikring; R-IMP-VAT-004 E1P). Mva. = 25 % × (grunnlag − fritatt del), grunnlag = tollverdi + tollavgift + avgifter ved innførsel.
  const basisDocumented = basisIn === "customs_value";
  const options: VatScenarioId[] = [];
  if (qual === "not_applicable_vehicle") options.push("single");
  else if (qual === "does_not_qualify") options.push("no_exemption");
  else {
    if (qual === "unresolved") { options.push("no_exemption"); c.incomplete.push("ev_qualification_unresolved"); } else c.estimate.add("ev_qualification_stated");
    options.push("with_exemption__basis_customs_value");
    if (!basisDocumented) c.incomplete.push("ev_threshold_basis_not_documented_for_import_type");
    if (customsValueRat && ((loadingNok ?? 0n) > 0n || !isZero(commissionInCustomsValue))) c.estimate.add("ev_threshold_components_unconfirmed");
    c.warnings.push("elbilgrensen: målegrunnlaget (tollverdi) er hentet fra Tolletatens veiledning for privatpersoner, sammenstilt med mval. § 4-11 for registrert importør; lasting/håndtering og salgsprovisjon i målt beløp er ikke avgjort ordrett");
  }
  const vatScenarios = customsValueRat && vatBaseRat && !outOfPeriod
    ? options.map((id) => {
        const exempt = id === "with_exemption__basis_customs_value" ? (cmp(customsValueRat, EV_EXEMPTION_THRESHOLD) < 0 ? customsValueRat : EV_EXEMPTION_THRESHOLD) : fromInt(0n);
        const raw = mul(VAT_RATE, subFloor0(vatBaseRat, exempt));
        return { id, valueNok: round(c, `import-mva (${id})`, raw), raw: toDecimalString(raw, 4) };
      })
    : [];
  const vatExact = customsValueRat !== null && customsComplete && baseComplete && basisDocumented && !c.tieHit;
  const vatReasons: string[] = [];
  if (outOfPeriod) vatReasons.push(periodReason);
  if (!customsValueRat) vatReasons.push("tollverdi kan ikke beregnes (kjøpesum/tollkurs/transport til innførselsstedet mangler)");
  if (insuranceNok === null || loadingNok === null) vatReasons.push("forsikring eller lasting/håndtering ukjent: mva.-grunnlaget er en nedre grense");
  for (const r of customsExtra) vatReasons.push(`${r}: mva.-grunnlaget er en nedre grense`);
  if (!baseComplete) vatReasons.push("tollavgift ukjent eller avgift ved innførsel uklassifisert (mval. § 4-11): mva.-grunnlaget er en nedre grense");
  if (!basisDocumented) vatReasons.push("elbilgrensens målegrunnlag er ikke dokumentert for denne typen innførsel: nedre grense");
  if (c.tieHit) vatReasons.push("avrundingslikhet (U-013 uavklart)");
  const vatLower = vatScenarios.length ? vatScenarios.reduce((m, s) => (s.valueNok < m ? s.valueNok : m), vatScenarios[0]!.valueNok) : null;
  const importVat: EconomicsResult["importVat"] = {
    status: !vatScenarios.length ? "not_calculated" : !vatExact ? "lower_bound" : vatScenarios.length > 1 ? "scenarios" : "calculated",
    valueNok: !vatScenarios.length ? null : !vatExact ? vatLower : vatScenarios.length > 1 ? null : vatScenarios[0]!.valueNok,
    scenarios: vatScenarios.map((s) => ({ id: s.id, valueNok: s.valueNok, raw: s.raw })),
    ev: { qualification: qual, thresholdBasis: qual === "not_applicable_vehicle" || qual === "does_not_qualify" ? null : basisIn, engineClassification: engine },
    reasons: vatReasons,
  };

  // --- Betalingskanal for import-mva. (adskilt fra fradragsrett; ingen tidspunkter) ---
  // Ukjent håndtering forblir ukjent, men scenarioene skal ikke motsi akseptert fradragsstatus: `recoverable` forutsetter registrering (mval. § 8-1),
  // så «ikke registrert» filtreres bort og oppgis som utelatt. Registrering anses ikke som bekreftet av dette.
  const allHandlings: Array<"registered_reports_in_vat_return" | "not_registered_pays_at_import"> = ["registered_reports_in_vat_return", "not_registered_pays_at_import"];
  const excludedScenarios: EconomicsResult["importVatSettlement"]["excludedScenarios"] = [];
  const handlings = handling === "unknown" ? allHandlings.filter((hh) => {
    if (hh === "not_registered_pays_at_import" && recov === "recoverable") {
      excludedScenarios.push({ handling: hh, reason: "uforenlig med akseptert fradragsrett (recoverable forutsetter registrert avgiftssubjekt, mval. § 8-1); registrering er ikke bekreftet av dette" });
      return false;
    }
    return true;
  }) : [handling];
  const settlementRows = vatScenarios.flatMap((s) => handlings.map((hh) => ({
    vatScenarioId: s.id, handling: hh, vatNok: s.valueNok,
    paidToCustomsAtImportNok: hh === "not_registered_pays_at_import" ? s.valueNok : 0n,
    reportedInVatReturnNok: hh === "registered_reports_in_vat_return" ? s.valueNok : 0n,
    lowerBound: !vatExact,
  })));
  const importVatSettlement: EconomicsResult["importVatSettlement"] = {
    status: !settlementRows.length ? "not_calculated" : settlementRows.length > 1 || !hAccepted ? "scenarios" : "known",
    handling: { value: handling, accepted: hAccepted, source: h?.source ?? null },
    rows: settlementRows,
    excludedScenarios,
  };

  // --- Totaler (brutto utlegg og økonomisk kost) ---
  const ZERO = 0n;
  if (acqNok === null) missing.push("acquisition_used");
  if (toBorderNok === null) missing.push("transport_to_border");
  if (insuranceNok === null) missing.push("insurance");
  if (loadingNok === null) missing.push("loading_handling");
  if (!vatScenarios.length) missing.push("import_vat");
  else if (!vatExact && customsComplete && baseComplete && basisDocumented) missing.push("import_vat_rounding_tie");
  if (vatScenarios.length && !baseComplete) missing.push("import_vat_base_incomplete");
  if (vatScenarios.length && !basisDocumented) missing.push("ev_threshold_basis_not_documented");
  if (customsExtra.length) missing.push("customs_value_components");
  if (taxL.totalRegistrationTaxesNok === null) missing.push("total_registration_taxes");
  const othersNok = round(c, "øvrige kostnader", others);
  const baseKnown = (acqNok ?? ZERO) + (toBorderNok ?? ZERO) + (afterBorderNok ?? ZERO) + (insuranceNok ?? ZERO) + (loadingNok ?? ZERO) + (taxL.totalRegistrationTaxesNok ?? ZERO) + othersNok;
  // Avrundingslikhet i øvrige kostnader oppdages først her: totalene skal da ikke være entydige.
  if (c.tieHit && vatExact) missing.push("rounding_tie_unresolved");
  const exact = missing.length === 0 && vatExact && !c.tieHit;
  const label = (id: string) => (id === "with_exemption__basis_customs_value" ? "med elbilfritak (grense målt mot tollverdi)" : id === "no_exemption" ? "uten elbilfritak" : "");
  let cash: Total;
  let landed: Total;
  if (!exact) {
    const lb = (extra: bigint) => baseKnown + extra;
    cash = { kind: "lower_bound", lowerBoundNok: lb(vatLower ?? ZERO), missing };
    const landedLb = recov === "non_recoverable" ? lb(vatLower ?? ZERO) : lb(ZERO);
    landed = { kind: "lower_bound", lowerBoundNok: landedLb, missing: recov === "unknown" ? [...missing, "vat_recoverability"] : missing };
  } else {
    cash = vatScenarios.length === 1
      ? { kind: "value", valueNok: baseKnown + vatScenarios[0]!.valueNok }
      : { kind: "scenarios", valueNok: null, scenarios: vatScenarios.map((s) => ({ id: s.id, label: label(s.id), valueNok: baseKnown + s.valueNok })) };
    const landedScenarios: Array<{ id: string; label: string; valueNok: bigint }> = [];
    for (const s of vatScenarios) {
      for (const r of recov === "unknown" ? (["recoverable", "non_recoverable"] as const) : [recov]) {
        landedScenarios.push({
          id: [s.id === "single" ? "" : s.id, recov === "unknown" ? `if_${r}` : r].filter(Boolean).join("__"),
          label: [label(s.id), recov === "unknown" ? `hvis ${r === "recoverable" ? "fradragsberettiget" : "ikke fradragsberettiget"}` : ""].filter(Boolean).join(", "),
          valueNok: baseKnown + (r === "non_recoverable" ? s.valueNok : ZERO),
        });
      }
    }
    landed = landedScenarios.length === 1 ? { kind: "value", valueNok: landedScenarios[0]!.valueNok } : { kind: "scenarios", valueNok: null, scenarios: landedScenarios };
  }
  // B1: utenfor dokumentert periode er totalene som avhenger av mva. ikke beregnet (eksisterende `not_calculated`-kontrakt), ikke et estimat og ikke en nedre grense.
  if (outOfPeriod) { cash = notCalculated([periodReason]); landed = notCalculated([periodReason]); }
  if (c.tieHit) c.incomplete.push("rounding_tie_unresolved");
  if (!exact && !c.incomplete.length) c.incomplete.push("components_missing");

  const status: EconomicsResult["status"] = c.incomplete.length ? "incomplete" : c.estimate.size ? "estimate" : "validated";
  return {
    status, blockers: [],
    dates: { asOf, customsAcceptance: { date: accept.date, kind: accept.kind, rateValidOnDate }, norwegianRegistration: { date: input.taxInput?.norwegianRegistration?.date ?? null, kind: input.taxInput?.norwegianRegistration?.kind ?? null } },
    acquisition: {
      advertisedGross, advertisedNet, dealerAdjusted,
      used: { amount: usedAmount, currency: currency as string, selected: p.use === "dealer_adjusted" ? "dealer_adjusted" : "advertised", basis: usedBasis, evidence: p.evidence },
      purchaseBasisResolved, acquisitionUsedNok: acqNok, acquisitionUsedRaw: acqRaw,
    },
    fx: { acquisition: acqFx, customs: custFx },
    transportToBorderNok: toBorderNok, transportToBorderBasis: toBorderBasis, transportAfterBorderNok: afterBorderNok, insuranceNok, loadingHandlingNok: loadingNok, customsValueNok,
    commissionInCustomsValueNok: customsValueRat ? wholeNok(commissionInCustomsValue) : null,
    customsDuty: { nok: dutyRat ? wholeNok(dutyRat) : null, basis: dutyBasis }, importVatBaseNok: vatBaseRat && !outOfPeriod ? wholeNok(vatBaseRat) : null,
    importVat, importVatSettlement, tax: taxL,
    costMeta: { transportAfterBorder: metaOf(input.transportAfterBorder), insurance: metaOf(input.insurance), loadingHandling: metaOf(input.loadingHandling), otherItems, othersNok },
    importCashRequirement: cash, estimatedLandedCost: landed,
    vatRecoverability: { value: recov, accepted: dedAccepted, source: d?.source ?? null },
    estimateReasons: [...c.estimate], incompleteReasons: [...new Set(c.incomplete)], warnings: c.warnings, roundingTies: c.ties,
  };
}
