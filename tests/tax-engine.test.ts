/**
 * ECON-002: deterministisk norsk engangsavgift (gruppe a, personbil 2026). Testene prøver regler, grenser og blokkering — de gyldne
 * casene er valideringsreferanser, aldri kilder til satser. Avrunding: bare sluttkravet ned til hele kroner (skattebetalingsforskriften § 10-4-4, R-OTA-014, E1P); mellomledd avrundes ikke (U-012).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateNorwegianVehicleTax, classifyPowertrain, lookupDeduction, NO_OTA_2026_A_PB, DEDUCTION_STEPS_2026, type TaxInput, type TaxProfile } from "@/domain/tax";
import { add, ceilInt, dec, decInt, floorInt, mul, roundHalfUpInt, toExactString } from "@/domain/tax/decimal";
import { DOCUMENTATION_CHECKLIST, GOLDEN_CASES, missingDocumentation, TEST_DATE } from "./fixtures/tax-golden";

const ROOT = join(__dirname, "..");
const json = (f: string) => JSON.parse(readFileSync(join(ROOT, "docs/tax", f), "utf8"));
interface Dp { internalSafetyLimit?: { date: string; kind: string }; id: string; thresholdKg?: number; rate?: number; group: string; from: string; to: string | null; evidence: string; bandSemantics?: string; bands?: Array<{ fromGramKm: number; toGramKm: number | null; rate: number }> }
const table = DEDUCTION_STEPS_2026;

const ice = (over: Partial<TaxInput> = {}): TaxInput => ({
  vehicleClass: "passenger_car_m1",
  propulsion: { pistonCombustionEngine: true, externallyChargeable: false, evidence: "type_approval" },
  norwegianTaxWeight: { kg: 1976, basis: "eu_type_approval_minimum_mass" },
  co2: { gramsPerKm: 179, method: "wltp_combined" },
  firstRegistration: { precision: "day", value: "2023-11-01" },
  norwegianRegistration: { date: "2026-04-30", kind: "expected" },
  ...over,
});
const codes = (r: ReturnType<typeof calculateNorwegianVehicleTax>) => r.blocked.map((b) => b.code);

describe("eksakt desimalaritmetikk (ingen float)", () => {
  it("12,71 × 1 685 er nøyaktig 21 416,35 (binær float gir støy)", () => {
    expect(toExactString(mul(decInt(1685), dec("12.71")))).toBe("21416.35");
    expect(0.1 + 0.2).not.toBe(0.3); // float ville ikke holdt
    expect(toExactString(add(dec("0.1"), dec("0.2")))).toBe("0.3");
  });
  it("floor / ceil / halvt opp er uavhengige og deterministiske, også for negative tall", () => {
    const x = dec("526669.738");
    expect([floorInt(x), ceilInt(x), roundHalfUpInt(x)]).toEqual([526669n, 526670n, 526670n]);
    expect([floorInt(dec("2.5")), roundHalfUpInt(dec("2.5")), roundHalfUpInt(dec("-2.5")), floorInt(dec("-0.5")), ceilInt(dec("-0.5"))]).toEqual([2n, 3n, -3n, -1n, 0n]);
    expect(() => dec("1e3")).toThrow();
  });
});

describe("kilde-belagte parametere stemmer med docs/tax (ingen parallell regelmodell)", () => {
  const rules = json("rules.json").rules as Array<{ id: string; datedParameters?: Array<Record<string, unknown>> }>;
  const dp = (id: string) => rules.flatMap((r) => r.datedParameters ?? []).find((d) => d.id === id) as unknown as Dp;
  const P = NO_OTA_2026_A_PB.parameters;
  it("vekt og CO2 = rules.json datedParameters", () => {
    expect(dp(P.generalWeight.paramRef)).toMatchObject({ thresholdKg: P.generalWeight.thresholdKg, rate: Number(P.generalWeight.ratePerKg), group: "a", from: "2026-01-01", to: null, evidence: "E1" });
    expect(dp(P.combustionWeight.paramRef)).toMatchObject({ thresholdKg: P.combustionWeight.thresholdKg, rate: Number(P.combustionWeight.ratePerKg), group: "a", from: "2026-01-01", to: null, evidence: "E1" });
    const bands = dp(P.co2ParamRef).bands!;
    expect(dp(P.co2ParamRef).bandSemantics).toBe("marginal");
    expect(P.co2Bands.map((b) => Number(b.ratePerGramKm))).toEqual(bands.map((b) => b.rate));
    expect(P.co2Bands.map((b) => b.toGramKm)).toEqual(bands.map((b) => b.toGramKm));
  });
  it("bruksfradragstabellen = T07-transkripsjonen (41 trinn, stigende) og vrakpant 2 400", () => {
    const t7 = json("bruksfradrag-tabell-T07.json").steps.map((s: { ageMonths: number; percent: number }) => ({ ageMonths: s.ageMonths, percent: s.percent }));
    expect(table).toEqual(t7);
    expect(table).toHaveLength(41);
    expect(table.at(-1)).toEqual({ ageMonths: 240, percent: 100 });
    expect(P.scrappageDepositNok).toBe(2400);
  });
  it("kildefilene i docs/tax/primarkilder har registrert SHA-256 og E1-nivå", () => {
    const sources = json("sources.json").sources as Array<{ id: string; evidenceLevel: string; repoFile?: string; packageSha256?: string }>;
    for (const id of NO_OTA_2026_A_PB.sources) {
      const s = sources.find((x) => x.id === id)!;
      expect(s.evidenceLevel, id).toBe("E1");
      expect(createHash("sha256").update(readFileSync(join(ROOT, s.repoFile!))).digest("hex"), id).toBe(s.packageSha256);
    }
  });
  it("profilen er ikke godkjent og ingen parameter er godkjent i foundationStatus", () => {
    expect(NO_OTA_2026_A_PB.approval.approved).toBe(false);
    expect(json("rules.json").foundationStatus).toMatchObject({ status: "REVIEW", approvedParameters: 0, class1References: 3 });
  });
});

/** Lesbar tekst fra de originale HTML-filene i repoet (ikke fra avledede TXT-kopier). */
function htmlText(file: string): string {
  const raw = readFileSync(join(ROOT, "docs/tax/primarkilder", file), "utf8");
  return raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[\u200b]/g, "")
    .replace(/\u2011/g, "-")
    .replace(/\s+/g, " ");
}

