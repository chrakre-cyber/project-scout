/**
 * ECON-003 — gyldne fixturer og aritmetikk for de tre casene.
 * A = offisiell beregningsreferanse (transport 0; observert + oppgitt); B = Merovo-scenario (egne merkede aritmetiske forventninger).
 * Testene bruker avgiftsmotoren fra ECON-002 uendret, og avrundingskonvensjonen er en FIXTURE-KONVENSJON (U-013 åpent), ikke en regel.
 */
import { describe, expect, it } from "vitest";
import { calculateNorwegianVehicleTax, NO_OTA_2026_A_PB } from "@/domain/tax";
import { ceilInt, floorInt, int, landedCost, mul, oracle, parseDec, roundHalfUp, toDecimalString, max0, sub, type VatState } from "./fixtures/econ-arithmetic";
import { ECON_CASES, FIXTURE_FX, FX_ROLES_SCENARIO, MEROVO_DEFAULT_EXPECTED, MEROVO_DEFAULT_TRANSPORT_NOK, OFFICIAL_STATED_LOCK, OPEN_ITEMS, VAT_STATES, type CaseId } from "./fixtures/econ-golden";
import { GOLDEN_CASES } from "./fixtures/tax-golden";
import { OBSERVED_RUNS, RUN_DATE } from "./fixtures/tax-calculator-observations";

const engineTotal = (c: (typeof ECON_CASES)[number]) => calculateNorwegianVehicleTax(c.golden.input);
const stated = (c: (typeof ECON_CASES)[number]) => c.golden.documented.calculatorOutputNok;
const taxOf = (c: (typeof ECON_CASES)[number]) => OFFICIAL_STATED_LOCK[c.id].avgiftNok;
const orc = (c: (typeof ECON_CASES)[number], transportNok: number) =>
  oracle({ priceEur: c.advertisedNetPriceEur, acquisitionFxRate: FIXTURE_FX.rate, customsFxRate: FIXTURE_FX.rate, transportNok, vatExemptionNok: c.vatExemptionNok, totalRegistrationTaxesNok: taxOf(c) });

