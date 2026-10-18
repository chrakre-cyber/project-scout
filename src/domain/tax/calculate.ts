/**
 * Deterministisk norsk engangsavgift 2026 (avgiftsgruppe a, personbil): `calculateNorwegianVehicleTax(input, profile)`.
 * Ren funksjon: ingen I/O, ingen valuta/kurs/transport, ingen provider, UI eller LLM. Beregningsrekkefølge (T40/T41/T05/T03):
 *   generell vektkomponent (alle) + [forbrenningsmotor: tilleggsvekt + CO2 marginalt] = avgift før fradrag
 *   → bruksfradrag i prosent (§ 3-3) = engangsavgift → + vrakpantavgift (ikke redusert) = total.
 * Mangler belegg eller input, blokkeres resultatet med årsak (ingen oppdiktede verdier). Avrunding er IKKE kilde-belagt (U-010):
 * resultatet er eksakt desimal pluss heltallsgrenser; en avrundingspolicy gis bare eksplisitt av kalleren og er merket uten kilde.
 */
import { lookupDeduction, stepLabel } from "./age-deduction";
import { add, dec, decInt, floorInt, max0, min, mul, sub, toExactString, toSafeNumber, ZERO, type Dec } from "./decimal";
import { compareIso, lastDayOfMonth, parseIsoDate } from "./dates";
import { TAX_PROFILES, type TaxProfile } from "./profile-no-2026-a";
import type {
  AgeDeductionResult, BlockCode, Blocker, ImplementationConclusion, MonthSensitivity, ProfileRef, TaxComponent, TaxInput, TaxPowertrain, TaxResult, ValidationStatus, Warning,
} from "./types";

const VERIFIED_WEIGHT_BASES = new Set(["eu_type_approval_minimum_mass", "vehicle_register"]);

export function classifyPowertrain(p: TaxInput["propulsion"]): TaxPowertrain | null {
  if (p.pistonCombustionEngine === null || p.externallyChargeable === null) return null;
  if (!p.pistonCombustionEngine) return "bev";
  return p.externallyChargeable ? "phev" : "ice";
}

const percentFactor = (pct: number): Dec => ({ units: BigInt(100 - pct), scale: 2 });

/** Svakeste regelnivå i profilen (brukes når ikke alle regler er anvendt, f.eks. blokkerte resultater). */
function weakest(p: TaxProfile): "E1" | "E1P" {
  return Object.values(p.ruleEvidence).some((e) => e === "E1P") ? "E1P" : "E1";
}

function profileRef(p: TaxProfile): ProfileRef {
  return { id: p.id, version: p.version, taxGroup: p.taxGroup, validFrom: p.validFrom, documentedPeriodLabel: p.documentedPeriodLabel, documentedValidTo: p.documentedValidTo, internalSafetyLimit: { date: p.internalSafetyLimit.date, kind: p.internalSafetyLimit.kind }, ratesVerifiedAsOf: p.ratesVerifiedAsOf, approved: p.approval.approved };
}

/** Kilde-dokumentert gyldighet og intern sperre holdes adskilt; ulike feilkoder gjør årsaken tydelig. */
function checkProfileDate(p: TaxProfile, dateIso: string, blockers: Blocker[]): boolean {
  if (compareIso(dateIso, p.validFrom) < 0) {
    blockers.push({ code: "no_profile_for_date", message: `Profil ${p.id} er dokumentert gyldig fra ${p.validFrom}; norsk registreringsdato ${dateIso} er før. Regelverket før dette er ikke i kildepakken.` });
    return false;
  }
  if (p.documentedValidTo !== null && compareIso(dateIso, p.documentedValidTo) > 0) {
    blockers.push({ code: "profile_not_valid_for_date", message: `Profil ${p.id} er dokumentert gyldig til ${p.documentedValidTo}; norsk registreringsdato ${dateIso} er etter.` });
    return false;
  }
  if (compareIso(dateIso, p.internalSafetyLimit.date) > 0) {
    blockers.push({ code: "profile_internal_limit_exceeded", message: `Intern sikkerhetssperre (${p.internalSafetyLimit.date}), ikke en kildedokumentert opphørsdato: satsene er ikke kontrollert for ${dateIso}. ${p.internalSafetyLimit.basis}` });
    return false;
  }
  return true;
}

