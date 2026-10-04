import { describe, expect, it } from "vitest";
import { NOT_STATED, formatFirstRegistration, formatMileage, formatMoney, formatPriceBasis } from "@/lib/format";

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

  it("feiler på ukjent valuta i stedet for å gjette desimaler", () => {
    expect(() => formatMoney({ amountMinor: 100, currency: "JPY" })).toThrow();
  });
});

describe("prisgrunnlag", () => {
  const amount = { amountMinor: 100_000, currency: "EUR" };

  it("viser brutto/netto uten belegg som ukjent i stedet for å anta", () => {
    expect(formatPriceBasis({ amount, basis: "gross", basisEvidence: null })).toBe("prisgrunnlag ukjent");
    expect(formatPriceBasis({ amount, basis: "net", basisEvidence: "" })).toBe("prisgrunnlag ukjent");
  });

  it("viser oppgitt grunnlag som ukontrollert annonsepåstand når belegg finnes", () => {
    const label = formatPriceBasis({ amount, basis: "net", basisEvidence: "«Nettopreis»" });
    expect(label).toMatch(/netto/);
    expect(label).toMatch(/ikke kontrollert/);
  });
});
