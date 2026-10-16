/**
 * Håndskrevne SYNTETISKE demoannonser (DEV-006C) for å vise variasjon i forklaringene: kjent oppfylt ønske, kjent ikke-oppfylt
 * ønske, ukjent ønske, ukjent krav og kjent kravbrudd. Id-prefikset «dvar-» skiller dem fra DEV-003-postene.
 *
 * Alle poster er oppdiktet av Project Scout. De er ikke ekte annonser, ikke fra noen leverandør eller markedsplass, og har
 * ingen originalannonse. Bare felt som kilden allerede har brukes (ingen utstyr, seter eller modellår).
 * Pris er gitt med belegg i teksten slik de øvrige postene; den er aldri total innkjøpskostnad.
 */
import type { SyntheticRawListing } from "../raw";

const TEXT = "Syntetisk demoannonse (ikke en ekte annonse). Preis inkl. MwSt.";
const base = (n: number) => ({
  modifiedAt: "2026-10-05T09:00:00Z",
  observed: { firstSeenAt: `2026-10-0${n}T08:00:00Z`, lastSeenAt: "2026-10-08T18:00:00Z" },
  description: TEXT,
  seller: { type: "DEALER" as const, country: "DE", city: "Demostad" },
});
const price = (amount: string) => ({ amount, currency: "EUR", type: "GROSS" as const, typeEvidence: "Preis inkl. MwSt." });
const bmw = { make: "BMW", model: "3er", fuel: "DIESEL", gearbox: "AUTOMATIC", body: "ESTATE", powerKw: 140 };

export const demoVariationRawListings: SyntheticRawListing[] = [
  // Oppfyller kravene (diesel, stasjonsvogn, ≥ 2021, ≤ 80 000 km); fargeønsket (svart/hvit) er kjent og oppfylt.
  { id: "dvar-001", ...base(1), price: price("31900"), vehicle: { ...bmw, variant: "320d Touring", firstRegistration: "2022-05", mileage: { value: 41_000, unit: "KM" }, color: "Svart" } },
  { id: "dvar-002", ...base(2), price: price("35400"), vehicle: { ...bmw, variant: "318d Touring", firstRegistration: "2023-02-14", mileage: { value: 24_500, unit: "KM" }, color: "Hvit" } },
  // Oppfyller kravene; fargeønsket er kjent og IKKE oppfylt (blå). Ønsker utelukker aldri.
  { id: "dvar-003", ...base(3), price: price("29800"), vehicle: { ...bmw, variant: "320d Touring", firstRegistration: "2021-09", mileage: { value: 62_000, unit: "KM" }, color: "Blå" } },
  // Oppfyller kravene; fargen er ikke oppgitt (ukjent ønske, ikke «ikke oppfylt»).
  { id: "dvar-004", ...base(4), price: price("30500"), vehicle: { ...bmw, variant: "320d Touring", firstRegistration: "2022", mileage: { value: 33_000, unit: "KM" }, color: null } },
  // Kilometerstand mangler: kravet er ukjent → «må kontrolleres» (ikke bestått, ikke brudd). Fargen er kjent og oppfylt.
  { id: "dvar-005", ...base(5), price: price("32800"), vehicle: { ...bmw, variant: "320d Touring", firstRegistration: "2022-08", mileage: null, color: "Svart" } },
  // Kjent kravbrudd: bensin i stedet for diesel. Fargen er oppfylt, men ønsker kan ikke gjøre en bil som bryter kravene relevant.
  { id: "dvar-006", ...base(6), price: price("28700"), vehicle: { ...bmw, fuel: "PETROL", variant: "320i Touring", firstRegistration: "2022-03", mileage: { value: 30_000, unit: "KM" }, color: "Svart" } },
];
