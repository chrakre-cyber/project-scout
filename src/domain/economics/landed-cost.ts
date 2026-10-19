/**
 * Landed-cost-kjernen (ECON-004): rene funksjoner, eksakt heltalls-/rasjonal aritmetikk, ingen I/O. Avgiften kommer fra avgiftsmotoren (ECON-002, uendret).
 * Ingen regel her er godkjent som produksjonsregel: mva.-sats/tollverdigrunnlag (R-IMP-VAT-001/-002, E1P), elbilfritak (R-IMP-VAT-003, E1X), avrunding (U-013),
 * tollkurs (U-008) og fradragsrett (R-DED-001, E1P) styres av `EconomicsProfile`. Så lenge profilen ikke er godkjent kan resultatet aldri bli `validated`.
 */
import { calculateNorwegianVehicleTax, classifyPowertrain, type TaxResult } from "@/domain/tax";
import {
  MAX_AMOUNT, MAX_RATE, MIN_RATE, add, cmp, fromInt, isZero, mul, parseDecimal, roundToWhole, subFloor0, toDecimalString,
  type Rat, type RoundingPolicy,
} from "./rational";
import {
  REGISTRY_ECONOMICS_PROFILE,
  type AmountBasis, type AmountInput, type ChargeState, type DeductionStatus, type EconBlocker, type EconomicsConfig, type EconomicsInput, type EconomicsResult,
  type EstimateReason, type EvExemptionInput, type FxQuote, type FxRoleResult, type TaxLine, type Total, type VatRecoverability,
} from "./types";

/** R-IMP-VAT-001 (E1P): 25 % av tollverdien. Ikke godkjent regel. */
const VAT_RATE: Rat = { n: 25n, d: 100n };
/** R-IMP-VAT-003 (E1X): fritaksbeløp for elbil fra 2026-01-01. Anvendelse ved innførsel og målt beløp er uavklart. */
const EV_EXEMPTION_THRESHOLD: Rat = fromInt(300_000n);
const AMOUNT_BASES: readonly AmountBasis[] = ["dealer_entered", "quoted", "assumed_default", "scenario_assumption"];

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

const emptyFx = (status: FxRoleResult["status"], reason?: string): FxRoleResult => ({ status, rate: null, pair: null, source: null, effectiveAt: null, quotedAt: null, ...(reason ? { reason } : {}) });

/** Validerer ett kursutsagn. Returnerer kursen, eller null (med blokkering). */
function checkQuote(c: Ctx, role: "acquisition" | "customs", q: FxQuote, currency: string, asOf: string, allowFixture: boolean): Rat | null {
  const f = `fx.${role}`;
  const bad = (m: string) => { block(c, "invalid_fx_quote", `${f}: ${m}`, f); return null; };
  if (!q || typeof q !== "object") return bad("ugyldig kursobjekt");
  if (q.pair !== `${currency}/NOK`) return bad(`kursparet ${String(q.pair)} samsvarer ikke med ${currency}/NOK`);
  const rate = parseDecimal(q.rate);
  if (!rate || cmp(rate, MIN_RATE) < 0 || cmp(rate, MAX_RATE) > 0) return bad("kurs ugyldig eller utenfor teknisk grense");
  if (q.fixtureOnly && !allowFixture) return bad("fixture-/testkurs er ikke en produksjonskurs");
  for (const k of ["effectiveAt", "quotedAt", "validUntil"] as const) {
    const v = q[k];
    if (v !== null && v !== undefined && !isIsoDate(v)) return bad(`${k} er ikke en gyldig ISO-dato`);
  }
  if (q.effectiveAt && q.effectiveAt > asOf) return bad("kursen gjelder etter beregningsdatoen");
  if (q.validUntil && q.validUntil < asOf) return bad("kursen er utløpt per beregningsdatoen");
  if (!q.effectiveAt || !q.quotedAt) c.estimate.add("fx_dates_missing");
  return rate;
}