describe("A. offisiell beregningsreferanse: fixturene gjenbruker eksisterende data og låser de oppgitte verdiene", () => {
  it("de tre casene gjenbruker GOLDEN_CASES og OBSERVED_RUNS (ingen kopierte sannheter)", () => {
    expect(ECON_CASES.map((c) => c.golden)).toEqual(GOLDEN_CASES);
    expect(ECON_CASES.map((c) => c.observedRun)).toEqual(OBSERVED_RUNS);
    expect(ECON_CASES.map((c) => [c.id, c.observedRun.id])).toEqual([["CASE-001", "GR-20261018-01"], ["CASE-002", "GR-20261018-02"], ["CASE-003", "GR-20261018-03"]]);
  });

  it("LÅS: oppgitte offisielle verdier (kjøpesum, mva., avgift inkl. vrakpant, total) er uendret — testen feiler hvis noen endrer dem", () => {
    for (const c of ECON_CASES) {
      const l = OFFICIAL_STATED_LOCK[c.id];
      expect(stated(c), c.id).toEqual({ avgift: l.avgiftNok, purchasePrice: l.purchaseNok, vat: l.vatNok, total: l.totalNok });
      expect(c.golden.expectedTotalNok, c.id).toBe(l.avgiftNok);
      expect(c.observedRun.expectedTotalNok, c.id).toBe(l.avgiftNok);
      expect(l.oneOffNok + l.scrappageNok, c.id).toBe(l.avgiftNok); // D5: «Avgift» inkluderer vrakpant 2 400
    }
  });

  it("oppgitte verdier er merket som udokumenterte; ingen kjøretøydata har verified-status", () => {
    for (const c of ECON_CASES) {
      expect(c.officialStatedProvenance).toBe("stated_not_documented");
      expect(c.vehicleData.status).toBe("unverified_test_input");
      expect(JSON.stringify(c)).not.toMatch(/"verified"\s*:\s*true/);
    }
  });

  it("A1 aritmetikk: kjøpesum = EUR × fixturekurs, mva. = 25 % av grunnlag (EV minus 300 000), total = kjøpesum + avgift + mva. — alt lik de oppgitte verdiene", () => {
    for (const c of ECON_CASES) {
      const o = orc(c, 0);
      const s = stated(c);
      expect(o.ruling.acquisitionUsedNok, c.id).toBe(s.purchasePrice);
      expect(o.ruling.importVatNok, c.id).toBe(s.vat);
      expect(o.ruling.importCashRequirementNok, c.id).toBe(s.total); // transport 0 ⇒ A-total = kontantbehov uten Merovo-standarder
      expect(o.ties, c.id).toEqual([]);
    }
  });

  it("råverdiene før avrunding er dokumentert (mva.-avrunding er åpent: U-013) og likhetstilfeller (x,5) forekommer ikke", () => {
    const raw = ECON_CASES.map((c) => ({ id: c.id, purchase: toDecimalString(orc(c, 0).raw.purchaseAcq), vat: toDecimalString(orc(c, 0).raw.vat, 2) }));
    expect(raw).toEqual([
      { id: "CASE-001", purchase: "2689248.2053", vat: "672312.00" },
      { id: "CASE-002", purchase: "366662.7949", vat: "16665.75" },
      { id: "CASE-003", purchase: "411491.2458", vat: "102872.75" },
    ]);
    expect(OPEN_ITEMS["U-013"]).toMatch(/FIXTURE-KONVENSJON/);
  });

  it("andre avrundingskonvensjoner stemmer IKKE med de oppgitte verdiene (dokumentert, ikke brukt til å justere forventninger)", () => {
    const eurRate = (eur: number) => mul(int(eur), parseDec(FIXTURE_FX.rate));
    expect(floorInt(eurRate(34361))).not.toBe(BigInt(OFFICIAL_STATED_LOCK["CASE-002"].purchaseNok)); // 366 662 ≠ 366 663: «ned» utelukket
    expect(ceilInt(eurRate(38562))).not.toBe(BigInt(OFFICIAL_STATED_LOCK["CASE-003"].purchaseNok)); // 411 492 ≠ 411 491: «opp» utelukket
    const vat003 = mul({ n: 25n, d: 100n }, int(OFFICIAL_STATED_LOCK["CASE-003"].purchaseNok));
    expect(floorInt(vat003)).not.toBe(BigInt(OFFICIAL_STATED_LOCK["CASE-003"].vatNok)); // 102 872 ≠ 102 873
    expect(roundHalfUp(vat003).value).toBe(BigInt(OFFICIAL_STATED_LOCK["CASE-003"].vatNok));
    // Valget half-up vs half-even avgjøres ikke av disse dataene (ingen likhet): U-013 forblir åpent.
  });

  it("avgiftsmotoren (ECON-002, uendret) gir de oppgitte avgiftstotalene og delingen; resultatet er estimat fordi vekten er udokumentert forhandleroppgitt testinput", () => {
    for (const c of ECON_CASES) {
      const r = engineTotal(c);
      expect(r.finalClaim?.totalRegistrationTaxesNok, c.id).toBe(OFFICIAL_STATED_LOCK[c.id].avgiftNok);
      expect(r.finalClaim?.oneOffTaxNok, c.id).toBe(OFFICIAL_STATED_LOCK[c.id].oneOffNok);
      expect(r.finalClaim?.scrappageDepositNok, c.id).toBe(OFFICIAL_STATED_LOCK[c.id].scrappageNok);
      expect(r.status, c.id).toBe("calculated_unverified");
      expect(r.validation, c.id).toMatchObject({ status: "estimate_not_approved", inputResolution: "estimate" });
      expect(r.validation?.estimateReasons, c.id).toContain("weight_dealer_entered_undocumented");
      expect(r.profile?.id ?? NO_OTA_2026_A_PB.id, c.id).toBe(NO_OTA_2026_A_PB.id);
    }
  });
});

