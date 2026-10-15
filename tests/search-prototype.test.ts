/**
 * SEARCH-001A-UI: logikken bak forhåndsvisningen (prototypes/merovo-search). Prioriterer feil som kan endre brukerens søk,
 * miste et utkast eller gi feil budsjettgrense. Forventede beløp er regnet ut for hånd, uavhengig av implementasjonen.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
/* eslint-disable @typescript-eslint/no-explicit-any */
const L: any = require("../prototypes/merovo-search/js/logic.js");
const D: any = require("../prototypes/merovo-search/js/data.js");
const NOW = new Date("2026-10-15T10:00:00Z");

const limit = (amount: string, pct: string) => L.fmtMinor(L.maxAllowedMinor(L.parseMoney(amount).minor, L.parsePercentBp(pct).bp)).replace(/ /g, " ");

describe("budsjettgrense (heltall i øre og basispunkter)", () => {
  it.each([
    ["750 000", "10", "825 000 kr"], // 750 000 × 1,10
    ["750 000", "0", "750 000 kr"],
    ["750 000", "100", "1 500 000 kr"],
    ["750 000,50", "10", "825 000,55 kr"], // 75 000 050 øre × 1,1 = 82 500 055 øre (eksakt)
    ["100,01", "12,34", "112,35 kr"], // 100,01 × 1,1234 = 112,351234 → rundes NED til 112,35
    ["999,99", "0,01", "1 000,08 kr"], // 999,99 × 1,0001 = 1000,089999 → 1000,08 (ikke 1000,09)
    ["1 234 567,89", "7,5", "1 327 160,48 kr"], // 123 456 789 øre × 1,075 = 132 716 048,175 → 132 716 048
  ])("%s + %s %% → %s", (amount, pct, expected) => {
    expect(limit(amount, pct)).toBe(expected);
  });

  it("grensen er eksakt i øre: ett øre under/over 825 000 kr", () => {
    const lim = L.maxAllowedMinor(75_000_000n, 1000n);
    expect(lim).toBe(82_500_000n);
    expect(82_499_999n <= lim).toBe(true);
    expect(82_500_001n <= lim).toBe(false);
  });

  it("er uavhengig av flyttall: brøkøre slipper aldri en bil inn over grensen", () => {
    for (let cents = 1n; cents < 5000n; cents += 37n) {
      for (const bp of [1n, 7n, 250n, 999n, 1234n, 9999n]) {
        const exact = cents * (10000n + bp); // teller; tillatt = floor(exact / 10000)
        const got = L.maxAllowedMinor(cents, bp);
        expect(got * 10000n <= exact).toBe(true);
        expect((got + 1n) * 10000n > exact).toBe(true);
      }
    }
  });
});

describe("tallparsing (norske formater)", () => {
  it.each([
    ["750 000", 75_000_000n], ["750 000", 75_000_000n], ["750000", 75_000_000n], ["750.000", 75_000_000n],
    ["750 000,5", 75_000_050n], ["750 000,50", 75_000_050n], ["0,01", 1n], ["1.234.567,89", 123_456_789n],
  ])("godtar %j", (input, minor) => {
    expect(L.parseMoney(input).minor).toBe(minor);
  });

  it.each([
    ["-5", /negative/i], ["−5", /negative/i], ["+5", /plusstegn/], ["abc", /Ugyldig tall/], ["1,234", /Maks 2 desimaler/],
    ["1.5", /komma som desimaltegn/], ["1 2345", /Ugyldig tall/], ["7,50,0", /Ugyldig tall/], ["0", /større enn 0/], ["1e6", /Ugyldig tall/],
    ["2 000 000 000", /for høyt/],
  ])("avviser %j", (input, msg) => {
    expect(L.parseMoney(input).error).toMatch(msg);
  });

  it("tomt er ukjent, og 0 er et uttrykkelig valg når det er tillatt (kostnader)", () => {
    expect(L.parseMoney("").empty).toBe(true);
    expect(L.parseMoney("  ").empty).toBe(true);
    expect(L.parseMoney("0", { allowZero: true }).minor).toBe(0n);
    expect(L.parseMoney("0,00", { allowZero: true }).minor).toBe(0n);
  });

  it.each([["10", 1000n], ["10,5", 1050n], ["10.5", 1050n], ["10,25", 1025n], ["0", 0n], ["100", 10000n], ["0,01", 1n]])("prosent %j → %s bp", (input, bp) => {
    expect(L.parsePercentBp(input).bp).toBe(bp);
  });
  it.each([["100,01"], ["101"], ["-1"], ["10,555"], ["abc"], ["1 0"]])("avviser prosent %j", (input) => {
    expect(L.parsePercentBp(input).error).toBeTruthy();
  });

  it("heltall: ingen desimaler og grenser", () => {
    expect(L.parseIntBounded("150 000", 1, 2_000_000).value).toBe(150000);
    expect(L.parseIntBounded("1,5", 1, 10).error).toMatch(/helt tall/);
    expect(L.parseIntBounded("0", 1, 10).error).toMatch(/mellom/);
  });
});

