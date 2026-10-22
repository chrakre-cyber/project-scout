/**
 * Godkjent runtime er avgrenset til de tre validerte personbilprofilene PB-DIE, PB-BEV og PB-PHEV (beslutning 2026-10-19).
 * Bensin, ikke-ladbar hybrid og ukjent undertype er blokkert som utenfor støttet omfang og arver ikke dieselens klasse 1-dekning;
 * klasse 1-dekning kontrolleres per kjøretøyprofil, ikke som globalt antall. Vektpolicy, datofølsomhet og tidligere blokkeringer er uendret.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateNorwegianVehicleTax, NO_OTA_2026_A_PB, type TaxInput, type TaxProfile } from "@/domain/tax";

const diesel: TaxInput = {
  vehicleClass: "passenger_car_m1",
  propulsion: { pistonCombustionEngine: true, externallyChargeable: false, combustionFuel: "diesel", hybridization: "none", evidence: "type_approval" },
  norwegianTaxWeight: { kg: 1976, basis: "vehicle_register" },
  co2: { gramsPerKm: 179, method: "wltp_combined" },
  firstRegistration: { precision: "day", value: "2023-11-01" },
  norwegianRegistration: { date: "2026-10-18", kind: "actual" },
};
const bev: TaxInput = { ...diesel, propulsion: { pistonCombustionEngine: false, externallyChargeable: true, combustionFuel: null, hybridization: null, evidence: "type_approval" }, norwegianTaxWeight: { kg: 2185, basis: "vehicle_register" }, co2: { gramsPerKm: null, method: "wltp_combined" }, firstRegistration: { precision: "day", value: "2023-08-01" } };
const phev: TaxInput = { ...diesel, propulsion: { pistonCombustionEngine: true, externallyChargeable: true, combustionFuel: "petrol", hybridization: null, evidence: "type_approval" }, norwegianTaxWeight: { kg: 2610, basis: "vehicle_register" }, co2: { gramsPerKm: 140, method: "wltp_weighted_combined" }, firstRegistration: { precision: "day", value: "2026-09-01" } };
const prop = (over: Partial<TaxInput["propulsion"]>): TaxInput => ({ ...diesel, propulsion: { ...diesel.propulsion, ...over } });
const codes = (r: ReturnType<typeof calculateNorwegianVehicleTax>) => r.blocked.map((b) => b.code);
const approvedProfile: TaxProfile = NO_OTA_2026_A_PB; // registerets godkjente profil
const read = (f: string) => JSON.parse(readFileSync(join(__dirname, "..", "docs/tax", f), "utf8"));

describe("støttede profiler: PB-DIE, PB-BEV og PB-PHEV får approved bare ved entydig, dokumentert input", () => {
  for (const [name, inp, id] of [["diesel", diesel, "PB-DIE"], ["elbil", bev, "PB-BEV"], ["ladbar hybrid", phev, "PB-PHEV"]] as const) {
    it(`${name}: ${id}, klasse 1-dekning 1 for profilen (ikke globalt antall), approved`, () => {
      const r = calculateNorwegianVehicleTax(inp);
      expect(r.status).toBe("calculated");
      expect(r.validation).toMatchObject({ status: "approved", vehicleProfile: id, class1References: 1, engineProfileClass1References: 3, inputResolution: "resolved" });
      expect(r.finalClaim?.validation).toEqual(r.validation);
    });
  }
});

describe("bensin, ikke-ladbar hybrid og ukjent undertype er utenfor støttet omfang (blokkert, ingen arvet dekning)", () => {
  it("bensin uten hybrid: blokkert (vehicle_profile_unsupported), ingen finalClaim/total/validation", () => {
    const r = calculateNorwegianVehicleTax(prop({ combustionFuel: "petrol", hybridization: "none" }));
    expect(r.status).toBe("blocked");
    expect(codes(r)).toEqual(["vehicle_profile_unsupported"]);
    expect([r.finalClaim, r.totalRegistrationTaxesExact, r.oneOffTaxExact, r.validation]).toEqual([null, null, null, null]);
  });
  it("ikke-ladbar hybrid (diesel eller bensin): blokkert, også når dieselen ellers er identisk", () => {
    for (const fuel of ["diesel", "petrol", "other"] as const) {
      const r = calculateNorwegianVehicleTax(prop({ combustionFuel: fuel, hybridization: "non_chargeable_hybrid" }));
      expect(r.status, fuel).toBe("blocked");
      expect(codes(r), fuel).toEqual(["vehicle_profile_unsupported"]);
      expect(r.finalClaim, fuel).toBeNull();
    }
  });
  it("annet drivstoff enn diesel/bensin uten hybrid er utenfor omfang", () => {
    expect(codes(calculateNorwegianVehicleTax(prop({ combustionFuel: "other", hybridization: "none" })))).toEqual(["vehicle_profile_unsupported"]);
  });
  it("ukjent undertype (null eller manglende felt) blokkeres som vehicle_profile_unknown, ikke som diesel", () => {
    for (const over of [{ combustionFuel: null }, { hybridization: null }, { combustionFuel: null, hybridization: null }]) {
      const r = calculateNorwegianVehicleTax(prop(over));
      expect(r.status).toBe("blocked");
      expect(codes(r)).toEqual(["vehicle_profile_unknown"]);
      expect(r.missingInputs).toContain("propulsion.combustionFuel/hybridization");
    }
    const legacy = { ...diesel, propulsion: { pistonCombustionEngine: true, externallyChargeable: false, evidence: "type_approval" } } as unknown as TaxInput; // som JS-kall uten de nye feltene
    expect(codes(calculateNorwegianVehicleTax(legacy))).toEqual(["vehicle_profile_unknown"]);
  });
  it("blokkeringen gjelder uavhengig av profilgodkjenning (også en ikke-godkjent profilkopi)", () => {
    const unapproved: TaxProfile = { ...approvedProfile, approval: { ...approvedProfile.approval, approved: false } };
    expect(codes(calculateNorwegianVehicleTax(prop({ combustionFuel: "petrol" }), unapproved))).toEqual(["vehicle_profile_unsupported"]);
  });
  it("undertype avgjøres av teknisk input, ikke av navn: markedsføringsnavn/etiketter påvirker verken blokkering eller profil", () => {
    const labelled = (label: string, base: TaxInput) => ({ ...base, marketingName: label, fuelLabel: label }) as unknown as TaxInput;
    expect(calculateNorwegianVehicleTax(labelled("Diesel", prop({ combustionFuel: "petrol" }))).status).toBe("blocked");
    expect(calculateNorwegianVehicleTax(labelled("Petrol hybrid", diesel)).validation?.vehicleProfile).toBe("PB-DIE");
    expect(codes(calculateNorwegianVehicleTax({ ...prop({ combustionFuel: "diesel" }), propulsion: { ...diesel.propulsion, evidence: "listing_claim" } }))).toContain("propulsion_evidence_insufficient");
  });
  it("elbil og ladbar hybrid påvirkes ikke av drivstoff-/hybridfeltene (egen profil)", () => {
    expect(calculateNorwegianVehicleTax({ ...bev, propulsion: { ...bev.propulsion, combustionFuel: "petrol", hybridization: "none" } }).validation?.vehicleProfile).toBe("PB-BEV");
    expect(calculateNorwegianVehicleTax({ ...phev, propulsion: { ...phev.propulsion, combustionFuel: null } }).validation?.vehicleProfile).toBe("PB-PHEV");
  });
});

describe("klasse 1-dekning kontrolleres per kjøretøyprofil", () => {
  it("tom dekning for én profil gir ikke approved for den profilen, men påvirker ikke de andre", () => {
    const noPhev: TaxProfile = { ...approvedProfile, vehicleProfiles: { ...approvedProfile.vehicleProfiles, "PB-PHEV": { powertrain: "phev", class1CaseIds: [] } } };
    const p = calculateNorwegianVehicleTax(phev, noPhev);
    expect(p.status).toBe("calculated_unverified");
    expect(p.validation).toMatchObject({ status: "estimate_not_approved", vehicleProfile: "PB-PHEV", class1References: 0, engineProfileClass1References: 3 });
    expect(calculateNorwegianVehicleTax(diesel, noPhev).validation).toMatchObject({ status: "approved", vehicleProfile: "PB-DIE", class1References: 1 });
  });
  it("registeret: motorprofilens dekning er nøyaktig de klasse 1-tilfellene i references.json per profil, og bare tre profiler er støttet", () => {
    const cases = read("references.json").cases as Array<{ id: string; evidenceClass: number; profileId?: string }>;
    const c1 = cases.filter((c) => c.evidenceClass === 1);
    expect(Object.keys(approvedProfile.vehicleProfiles).sort()).toEqual(["PB-BEV", "PB-DIE", "PB-PHEV"]);
    for (const [id, cov] of Object.entries(approvedProfile.vehicleProfiles)) {
      expect(c1.filter((c) => c.profileId === id).map((c) => c.id).sort(), id).toEqual([...cov.class1CaseIds].sort());
    }
    expect(c1.every((c) => c.profileId && c.profileId in approvedProfile.vehicleProfiles)).toBe(true); // ingen klasse 1 uten støttet profil
    expect(c1).toHaveLength(approvedProfile.approval.class1References);
  });
  it("PB-BEN og PB-HEV har ingen klasse 1 i registeret og er ikke i motorprofilen", () => {
    const cases = read("references.json").cases as Array<{ evidenceClass: number; profileId?: string }>;
    for (const id of ["PB-BEN", "PB-HEV"]) {
      expect(cases.some((c) => c.evidenceClass === 1 && c.profileId === id), id).toBe(false);
      expect(id in approvedProfile.vehicleProfiles, id).toBe(false);
    }
  });
});

describe("uendret: vektpolicy, datofølsomhet og tidligere blokkeringer", () => {
  it("udokumentert/referansevekt og datofølsomt beløp er fortsatt estimat for PB-DIE", () => {
    for (const basis of ["dealer_entered", "reference_listing", "unverified"] as const) expect(calculateNorwegianVehicleTax({ ...diesel, norwegianTaxWeight: { kg: 1976, basis } }).validation, basis).toMatchObject({ status: "estimate_not_approved", inputResolution: "estimate", vehicleProfile: "PB-DIE" });
    expect(calculateNorwegianVehicleTax({ ...diesel, firstRegistration: { precision: "month", value: "2026-09" } }).validation?.estimateReasons).toEqual(["first_registration_date_sensitive"]);
  });
  it("NEDC, 20 år eller eldre og dag 29–31 i vinduet er fortsatt blokkert", () => {
    expect(codes(calculateNorwegianVehicleTax({ ...diesel, co2: { gramsPerKm: 150, method: "nedc" } }))).toContain("co2_nedc_unsupported");
    expect(codes(calculateNorwegianVehicleTax({ ...diesel, firstRegistration: { precision: "day", value: "2006-06-15" } }))).toEqual(["twenty_year_minimum_unresolved"]);
    expect(codes(calculateNorwegianVehicleTax({ ...diesel, firstRegistration: { precision: "day", value: "2026-01-31" }, norwegianRegistration: { date: "2026-02-28", kind: "actual" } }))).toContain("age_step_boundary_ambiguous");
  });
  it("totalene for de tre validerte profilene er uendret (diesel 333 723, elbil 16 748, PHEV 529 069)", () => {
    expect(calculateNorwegianVehicleTax(diesel).finalClaim?.totalRegistrationTaxesNok).toBe(333723);
    expect(calculateNorwegianVehicleTax(bev).finalClaim?.totalRegistrationTaxesNok).toBe(16748);
    expect(calculateNorwegianVehicleTax(phev).finalClaim?.totalRegistrationTaxesNok).toBe(529069);
  });
});