describe("endelig stortingsvedtak og endringsvedtak (U-011) — tekstbelegg i de originale HTML-filene", () => {
  const consolidated = htmlText("10_Lovdata_Engangsavgift_2026.html");
  const original = htmlText("06_Stortinget_Vedtak_220_2026.html");
  const amendment = htmlText("11_Endringsvedtak_2026-06-19-1246.html");
  const rnb = htmlText("07_Stortinget_RNB_2026_vedtak.html");
  it("identitet og metadata: FOR-2025-12-18-2755, Budsjettåret 2026, sist endret FOR-2026-06-19-1246 fra 01.09.2026", () => {
    for (const s of ["FOR-2025-12-18-2755", "Budsjettåret 2026", "FOR-2026-06-19-1246 fra 01.09.2026", "Kunngjort 22.12.2025"]) expect(consolidated, s).toContain(s);
    expect(original).toContain("Vedtak 220");
  });
  it("§ 2, § 3 a, § 4 og § 5 er like i opprinnelig vedtak 220 og konsolidert tekst (gruppe a uendret)", () => {
    for (const s of ["12,71 kroner per kg for den delen av egenvekten som overstiger 500 kg", "260 kroner per kg for den delen av vekten som overstiger 1 200 kg", "gjøres fradrag i den avgift som beregnes etter §§ 2 og 3 basert på motorvognens alder", "For motorvogner med stempeldrevet forbrenningsmotor"]) {
      expect(original.replace(/\s+/g, " "), `vedtak 220: ${s}`).toContain(s);
      expect(consolidated, `konsolidert: ${s}`).toContain(s);
    }
    for (const doc of [original, consolidated]) expect(doc).toMatch(/Motorvogner\s*i avgiftsgruppe a, b, c, g og j\s*2\s?400/);
  });
  it("endringsvedtaket endrer bare § 3 første ledd bokstav b nr 2 og trer i kraft 1. september 2026; vedtak 1131–1132 stemmer", () => {
    expect(amendment).toContain("§ 3 fyrste ledd bokstav b nr 2 skal lyde");
    expect(amendment.match(/§ \d+[a-z]? /g)?.filter((x) => x !== "§ 3 " && x !== "§ 75 ").length ?? 0).toBeLessThanOrEqual(1);
    expect(amendment).toContain("Endringa under I tek til å gjelde 1. september 2026");
    expect(amendment).not.toMatch(/12,71|260 kroner|2 400/);
    expect(rnb).toContain("stortingsvedtak 18. desember 2025 nr. 220");
    expect(rnb).toContain("§ 3 fyrste ledd bokstav b nr 2 skal lyde");
  });
  it("motorens gruppe a-parametere er tallene i vedtaket", () => {
    const P = NO_OTA_2026_A_PB.parameters;
    expect(consolidated).toContain(`${P.generalWeight.ratePerKg.replace(".", ",")} kroner per kg for den delen av egenvekten som overstiger ${P.generalWeight.thresholdKg} kg`);
    expect(consolidated).toContain(`${P.combustionWeight.ratePerKg} kroner per kg for den delen av vekten som overstiger 1 200 kg`);
    expect(consolidated).toMatch(/per g\/km kr 0–100 800 101–150 1 600 151–225 3 200 over 225 5 000 b\. For varebiler klasse 2/);
  });
});

describe("finalClaim ledsages alltid av valideringsstatus og er aldri «godkjent» fordi beregningen lykkes", () => {
  const ok = (over: Partial<TaxInput> = {}, profile?: TaxProfile) => calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-10-18", kind: "expected" }, ...over }), profile);
  it("hvert vellykket resultat har finalClaim.validation = estimate_not_approved, identisk med toppnivå-validation", () => {
    for (const c of GOLDEN_CASES) {
      const r = calculateNorwegianVehicleTax(c.input);
      expect(r.status, c.id).toBe("calculated_unverified");
      expect(r.finalClaim!.validation, c.id).toEqual(r.validation);
      expect(r.validation, c.id).toMatchObject({ status: "estimate_not_approved", profileApproved: false, class1References: 3, weakestRuleEvidence: "E1P" });
    }
  });
  it("anvendte regler og svakeste nivå følger registeret (BEV: R-OTA-007 i stedet for 002/005; ny motorvogn: ingen R-OTA-010)", () => {
    const refs = (r: ReturnType<typeof ok>) => r.validation!.appliedRules.map((x) => x.ruleRef).sort();
    expect(refs(calculateNorwegianVehicleTax(GOLDEN_CASES[1]!.input))).toEqual(["R-IMP-OTH-001", "R-OTA-001", "R-OTA-007", "R-OTA-010", "R-OTA-014"]);
    expect(refs(calculateNorwegianVehicleTax(GOLDEN_CASES[0]!.input))).toEqual(["R-IMP-OTH-001", "R-OTA-001", "R-OTA-002", "R-OTA-005", "R-OTA-010", "R-OTA-014"]);
    expect(refs(ok({ firstRegistration: { precision: "none", value: null } }))).not.toContain("R-OTA-010");
  });
  it("profilens ruleEvidence er lik rules.json evidenceLevel (ingen stille avvik)", () => {
    const rules = json("rules.json").rules as Array<{ id: string; evidenceLevel: string }>;
    for (const [ref, level] of Object.entries(NO_OTA_2026_A_PB.ruleEvidence)) expect(rules.find((r) => r.id === ref)!.evidenceLevel, ref).toBe(level);
  });
  it("godkjent profil alene gjør ikke resultatet godkjent: krever også klasse 1-referanse og at alle anvendte regler er E1", () => {
    const flagOnly: TaxProfile = { ...NO_OTA_2026_A_PB, approval: { ...NO_OTA_2026_A_PB.approval, approved: true } };
    const r1 = ok({}, flagOnly);
    expect(r1.status).toBe("calculated_unverified");
    expect(r1.validation).toMatchObject({ status: "estimate_not_approved", profileApproved: true });
    const withClass1: TaxProfile = { ...flagOnly, approval: { ...flagOnly.approval, class1References: 1 } };
    expect(ok({}, withClass1).validation).toMatchObject({ status: "estimate_not_approved", weakestRuleEvidence: "E1P" });
  });
  it("først når profil godkjent + klasse 1 + alle anvendte regler E1 gir resultatet «calculated» (syntetisk profil; ikke registeret)", () => {
    const allE1: TaxProfile = { ...NO_OTA_2026_A_PB, approval: { approved: true, class1References: 1, reason: "test" }, ruleEvidence: Object.fromEntries(Object.keys(NO_OTA_2026_A_PB.ruleEvidence).map((k) => [k, "E1" as const])) };
    const r = ok({}, allE1);
    expect(r.status).toBe("calculated");
    expect(r.validation!.status).toBe("approved");
    expect(NO_OTA_2026_A_PB.approval).toMatchObject({ approved: false, class1References: 3 }); // registeret er ikke endret: klasse 1 finnes, men ingen godkjenning
  });
  it("blokkerte resultater har verken finalClaim eller validation", () => {
    const r = ok({ norwegianTaxWeight: { kg: null, basis: "unverified" } });
    expect([r.finalClaim, r.validation]).toEqual([null, null]);
  });
});

