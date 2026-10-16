/** Normalisering råpost → intern modell: ukjent, belegg, valuta og avvisning. */
import { describe, expect, it } from "vitest";
import { normalizeSyntheticListing } from "@/providers/marketplace/synthetic/normalize";
import { raw } from "./helpers";

function ok(input: Parameters<typeof raw>[0]) {
  const r = normalizeSyntheticListing(raw(input));
  if (!r.ok) throw new Error(`forventet gyldig, fikk: ${r.reason}`);
  return r.listing;
}
function rejected(input: Parameters<typeof raw>[0]) {
  const r = normalizeSyntheticListing(raw(input));
  expect(r.ok).toBe(false);
  return r.ok ? "" : r.reason;
}

describe("prisgrunnlag og mva.", () => {
  it("brutto uten belegg blir unknown og noteres", () => {
    const l = ok({ price: { amount: "20000", currency: "EUR", type: "GROSS", typeEvidence: null } });
    expect(l.price?.basis).toBe("unknown");
    expect(l.price?.basisEvidence).toBeNull();
    expect(l.provenance.normalizationNotes.join()).toMatch(/uten belegg/);
  });

  it("utleder ikke prisgrunnlag fra mva.-påstand", () => {
    const l = ok({
      description: "MwSt. ausweisbar",
      price: { amount: "20000", currency: "EUR", type: null, vat: { rate: "19", reclaimable: true, evidence: ["MwSt. ausweisbar"], origin: "TEXT" } },
    });
    expect(l.price?.basis).toBe("unknown");
    expect(l.price?.vat).toEqual({ statedRateBasisPoints: 1900, reclaimableClaim: "claimed", evidence: ["MwSt. ausweisbar"], origin: "listing_text" });
  });

  it("forkaster mva.-påstand når belegget ikke står i annonseteksten", () => {
    const l = ok({
      description: "Ingen omtale av mva.",
      price: { amount: "20000", currency: "EUR", type: null, vat: { reclaimable: true, evidence: ["MwSt. ausweisbar"], origin: "TEXT" } },
    });
    expect(l.price?.vat.reclaimableClaim).toBe("unknown");
    expect(l.price?.vat.origin).toBe("none");
  });

  it("forkaster mva.-påstand uten belegg", () => {
    const l = ok({ price: { amount: "20000", currency: "EUR", type: null, vat: { rate: "19", reclaimable: false, evidence: [], origin: "FIELD" } } });
    expect(l.price?.vat).toEqual({ statedRateBasisPoints: null, reclaimableClaim: "unknown", evidence: [], origin: "none" });
  });

  it("bevarer uttrykkelig avkreftelse og desimalsats", () => {
    const l = ok({ price: { amount: "20000", currency: "CHF", type: null, vat: { rate: "8.1", reclaimable: false, evidence: ["MWST nicht ausweisbar"], origin: "FIELD" } } });
    expect(l.price?.vat.reclaimableClaim).toBe("denied");
    expect(l.price?.vat.statedRateBasisPoints).toBe(810);
  });
});

describe("beløp og valuta", () => {
  it("regner om desimalstreng til minste enhet uten flyttallsfeil", () => {
    expect(ok({ price: { amount: "32490.5", currency: "EUR" } }).price?.amount).toEqual({ amountMinor: 3_249_050, currency: "EUR" });
    expect(ok({ price: { amount: "0.29", currency: "EUR" } }).price?.amount?.amountMinor).toBe(29);
  });

  it("ustøttet valuta: beløpet bevares som oppgitt, ingen omregning og ingen feil", () => {
    const l = ok({ price: { amount: "41500.00", currency: "USD" } });
    expect(l.price?.amount).toBeNull();
    expect(l.price?.stated).toEqual({ amount: "41500.00", currency: "USD" });
    expect(l.provenance.normalizationNotes.join()).toMatch(/USD støttes ikke/);
  });

  it("pris 0 blir ikke oppgitt pris, ikke 0", () => {
    const l = ok({ price: { amount: "0.00", currency: "EUR" } });
    expect(l.price).toBeNull();
  });

  it("avviser ugyldige beløp og valutakoder", () => {
    expect(rejected({ price: { amount: "32.490,00", currency: "EUR" } })).toMatch(/prisbeløp/);
    expect(rejected({ price: { amount: "100.123", currency: "EUR" } })).toMatch(/desimaler/);
    expect(rejected({ price: { amount: "100", currency: "EURO" } })).toMatch(/valutakode/);
  });
});

describe("spesifikasjoner", () => {
  it("bevarer registreringspresisjon og avviser umulige datoer", () => {
    expect(ok({ vehicle: { make: "A", model: "B", firstRegistration: "2021" } }).specs.firstRegistration).toEqual({ precision: "year", year: 2021 });
    expect(ok({ vehicle: { make: "A", model: "B", firstRegistration: "2023-04" } }).specs.firstRegistration).toEqual({ precision: "month", year: 2023, month: 4 });
    expect(ok({ vehicle: { make: "A", model: "B", firstRegistration: "2024-02-29" } }).specs.firstRegistration?.precision).toBe("date");
    expect(ok({ vehicle: { make: "A", model: "B", firstRegistration: "2023-02-29" } }).specs.firstRegistration).toBeNull();
  });

  it("beholder miles som miles", () => {
    expect(ok({ vehicle: { make: "A", model: "B", mileage: { value: 38_000, unit: "MI" } } }).specs.mileage).toEqual({ value: 38_000, unit: "mi" });
  });

  it("ukjent kode og 0 i effekt blir null, ikke gjettet", () => {
    const l = ok({ vehicle: { make: "A", model: "B", fuel: "LPG", powerKw: 0, co2: { gramsPerKm: 120, method: "EPA" } }, seller: { country: "Germany" } });
    expect(l.specs.fuel).toBeNull();
    expect(l.specs.powerKw).toBeNull();
    expect(l.specs.co2?.testMethod).toBe("unknown");
    expect(l.seller?.countryCode).toBeNull();
    expect(l.seller?.type).toBe("unknown");
  });

  it("gir intern modell uten providerspesifikke feltnavn", () => {
    const keys = JSON.stringify(ok({ vehicle: { make: "A", model: "B", gearbox: "MANUAL", weightKg: 1200 } }));
    for (const rawKey of ['"gearbox"', '"weightKg"', '"typeEvidence"', '"modifiedAt"', '"observed"']) {
      expect(keys).not.toContain(rawKey);
    }
  });
});

describe("avvisning", () => {
  it("avviser poster uten ID, merke/modell eller med umulig observasjonshistorikk", () => {
    expect(rejected({ id: " " })).toMatch(/kilde-ID/);
    expect(rejected({ vehicle: { make: "A", model: null } })).toMatch(/merke eller modell/);
    expect(rejected({ observed: { firstSeenAt: "2026-10-02T00:00:00Z", lastSeenAt: "2026-10-01T00:00:00Z" } })).toMatch(/lastSeenAt/);
  });
});
