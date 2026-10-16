import { describe, expect, it } from "vitest";
import type { ListingPrice, SourceVatStatement } from "@/domain/types";
import {
  NOT_STATED, UNSUPPORTED_CURRENCY_NOTE, formatFirstRegistration, formatListingPrice, formatMileage, formatMoney,
  formatPriceBasis, formatVatStatement,
} from "@/lib/format";

const NO_VAT: SourceVatStatement = { statedRateBasisPoints: null, reclaimableClaim: "unknown", evidence: [], origin: "none" };
function priceOf(p: Partial<ListingPrice>): ListingPrice {
  return {
    stated: { amount: "1000", currency: "EUR" }, amount: { amountMinor: 100_000, currency: "EUR" },
    basis: "unknown", basisEvidence: null, vat: { ...NO_VAT, evidence: [] }, ...p,
  };
}

describe("visning av ukjente og upresise verdier", () => {
  it("viser null som «ikke oppgitt», aldri 0", () => {
    expect(formatMoney(null)).toBe(NOT_STATED);
    expect(formatMileage(null)).toBe(NOT_STATED);
    expect(formatFirstRegistration(null)).toBe(NOT_STATED);
  });

  it("dikter ikke opp dag eller måned", () => {
    expect(formatFirstRegistration({ precision: "year", year: 2021 })).toBe("2021 (kun år oppgitt)");
    expect(formatFirstRegistration({ precision: "month", year: 2023, month: 4 })).toBe("04.2023 (kun måned oppgitt)");
  });

  it("konverterer ikke miles stille til km", () => {
    expect(formatMileage({ value: 38_000, unit: "mi" })).toMatch(/miles/);
    expect(formatMileage({ value: 38_000, unit: "mi" })).not.toMatch(/km/);
  });

  it("viser beløp i minste enhet korrekt og beholder valuta", () => {
    const eur = formatMoney({ amountMinor: 3_249_000, currency: "EUR" });
    expect(eur.replace(/\s/g, "")).toMatch(/32490/);
    expect(eur).toMatch(/€/);
    expect(formatMoney({ amountMinor: 1_050, currency: "NOK" }).replace(/\s/g, "")).toMatch(/10,5/);
  });

  it("krasjer ikke på ustøttet valuta og gjetter ikke desimaler (R1)", () => {
    expect(formatMoney({ amountMinor: 4_150_000, currency: "USD" })).toBe("4150000 (minste enhet) USD");
  });

  it("viser annonsepris i ustøttet valuta ordrett med merknad", () => {
    const shown = formatListingPrice(priceOf({ stated: { amount: "41500.00", currency: "USD" }, amount: null }));
    expect(shown).toEqual({ text: "41500.00 USD", note: UNSUPPORTED_CURRENCY_NOTE });
    expect(formatListingPrice(null).text).toBe("Pris ikke oppgitt");
  });
});

describe("prisgrunnlag", () => {
  it("viser brutto/netto uten belegg som ukjent i stedet for å anta", () => {
    expect(formatPriceBasis(priceOf({ basis: "gross", basisEvidence: null }))).toBe("prisgrunnlag ukjent");
    expect(formatPriceBasis(priceOf({ basis: "net", basisEvidence: "" }))).toBe("prisgrunnlag ukjent");
    expect(formatPriceBasis(null)).toBe("prisgrunnlag ukjent");
  });

  it("viser mva.-opplysninger som ukontrollert annonsepåstand, aldri som fradragsrett", () => {
    expect(formatVatStatement(NO_VAT)).toBe("ingen mva.-opplysninger i annonsen");
    const text = formatVatStatement({ statedRateBasisPoints: 810, reclaimableClaim: "claimed", evidence: ["x"], origin: "structured_field" });
    expect(text).toMatch(/8,1 %/);
    expect(text).toMatch(/ikke kontrollert/);
    expect(text).not.toMatch(/fradragsrett|fradragsberettiget/);
  });

  it("viser oppgitt grunnlag som ukontrollert annonsepåstand når belegg finnes", () => {
    const label = formatPriceBasis(priceOf({ basis: "net", basisEvidence: "Nettopreis" }));
    expect(label).toMatch(/netto/);
    expect(label).toMatch(/ikke kontrollert/);
  });
});