describe("U-012: bare generell vekt har brøk; sensitivitet for mellomavrunding (informasjon, ikke regelutledning)", () => {
  it("tilleggsvekt, CO₂ og vrakpant er heltall for alle gyldige vekter og CO₂-verdier; generell vekt har høyst to desimaler", () => {
    for (let kg = 400; kg <= 3500; kg += 37) {
      for (const g of [0, 99, 100, 101, 149, 150, 151, 224, 225, 226, 300]) {
        const r = calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg, basis: "vehicle_register" }, co2: { gramsPerKm: g, method: "wltp_combined" }, firstRegistration: { precision: "none", value: null } }));
        for (const c of r.components) {
          if (c.id === "general_weight") expect(c.amountExact.split(".")[1]?.length ?? 0, `${kg}`).toBeLessThanOrEqual(2);
          else expect(c.amountExact, `${c.id} ${kg}/${g}`).not.toContain(".");
        }
      }
    }
  });
  it("SENSITIVITET (avgrenset): alternative mellomavrundinger avviker fra motorens sluttkrav med −1…+2 kr over det definerte variantsettet og inputområdet — ingen generell garanti", () => {
    // Heltallsaritmetikk i hundredeler (kun testhjelp). Motorens formel: floor((gen + I) × (100 − p)/100) der gen = (kg − 500) × 12,71 og I er heltall (ICE-tillegg + CO₂).
    const PCTS = [...new Set([0, ...DEDUCTION_STEPS_2026.map((s) => s.percent)])]; // alle 41 trinn + 0 %
    const co2 = (g: number) => [[0, 100, 800], [100, 150, 1600], [150, 225, 3200], [225, 1e9, 5000]].reduce((s, [lo, hi, r]) => s + Math.max(0, Math.min(g, hi!) - lo!) * r!, 0);
    const G = [0, 60, 99, 100, 101, 140, 150, 151, 179, 225, 226, 300, 400];
    const ceil = (n: number, d: number) => Math.ceil(n / d);
    const near = (n: number, d: number) => Math.floor((2 * n + d) / (2 * d));
    let max = -Infinity;
    let min = Infinity;
    let points = 0;
    for (let kg = 500; kg <= 4000; kg++) {
      const gen = (kg - 500) * 1271; // hundredeler
      for (const ice of [false, true]) {
        const Is = ice ? [...new Set(G.map((g) => Math.max(0, kg - 1200) * 260 + co2(g)))] : [0];
        for (const I of Is) for (const p of PCTS) {
          const f = 100 - p;
          const engine = Math.floor(((gen + I * 100) * f) / 10000);
          for (const gv of [gen, Math.floor(gen / 100) * 100, near(gen, 100) * 100, ceil(gen, 100) * 100]) {
            const pre = gv + I * 100;
            const variants = [Math.floor((pre * f) / 10000)];
            for (const ded of [Math.floor((pre * p) / 10000), near(pre * p, 10000), ceil(pre * p, 10000)]) variants.push(Math.floor(pre / 100 - ded));
            for (const s of [Math.floor(pre / 100), near(pre, 100), ceil(pre, 100)]) variants.push(Math.floor((s * f) / 100));
            for (const v of variants) { max = Math.max(max, v - engine); min = Math.min(min, v - engine); points++; }
          }
        }
      }
    }
    expect(points).toBeGreaterThan(10_000_000);
    expect(max).toBe(2);
    expect(min).toBe(-1);
    // rutenettformelen er motorens egen: sjekk mot den faktiske motoren på et utvalg (BEV og ICE)
    for (const [kg, g] of [[2185, 0], [1976, 179], [2610, 140], [1500, 99], [3100, 226]] as const) {
      const ev = g === 0;
      const r = calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: !ev, externallyChargeable: false, evidence: "type_approval" }, norwegianTaxWeight: { kg, basis: "vehicle_register" }, co2: { gramsPerKm: ev ? null : g, method: "wltp_combined" }, firstRegistration: { precision: "none", value: null } }));
      const I = ev ? 0 : Math.max(0, kg - 1200) * 260 + co2(g);
      expect(r.finalClaim!.oneOffTaxNok, `${kg}/${g}`).toBe(Math.floor(((kg - 500) * 1271 + I * 100) * 100 / 10000));
    }
  });
});

describe("registreringsmal for nye golden-kjøringer", () => {
  const template = readFileSync(join(ROOT, "docs/tax/golden-run-template.md"), "utf8");
  it("inneholder alle sjekklistepunktene fra fixturen og krever ny referanse-ID (ikke rekonstruksjon av CASE-001/002/003)", () => {
    for (const k of DOCUMENTATION_CHECKLIST) expect(template, k).toContain("`" + k + "`");
    expect(template).toMatch(/GR-/);
    expect(template).toMatch(/aldri.*CASE-001\/002\/003/s);
    expect(template).toMatch(/ikke testdato/);
    expect(template).toMatch(/kjøredato ≠ testdato/);
  });
});

describe("avrundingskjeden (U-010): forskrift § 10-4-4, håndbok og lovens virkeområde — tekstbelegg", () => {
  it("skattebetalingsforskriften § 10-4-4 og håndboken sier ned til nærmeste hele krone ved beregning av skatte- og avgiftskrav", () => {
    const s = "Ved beregning av skatte- og avgiftskrav avrundes beløpet ned til nærmeste hele krone";
    expect(htmlText("09_Skattebetalingsforskriften.html")).toContain(s);
    expect(htmlText("08_Skattebetalingshandboken_10-4.html")).toContain(s);
    expect(htmlText("08_Skattebetalingshandboken_10-4.html")).toContain("skatte- og avgiftsregnskapene ikke vil inneholde ørebeløp");
  });
  it("engangsavgift er et avgiftskrav under skattebetalingsloven (§ 1-1 (2) i, § 10-40 (1) c) og nevnes i forskriften § 10-4-1 d", () => {
    const law = htmlText("12_Skattebetalingsloven.html");
    expect(law).toContain("særavgifter omfattet av lov 19. juni 1959 nr. 2 om avgifter vedrørende motorkjøretøyer og båter");
    expect(law).toContain("engangsavgiften for registrerte virksomheter, som forfaller til betaling den 18. i måneden etter at avgiftsplikten oppstod");
    expect(htmlText("09_Skattebetalingsforskriften.html")).toContain("engangsavgift på motorvogner, hvor beløpsgrensen er 200 kroner");
  });
  it("hjemmel: skattebetalingsloven § 10-4 gjelder «dette kapitlet» (kapittel 10 Forfall) — registrert som åpent spørsmål, ikke skjult", () => {
    expect(htmlText("12_Skattebetalingsloven.html")).toContain("Departementet kan i forskrift gi regler til utfylling og gjennomføring av bestemmelsene i dette kapitlet");
    const rule = (json("rules.json").rules as Array<{ id: string; evidenceLevel: string; openQuestions: string[] }>).find((r) => r.id === "R-OTA-014")!;
    expect(rule.evidenceLevel).toBe("E1P");
    expect(rule.openQuestions.join(" ")).toMatch(/kapittel 10/);
  });
});

describe("drivlinje avgjøres av tekniske data, ikke merkenavn", () => {
  it("klassifiserer BEV / PHEV / ICE og krever kjente felt", () => {
    const p = (piston: boolean | null, chg: boolean | null) => ({ pistonCombustionEngine: piston, externallyChargeable: chg, evidence: "type_approval" as const });
    expect(classifyPowertrain(p(false, true))).toBe("bev");
    expect(classifyPowertrain(p(true, true))).toBe("phev");
    expect(classifyPowertrain(p(true, false))).toBe("ice");
    expect(classifyPowertrain(p(null, false))).toBeNull();
    expect(classifyPowertrain(p(true, null))).toBeNull();
  });
  it("annonsepåstand om drivlinje og ukjent drivlinje blokkerer", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: false, externallyChargeable: false, evidence: "listing_claim" } })))).toContain("propulsion_evidence_insufficient");
    const unk = calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: null, externallyChargeable: null, evidence: "type_approval" } }));
    expect(codes(unk)).toContain("propulsion_unknown");
    expect(unk.missingInputs).toContain("propulsion");
  });
  it("drivstoff (bensin/diesel) og merkenavn er ikke en del av avgiftsinput og endrer aldri resultatet", () => {
    const withLabel = (label: string) => ({ ...ice(), fuelLabel: label, marketingName: "e-tron" }) as unknown as TaxInput;
    expect(calculateNorwegianVehicleTax(withLabel("petrol"))).toEqual(calculateNorwegianVehicleTax(withLabel("diesel")));
    expect(calculateNorwegianVehicleTax(withLabel("petrol"))).toEqual(calculateNorwegianVehicleTax(ice()));
  });
  it("ikke-støttet kjøretøyklasse blokkeres", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ vehicleClass: "van_class_2" })))).toContain("vehicle_class_unsupported");
  });
});