function selectProfile(dateIso: string | null, profile: TaxProfile | undefined, blockers: Blocker[]): TaxProfile | null {
  if (profile) return dateIso && !checkProfileDate(profile, dateIso, blockers) ? null : profile;
  if (!dateIso) return null;
  // Velg profilen hvis dokumenterte startdato ≤ dato; sperrene (dokumentert slutt / intern grense) rapporteres av checkProfileDate.
  const candidate = TAX_PROFILES.filter((p) => compareIso(dateIso, p.validFrom) >= 0).at(-1) ?? TAX_PROFILES[0]!;
  return checkProfileDate(candidate, dateIso, blockers) ? candidate : null;
}

interface Computed {
  components: TaxComponent[];
  preDeduction: Dec;
}

function computeComponents(profile: TaxProfile, powertrain: TaxPowertrain, kg: number, co2Grams: number | null): Computed {
  const pr = profile.parameters;
  const components: TaxComponent[] = [];
  const weight = decInt(kg);
  const gen = mul(max0(sub(weight, decInt(pr.generalWeight.thresholdKg))), dec(pr.generalWeight.ratePerKg));
  components.push({
    id: "general_weight",
    label: "Vektkomponent, generell (alle personbiler)",
    basis: `max(0, ${kg} − ${pr.generalWeight.thresholdKg}) kg × ${pr.generalWeight.ratePerKg} kr/kg`,
    amountExact: toExactString(gen),
    ruleRef: pr.generalWeight.ruleRef,
  });
  let pre = gen;
  if (powertrain !== "bev") {
    const ice = mul(max0(sub(weight, decInt(pr.combustionWeight.thresholdKg))), dec(pr.combustionWeight.ratePerKg));
    components.push({
      id: "combustion_weight",
      label: "Vektkomponent, tillegg for forbrenningsmotor",
      basis: `max(0, ${kg} − ${pr.combustionWeight.thresholdKg}) kg × ${pr.combustionWeight.ratePerKg} kr/kg`,
      amountExact: toExactString(ice),
      ruleRef: pr.combustionWeight.ruleRef,
    });
    pre = add(pre, ice);
    const grams = decInt(co2Grams ?? 0);
    let co2 = ZERO;
    const parts: string[] = [];
    for (const b of pr.co2Bands) {
      const upper = b.toGramKm === null ? grams : min(grams, decInt(b.toGramKm));
      const portion = max0(sub(upper, decInt(b.fromGramKm)));
      if (portion.units > 0n) parts.push(`${toExactString(portion)} g/km × ${b.ratePerGramKm}`);
      co2 = add(co2, mul(portion, dec(b.ratePerGramKm)));
    }
    components.push({ id: "co2", label: "CO₂-komponent (marginale bånd)", basis: `${co2Grams} g/km: ${parts.join(" + ") || "0"}`, amountExact: toExactString(co2), ruleRef: pr.co2RuleRef });
    pre = add(pre, co2);
  }
  return { components, preDeduction: pre };
}

function ambiguityBlocker(a: { stepMonths: number; clampedDate: string; rolledDate: string } | null, norDate: string, viaAlt: boolean): Blocker {
  return {
    code: "age_step_boundary_ambiguous",
    message: `Første registreringsdag (29–31) finnes ikke i målmåneden for trinnet ${a ? stepLabel(a.stepMonths) : "?"}. Kilden sier ikke om trinnet nås ${a?.clampedDate} (siste dag i måneden) eller ${a?.rolledDate} (1. i neste måned); norsk registrering ${norDate} ligger i dette vinduet (U-009).${viaAlt ? " Utfallet oppstår i alternativet «siste dag i måneden» fordi bare måned er kjent." : ""}`,
    ...(a ? { detail: { stepMonths: a.stepMonths, clampedDate: a.clampedDate, rolledDate: a.rolledDate, norwegianDate: norDate, viaMonthPrecisionAlternative: viaAlt } } : {}),
  };
}