const fxUsed = (q: FxQuote, rate: Rat, status: FxRoleResult["status"] = "used"): FxRoleResult => ({
  status, rate: toDecimalString(rate, 8).replace(/\.?0+$/, "") || "0", pair: q.pair, source: q.source, effectiveAt: q.effectiveAt ?? null, quotedAt: q.quotedAt ?? null,
});

function chargeAmount(c: Ctx, field: string, s: ChargeState | undefined, missing: string[]): Rat {
  if (!s || ("state" in s && s.state === "unknown")) { missing.push(field); return fromInt(0n); }
  if ("state" in s) {
    if (s.state === "excluded_by_scenario") { c.estimate.add("charges_excluded_by_scenario"); return fromInt(0n); }
    return fromInt(0n); // not_applicable
  }
  return amountInput(c, field, s) ?? fromInt(0n);
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

const notCalculated = (reasons: string[]): Total => ({ kind: "not_calculated", reasons });

export function calculateEconomics(input: EconomicsInput, config: EconomicsConfig): EconomicsResult {
  const c: Ctx = { blockers: [], estimate: new Set(), incomplete: [], warnings: [], ties: [], tieHit: false, rounding: config.rounding };
  const profile = config.profile ?? REGISTRY_ECONOMICS_PROFILE;
  const asOf = input.asOf;
  if (!isIsoDate(asOf)) block(c, "invalid_date", "asOf: ugyldig ISO-dato", "asOf");

  // --- Kjøpsgrunnlag (annonsert / forhandlerjustert / brukt holdes adskilt) ---
  const p = input.price;
  const currency = p?.currency;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) block(c, "invalid_currency", "price.currency: ISO 4217-kode (tre store bokstaver) kreves", "price.currency");
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

  // --- Kurser: to separate roller ---
  const nok = currency === "NOK";
  let acqRate: Rat | null = null;
  let custRate: Rat | null = null;
  let acqFx: FxRoleResult = emptyFx("not_calculated", "anskaffelseskurs mangler");
  let custFx: FxRoleResult = emptyFx("not_calculated", "tollkurs mangler");
  if (nok) {
    acqRate = custRate = fromInt(1n);
    acqFx = { ...emptyFx("not_needed"), rate: "1", pair: "NOK/NOK" };
    custFx = { ...emptyFx("not_needed"), rate: "1", pair: "NOK/NOK" };
  } else if (typeof currency === "string" && /^[A-Z]{3}$/.test(currency) && isIsoDate(asOf)) {
    const allowFixture = config.allowFixtureFxQuotes === true;
    const aq = input.fx?.acquisition;
    if (aq) { acqRate = checkQuote(c, "acquisition", aq, currency, asOf, allowFixture); if (acqRate) acqFx = fxUsed(aq, acqRate); }
    else c.incomplete.push("acquisition_fx_missing");
    const cq = input.fx?.customs;
    if (cq) { custRate = checkQuote(c, "customs", cq, currency, asOf, allowFixture); if (custRate) custFx = fxUsed(cq, custRate); }
    else if (input.fx?.customsFallback === "use_acquisition_rate_assumed" && aq && acqRate) {
      custRate = acqRate;
      custFx = { ...fxUsed(aq, acqRate, "assumed_from_acquisition"), reason: "tollkurs antatt lik anskaffelseskurs (uttrykkelig antakelse)" };
      c.estimate.add("customs_fx_fallback_acquisition_rate");
    } else c.incomplete.push("customs_fx_missing");
    if (!profile.customsFxRuleApproved) c.estimate.add("customs_fx_rule_unconfirmed");
  }

  // --- Transport og forsikring (én gang i kostnadssummen) ---
  let transport: Rat | null = null;
  let transportBasis: EconomicsResult["transportBasis"] = null;
  if (input.transport === "unknown") { transportBasis = "unknown"; c.incomplete.push("transport_unknown"); }
  else if (input.transport === undefined) {
    if (config.transportDefaultNok !== undefined) {
      transport = amount(c, "config.transportDefaultNok", config.transportDefaultNok, true);
      transportBasis = "assumed_default";
      c.estimate.add("transport_default_assumed");
    } else { transportBasis = "unknown"; c.incomplete.push("transport_unknown"); }
  } else { transport = amountInput(c, "transport", input.transport); transportBasis = input.transport.basis; }
  let insurance: Rat | null = null;
  if (input.insurance === undefined || input.insurance === "unknown") c.incomplete.push("insurance_unknown");
  else insurance = amountInput(c, "insurance", input.insurance);

  // --- Avgift (ECON-002) ---
  const tax = calculateNorwegianVehicleTax(input.taxInput, config.taxProfile);
  const taxL = taxLine(tax);
  if (taxL.status === "blocked") c.incomplete.push("tax_blocked");
  else {
    if (taxL.status === "estimate") c.estimate.add("tax_estimate");
    if (tax.validation && !tax.validation.profileApproved) c.estimate.add("tax_profile_not_approved");
  }

  // --- Videre: ugyldig input stopper her ---
  if (c.blockers.length) {
    const reasons = c.blockers.map((b) => `${b.code}: ${b.message}`);
    return {
      status: "blocked", blockers: c.blockers,
      acquisition: { advertisedGross, advertisedNet, dealerAdjusted, used: { amount: usedAmount, currency: String(currency), selected: p?.use === "dealer_adjusted" ? "dealer_adjusted" : "advertised", basis: usedBasis, evidence: p?.evidence }, purchaseBasisResolved: false, acquisitionUsedNok: null, acquisitionUsedRaw: null },
      fx: { acquisition: acqFx, customs: custFx }, transportNok: null, transportBasis, insuranceNok: null, customsValueNok: null,
      importVat: { status: "not_calculated", valueNok: null, scenarios: [], evExemption: "unknown", reasons },
      tax: taxL, importCashRequirement: notCalculated(reasons), estimatedLandedCost: notCalculated(reasons),
      vatRecoverability: { value: "unknown", accepted: false, source: null }, estimateReasons: [...c.estimate], incompleteReasons: c.incomplete, warnings: c.warnings, roundingTies: [],
    };
  }

  // --- Kjøpesum (anskaffelseskurs) og tollverdi (tollkurs) ---
  const price = usedAmount === null ? null : parseDecimal(usedAmount)!;
  const acqNok = price && acqRate && purchaseBasisResolved ? round(c, "kjøpesum (anskaffelseskurs)", mul(price, acqRate)) : null;
  const acqRaw = price && acqRate && purchaseBasisResolved ? toDecimalString(mul(price, acqRate), 4) : null;
  const custPurchase = price && custRate && purchaseBasisResolved ? round(c, "kjøpesum (tollkurs)", mul(price, custRate)) : null;
  const customsKnown = custPurchase !== null && transport !== null;
  const transportNok = transport ? round(c, "transport", transport) : transport === null ? null : 0n;
  const insuranceNok = insurance ? round(c, "forsikring", insurance) : insurance === null ? null : 0n;
  const customsValueRat = customsKnown ? add(add(fromInt(custPurchase), fromInt(transportNok ?? 0n)), fromInt(insuranceNok ?? 0n)) : null;
  const customsValueNok = customsValueRat && insurance !== null ? customsValueRat.n : null;
  if (!profile.vatRulesApproved) c.estimate.add("vat_rules_unapproved");
  if (!profile.roundingApproved || c.rounding.status !== "approved") c.estimate.add("rounding_unconfirmed");

  // --- Elbilfritak (scenarier; ukjent er standard) ---
  const powertrain = tax.powertrain ?? classifyPowertrain(input.taxInput.propulsion);
  const isBev = powertrain === "bev";
  const evRaw: EvExemptionInput = input.evExemption ?? "unknown";
  if (!["applies", "not_applicable", "unknown"].includes(evRaw)) { block(c, "invalid_amount", "evExemption: ugyldig verdi", "evExemption"); }
  let evMode: EconomicsResult["importVat"]["evExemption"] = "not_applicable_vehicle";
  const exemptionOptions: Array<"no_exemption" | "with_exemption" | "single"> = [];
  if (!isBev) {
    if (powertrain === null) c.incomplete.push("powertrain_unknown_ev_exemption_unresolved");
    exemptionOptions.push("single");
  } else {
    evMode = evRaw;
    if (evRaw === "applies") { exemptionOptions.push("with_exemption"); c.estimate.add("ev_exemption_assumed"); }
    else if (evRaw === "not_applicable") exemptionOptions.push("no_exemption");
    else { exemptionOptions.push("no_exemption", "with_exemption"); c.incomplete.push("ev_exemption_unresolved"); }
  }

  // --- Import-mva. ---
  const vatScenarios = customsValueRat
    ? exemptionOptions.map((id) => {
        const base = id === "with_exemption" ? subFloor0(customsValueRat, EV_EXEMPTION_THRESHOLD) : customsValueRat;
        const raw = mul(VAT_RATE, base);
        return { id, valueNok: round(c, `import-mva (${id})`, raw), raw: toDecimalString(raw, 4) };
      })
    : [];
  const vatExact = customsValueRat !== null && insurance !== null && !c.tieHit;
  const vatReasons: string[] = [];
  if (!customsValueRat) vatReasons.push("tollverdi kan ikke beregnes (kjøpesum/tollkurs/transport mangler)");
  if (insurance === null) vatReasons.push("forsikring ukjent: mva.-grunnlaget er en nedre grense");
  if (c.tieHit) vatReasons.push("avrundingslikhet (U-013 uavklart)");
  const vatLower = vatScenarios.length ? vatScenarios.reduce((m, s) => (s.valueNok < m ? s.valueNok : m), vatScenarios[0]!.valueNok) : null;
  const importVat: EconomicsResult["importVat"] = {
    status: !vatScenarios.length ? "not_calculated" : !vatExact ? "lower_bound" : vatScenarios.length > 1 ? "scenarios" : "calculated",
    valueNok: !vatScenarios.length ? null : !vatExact ? vatLower : vatScenarios.length > 1 ? null : vatScenarios[0]!.valueNok,
    scenarios: vatScenarios.map((s) => ({ id: s.id, valueNok: s.valueNok, raw: s.raw })),
    evExemption: evMode,
    reasons: vatReasons,
  };

  // --- Øvrige kjente kostnader ---
  const missing: string[] = [];
  const ch = input.charges ?? {};
  let others = fromInt(0n);
  for (const [k, v] of [["climateGas", ch.climateGas], ["registrationFee", ch.registrationFee], ["customsDuty", ch.customsDuty]] as const) {
    const a = chargeAmount(c, `charges.${k}`, v, missing);
    if (k === "customsDuty" && !isZero(a)) c.incomplete.push("customs_duty_vat_base_unresolved");
    others = add(others, a);
  }
  for (const [i, o] of (ch.otherKnown ?? []).entries()) {
    const a = amountInput(c, `charges.otherKnown[${i}]`, o);
    if (a) others = add(others, a);
  }
  if (c.blockers.length) return calculateEconomicsBlockedLate(c, input, config);

  // --- Fradragsstatus: bare uttrykkelig forhandleroppgitt godtas ---
  const d: DeductionStatus | null = input.deduction ?? null;
  const acceptedSource = d !== null && (d.source?.kind === "dealer_entered" || d.source?.kind === "dealer_profile");
  const accepted = acceptedSource && (d!.value === "recoverable" || d!.value === "non_recoverable");
  if (d && !acceptedSource) c.warnings.push(`fradragsstatus ignorert: kilde «${String(d.source?.kind)}» godtas ikke (annonsetekst/antakelse gir ikke fradragsrett)`);
  const recov: VatRecoverability = accepted ? d!.value : "unknown";
  if (accepted) {
    if (d!.source.kind === "dealer_entered") c.estimate.add("deduction_status_dealer_stated");
    if (!profile.deductionRuleApproved) c.estimate.add("deduction_rule_unapproved");
  } else c.incomplete.push("unresolved_vat_recoverability");

  // --- Totaler ---
  const ZERO = 0n;
  if (acqNok === null) missing.push("acquisition_used");
  if (transportNok === null) missing.push("transport");
  if (insuranceNok === null) missing.push("insurance");
  if (!vatScenarios.length) missing.push("import_vat");
  else if (!vatExact && insurance !== null) missing.push("import_vat_rounding_tie");
  if (taxL.totalRegistrationTaxesNok === null) missing.push("total_registration_taxes");
  const baseKnown = (acqNok ?? ZERO) + (transportNok ?? ZERO) + (insuranceNok ?? ZERO) + (taxL.totalRegistrationTaxesNok ?? ZERO) + round(c, "øvrige kostnader", others);
  const exact = missing.length === 0 && vatExact;
  const label = (id: string) => (id === "with_exemption" ? "med elbilfritak (antatt)" : id === "no_exemption" ? "uten elbilfritak" : "");
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
  if (c.tieHit) c.incomplete.push("rounding_tie_unresolved");
  if (!exact && !c.incomplete.length) c.incomplete.push("components_missing");

  const status: EconomicsResult["status"] = c.incomplete.length ? "incomplete" : c.estimate.size ? "estimate" : "validated";
  return {
    status, blockers: [],
    acquisition: {
      advertisedGross, advertisedNet, dealerAdjusted,
      used: { amount: usedAmount, currency: currency as string, selected: p.use === "dealer_adjusted" ? "dealer_adjusted" : "advertised", basis: usedBasis, evidence: p.evidence },
      purchaseBasisResolved, acquisitionUsedNok: acqNok, acquisitionUsedRaw: acqRaw,
    },
    fx: { acquisition: acqFx, customs: custFx },
    transportNok, transportBasis, insuranceNok, customsValueNok, importVat, tax: taxL,
    importCashRequirement: cash, estimatedLandedCost: landed,
    vatRecoverability: { value: recov, accepted, source: d?.source ?? null },
    estimateReasons: [...c.estimate], incompleteReasons: [...new Set(c.incomplete)], warnings: c.warnings, roundingTies: c.ties,
  };
}

