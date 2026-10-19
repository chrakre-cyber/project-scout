/** Regresjonstester fra Codex' uavhengige review av a42a30b (to P2-funn). De feilet på a42a30b og skal bestå etter retting. Levert uendret; utvidelsene står i eget describe-blokk nederst. */
import { describe, expect, it } from "vitest";
import { calculateNorwegianVehicleTax, NO_OTA_2026_A_PB, type TaxInput, type TaxProfile } from "@/domain/tax";

const input: TaxInput = {
  vehicleClass: "passenger_car_m1",
  propulsion: { pistonCombustionEngine: true, externallyChargeable: false, evidence: "type_approval" },
  norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" },
  co2: { gramsPerKm: 179, method: "wltp_combined" },
  firstRegistration: { precision: "day", value: "2023-11-01" },
  norwegianRegistration: { date: "2026-10-18", kind: "actual" },
};
const profile: TaxProfile = {
  ...NO_OTA_2026_A_PB,
  approval: { ...NO_OTA_2026_A_PB.approval, approved: true },
};

describe("independent review: profile approval must not approve unresolved calculation inputs", () => {
  it("reference-only weight cannot produce an approved final amount", () => {
    const result = calculateNorwegianVehicleTax({
      ...input,
      norwegianTaxWeight: { kg: 1976, basis: "reference_listing" },
    }, profile);
    expect(result.validation?.status).not.toBe("approved");
    expect(result.finalClaim?.validation.status).not.toBe("approved");
  });

  it("a date-sensitive monthly working date cannot produce an approved point amount", () => {
    const early = calculateNorwegianVehicleTax({ ...input, firstRegistration: { precision: "day", value: "2026-09-01" } }, profile);
    const late = calculateNorwegianVehicleTax({ ...input, firstRegistration: { precision: "day", value: "2026-09-30" } }, profile);
    expect(early.finalClaim?.totalRegistrationTaxesNok).toBe(466253);
    expect(late.finalClaim?.totalRegistrationTaxesNok).toBe(475719);
    const result = calculateNorwegianVehicleTax({ ...input, firstRegistration: { precision: "month", value: "2026-09" } }, profile);
    expect(result.validation?.status).not.toBe("approved");
    expect(result.finalClaim?.validation.status).not.toBe("approved");
  });
});

describe("rettingen: godkjent regelprofil skilles fra kvalitet og entydighet i inputene (beholder estimat og sensitivitet)", () => {
  const ok = (over: Partial<TaxInput> = {}, p: TaxProfile = profile) => calculateNorwegianVehicleTax({ ...input, ...over }, p);

  it("entydig, verifisert input med godkjent syntetisk profil får fortsatt approved (rettingen blokkerer ikke godkjenning generelt)", () => {
    const r = ok();
    expect(r.status).toBe("calculated");
    expect(r.validation).toMatchObject({ status: "approved", profileApproved: true, inputResolution: "resolved", estimateReasons: [] });
    expect(r.finalClaim?.validation).toEqual(r.validation);
  });

  it("referansevekt (og ukjent vektgrunnlag): estimat bevares med beløp og advarsel, men ikke godkjent; profilen er fortsatt registrert som godkjent i eget signal", () => {
    for (const basis of ["reference_listing", "unverified"] as const) {
      const r = ok({ norwegianTaxWeight: { kg: 1976, basis } });
      expect(r.status, basis).toBe("calculated_unverified");
      expect(r.finalClaim?.totalRegistrationTaxesNok, basis).toBe(333723);
      expect(r.warnings.map((w) => w.code), basis).toContain("weight_basis_not_verified");
      expect(r.validation, basis).toMatchObject({ status: "estimate_not_approved", profileApproved: true, inputResolution: "estimate", estimateReasons: ["weight_reference_only"] });
      expect(r.finalClaim?.validation, basis).toEqual(r.validation);
    }
  });

  it("forhandleroppgitt vekt er ikke referanse-vekt: advarsel som før, ingen automatisk likestilling med reference_listing", () => {
    const r = ok({ norwegianTaxWeight: { kg: 1976, basis: "dealer_entered" } });
    expect(r.warnings.map((w) => w.code)).toContain("weight_basis_not_verified");
    expect(r.validation?.estimateReasons).toEqual([]);
  });

  it("bare måned som endrer kravet: punktbeløp og monthSensitivity bevares, men resultatet er estimat uten approved-status", () => {
    const r = ok({ firstRegistration: { precision: "month", value: "2026-09" } });
    expect(r.status).toBe("calculated_unverified");
    expect(r.finalClaim?.totalRegistrationTaxesNok).toBe(466253);
    expect(r.monthSensitivity?.alternativeTotalRegistrationTaxesNok).toBe(475719);
    expect(r.warnings.map((w) => w.code)).toContain("month_precision_sensitivity");
    expect(r.validation).toMatchObject({ status: "estimate_not_approved", profileApproved: true, inputResolution: "estimate", estimateReasons: ["first_registration_date_sensitive"] });
    expect(r.finalClaim?.validation).toEqual(r.validation);
  });

  it("bare måned der alle mulige dager gir samme beløp: ingen sensitivitet, ikke estimat (blokkeres ikke automatisk)", () => {
    const r = ok({ firstRegistration: { precision: "month", value: "2023-11" } });
    expect(r.monthSensitivity).toBeNull();
    expect(r.validation).toMatchObject({ status: "approved", inputResolution: "resolved", estimateReasons: [] });
  });

  it("begge årsaker samtidig gir begge i rekkefølge; uten godkjent profil er status uendret estimate_not_approved med profileApproved false", () => {
    const both = ok({ norwegianTaxWeight: { kg: 1976, basis: "reference_listing" }, firstRegistration: { precision: "month", value: "2026-09" } });
    expect(both.validation?.estimateReasons).toEqual(["weight_reference_only", "first_registration_date_sensitive"]);
    const unapproved = calculateNorwegianVehicleTax(input);
    expect(unapproved.validation).toMatchObject({ status: "estimate_not_approved", profileApproved: false, inputResolution: "resolved" });
  });
});