describe("vektkomponenter: EV får bare generell, forbrenningsmotor får tillegg", () => {
  const ev = (kg: number): TaxInput => ice({ propulsion: { pistonCombustionEngine: false, externallyChargeable: false, evidence: "type_approval" }, norwegianTaxWeight: { kg, basis: "vehicle_register" }, co2: { gramsPerKm: null, method: "wltp_combined" } });
  it("EV 2 185 kg: bare (2185−500)×12,71 = 21 416,35; ingen 260-komponent og ingen CO₂", () => {
    const r = calculateNorwegianVehicleTax(ev(2185));
    expect(r.components.map((c) => c.id)).toEqual(["general_weight"]);
    expect(r.components[0]!.amountExact).toBe("21416.35");
    expect(r.preDeductionExact).toBe("21416.35");
  });
  it("samme vekt som ICE gir tillegg (2185−1200)×260 = 256 100 og CO₂", () => {
    const r = calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: 2185, basis: "vehicle_register" } }));
    expect(r.components.map((c) => [c.id, c.amountExact])).toEqual([["general_weight", "21416.35"], ["combustion_weight", "256100"], ["co2", "252800"]]);
  });
  it("terskler: 500 og 1 200 kg gir 0 i hver komponent; én kg over gir én sats", () => {
    const amount = (kg: number, id: string, input = ice) => calculateNorwegianVehicleTax(input({ norwegianTaxWeight: { kg, basis: "vehicle_register" }, co2: { gramsPerKm: 0, method: "wltp_combined" } })).components.find((c) => c.id === id)!.amountExact;
    expect(amount(500, "general_weight")).toBe("0");
    expect(amount(501, "general_weight")).toBe("12.71");
    expect(amount(1200, "combustion_weight")).toBe("0");
    expect(amount(1201, "combustion_weight")).toBe("260");
    expect(amount(300, "general_weight")).toBe("0");
  });
  it("ugyldig vekt blokkeres; ukjent vekt gir missing input", () => {
    const miss = calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: null, basis: "unverified" } }));
    expect(codes(miss)).toContain("tax_weight_missing");
    expect(miss.missingInputs).toContain("norwegianTaxWeight.kg");
    for (const kg of [0, -5, 1976.5, 25000]) expect(codes(calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg, basis: "vehicle_register" } }))), String(kg)).toContain("tax_weight_invalid");
  });
  it("uverifisert vektgrunnlag gir advarsel, ikke blokkering", () => {
    const r = calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: 1976, basis: "reference_listing" } }));
    expect(r.status).toBe("calculated_unverified");
    expect(r.warnings.map((w) => w.code)).toContain("weight_basis_not_verified");
  });
});

describe("CO₂: marginale bånd (T40) og målegrunnlag (§ 3-1)", () => {
  const co2 = (g: number) => Number(calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: 500, basis: "vehicle_register" }, co2: { gramsPerKm: g, method: "wltp_combined" }, firstRegistration: { precision: "none", value: null } })).components.find((c) => c.id === "co2")!.amountExact);
  it("båndgrenser 0/100/101/150/151/225/226", () => {
    expect([0, 100, 101, 150, 151, 225, 226, 300].map(co2)).toEqual([0, 80000, 81600, 160000, 163200, 400000, 405000, 775000]);
  });
  it("er progressive, ikke flat sats: 179 g/km = 80 000 + 80 000 + 29×3 200 (ikke 179×3 200)", () => {
    expect(co2(179)).toBe(252800);
    expect(co2(179)).not.toBe(179 * 3200);
  });
  it("PHEV må bruke «vektet kombinert»; vanlig ICE kan ikke bruke det; mangler/ugyldig blokkeres", () => {
    const phev = (method: TaxInput["co2"]["method"], g: number | null = 140): TaxInput => ice({ propulsion: { pistonCombustionEngine: true, externallyChargeable: true, evidence: "type_approval" }, co2: { gramsPerKm: g, method } });
    expect(calculateNorwegianVehicleTax(phev("wltp_weighted_combined")).status).toBe("calculated_unverified");
    expect(codes(calculateNorwegianVehicleTax(phev("wltp_combined")))).toContain("phev_requires_weighted_combined_co2");
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: 150, method: "wltp_weighted_combined" } })))).toContain("co2_field_mismatch");
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: null, method: "wltp_combined" } })))).toContain("co2_missing");
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: 12.5, method: "wltp_combined" } })))).toContain("co2_invalid");
  });
  it("PHEV beholder ICE-komponentene (§ 3: stempeldrevet forbrenningsmotor) og har ingen vektfradrag", () => {
    const r = calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: true, externallyChargeable: true, evidence: "type_approval" }, co2: { gramsPerKm: 140, method: "wltp_weighted_combined" } }));
    expect(r.powertrain).toBe("phev");
    expect(r.components.map((c) => c.id)).toEqual(["general_weight", "combustion_weight", "co2"]);
  });
  it("NEDC, egenvekt/10 og ukjent metode før 1.9.2018 blokkeres (avrunding av omregnet CO₂ uten kilde); ukjent metode etter støttes som WLTP", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: 150, method: "nedc" } })))).toContain("co2_nedc_unsupported");
    expect(codes(calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: null, method: "not_wltp_or_nedc_approved" } })))).toContain("co2_fallback_unsupported");
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2018-08-31" }, co2: { gramsPerKm: 150, method: "unspecified" } })))).toContain("co2_nedc_unsupported");
    expect(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2018-09-01" }, co2: { gramsPerKm: 150, method: "unspecified" } })).status).toBe("calculated_unverified");
    expect(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "none", value: null }, co2: { gramsPerKm: 150, method: "unspecified" } })).status).toBe("calculated_unverified");
  });
});