describe("A. dokumenterte kalkulatorobservasjoner: prisversjoner, brukerbekreftet dato og sumidentitet", () => {
  it("prisversjonene er separate og uendret (PHEV 600 000/2 600 000, EV 350 000/300 000, diesel 350 000); dato 18.10.2026 er den brukerbekreftede kjøredatoen", () => {
    expect(RUN_DATE).toBe("2026-10-18");
    expect(OBSERVED_RUNS.map((r) => r.versions.map((v) => v.priceNok))).toEqual([[600000, 2600000], [350000, 300000], [350000]]);
    expect(OBSERVED_RUNS.map((r) => r.input.norwegianRegistration.date)).toEqual(["2026-10-18", "2026-10-18", "2026-10-18"]);
    // nedbrytningsbildene med andre priser har ikke fullt inputbilde og kobles ikke til input-/resultatsettet
    for (const r of OBSERVED_RUNS) for (const v of r.versions) if (v.priceNok !== r.versions[0]!.priceNok) expect(v.fullInputDocumented, `${r.id}/${v.priceNok}`).toBe(false);
  });

  it("observert sumidentitet: avgift + innkjøpspris + mva. = sum, og mva. = 25 % av pris (EV: over 300 000) uten avrunding i observasjonene", () => {
    for (const run of OBSERVED_RUNS) {
      const exemption = run.id === "GR-20261018-02" ? 300000 : 0;
      for (const v of run.versions) {
        const sum = parseDec(v.totalAvgift).n / parseDec(v.totalAvgift).d + BigInt(v.priceNok) + parseDec(v.vat).n / parseDec(v.vat).d;
        expect(sum, `${run.id}/${v.priceNok}`).toBe(parseDec(v.sum).n / parseDec(v.sum).d);
        const vatRaw = mul({ n: 25n, d: 100n }, max0(sub(int(v.priceNok), int(exemption))));
        expect(vatRaw.d, `${run.id}/${v.priceNok}: mva. er et helt tall ⇒ ingen avrunding (U-013 berøres ikke)`).toBe(1n);
        expect(vatRaw.n, `${run.id}/${v.priceNok}`).toBe(parseDec(v.vat).n / parseDec(v.vat).d);
      }
    }
  });

  it("observasjonenes avgift er uavhengig av prisversjonen og lik motorens sluttkrav (estimat) — men prisuavhengighet brukes ikke som regelbelegg", () => {
    for (const run of OBSERVED_RUNS) {
      const totals = new Set(run.versions.map((v) => v.totalAvgift));
      expect(totals.size, run.id).toBe(1);
      expect(calculateNorwegianVehicleTax(run.input).finalClaim?.totalRegistrationTaxesNok, run.id).toBe(run.expectedTotalNok);
    }
  });

  it("antakelser og brukerbekreftede opplysninger er bevart i fixturen (CO₂-metode er motorantakelse; elbil har ingen observert CO₂)", () => {
    const [phev, ev] = [OBSERVED_RUNS[0]!, OBSERVED_RUNS[1]!];
    expect(phev.assumptions.join(" ")).toMatch(/vektet kombinert/);
    expect(ev.assumptions.join(" ")).toMatch(/IKKE observert/);
    expect(Object.keys(ev.observedInputs)).not.toContain("CO2-utslipp");
  });
});