export function calculateNorwegianVehicleTax(input: TaxInput, profile?: TaxProfile): TaxResult {
  const blockers: Blocker[] = [];
  const missing: string[] = [];
  const warnings: Warning[] = [];
  const block = (code: BlockCode, message: string, field?: string) => {
    blockers.push({ code, message });
    if (field) missing.push(field);
  };

  // --- kjøretøyklasse og drivlinje (aldri fra markedsføringsnavn)
  if (input.vehicleClass !== "passenger_car_m1") block("vehicle_class_unsupported", `Kjøretøyklassen «${input.vehicleClass}» støttes ikke (bare personbil M1, avgiftsgruppe a).`);
  let powertrain: TaxPowertrain | null = null;
  if (input.propulsion.evidence === "listing_claim") {
    block("propulsion_evidence_insufficient", "Drivlinje fra annonsepåstand er ikke et avgiftsgrunnlag; krever typegodkjenning, kjøretøyregister eller forhandlerens egen oppgave.");
  } else {
    powertrain = classifyPowertrain(input.propulsion);
    if (!powertrain) block("propulsion_unknown", "Stempeldrevet forbrenningsmotor og ladbarhet må være kjent.", "propulsion");
    if (input.propulsion.evidence === "dealer_entered") warnings.push({ code: "propulsion_dealer_entered", message: "Drivlinje er oppgitt av forhandler, ikke dokumentert fra typegodkjenning/register." });
  }

  // --- vekt
  const kg = input.norwegianTaxWeight.kg;
  if (kg === null) block("tax_weight_missing", "Norsk avgiftsvekt (egenvekt, minimumsvekt fra typegodkjenning) mangler.", "norwegianTaxWeight.kg");
  else if (!Number.isInteger(kg) || kg <= 0 || kg > 20000) block("tax_weight_invalid", `Ugyldig avgiftsvekt: ${kg}.`);
  else if (!VERIFIED_WEIGHT_BASES.has(input.norwegianTaxWeight.basis)) warnings.push({ code: "weight_basis_not_verified", message: `Vektgrunnlaget «${input.norwegianTaxWeight.basis}» er ikke typegodkjenning/register (rundskriv 3.2.2).` });

  // --- datoer
  const nor = input.norwegianRegistration;
  let norDate: string | null = null;
  if (nor.date === null) block("norwegian_registration_missing", "Forventet/faktisk norsk registreringsdato mangler.", "norwegianRegistration.date");
  else if (!parseIsoDate(nor.date)) block("norwegian_registration_invalid", `Ugyldig norsk registreringsdato: ${nor.date}.`);
  else norDate = nor.date;
  if (nor.defaulted) warnings.push({ code: "norwegian_registration_defaulted", message: "Norsk registreringsdato er standardverdien (beregningsdato); faktisk dato kan gi annet bruksfradrag og annen regelversjon." });

  const fr = input.firstRegistration;
  let working: string | null = null;
  let altWorking: string | null = null;
  let derived = false;
  let isNew = false;
  if (fr.precision === "none") isNew = true;
  else if (fr.precision === "day") {
    if (fr.value && parseIsoDate(fr.value)) working = fr.value;
    else block("first_registration_invalid", `Første registrering «${fr.value}» er ikke en gyldig dato.`);
  } else if (fr.precision === "month") {
    const m = fr.value ? /^(\d{4})-(\d{2})$/.exec(fr.value) : null;
    if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
      working = `${m[1]}-${m[2]}-01`;
      altWorking = lastDayOfMonth(Number(m[1]), Number(m[2]));
      derived = true;
    } else block("first_registration_invalid", `Første registrering «${fr.value}» er ikke et gyldig år-måned.`);
  } else if (fr.precision === "year") {
    block("registration_precision_insufficient", "Bare registreringsår er kjent: alder i måneder og dato-til-dato-bruksfradrag kan ikke beregnes eksakt. Måned (og helst dag) må oppgis; ingen dato antas.", "firstRegistration.month");
  } else block("first_registration_missing", "Første registreringsdato mangler.", "firstRegistration");
  if (working && norDate && compareIso(norDate, working) < 0) block("norwegian_registration_before_first_registration", `Norsk registrering ${norDate} er før første registrering ${working}.`);

  // --- profil (styrende hendelse = norsk registreringsdato)
  const prof = selectProfile(norDate, profile, blockers);
  if (prof && prof.vehicleClass !== input.vehicleClass && input.vehicleClass === "passenger_car_m1") block("vehicle_class_unsupported", "Profilen dekker ikke kjøretøyklassen.");
  if (prof && norDate && compareIso(norDate, prof.ratesVerifiedAsOf) > 0) {
    warnings.push({ code: "rates_verified_as_of", message: `Satsene er verifisert mot den konsoliderte vedtaksteksten hentet ${prof.ratesVerifiedAsOf}; senere endringer er ikke kontrollert.` });
  }

  // --- CO2 (§ 3-1)
  let co2Grams: number | null = null;
  if (powertrain === "ice" || powertrain === "phev") {
    const c = input.co2;
    if (c.method === "nedc") block("co2_nedc_unsupported", "NEDC-verdi må ganges med 1,24 (§ 3-1), men avrunding av resultatet er ikke omtalt i kildene (U-010): ikke støttet.");
    else if (c.method === "not_wltp_or_nedc_approved") block("co2_fallback_unsupported", "CO₂ = egenvekt/10 gir desimaler uten kilde for avrunding (U-010): ikke støttet.");
    else if (c.gramsPerKm === null) block("co2_missing", "CO₂-utslipp (g/km) mangler.", "co2.gramsPerKm");
    else if (!Number.isInteger(c.gramsPerKm) || c.gramsPerKm < 0 || c.gramsPerKm > 1000) block("co2_invalid", `Ugyldig CO₂-verdi: ${c.gramsPerKm}.`);
    else if (powertrain === "phev" && c.method !== "wltp_weighted_combined") block("phev_requires_weighted_combined_co2", "Ladbar hybrid skal bruke feltet «vektet kombinert» (§ 3-1).");
    else if (powertrain === "ice" && c.method === "wltp_weighted_combined") block("co2_field_mismatch", "«Vektet kombinert» gjelder bare ladbare hybridbiler (§ 3-1).");
    else {
      let method = c.method;
      if (method === "unspecified") {
        // § 3-1 fjerde ledd: WLTP hvis første registrering i utlandet 1.9.2018 eller senere (eller ikke tidligere registrert), ellers NEDC
        if (isNew) method = "wltp_combined";
        else if (working && (compareIso(working, "2018-09-01") >= 0) && (!altWorking || compareIso(altWorking, "2018-09-01") >= 0)) method = "wltp_combined";
        else if (working) block("co2_nedc_unsupported", "Målemetode ukjent og første registrering før 1.9.2018 ⇒ NEDC-behandling, som ikke støttes (U-010).");
      }
      if (method !== "unspecified" && !blockers.some((b) => b.code === "co2_nedc_unsupported")) co2Grams = c.gramsPerKm;
    }
  }

  if (blockers.length > 0 || !prof || !powertrain || kg === null || !norDate) {
    return { status: "blocked", profile: prof ? profileRef(prof) : null, powertrain, components: [], preDeductionExact: null, ageDeduction: null, oneOffTaxExact: null, scrappageDeposit: null, totalRegistrationTaxesExact: null, finalClaim: null, monthSensitivity: null, evidence: prof ? { parameterEvidenceLevel: weakest(prof), profileApproved: prof.approval.approved, openItems: [...prof.openItems] } : null, missingInputs: missing, blocked: blockers, warnings, implementationConclusions: [], validation: null };
  }

  // --- beregning
  const { components, preDeduction } = computeComponents(prof, powertrain, kg, co2Grams);
  let ded: AgeDeductionResult;
  let monthSensitivity: MonthSensitivity | null = null;
  const total = (pct: number) => add(mul(preDeduction, percentFactor(pct)), decInt(prof.parameters.scrappageDepositNok));
  if (isNew) {
    ded = { percent: 0, ageCompletedMonths: null, stepLabel: null, workingFirstRegistration: null, workingDateDerived: false, norwegianRegistrationDate: norDate, norwegianRegistrationKind: nor.kind, twentyYearRule: false };
    warnings.push({ code: "new_vehicle_no_deduction", message: "Ikke registrert i utlandet før norsk registrering: ingen bruksfradrag (§ 3-2)." });
  } else {
    const main = lookupDeduction(prof.deductionTable, working!, norDate);
    const alt = altWorking && compareIso(norDate, altWorking) >= 0 ? lookupDeduction(prof.deductionTable, altWorking, norDate) : null;
    if (main.ambiguous || alt?.ambiguous) {
      return { status: "blocked", profile: profileRef(prof), powertrain, components, preDeductionExact: toExactString(preDeduction), ageDeduction: null, oneOffTaxExact: null, scrappageDeposit: null, totalRegistrationTaxesExact: null, finalClaim: null, monthSensitivity: null, evidence: { parameterEvidenceLevel: weakest(prof), profileApproved: prof.approval.approved, openItems: [...prof.openItems] }, missingInputs: missing, blocked: [ambiguityBlocker(main.ambiguity ?? alt?.ambiguity ?? null, norDate, !main.ambiguity)], warnings, implementationConclusions: [], validation: null };
    }
    ded = { percent: main.percent, ageCompletedMonths: main.completedMonths, stepLabel: main.stepLabel, workingFirstRegistration: working, workingDateDerived: derived, norwegianRegistrationDate: norDate, norwegianRegistrationKind: nor.kind, twentyYearRule: main.twentyYearRule };
    if (main.twentyYearRule) warnings.push({ code: "twenty_year_rule_unverified", message: "20-årsregelen gir 100 % fradrag; hvilken avgift som ellers gjelder for 20 år gamle motorvogner er ikke utledet (R-OTA-011)." });
    if (alt && alt.percent !== main.percent) {
      monthSensitivity = {
        alternativeWorkingDate: altWorking!,
        alternativeDeductionPercent: alt.percent,
        alternativeTotalRegistrationTaxesExact: toExactString(total(alt.percent)),
        alternativeTotalRegistrationTaxesNok: toSafeNumber(floorInt(total(alt.percent))),
        message: `Bare måned er kjent; arbeidsdato ${working} (første dag) gir ${main.percent} % fradrag, siste dag i måneden (${altWorking}) gir ${alt.percent} %. Første dag gir høyest alder og lavest avgift.`,
      };
      warnings.push({ code: "month_precision_sensitivity", message: monthSensitivity.message });
    }
  }
  const implementationConclusions: ImplementationConclusion[] = [];
  if (!isNew) {
    implementationConclusions.push({
      code: "month_steps_same_anniversary_rule",
      statement: "Månedstrinn i bruksfradraget nås på dagen i måneden (inklusivt), på samme måte som T42 uttrykkelig sier for hele år («fyller år»). Kilden beskriver ikke månedstrinn særskilt.",
      sourceStatus: "not_expressly_described",
    });
    const overflowPossible = (working && parseIsoDate(working)!.d > 28) || (altWorking && parseIsoDate(altWorking)!.d > 28);
    if (overflowPossible) {
      implementationConclusions.push({
        code: "overflow_dates_outside_window_monotonic",
        statement: "Første registreringsdag 29–31 finnes ikke i alle målmåneder, og kilden beskriver ikke dag 29–31. Utenfor tvetydighetsvinduet [siste dag i målmåneden, første dag i neste måned) er utfallet likt for begge kandidatdatoer, og motoren bruker da dette trinnet; i vinduet blokkeres beregningen.",
        sourceStatus: "not_expressly_described",
      });
    }
  }

  const oneOff = mul(preDeduction, percentFactor(ded.percent));
  const scrap = prof.parameters.scrappageDepositNok;
  const totalExact = add(oneOff, decInt(scrap));
  // Skattebetalingsforskriften § 10-4-4 (R-OTA-014): bare det samlede kravet avrundes ned til hele kroner; mellomledd er eksakte desimaler (U-012).
  const oneOffNok = toSafeNumber(floorInt(oneOff));
  const totalNok = toSafeNumber(floorInt(totalExact));
  implementationConclusions.push({
    code: "no_intermediate_rounding",
    statement: "Avrunding (ned til hele kroner, skattebetalingsforskriften § 10-4-4) gjelder det samlede kravet. Kildene omtaler ikke avrunding av kg × sats, CO₂-bånd, sum før fradrag eller prosentfradrag; motoren avrunder derfor ikke mellomledd (U-012).",
    sourceStatus: "not_expressly_described",
  });
  // Regler som faktisk er anvendt i dette resultatet (svakeste nivå styrer; en vellykket beregning er aldri «godkjent» i seg selv).
  const applied = [prof.parameters.generalWeight.ruleRef, ...(powertrain === "bev" ? ["R-OTA-007"] : [prof.parameters.combustionWeight.ruleRef, prof.parameters.co2RuleRef]), ...(powertrain === "phev" ? ["R-OTA-005"] : []), ...(isNew ? [] : [prof.deductionRuleRef]), prof.parameters.scrappageRuleRef, prof.parameters.rounding.ruleRef];
  const appliedRules = [...new Set(applied)].map((ruleRef) => ({ ruleRef, evidence: prof.ruleEvidence[ruleRef] ?? ("E1P" as const) }));
  const weakestRuleEvidence: "E1" | "E1P" = appliedRules.some((r) => r.evidence === "E1P") ? "E1P" : "E1";
  const approved = prof.approval.approved && prof.approval.class1References > 0 && weakestRuleEvidence === "E1";
  const validation: ValidationStatus = { status: approved ? "approved" : "estimate_not_approved", profileApproved: prof.approval.approved, class1References: prof.approval.class1References, weakestRuleEvidence, appliedRules };
  return {
    status: approved ? "calculated" : "calculated_unverified",
    profile: profileRef(prof),
    powertrain,
    components,
    preDeductionExact: toExactString(preDeduction),
    ageDeduction: ded,
    oneOffTaxExact: toExactString(oneOff),
    scrappageDeposit: { amountNok: scrap, ruleRef: prof.parameters.scrappageRuleRef, reducedByAgeDeduction: false },
    totalRegistrationTaxesExact: toExactString(totalExact),
    finalClaim: { ruleRef: "R-OTA-014", basis: "skattebetalingsforskriften § 10-4-4: ned til nærmeste hele krone", evidence: "E1P", oneOffTaxNok: oneOffNok, scrappageDepositNok: scrap, totalRegistrationTaxesNok: totalNok, validation },
    monthSensitivity,
    evidence: { parameterEvidenceLevel: validation.weakestRuleEvidence, profileApproved: prof.approval.approved, openItems: [...prof.openItems] },
    missingInputs: missing,
    blocked: [],
    warnings,
    implementationConclusions,
    validation,
  };
}