describe("bruksfradrag: dato til dato, trinngrenser", () => {
  const pct = (first: string, nor: string) => lookupDeduction(table, first, nor).percent;
  it("2 år 6 måneder fra 2023-11-01 nås 2026-05-01 (26 % → 30 %); 3 år 2026-11-01 (30 % → 33 %)", () => {
    expect([pct("2023-11-01", "2026-04-30"), pct("2023-11-01", "2026-05-01"), pct("2023-11-01", "2026-10-31"), pct("2023-11-01", "2026-11-01")]).toEqual([26, 30, 30, 33]);
  });
  it("første trinn: 1 måned fra 2026-09-01 nås 2026-10-01; samme dag = 0 %", () => {
    expect([pct("2026-09-01", "2026-09-01"), pct("2026-09-01", "2026-09-30"), pct("2026-09-01", "2026-10-01"), pct("2026-09-01", "2026-10-31"), pct("2026-09-01", "2026-11-01")]).toEqual([0, 0, 2, 2, 4]);
  });
  it("hele år: rundskrivets eksempel 15. januar → ett-års fradrag 15. januar året etter", () => {
    expect([pct("2025-01-15", "2026-01-14"), pct("2025-01-15", "2026-01-15")]).toEqual([18, 19]);
  });
  it("20-årsregelen: 100 % fra 1. januar i året det har gått 20 år, ikke på fødselsdagen", () => {
    const r1 = lookupDeduction(table, "2006-06-15", "2025-12-31");
    expect(r1.percent).toBe(98);
    expect(r1.twentyYearRule).toBe(false);
    const r2 = lookupDeduction(table, "2006-06-15", "2026-01-01");
    expect([r2.percent, r2.twentyYearRule]).toEqual([100, true]);
    expect(lookupDeduction(table, "2006-12-31", "2026-01-01").percent).toBe(100);
  });
  it("kortere målmåned (dag 29–31): to kandidater; ulikt trinn ⇒ ambiguous (kilden er taus)", () => {
    expect(lookupDeduction(table, "2023-01-31", "2023-02-27")).toMatchObject({ percent: 0, ambiguous: false });
    expect(lookupDeduction(table, "2023-01-31", "2023-02-28")).toMatchObject({ ambiguous: true });
    expect(lookupDeduction(table, "2023-01-31", "2023-03-01")).toMatchObject({ percent: 2, ambiguous: false });
    expect(lookupDeduction(table, "2024-02-29", "2025-02-28").ambiguous).toBe(true);
    expect(lookupDeduction(table, "2024-02-29", "2025-03-01").ambiguous).toBe(false);
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2026-01-31" }, norwegianRegistration: { date: "2026-02-28", kind: "expected" } }));
    expect(codes(r)).toEqual(["age_step_boundary_ambiguous"]);
    expect(r.status).toBe("blocked");
  });
  it("norsk registrering før første registrering kaster/ blokkeres", () => {
    expect(() => lookupDeduction(table, "2026-09-01", "2026-08-31")).toThrow();
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2026-09-01" }, norwegianRegistration: { date: "2026-08-31", kind: "expected" } })))).toContain("norwegian_registration_before_first_registration");
  });
  it("ny motorvogn (ikke registrert i utlandet): 0 % og advarsel", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "none", value: null } }));
    expect(r.ageDeduction?.percent).toBe(0);
    expect(r.warnings.map((w) => w.code)).toContain("new_vehicle_no_deduction");
  });
});

describe("registreringspresisjon (ECON-001 §4.1)", () => {
  it("bare år ⇒ blokkert; ingen 1. januar antas, ingen avgift vises", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "year", value: "2023" } }));
    expect(r.status).toBe("blocked");
    expect(codes(r)).toEqual(["registration_precision_insufficient"]);
    expect(r.totalRegistrationTaxesExact).toBeNull();
    expect(r.finalClaim).toBeNull();
    expect(r.ageDeduction).toBeNull();
  });
  it("manglende/ukjent første registrering og ugyldig verdi blokkeres", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "unknown", value: null } })))).toEqual(["first_registration_missing"]);
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "month", value: "2023-13" } })))).toEqual(["first_registration_invalid"]);
    expect(codes(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2023-02-30" } })))).toEqual(["first_registration_invalid"]);
  });
  it("måned + år ⇒ arbeidsdato første dag, bevart som avledet, med følsomhet mot siste dag", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "month", value: "2026-09" }, norwegianRegistration: { date: "2026-10-18", kind: "expected", defaulted: true } }));
    expect(r.ageDeduction).toMatchObject({ workingFirstRegistration: "2026-09-01", workingDateDerived: true, percent: 2 });
    expect(r.monthSensitivity).toMatchObject({ alternativeWorkingDate: "2026-09-30", alternativeDeductionPercent: 0 });
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["month_precision_sensitivity", "norwegian_registration_defaulted"]));
  });
  it("manglende eller ugyldig norsk registreringsdato blokkeres", () => {
    expect(codes(calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: null, kind: "expected" } })))).toContain("norwegian_registration_missing");
    expect(codes(calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-02-30", kind: "expected" } })))).toContain("norwegian_registration_invalid");
  });
});

