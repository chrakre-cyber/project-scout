/** R5: penger mellom Postgres/PostgREST (tekst) og domenet (trygt heltall). */
import { describe, expect, it } from "vitest";
import { MoneyBoundaryError, minorToDecimalString, moneyFromDb, moneyToDb } from "@/domain/currency";
import { formatMoney } from "@/lib/format";

const MAX = Number.MAX_SAFE_INTEGER; // 9007199254740991

describe("databasegrense for penger", () => {
  it("rundtur bevarer største trygge beløp eksakt", () => {
    const db = moneyToDb({ amountMinor: MAX, currency: "NOK" });
    expect(db).toEqual({ amountMinor: "9007199254740991", currency: "NOK" });
    expect(moneyFromDb(JSON.parse(JSON.stringify(db)))).toEqual({ amountMinor: MAX, currency: "NOK" });
  });

  it("feiler i stedet for å runde stille når beløpet er over 2^53-1", () => {
    // Som JSON-tall ville 9007199254740993 blitt 9007199254740992 uten feil.
    expect(JSON.parse("9007199254740993")).toBe(9007199254740992);
    expect(() => moneyFromDb({ amountMinor: "9007199254740993", currency: "NOK" })).toThrow(MoneyBoundaryError);
    expect(() => moneyFromDb({ amountMinor: "99999999999999999", currency: "NOK" })).toThrow(MoneyBoundaryError);
  });

  it("avviser JSON-tall, desimaler, fortegn, 0 og ugyldig valuta fra databasen", () => {
    for (const amountMinor of [123, "12.5", "-5", "0", "007", " 1", "1e3", null]) {
      expect(() => moneyFromDb({ amountMinor, currency: "NOK" }), String(amountMinor)).toThrow(MoneyBoundaryError);
    }
    expect(() => moneyFromDb({ amountMinor: "100", currency: "nok" })).toThrow(MoneyBoundaryError);
    expect(() => moneyFromDb(null)).toThrow(MoneyBoundaryError);
  });

  it("nekter å sende utrygge eller ikke-heltallige beløp til databasen", () => {
    expect(() => moneyToDb({ amountMinor: MAX + 1, currency: "NOK" })).toThrow(MoneyBoundaryError);
    expect(() => moneyToDb({ amountMinor: 10.5, currency: "NOK" })).toThrow(MoneyBoundaryError);
    expect(() => moneyToDb({ amountMinor: 0, currency: "NOK" })).toThrow(MoneyBoundaryError);
  });

  it("viser store beløp eksakt uten flyttallsdivisjon", () => {
    expect(minorToDecimalString(MAX, 2)).toBe("90071992547409.91");
    expect(minorToDecimalString(5, 2)).toBe("0.05");
    expect(formatMoney({ amountMinor: MAX, currency: "NOK" }).replace(/\s/g, "")).toBe("90071992547409,91kr");
  });
});