describe("intervaller og enheter", () => {
  const withRange = (id: string, from: string, to: string) => {
    const s = L.emptyState();
    s.values[id] = { from, to };
    return L.validate(s)[id];
  };
  it("motstridende fra–til gir feil; lik verdi er eksakt og gyldig", () => {
    expect(withRange("modelYear", "2023", "2021").to).toMatch(/mindre enn/);
    expect(withRange("modelYear", "2021", "2021")).toBeUndefined();
    expect(withRange("seats", "7", "7")).toBeUndefined();
    expect(withRange("seats", "8", "7").to).toBeTruthy();
    expect(withRange("modelYear", "1800", "").from).toMatch(/mellom/);
  });
  it("førstegangsregistrering beholder kildens presisjon (år/måned) og sammenligner riktig", () => {
    expect(withRange("firstReg", "2021", "2021-06")).toBeUndefined(); // «til 2021» uten måned = hele året
    expect(withRange("firstReg", "2021-01", "2021")).toBeUndefined();
    expect(withRange("firstReg", "2021-06", "2021")).toBeUndefined(); // «til 2021» = til og med desember 2021
    expect(withRange("firstReg", "2021-07", "2021-06").to).toBeTruthy();
    expect(withRange("firstReg", "2021", "2020-12").to).toBeTruthy();
    expect(withRange("firstReg", "2021-13", "").from).toMatch(/01–12/);
    expect(withRange("firstReg", "21", "").from).toBeTruthy();
  });
  it("modellår og registreringsår er separate felt", () => {
    const s = L.emptyState();
    s.values.modelYear = { from: "2021", to: "" };
    const sum = L.summarize(s).criteria.map((c: any) => c.id);
    expect(sum).toEqual(["modelYear"]);
  });
  it("hk ↔ kW: 1 hk = 0,73549875 kW, tapsfritt via kanonisk watt", () => {
    expect(L.hpToW(300)).toBe(220_650); // 300 × 735,49875 = 220 649,625 → 220 650
    expect(L.wToKw(L.hpToW(300))).toBe(221);
    expect(L.kwToW(221)).toBe(221_000);
    for (let hp = 1; hp <= 1500; hp++) expect(L.wToHp(L.hpToW(hp))).toBe(hp);
    for (let kw = 1; kw <= 1100; kw++) expect(L.wToKw(L.kwToW(kw))).toBe(kw);
  });
});