describe("profilens gyldighet: dokumentert start/slutt er adskilt fra intern sikkerhetssperre", () => {
  it("dokumentert start 2026-01-01; ingen dokumentert slutt; intern sperre 2026-12-31 er merket som intern", () => {
    expect(NO_OTA_2026_A_PB.validFrom).toBe("2026-01-01");
    expect(NO_OTA_2026_A_PB.documentedValidTo).toBeNull();
    expect(NO_OTA_2026_A_PB.internalSafetyLimit).toMatchObject({ date: "2026-12-31", kind: "internal_guard" });
    const P = NO_OTA_2026_A_PB.parameters;
    const rules = json("rules.json").rules as Array<{ datedParameters?: Dp[] }>;
    for (const ref of [P.generalWeight.paramRef, P.combustionWeight.paramRef, P.co2ParamRef]) {
      const d = rules.flatMap((r) => r.datedParameters ?? []).find((x) => x.id === ref)!;
      expect(d.to, ref).toBeNull();
      expect(d.internalSafetyLimit, ref).toMatchObject({ date: NO_OTA_2026_A_PB.internalSafetyLimit.date, kind: "internal_guard" });
    }
    const r = calculateNorwegianVehicleTax(ice());
    expect(r.profile).toMatchObject({ documentedValidTo: null, internalSafetyLimit: { date: "2026-12-31", kind: "internal_guard" } });
  });
  it("før dokumentert start: no_profile_for_date (ikke 2026-satser)", () => {
    const r = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2025-12-31", kind: "expected" } }));
    expect(r.status).toBe("blocked");
    expect(codes(r)).toEqual(["no_profile_for_date"]);
    expect(calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-01-01", kind: "expected" } })).status).toBe("calculated_unverified");
  });
  it("etter intern sperre: egen kode og tekst som sier «ikke kildedokumentert opphørsdato»", () => {
    const ok = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-12-31", kind: "expected" } }));
    expect(ok.status).toBe("calculated_unverified");
    const r = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2027-01-01", kind: "expected" } }));
    expect(r.status).toBe("blocked");
    expect(codes(r)).toEqual(["profile_internal_limit_exceeded"]);
    expect(r.blocked[0]!.message).toMatch(/Intern sikkerhetssperre/);
    expect(r.blocked[0]!.message).toMatch(/ikke en kildedokumentert opphørsdato/);
  });
  it("en kildedokumentert sluttdato gir en annen kode enn den interne sperren", () => {
    const documented: TaxProfile = { ...NO_OTA_2026_A_PB, documentedValidTo: "2026-06-30" };
    const r = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-07-01", kind: "expected" } }), documented);
    expect(codes(r)).toEqual(["profile_not_valid_for_date"]);
    expect(r.blocked[0]!.message).toMatch(/dokumentert gyldig til 2026-06-30/);
    expect(calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-06-30", kind: "expected" } }), documented).status).toBe("calculated_unverified");
  });
  it("etter hentedatoen for den konsoliderte vedtaksteksten (2026-10-18) følger en advarsel om ukontrollerte senere endringer", () => {
    expect(NO_OTA_2026_A_PB.ratesVerifiedAsOf).toBe("2026-10-18");
    const before = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-10-18", kind: "expected" } }));
    const after = calculateNorwegianVehicleTax(ice({ norwegianRegistration: { date: "2026-10-19", kind: "expected" } }));
    expect(before.warnings.map((w) => w.code)).not.toContain("rates_verified_as_of");
    expect(after.warnings.map((w) => w.code)).toContain("rates_verified_as_of");
  });
});

describe("U-009: dag 29–31 når målmåneden er kortere — kildebelagt vs blokkert", () => {
  // Kilden (T42, T03 4.2) sier bare at steg nås på dagen kjøretøyet «fyller» alderen (15. jan → 15. jan). Vinduet [siste dag i målmåneden, 1. i neste) er ikke avgjort.
  const row = (first: string, nor: string) => {
    const l = lookupDeduction(table, first, nor);
    return { percent: l.percent, ambiguous: l.ambiguous, window: l.ambiguity };
  };
  it("31. jan → «1 måned»: 27. feb = 0 % (før begge), 28. feb = blokkert, 1. mars = 2 % (etter begge)", () => {
    expect(row("2025-01-31", "2025-02-27")).toMatchObject({ percent: 0, ambiguous: false });
    expect(row("2025-01-31", "2025-02-28")).toMatchObject({ ambiguous: true, window: { stepMonths: 1, clampedDate: "2025-02-28", rolledDate: "2025-03-01" } });
    expect(row("2025-01-31", "2025-03-01")).toMatchObject({ percent: 2, ambiguous: false });
  });
  it("31. mars → «1 måned» (30-dagersmåned): bare 30. april er uavklart", () => {
    expect([row("2025-03-31", "2025-04-29").ambiguous, row("2025-03-31", "2025-04-30").ambiguous, row("2025-03-31", "2025-05-01").ambiguous]).toEqual([false, true, false]);
  });
  it("30. mai 2023 → «9 måneder» i skuddåret 2024: 29. feb er uavklart; 29. mai 2023 har ingen overflyt der", () => {
    expect(row("2023-05-30", "2024-02-28")).toMatchObject({ ambiguous: false });
    expect(row("2023-05-30", "2024-02-29").ambiguous).toBe(true);
    expect(row("2023-05-30", "2024-03-01")).toMatchObject({ ambiguous: false, percent: 16 });
    expect(row("2023-05-29", "2024-02-29")).toMatchObject({ ambiguous: false, percent: 16 });
  });
  it("hele år: 29. feb 2024 → «1 år» finnes ikke 2025: 28. feb 2025 er uavklart, 1. mars 2025 = 19 %", () => {
    expect(row("2024-02-29", "2025-02-27")).toMatchObject({ ambiguous: false, percent: 18 });
    expect(row("2024-02-29", "2025-02-28").ambiguous).toBe(true);
    expect(row("2024-02-29", "2025-03-01")).toMatchObject({ ambiguous: false, percent: 19 });
    expect(row("2024-02-29", "2028-02-29")).toMatchObject({ ambiguous: false }); // 4 år: dagen finnes (2028 er skuddår)
  });
  it("dag 1–28 har aldri overflyt (kildebelagt dato-til-dato): 28. jan → 28. feb = nådd", () => {
    expect(row("2025-01-28", "2025-02-27")).toMatchObject({ percent: 0, ambiguous: false });
    expect(row("2025-01-28", "2025-02-28")).toMatchObject({ percent: 2, ambiguous: false });
  });
  it("motoren blokkerer (age_step_boundary_ambiguous) med detaljer og beregner aldri et trinn i vinduet", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2025-01-31" }, norwegianRegistration: { date: "2025-02-28", kind: "expected" } }), { ...NO_OTA_2026_A_PB, validFrom: "2025-01-01" });
    expect(r.status).toBe("blocked");
    expect(r.blocked[0]).toMatchObject({ code: "age_step_boundary_ambiguous", detail: { stepMonths: 1, clampedDate: "2025-02-28", rolledDate: "2025-03-01", viaMonthPrecisionAlternative: false } });
    expect(r.totalRegistrationTaxesExact).toBeNull();
    expect(r.ageDeduction).toBeNull();
  });
  it("kun måned kjent: alternativet «siste dag i måneden» kan utløse blokkering; ellers følsomhet", () => {
    const profile = { ...NO_OTA_2026_A_PB, validFrom: "2025-01-01" };
    const blocked = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "month", value: "2025-01" }, norwegianRegistration: { date: "2025-02-28", kind: "expected" } }), profile);
    expect(blocked.blocked[0]).toMatchObject({ code: "age_step_boundary_ambiguous", detail: { viaMonthPrecisionAlternative: true } });
    const ok = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "month", value: "2025-01" }, norwegianRegistration: { date: "2025-02-27", kind: "expected" } }), profile);
    expect(ok.status).toBe("calculated_unverified");
    expect(ok.monthSensitivity).toMatchObject({ alternativeWorkingDate: "2025-01-31", alternativeDeductionPercent: 0 });
  });
});

describe("implementasjonskonklusjoner er merket og skilt fra kildebelagt oppførsel", () => {
  const codesOf = (r: ReturnType<typeof calculateNorwegianVehicleTax>) => r.implementationConclusions.map((c) => c.code);
  it("dag 1–28: månedstrinn- og ingen-mellomavrunding-konklusjon; ingen overflyt-konklusjon", () => {
    const r = calculateNorwegianVehicleTax(ice());
    expect(codesOf(r)).toEqual(["month_steps_same_anniversary_rule", "no_intermediate_rounding"]);
    expect(r.implementationConclusions.every((c) => c.sourceStatus === "not_expressly_described")).toBe(true);
  });
  it("dag 29–31 utenfor vinduet beregnes, og overflyt-konklusjonen er merket (kilden beskriver ikke dag 29–31)", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2023-01-31" }, norwegianRegistration: { date: "2026-04-30", kind: "expected" } }));
    expect(r.status).toBe("calculated_unverified");
    expect(codesOf(r)).toEqual(["month_steps_same_anniversary_rule", "overflow_dates_outside_window_monotonic", "no_intermediate_rounding"]);
  });
  it("kun måned kjent: «siste dag i måneden» (dag 29–31) utløser overflyt-konklusjonen", () => {
    const r = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "month", value: "2023-01" } }));
    expect(codesOf(r)).toContain("overflow_dates_outside_window_monotonic");
  });
  it("blokkerte resultater har ingen konklusjoner; ny motorvogn bare avrundingskonklusjonen; blokkering i vinduet består", () => {
    expect(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "year", value: "2023" } })).implementationConclusions).toEqual([]);
    expect(codesOf(calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "none", value: null } })))).toEqual(["no_intermediate_rounding"]);
    const inWindow = calculateNorwegianVehicleTax(ice({ firstRegistration: { precision: "day", value: "2023-01-31" }, norwegianRegistration: { date: "2023-02-28", kind: "expected" } }), { ...NO_OTA_2026_A_PB, validFrom: "2023-01-01" });
    expect(inWindow.status).toBe("blocked");
    expect(inWindow.blocked[0]!.code).toBe("age_step_boundary_ambiguous");
  });
});