describe("B. Merovo-scenario: transport, kontantbehov og økonomisk kost (aritmetiske forventninger, ikke offisielle referanser)", () => {
  it("transport 8 000 er assumed-default; forventningene (ECON-001 §7.B) stemmer med uavhengig aritmetikk for alle tre casene og tilstander", () => {
    expect(MEROVO_DEFAULT_TRANSPORT_NOK).toBe(8000);
    for (const c of ECON_CASES) {
      const e = MEROVO_DEFAULT_EXPECTED[c.id as CaseId];
      const o = orc(c, MEROVO_DEFAULT_TRANSPORT_NOK);
      expect(o.ruling.customsValueNok, c.id).toBe(e.customsValueNok);
      expect(o.ruling.importVatNok, c.id).toBe(e.importVatNok);
      expect(o.ruling.totalRegistrationTaxesNok, c.id).toBe(e.totalRegistrationTaxesNok);
      expect(o.ruling.importCashRequirementNok, c.id).toBe(e.importCashRequirementNok);
      expect(landedCost(o.ruling, 8000, "recoverable"), c.id).toEqual({ status: "calculated", valueNok: e.landedRecoverableNok });
      expect(landedCost(o.ruling, 8000, "non_recoverable"), c.id).toEqual({ status: "calculated", valueNok: e.landedNonRecoverableNok });
      expect(o.ties, c.id).toEqual([]);
    }
  });

  it("kontantbehov er uavhengig av mva.-tilstanden; `unknown` gir ingen oppdiktet enkeltkost, bare to merkede scenarier; mva.-beløpet står separat", () => {
    for (const c of ECON_CASES) {
      const o = orc(c, 8000);
      const results = VAT_STATES.map((s: VatState) => landedCost(o.ruling, 8000, s));
      const [rec, non, unk] = results;
      expect(rec).toMatchObject({ status: "calculated" });
      expect(non).toMatchObject({ status: "calculated" });
      expect(unk).toEqual({ status: "unresolved_vat", valueNok: null, scenarios: { if_recoverable: (rec as { valueNok: number }).valueNok, if_non_recoverable: (non as { valueNok: number }).valueNok } });
      expect((non as { valueNok: number }).valueNok, c.id).toBe(o.ruling.importCashRequirementNok); // non_recoverable = kontantbehov når ingen andre fradrag
      expect((rec as { valueNok: number }).valueNok + o.ruling.importVatNok, c.id).toBe((non as { valueNok: number }).valueNok);
      expect(o.ruling.importVatNok, c.id).toBeGreaterThan(0); // vises som egen linje
    }
  });

  it("A → B: 8 000 i transport gir +10 000 kontantbehov (8 000 + 25 %), +8 000 økonomisk kost ved recoverable, +10 000 ved non_recoverable; transport 0 reproduserer offisiell total", () => {
    for (const c of ECON_CASES) {
      const a = orc(c, 0), b = orc(c, 8000);
      expect(a.ruling.importCashRequirementNok, c.id).toBe(stated(c).total);
      expect(b.ruling.importCashRequirementNok - a.ruling.importCashRequirementNok, c.id).toBe(10000);
      const aRec = landedCost(a.ruling, 0, "recoverable"), bRec = landedCost(b.ruling, 8000, "recoverable");
      expect((bRec as { valueNok: number }).valueNok - (aRec as { valueNok: number }).valueNok, c.id).toBe(8000);
      expect((aRec as { valueNok: number }).valueNok, c.id).toBe(stated(c).total - stated(c).vat); // offisiell total − offisiell mva.
      const aNon = landedCost(a.ruling, 0, "non_recoverable"), bNon = landedCost(b.ruling, 8000, "non_recoverable");
      expect((bNon as { valueNok: number }).valueNok - (aNon as { valueNok: number }).valueNok, c.id).toBe(10000);
    }
  });

  it("B endrer ikke A: A-verdiene og de gjenbrukte fixturene er uendret etter å ha kjørt scenarioene", () => {
    const before = JSON.stringify([ECON_CASES.map((c) => stated(c)), OFFICIAL_STATED_LOCK]);
    for (const c of ECON_CASES) { orc(c, 8000); orc(c, 15000); }
    expect(JSON.stringify([ECON_CASES.map((c) => stated(c)), OFFICIAL_STATED_LOCK])).toBe(before);
  });

  it("dealer-overstyrt transport (15 000): samme regler, annen delta; transport er aldri skjult i A", () => {
    for (const c of ECON_CASES) {
      const a = orc(c, 0), b = orc(c, 15000);
      expect(b.ruling.importCashRequirementNok - a.ruling.importCashRequirementNok, c.id).toBe(18750); // 15 000 + 25 % × 15 000 = 18 750 (ingen avrunding)
    }
  });

  it("CASE-002 er betinget av elbilens 300 000-fritak (R-IMP-VAT-003, anvendelse uavklart): fritaket er antatt, ikke bekreftet, og effekten er synlig", () => {
    const c = ECON_CASES[1]!;
    expect(c.vatExemptionStatus).toBe("assumed_application_open");
    expect(OPEN_ITEMS["R-IMP-VAT-003"]).toMatch(/uavklart/);
    const withExemption = orc(c, 8000).ruling.importVatNok;
    const withoutExemption = oracle({ priceEur: c.advertisedNetPriceEur, acquisitionFxRate: FIXTURE_FX.rate, customsFxRate: FIXTURE_FX.rate, transportNok: 8000, vatExemptionNok: 0, totalRegistrationTaxesNok: taxOf(c) }).ruling.importVatNok;
    expect(withExemption).toBe(18666);
    expect(withoutExemption).toBe(93666); // 25 % × 374 663 = 93 665,75
    expect(ECON_CASES.filter((x) => x.vatExemptionStatus !== "not_applicable").map((x) => x.id)).toEqual(["CASE-002"]);
  });

  it("kurs-roller: anskaffelseskurs og tollkurs er adskilte; fixturekursen er testinput (ikke offisiell); tollkursen påvirker mva.-grunnlaget, ikke kjøpesummen", () => {
    expect(FIXTURE_FX).toMatchObject({ basis: "fixture", fixtureOnly: true, status: "test_input_not_official_rate" });
    const s = FX_ROLES_SCENARIO;
    expect(s.customsFxStatus).toBe("synthetic_test_assumption");
    const c = ECON_CASES.find((x) => x.id === s.caseId)!;
    const o = oracle({ priceEur: c.advertisedNetPriceEur, acquisitionFxRate: s.acquisitionFxRate, customsFxRate: s.customsFxRate, transportNok: s.transportNok, vatExemptionNok: 0, totalRegistrationTaxesNok: taxOf(c) });
    expect(o.ruling).toEqual({ acquisitionUsedNok: s.expected.acquisitionUsedNok, customsValueNok: s.expected.customsValueNok, importVatNok: s.expected.importVatNok, totalRegistrationTaxesNok: s.expected.totalRegistrationTaxesNok, importCashRequirementNok: s.expected.importCashRequirementNok });
    expect(landedCost(o.ruling, s.transportNok, "recoverable")).toEqual({ status: "calculated", valueNok: s.expected.landedRecoverableNok });
    expect(landedCost(o.ruling, s.transportNok, "non_recoverable")).toEqual({ status: "calculated", valueNok: s.expected.landedNonRecoverableNok });
    // kjøpesummen følger anskaffelseskursen; mva.-grunnlaget følger tollkursen
    expect(o.ruling.acquisitionUsedNok).toBe(MEROVO_DEFAULT_EXPECTED["CASE-003"].customsValueNok - 8000);
    expect(o.ruling.customsValueNok).not.toBe(MEROVO_DEFAULT_EXPECTED["CASE-003"].customsValueNok);
    expect(o.ties).toEqual([]);
  });

  it("avgiften i B kommer fra de oppgitte/engine-verdiene og er estimat når inputene bruker udokumentert forhandlervekt (aldri approved)", () => {
    for (const c of ECON_CASES) {
      const r = engineTotal(c);
      expect(r.finalClaim?.totalRegistrationTaxesNok, c.id).toBe(MEROVO_DEFAULT_EXPECTED[c.id as CaseId].totalRegistrationTaxesNok);
      expect(r.validation?.status, c.id).toBe("estimate_not_approved");
    }
  });

  it("åpne punkter fremgår uttrykkelig i fixturene (ikke skjult ved å tilpasse forventninger): U-013, U-003, U-008, R-IMP-VAT-003, R-IMP-VAT-002, R-DED-001", () => {
    expect(Object.keys(OPEN_ITEMS).sort()).toEqual(["R-DED-001", "R-IMP-VAT-002", "R-IMP-VAT-003", "U-003", "U-008", "U-013"]);
    expect(OPEN_ITEMS["U-003"]).toMatch(/ECON-004/);
    expect(OPEN_ITEMS["U-008"]).toMatch(/ECON-004/);
    expect(OPEN_ITEMS["U-013"]).toMatch(/ECON-004/);
  });
});