describe("krav og ønsker (OG / ELLER)", () => {
  it("flere farger er ELLER; ulike krav og må-ha gjelder samtidig; ønsker er egen gruppe", () => {
    const s = L.exampleState();
    const sum = L.summarize(s);
    expect(sum.criteria.find((c: any) => c.id === "extColor").text).toBe("Svart ELLER Hvit");
    expect(sum.must.map((m: any) => m.label).sort()).toEqual(["360-kamera", "Apple CarPlay"]);
    expect(sum.nice.map((m: any) => m.label).sort()).toEqual(["Luftfjæring", "Panoramatak", "Setevarme foran"]);
  });
  it("å fjerne et element fjerner bare det", () => {
    const s = L.exampleState();
    const before = L.summarize(s);
    before.must.find((m: any) => m.id === "camera_360").clear(s);
    expect(s.eq.camera_360).toBeUndefined();
    expect(s.eq.carplay).toBe("must");
    before.criteria.find((c: any) => c.id === "extColor").clear(s);
    expect(s.values.extColor).toEqual([]);
    expect(s.values.seats).toEqual({ from: "7", to: "7" });
  });
  it("hengerfeste, cruise og klima følger samme må-ha/ønskelig-regel", () => {
    const s = L.emptyState();
    s.values.towbar = "swivel_only";
    s.eq.towbar = "nice";
    s.values.cruise = "adaptive";
    const sum = L.summarize(s);
    expect(sum.nice.map((x: any) => x.text)).toEqual(["Bare svingbart"]);
    expect(sum.must.map((x: any) => x.text)).toEqual(["Bare adaptiv cruisekontroll"]);
  });
  it("prisavvik påvirker ikke bilkrav: bilkrav finnes uavhengig av budsjett", () => {
    const s = L.exampleState();
    s.budget.deviationOn = false;
    expect(L.summarize(s).criteria.length).toBe(L.summarize(L.exampleState()).criteria.length);
    expect(L.budgetLimit(s.budget).limitMinor).toBe(75_000_000n);
  });
});

describe("modellavhengige valg", () => {
  it("modellbytte fjerner variant/pakker som ikke hører til og behåller de som gjør det", () => {
    const s = L.emptyState();
    Object.assign(s.values, { brand: "mercedes-benz", model: "gls", variant: "GLS 450 4MATIC", packages: ["AMG Line", "Premium Plus-pakke"] });
    s.values.model = "gle";
    const removed = L.reconcileModelDependent(s);
    expect(removed.variant).toBe("GLS 450 4MATIC");
    expect(removed.packages).toEqual(["Premium Plus-pakke"]);
    expect(s.values.packages).toEqual(["AMG Line"]);
    expect(s.values.variant).toBe("");
  });
  it("variant uten modell og modell uten merke er feil", () => {
    const s = L.emptyState();
    s.values.variant = "AMG Line";
    expect(L.validate(s).variant.value).toMatch(/krever valgt modell/);
    s.values.model = "gls";
    expect(L.validate(s).model.value).toMatch(/krever valgt merke/);
  });
  it("å tømme merke tømmer modell, variant og pakker", () => {
    const s = L.exampleState();
    s.values.variant = "GLS 450 4MATIC";
    L.clearField(s, "brand");
    expect([s.values.model, s.values.variant, s.values.packages]).toEqual(["", "", []]);
  });
});

describe("kostnadslinjer", () => {
  it("tomt er ukjent, 0 er uttrykkelig, ugyldig og negativt avvises, egen linje trenger navn", () => {
    const s = L.emptyState();
    const [transport, travel] = s.budget.costs;
    transport.amount = "0";
    travel.amount = "-100";
    const custom = L.newCost("", "");
    custom.amount = "1 500";
    s.budget.costs.push(custom);
    const e = L.validate(s);
    expect(e["cost.transport"]).toBeUndefined();
    expect(e["cost.travel"].amount).toMatch(/negative/i);
    expect(e["cost." + custom.id].label).toMatch(/navn/);
  });
  it("kostnader endrer aldri budsjettgrensen", () => {
    const s = L.exampleState();
    const base = L.budgetLimit(s.budget).limitMinor;
    s.budget.costs[0].amount = "50 000";
    s.budget.costs[0].included = true;
    expect(L.budgetLimit(s.budget).limitMinor).toBe(base);
  });
  it("prisavvik uten budsjett eller uten prosent er feil", () => {
    const s = L.emptyState();
    s.budget.deviationOn = true;
    expect(L.validate(s)["budget.deviation"].value).toMatch(/prosent/);
    s.budget.deviation = "10";
    expect(L.validate(s)["budget.amount"].value).toMatch(/krever et budsjett/);
  });
});