/** Blokkering som først oppdages etter kursoppløsning (ugyldig tilleggsinput): ingen delsummer. */
function calculateEconomicsBlockedLate(c: Ctx, input: EconomicsInput, config: EconomicsConfig): EconomicsResult {
  const reasons = c.blockers.map((b) => `${b.code}: ${b.message}`);
  const blank = emptyFx("not_calculated");
  return {
    status: "blocked", blockers: c.blockers,
    acquisition: { advertisedGross: null, advertisedNet: null, dealerAdjusted: null, used: { amount: null, currency: input.price.currency, selected: input.price.use === "dealer_adjusted" ? "dealer_adjusted" : "advertised", basis: "unknown", evidence: input.price.evidence }, purchaseBasisResolved: false, acquisitionUsedNok: null, acquisitionUsedRaw: null },
    fx: { acquisition: blank, customs: blank }, transportNok: null, transportBasis: null, insuranceNok: null, customsValueNok: null,
    importVat: { status: "not_calculated", valueNok: null, scenarios: [], evExemption: "unknown", reasons },
    tax: taxLine(calculateNorwegianVehicleTax(input.taxInput, config.taxProfile)),
    importCashRequirement: notCalculated(reasons), estimatedLandedCost: notCalculated(reasons),
    vatRecoverability: { value: "unknown", accepted: false, source: null }, estimateReasons: [], incompleteReasons: [], warnings: [], roundingTies: [],
  };
}
