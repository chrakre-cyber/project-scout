/**
 * Håndskrevne SYNTETISKE kildeposter. demo-001 – demo-008 er de samme bilene
 * som i DEV-001-demoen (inkl. reviewrettingene: demo-004 og demo-005 har ukjent
 * prisgrunnlag). demo-009 viser en annonse i ustøttet valuta (USD).
 *
 * Belegg-strenger står ordrett i den syntetiske annonseteksten. Ingenting her
 * er ekte annonser eller mobile.de-data.
 */
import type { SyntheticRawListing } from "../raw";

export const handwrittenRawListings: SyntheticRawListing[] = [
  {
    id: "demo-001",
    modifiedAt: "2026-10-02T14:10:00Z",
    observed: { firstSeenAt: "2026-10-03T06:30:00Z", lastSeenAt: "2026-10-04T18:00:00Z" },
    price: { amount: "32490", currency: "EUR", type: "GROSS", typeEvidence: "Preis inkl. MwSt." },
    vehicle: {
      make: "Volkswagen", model: "Golf", variant: "Variant 1.5 eTSI", firstRegistration: "2023-04",
      mileage: { value: 28_400, unit: "KM" }, fuel: "PETROL", gearbox: "AUTOMATIC", body: "ESTATE",
      powerKw: 110, co2: { gramsPerKm: 129, method: "WLTP" }, weightKg: 1_390, color: "Grå",
    },
    description: "Syntetisk annonsetekst. Preis inkl. MwSt. Servicehefte, tilhengerfeste, to nøkler.",
    seller: { type: "DEALER", country: "DE", city: "Hamburg" },
  },
  {
    id: "demo-002",
    modifiedAt: "2026-09-29T10:00:00Z",
    observed: { firstSeenAt: "2026-10-02T19:05:00Z", lastSeenAt: "2026-10-04T18:00:00Z" },
    price: {
      amount: "41900", currency: "EUR", type: "NET", typeEvidence: "Nettopreis",
      vat: { rate: "19", reclaimable: true, evidence: ["MwSt. 19 % ausweisbar"], origin: "TEXT" },
    },
    vehicle: {
      make: "Toyota", model: "RAV4", variant: "2.5 Plug-in Hybrid AWD", firstRegistration: "2022-11-15",
      mileage: { value: 41_000, unit: "KM" }, fuel: "PLUGIN_HYBRID", gearbox: "AUTOMATIC", body: "SUV",
      powerKw: 225, co2: { gramsPerKm: 22, method: "WLTP" }, weightKg: null, color: "Hvit",
    },
    description: "Syntetisk annonsetekst. Nettopreis, MwSt. 19 % ausweisbar. Panoramatak, vinterhjul medfølger.",
    seller: { type: "DEALER", country: "DE", city: "München" },
  },
  {
    id: "demo-003",
    modifiedAt: "2026-09-30T08:00:00Z",
    observed: { firstSeenAt: "2026-10-01T11:20:00Z", lastSeenAt: "2026-10-02T09:00:00Z" },
    price: { amount: "27900", currency: "EUR", type: null },
    vehicle: {
      make: "Volvo", model: "V60", variant: "B4 Momentum", firstRegistration: "2021",
      mileage: { value: 67_500, unit: "KM" }, fuel: "HYBRID", gearbox: "AUTOMATIC", body: "ESTATE",
      powerKw: 145, co2: null, weightKg: null, color: null,
    },
    description: null,
    seller: { type: null, country: "DE", city: null },
  },
  {
    // Endret annonse: to revisjoner med ulik pris og tekst. Siste revisjon gjelder.
    id: "demo-004",
    modifiedAt: "2026-10-01T07:45:00Z",
    observed: { firstSeenAt: "2026-10-01T08:00:00Z", lastSeenAt: "2026-10-02T08:00:00Z" },
    price: {
      amount: "56900", currency: "EUR", type: null,
      vat: { reclaimable: true, evidence: ["MwSt. ausweisbar"], origin: "TEXT" },
    },
    vehicle: {
      make: "BMW", model: "X3", variant: "xDrive30e", firstRegistration: "2024-02",
      mileage: { value: 12_900, unit: "KM" }, fuel: "PLUGIN_HYBRID", gearbox: "AUTOMATIC", body: "SUV",
      powerKw: 215, co2: { gramsPerKm: 41, method: "WLTP" }, weightKg: 2_045, color: "Svart",
    },
    description: "Syntetisk annonsetekst. MwSt. ausweisbar. Hengerfeste.",
    seller: { type: "DEALER", country: "DE", city: "Köln" },
  },
  {
    id: "demo-004",
    modifiedAt: "2026-10-03T07:45:00Z",
    observed: { firstSeenAt: "2026-10-01T08:00:00Z", lastSeenAt: "2026-10-04T18:00:00Z" },
    price: {
      amount: "54900", currency: "EUR", type: null,
      vat: { reclaimable: true, evidence: ["MwSt. ausweisbar"], origin: "TEXT" },
    },
    vehicle: {
      make: "BMW", model: "X3", variant: "xDrive30e", firstRegistration: "2024-02",
      mileage: { value: 12_900, unit: "KM" }, fuel: "PLUGIN_HYBRID", gearbox: "AUTOMATIC", body: "SUV",
      powerKw: 215, co2: { gramsPerKm: 41, method: "WLTP" }, weightKg: 2_045, color: "Svart",
    },
    description: "Syntetisk annonsetekst. MwSt. ausweisbar. Hengerfeste, head-up display, fabrikkgaranti oppgitt.",
    seller: { type: "DEALER", country: "DE", city: "Köln" },
  },
  {
    // Prisgrunnlag oppgitt som brutto i kilden, men uten belegg → normaliseres til unknown.
    id: "demo-005",
    modifiedAt: null,
    observed: { firstSeenAt: "2026-09-28T15:40:00Z", lastSeenAt: "2026-10-04T18:00:00Z" },
    price: { amount: "18950", currency: "EUR", type: "GROSS", typeEvidence: null },
    vehicle: {
      make: "Skoda", model: "Octavia", variant: "Combi 2.0 TDI", firstRegistration: "2020-06-02",
      mileage: { value: 89_000, unit: "KM" }, fuel: "DIESEL", gearbox: "MANUAL", body: "ESTATE",
      powerKw: 110, co2: { gramsPerKm: 117, method: "NEDC" }, weightKg: 1_460, color: "Blå",
    },
    description: "Syntetisk annonsetekst. Ingen skadeomtale i teksten.",
    seller: { type: "PRIVATE", country: "DE", city: null },
  },
  {
    id: "demo-006",
    modifiedAt: "2026-10-01T09:30:00Z",
    observed: { firstSeenAt: "2026-10-02T09:35:00Z", lastSeenAt: "2026-10-04T18:00:00Z" },
    price: { amount: "36500", currency: "EUR", type: "NET", typeEvidence: "Exportpreis netto" },
    vehicle: {
      make: "Audi", model: "A6", variant: "Avant 40 TDI quattro", firstRegistration: "2022-09",
      mileage: null, fuel: "DIESEL", gearbox: "AUTOMATIC", body: "ESTATE",
      powerKw: 150, co2: null, weightKg: null, color: "Grå",
    },
    description: "Syntetisk annonsetekst. Exportpreis netto. Kilometerstand ikke oppgitt i annonsen.",
    seller: { type: "DEALER", country: "AT", city: "Salzburg" },
  },
  {
    id: "demo-007",
    modifiedAt: null,
    observed: { firstSeenAt: "2026-10-03T05:15:00Z", lastSeenAt: "2026-10-04T18:00:00Z" },
    price: {
      amount: "23990", currency: "EUR", type: "GROSS", typeEvidence: "inkl. 19 % MwSt.",
      vat: { rate: "19", reclaimable: null, evidence: ["inkl. 19 % MwSt."], origin: "TEXT" },
    },
    vehicle: {
      make: "Hyundai", model: "Kona", variant: "Electric 64 kWh", firstRegistration: "2022-05",
      mileage: { value: 34_200, unit: "KM" }, fuel: "ELECTRIC", gearbox: "AUTOMATIC", body: "SUV",
      powerKw: 150, co2: { gramsPerKm: 0, method: "WLTP" }, weightKg: 1_685, color: "Rød",
    },
    description: "Syntetisk annonsetekst. Preis inkl. 19 % MwSt. Varmepumpe, batterisertifikat ikke nevnt.",
    seller: { type: "DEALER", country: "DE", city: "Berlin" },
  },
  {
    id: "demo-008",
    modifiedAt: null,
    observed: { firstSeenAt: "2026-09-30T20:50:00Z", lastSeenAt: "2026-09-30T20:50:00Z" },
    price: { amount: "44800", currency: "EUR", type: null },
    vehicle: {
      make: "Mercedes-Benz", model: "E-Klasse", variant: null, firstRegistration: null,
      mileage: { value: 38_000, unit: "MI" }, fuel: null, gearbox: "AUTOMATIC", body: "SEDAN",
      powerKw: null, co2: null, weightKg: null, color: null,
    },
    description: null,
    seller: null,
  },
  {
    // Ustøttet valuta (DEV-001 review R1): beløpet bevares som oppgitt og regnes ikke om.
    id: "demo-009",
    modifiedAt: "2026-10-03T16:20:00Z",
    observed: { firstSeenAt: "2026-10-03T17:00:00Z", lastSeenAt: "2026-10-04T18:00:00Z" },
    price: { amount: "41500.00", currency: "USD", type: null },
    vehicle: {
      make: "Ford", model: "Mustang", variant: "GT 5.0 V8", firstRegistration: "2021-07",
      mileage: { value: 22_000, unit: "MI" }, fuel: "PETROL", gearbox: "AUTOMATIC", body: "COUPE",
      powerKw: 330, co2: null, weightKg: null, color: "Gul",
    },
    description: "Syntetisk annonsetekst. Pris oppgitt i amerikanske dollar. US-spesifikasjon.",
    seller: { type: "DEALER", country: "DE", city: "Frankfurt" },
  },
];