describe("eksport og import", () => {
  const build = () => {
    const s = L.exampleState();
    s.values.mileage = "150 000";
    s.values.power = { unit: "hp", from: "300", to: "", fromW: L.hpToW(300), toW: null };
    s.values.weight = { type: "gross", max: "3 500" };
    s.values.consumption = { unit: "l100", max: "9,5" };
    s.values.firstReg = { from: "2021-03", to: "" };
    s.values.freeText = "Skal ha <b>trekk</b> & \"hengerfeste\"";
    s.budget.costs[0].amount = "0";
    s.budget.costs[1].amount = "12 500,50";
    s.budget.costs[1].currency = "EUR";
    s.budget.costs[1].vat = "excl";
    const c = L.newCost("Tollagring <script>alert(1)</script>", "");
    c.amount = "2 000";
    c.included = true;
    s.budget.costs.push(c);
    return s;
  };

  it("eksport har eksplisitte enheter, basispunkter, minste enhet og skiller 0 fra ukjent", () => {
    const r = L.exportDraft(build(), NOW);
    expect(r.ok).toBe(true);
    const d = r.draft;
    expect(d).toMatchObject({ schema: "merovo.search-draft", schemaVersion: 1, origin: "demo-example" });
    expect(d.criteria.mileage).toEqual({ value: 150000, unit: "km", bound: "max" });
    expect(d.criteria.power).toEqual({ unit: "hk", from: 300, to: null, approxKw: { from: 221, to: null } });
    expect(d.criteria.weight).toEqual({ type: "gross", max: 3500, unit: "kg" });
    expect(d.criteria.consumption).toEqual({ unit: "l100", max: "9.5", perUnit: "100 km" });
    expect(d.criteria.firstReg).toEqual({ from: "2021-03", to: null, format: "ÅÅÅÅ[-MM]" });
    expect(d.budget.maxPurchaseCost).toEqual({ amountMinor: "75000000", currency: "NOK" });
    expect(d.budget.deviation).toEqual({ enabled: true, basisPoints: 1000, maxAllowed: { amountMinor: "82500000", currency: "NOK" } });
    const [transport, travel, insurance] = d.budget.costs;
    expect(transport.amount).toEqual({ amountMinor: "0", currency: "NOK" }); // uttrykkelig 0
    expect(travel.amount).toEqual({ amountMinor: "1250050", currency: "EUR" });
    expect(insurance.amount).toBeNull(); // ukjent
    expect(d.equipment.camera_360).toEqual({ priority: "must" });
    expect(JSON.stringify(d)).not.toMatch(/salgspris|margin|retail/i);
  });

  it("rundtur: import(eksport) gir samme eksport (samme meningsinnhold)", () => {
    const first = L.exportDraft(build(), NOW).draft;
    const imp = L.importDraft(JSON.stringify(first));
    expect(imp.ok).toBe(true);
    const second = L.exportDraft(imp.state, NOW).draft;
    expect(second).toEqual(first);
    expect(imp.state.values.freeText).toBe("Skal ha <b>trekk</b> & \"hengerfeste\"");
    expect(imp.state.budget.costs.at(-1).label).toBe("Tollagring <script>alert(1)</script>");
  });

  it("prisavvik av: ingen prosent i eksport, og import beholder av", () => {
    const s = build();
    s.budget.deviationOn = false;
    const d = L.exportDraft(s, NOW).draft;
    expect(d.budget.deviation).toEqual({ enabled: false, basisPoints: null, maxAllowed: null });
    expect(L.importDraft(JSON.stringify(d)).state.budget.deviationOn).toBe(false);
  });

  it("eksport stoppes når utkastet har feil", () => {
    const s = build();
    s.budget.amount = "-5";
    expect(L.exportDraft(s, NOW).ok).toBe(false);
  });

  const valid = () => L.exportDraft(L.exampleState(), NOW).draft;
  const tweak = (fn: (d: any) => void) => {
    const d = valid();
    fn(d);
    return L.importDraft(JSON.stringify(d));
  };

  it("avviser ukjent schema-versjon, feil schema, ugyldig JSON og ikke-objekt med forståelige feil", () => {
    expect(tweak((d) => { d.schemaVersion = 2; }).errors[0]).toMatch(/Ukjent schema-versjon: 2/);
    expect(tweak((d) => { d.schema = "annet"; }).errors[0]).toMatch(/ikke et Merovo-søkeutkast/);
    expect(L.importDraft("{ikke json").errors[0]).toMatch(/ikke gyldig JSON/);
    expect(L.importDraft("[]").errors[0]).toMatch(/JSON-objekt/);
    expect(L.importDraft("null").errors[0]).toMatch(/JSON-objekt/);
    expect(L.importDraft("x".repeat(D.LIMITS.importBytes + 1)).errors[0]).toMatch(/for stor/);
  });
  it("avviser ukjente felt, ukjente nøkler og ugyldige verdier (alt eller ingenting)", () => {
    expect(tweak((d) => { d.criteria.hacked = "x"; }).ok).toBe(false);
    expect(tweak((d) => { d.extra = 1; }).errors.join()).toMatch(/Ukjent toppnivånøkkel/);
    expect(tweak((d) => { d.criteria.modelYear.from = 1800; }).ok).toBe(false);
    expect(tweak((d) => { d.criteria.modelYear.unit = "km"; }).ok).toBe(false);
    expect(tweak((d) => { d.criteria.extColor = ["rosa"]; }).ok).toBe(false);
    expect(tweak((d) => { d.criteria.seats = { from: 9, to: 7, unit: "seter" }; }).ok).toBe(false);
    expect(tweak((d) => { d.criteria.brand = "ukjent-merke"; }).ok).toBe(false);
    expect(tweak((d) => { d.equipment.camera_360 = { priority: "kanskje" }; }).ok).toBe(false);
    expect(tweak((d) => { d.equipment.finnes_ikke = { priority: "must" }; }).ok).toBe(false);
    expect(tweak((d) => { d.equipment.towbar = { priority: "must" }; }).errors.join()).toMatch(/uten valgt verdi/);
    expect(tweak((d) => { d.budget.maxPurchaseCost.amountMinor = "-5"; }).ok).toBe(false);
    expect(tweak((d) => { d.budget.maxPurchaseCost.currency = "EUR"; }).ok).toBe(false);
    expect(tweak((d) => { d.budget.deviation.basisPoints = 10001; }).ok).toBe(false);
    expect(tweak((d) => { d.budget.costs[0].amount = { amountMinor: "100", currency: "XXX" }; }).ok).toBe(false);
    expect(tweak((d) => { d.budget.costs = Array.from({ length: 40 }, () => d.budget.costs[0]); }).ok).toBe(false);
    expect(tweak((d) => { d.criteria.model = "gle"; }).ok).toBe(true);
    expect(tweak((d) => { d.criteria.variant = "GLS 450 4MATIC"; d.criteria.model = "gle"; }).ok).toBe(false); // variant hører ikke til modellen
  });
  it("ugyldig import gir aldri delvis tilstand", () => {
    const bad = tweak((d) => { d.criteria.modelYear.from = 1800; d.budget.maxPurchaseCost.amountMinor = "1"; });
    expect(bad.ok).toBe(false);
    expect(bad.state).toBeUndefined();
  });
  it("tekst med HTML-tegn beholdes som ren tekst i data (visning bruker textContent, se e2e)", () => {
    const d = valid();
    d.criteria.freeText = "<img src=x onerror=alert(1)>";
    const r = L.importDraft(JSON.stringify(d));
    expect(r.ok).toBe(true);
    expect(r.state.values.freeText).toBe("<img src=x onerror=alert(1)>");
    d.criteria.freeText = "x".repeat(300);
    expect(L.importDraft(JSON.stringify(d)).ok).toBe(false);
  });
});

describe("tom/ikke tom", () => {
  it("hasContent skiller et tomt utkast fra ett med innhold, også kun kostnad eller egen linje", () => {
    const s = L.emptyState();
    expect(L.hasContent(s)).toBe(false);
    s.budget.costs[0].amount = "0";
    expect(L.hasContent(s)).toBe(true);
    const t = L.emptyState();
    t.budget.costs.push(L.newCost("", ""));
    expect(L.hasContent(t)).toBe(true);
    const u = L.emptyState();
    u.eq.carplay = "nice";
    expect(L.hasContent(u)).toBe(true);
  });
});