describe("PHEV: definisjon → anvendelig bestemmelse → rundskriv er koblet i evidensregisteret", () => {
  const rule = (json("rules.json").rules as Array<{ id: string; e1Findings: Array<{ source: string; locator: string }>; chain?: Record<string, string> }>).find((r) => r.id === "R-OTA-005")!;
  it("regelen er E1 og kjeden går fra teknisk vilkår via bestemmelse og forskrift til rundskriv; kravet som gjenstår er faktisk (per kjøretøy), ikke regelusikkerhet", () => {
    const r = rule as unknown as { evidenceLevel: string };
    expect(r.evidenceLevel).toBe("E1");
    expect(Object.keys(rule.chain!)).toEqual(["definition", "applicableProvision", "circular", "gap"]);
    expect(rule.chain!.definition).toMatch(/stempeldrevet forbrenningsmotor/);
    expect(rule.chain!.definition).toMatch(/trenger ikke stå/);
    expect(rule.chain!.applicableProvision).toMatch(/nr 1.*nr 2.*samme vilkår/s);
    expect(rule.chain!.circular).toMatch(/3\.3\.11/);
    expect(rule.chain!.gap).toMatch(/Ingen tekst nevner ladbar hybrid uttrykkelig/);
    expect(rule.chain!.gap).toMatch(/FAKTISK krav per kjøretøy/);
    const srcs = new Set(rule.e1Findings.map((f) => f.source));
    for (const s of ["T03", "T05", "T40", "T41", "T47"]) expect(srcs.has(s), s).toBe(true);
    expect(NO_OTA_2026_A_PB.ruleEvidence["R-OTA-005"]).toBe("E1");
  });
  it("anvendelsen følger av tekniske egenskaper, ikke av ordet PHEV eller markedsføringsnavn", () => {
    const technical = { propulsion: { pistonCombustionEngine: true, externallyChargeable: true, evidence: "type_approval" as const }, co2: { gramsPerKm: 60, method: "wltp_weighted_combined" as const } };
    const named = (label: string) => ({ ...ice(technical), marketingName: label, fuelLabel: label }) as unknown as TaxInput;
    expect(calculateNorwegianVehicleTax(named("Plug-in Hybrid"))).toEqual(calculateNorwegianVehicleTax(named("e-tron")));
    expect(calculateNorwegianVehicleTax(named("Plug-in Hybrid")).powertrain).toBe("phev");
    // uten dokumentert stempeldrevet motor/ladbarhet: ingen klassifisering, uansett navn
    expect(calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: null, externallyChargeable: true, evidence: "type_approval" } })).blocked.map((b) => b.code)).toContain("propulsion_unknown");
  });
  it("motoren behandler PHEV likt som forbrenningsmotor for vekt og CO₂, men krever «vektet kombinert»", () => {
    const base = calculateNorwegianVehicleTax(ice({ co2: { gramsPerKm: 140, method: "wltp_combined" } }));
    const phev = calculateNorwegianVehicleTax(ice({ propulsion: { pistonCombustionEngine: true, externallyChargeable: true, evidence: "type_approval" }, co2: { gramsPerKm: 140, method: "wltp_weighted_combined" } }));
    expect(phev.components).toEqual(base.components);
    expect(phev.powertrain).toBe("phev");
  });
});

describe("gyldige tilfeller er aldri «godkjent»; avrunding av sluttkravet (R-OTA-014)", () => {
  it("status er calculated_unverified, profilen ikke godkjent, åpne punkter følger resultatet", () => {
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[2]!.input);
    expect(r.status).toBe("calculated_unverified");
    expect(r.evidence).toMatchObject({ parameterEvidenceLevel: "E1P", profileApproved: false });
    expect(r.evidence!.openItems.join(" ")).toMatch(/U-012/);
    expect(r.evidence!.openItems.join(" ")).toMatch(/R-OTA-014 er E1P/);
  });
  it("vrakpant er separat, 2 400 og reduseres ikke av bruksfradrag (vedtak § 4: fradrag i avgiften etter §§ 2 og 3); oneOff + vrakpant = total", () => {
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[2]!.input);
    expect(r.scrappageDeposit).toEqual({ amountNok: 2400, ruleRef: "R-IMP-OTH-001", reducedByAgeDeduction: false });
    expect(toExactString(add(dec(r.oneOffTaxExact!), decInt(2400)))).toBe(r.totalRegistrationTaxesExact);
  });
  it("sluttkravet avrundes ned til hele kroner (§ 10-4-4); eksakte beløp og komponenter beholdes uavrundet", () => {
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[2]!.input);
    expect(r.finalClaim).toMatchObject({ ruleRef: "R-OTA-014", basis: "skattebetalingsforskriften § 10-4-4: ned til nærmeste hele krone", evidence: "E1P", oneOffTaxNok: 331323, scrappageDepositNok: 2400, totalRegistrationTaxesNok: 333723 });
    expect(r.totalRegistrationTaxesExact).toBe("333723.972");
    expect(r.components.map((c) => c.amountExact)).toEqual(["18759.96", "201760", "252800"]); // mellomledd er ikke avrundet
    expect(r.preDeductionExact).toBe("473319.96");
    expect(r.oneOffTaxExact).toBe("331323.972");
  });
  it("avrunding skjer én gang til slutt: summen av nedrundede ledd ville gitt annet svar enn nedrunding av summen", () => {
    // 18 759,96 + 201 760 + 252 800 → ledd for ledd ned: 18 759 + … = 473 319; hele summen 473 319,96 → ned 473 319; etter 30 %-fradrag: 331 323,972
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[2]!.input);
    const stepwise = (18759 + 201760 + 252800) * 70 / 100; // ville gitt 331 323,3 (ikke kilde-belagt)
    expect(stepwise).not.toBe(Number(r.oneOffTaxExact));
    expect(r.finalClaim!.oneOffTaxNok).toBe(Math.trunc(Number(r.oneOffTaxExact)));
  });
  it("heltall uten brøk forblir uendret; vrakpant (heltall) endrer ikke avrundingen: floor(avgift + 2 400) = floor(avgift) + 2 400", () => {
    const base = ice({ norwegianTaxWeight: { kg: 500, basis: "vehicle_register" }, co2: { gramsPerKm: 0, method: "wltp_combined" }, firstRegistration: { precision: "none", value: null } });
    const r = calculateNorwegianVehicleTax(base);
    expect(r.totalRegistrationTaxesExact).toBe("2400");
    expect(r.finalClaim).toMatchObject({ oneOffTaxNok: 0, totalRegistrationTaxesNok: 2400 });
    for (const g of GOLDEN_CASES) {
      const x = calculateNorwegianVehicleTax(g.input);
      expect(x.finalClaim!.totalRegistrationTaxesNok).toBe(x.finalClaim!.oneOffTaxNok + 2400);
    }
  });
  it("blokkerte resultater har ingen avrundet sluttkrav (aldri 0)", () => {
    const r = calculateNorwegianVehicleTax(ice({ norwegianTaxWeight: { kg: null, basis: "unverified" } }));
    expect(r.finalClaim).toBeNull();
    expect(r.totalRegistrationTaxesExact).toBeNull();
  });
  it("deterministisk: samme input to ganger gir identisk resultat og inputen muteres ikke", () => {
    const input = JSON.parse(JSON.stringify(GOLDEN_CASES[0]!.input)) as TaxInput;
    const snapshot = JSON.stringify(input);
    expect(calculateNorwegianVehicleTax(input)).toEqual(calculateNorwegianVehicleTax(input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("gyldne caser (validering mot offisielle verdier; ikke regelkilde)", () => {
  const EXPECTED = { "CASE-001": 529069, "CASE-002": 16748, "CASE-003": 333723 } as const;
  const EXACT = { "CASE-001": "529069.738", "CASE-002": "16748.9545", "CASE-003": "333723.972" } as const;
  it("de forventede offisielle verdiene er låst", () => {
    expect(Object.fromEntries(GOLDEN_CASES.map((c) => [c.id, c.expectedTotalNok]))).toEqual(EXPECTED);
  });
  for (const c of GOLDEN_CASES) {
    it(`${c.id} ${c.label}: eksakt desimal fra kilde-belagte regler; sluttkrav (nedrundet, § 10-4-4) = offisielt beløp`, () => {
      const r = calculateNorwegianVehicleTax(c.input);
      expect(r.status).toBe("calculated_unverified");
      expect(r.totalRegistrationTaxesExact).toBe(EXACT[c.id as keyof typeof EXACT]);
      expect(r.finalClaim!.totalRegistrationTaxesNok).toBe(c.expectedTotalNok); // VALIDERING: regelen er kilde-belagt uavhengig av casene
    });
  }
  it("komponentene: CASE-001 PHEV, CASE-002 EV (ingen 260), CASE-003 diesel", () => {
    const comp = (id: string) => Object.fromEntries(calculateNorwegianVehicleTax(GOLDEN_CASES.find((c) => c.id === id)!.input).components.map((x) => [x.id, x.amountExact]));
    expect(comp("CASE-001")).toEqual({ general_weight: "26818.1", combustion_weight: "366600", co2: "144000" });
    expect(comp("CASE-002")).toEqual({ general_weight: "21416.35" });
    expect(comp("CASE-003")).toEqual({ general_weight: "18759.96", combustion_weight: "201760", co2: "252800" });
  });
  it("bruksfradrag per case ved beregningsdato 2026-10-18: 2 %, 33 %, 30 %", () => {
    expect(GOLDEN_CASES.map((c) => calculateNorwegianVehicleTax(c.input).ageDeduction!.percent)).toEqual([2, 33, 30]);
  });
  it("avrundingsregelen er hentet fra kilder (T46 § 10-4-4 / T45), ikke fra casene: den er registrert som R-OTA-014 med kildene og leses uten referanse til casene", () => {
    const rule = (json("rules.json").rules as Array<{ id: string; sources: Array<{ id: string }>; e1Findings: Array<{ source: string; claim: string }> }>).find((r) => r.id === "R-OTA-014")!;
    expect(rule.sources.map((s) => s.id)).toEqual(expect.arrayContaining(["T46", "T45", "T49"]));
    expect(rule.e1Findings.some((f) => f.source === "T46" && /avrundes beløpet ned til nærmeste hele krone/.test(f.claim))).toBe(true);
    for (const f of rule.e1Findings) expect(f.claim, f.source).not.toMatch(/CASE-00|529 ?069|16 ?748|333 ?723/);
  });
  it("CASE-001 måned-presisjon: siste dag i september ville gitt 0 % og høyere avgift (følsomhet vist)", () => {
    const r = calculateNorwegianVehicleTax(GOLDEN_CASES[0]!.input);
    expect(r.monthSensitivity).toMatchObject({ alternativeDeductionPercent: 0, alternativeTotalRegistrationTaxesExact: "539818.1", alternativeTotalRegistrationTaxesNok: 539818 });
  });
  it("om kalkulatorkjøringen var 2026-10-01 eller 2026-11-01 (trinngrenser) endres fradragene — viser at kjøredato må dokumenteres", () => {
    const at = (c: number, d: string) => calculateNorwegianVehicleTax({ ...GOLDEN_CASES[c]!.input, norwegianRegistration: { date: d, kind: "expected" } }).ageDeduction!.percent;
    expect([at(0, "2026-09-30"), at(0, "2026-10-01"), at(0, "2026-11-01")]).toEqual([0, 2, 4]);
    expect([at(2, "2026-10-31"), at(2, "2026-11-01")]).toEqual([30, 33]);
  });
});

describe("gyldne caser: dokumentasjon mangler (ikke klasse 1); testdato er ikke kalkulatorkjøring", () => {
  it("hver case mangler kjøredato, norsk registreringsdato brukt og skjermbilder", () => {
    for (const c of GOLDEN_CASES) {
      const m = missingDocumentation(c);
      expect(m, c.id).toEqual(expect.arrayContaining(["calculatorRunDate", "norwegianRegistrationDateUsed", "inputScreenshot", "resultScreenshot", "powertrainEvidence"]));
      expect(Object.keys(c.documentation), c.id).toEqual([...DOCUMENTATION_CHECKLIST]);
      expect(c.input.norwegianRegistration).toMatchObject({ date: TEST_DATE, kind: "expected", defaulted: true });
    }
    expect(TEST_DATE).toBe("2026-10-18");
  });
  it("eksisterende dokumentasjon er ordrett fra oppdraget; fixturen inneholder ingen rekonstruert kjøredato eller input", () => {
    for (const c of GOLDEN_CASES) {
      const d = c.documented;
      expect(d.calculatorOutputNok.avgift, c.id).toBe(c.expectedTotalNok);
      expect(c.input.norwegianTaxWeight.kg, c.id).toBe(d.referenceTaxWeightKg);
      expect(c.input.firstRegistration, c.id).toEqual({ precision: "month", value: d.firstRegistrationWorkingDate.slice(0, 7) });
      if (c.input.co2.gramsPerKm !== null) expect(c.input.co2.gramsPerKm, c.id).toBe(d.co2GramsPerKm);
      expect(d.calculatorOutputNok.purchasePrice + d.calculatorOutputNok.avgift + d.calculatorOutputNok.vat, c.id).toBe(d.calculatorOutputNok.total);
      expect([c.documentation.calculatorRunDate, c.documentation.norwegianRegistrationDateUsed], c.id).toEqual(["missing", "missing"]);
      expect(Object.keys(d), c.id).not.toEqual(expect.arrayContaining(["calculatorRunDate"]));
    }
  });
  it("klasse 1 er registrert for PHEV, EV og diesel (explicit_inputs, brukerbekreftet dato); ingen er godkjenning", () => {
    const cases = json("references.json").cases as Array<{ id: string; evidenceClass: number; independentReference?: { runDate: string; runDateProvenance: string; referenceScope: string } }>;
    const c1 = cases.filter((c) => c.evidenceClass === 1);
    expect(c1.map((c) => c.id).sort()).toEqual(["C1-GR-20261018-01", "C1-GR-20261018-02", "C1-GR-20261018-03"]);
    for (const c of c1) expect(c.independentReference).toMatchObject({ runDate: "2026-10-18", runDateProvenance: "user_confirmed", referenceScope: "explicit_inputs" });
    expect(json("rules.json").foundationStatus).toMatchObject({ approvedParameters: 0 });
  });
});

describe("domenekode for avgift er uavhengig og uten float", () => {
  it("src/domain/tax importerer bare lokale filer og bruker ikke Math.round/toFixed/parseFloat", () => {
    const dir = join(ROOT, "src/domain/tax");
    for (const f of ["age-deduction", "calculate", "dates", "decimal", "index", "profile-no-2026-a", "types"]) {
      const text = readFileSync(join(dir, `${f}.ts`), "utf8");
      for (const m of text.matchAll(/from\s+["']([^"']+)["']/g)) expect(m[1]!.startsWith("."), `${f} → ${m[1]}`).toBe(true);
      // Månedsaritmetikk i dates.ts bruker heltalls-Math.floor; pengeberegning (calculate/decimal) bruker ingen Math-avrunding.
      if (["calculate", "decimal"].includes(f)) expect(text, f).not.toMatch(/Math\.(round|floor|ceil)/);
      expect(text, f).not.toMatch(/toFixed|parseFloat|Number\(\s*["'`]?\d+\.\d/);
      expect(text, f).not.toMatch(/fetch\(|process\.env|Date\.now|new Date/);
    }
  });
});
