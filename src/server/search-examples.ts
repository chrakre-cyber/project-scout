/**
 * Navngitte demo-eksempler for «Nytt søk» (SEARCH-005). Begge er skjemautfyllinger — ikke lagrede søk og ikke brukerens valg:
 * brukeren kan endre alt, og må selv lagre.
 *
 *  - GLS-eksempelet er prototypens (SEARCH-001A-UI) eksempel, uendret i innhold. Kilometerstand er ikke satt. Prioritet for fargene
 *    og planlagt registrering er IKKE forhåndsvalgt: de må velges uttrykkelig før lagring. Demokilden har ingen GLS og leverer ikke
 *    modellår, seter eller utstyr, så eksempelet gir ingen fullstendige treff — det er poenget (ærlig dekning).
 *  - Demofixturen bruker bare opplysninger den syntetiske kilden faktisk har (merke/modell, drivstoff, karosseri,
 *    førstegangsregistrering, kilometerstand, farge), slik at både treff og kravbrudd kan prøves.
 */
import type { FormValues } from "./search-form";
import { emptyFormValues } from "./search-form";

export type ExampleId = "gls" | "demo-bmw";

export interface ExampleInfo {
  id: ExampleId;
  title: string;
  /** Vises over skjemaet når eksempelet er valgt. */
  note: string;
  values: () => FormValues;
}

function gls(): FormValues {
  return {
    ...emptyFormValues(),
    name: "GLS-eksempel (demo)",
    brand: "mercedes-benz", model: "gls",
    modelYearMin: "2021",
    seatsMin: "7", seatsMax: "7",
    exteriorColors: ["black", "white"],
    "eq:panoramic_roof": "nice", "eq:air_suspension": "nice", "eq:camera_360": "must", "eq:heated_seats_front": "nice", "eq:carplay": "must",
    budgetMax: "750 000", budgetDeviation: "10",
  };
}

function demoBmw(): FormValues {
  return {
    ...emptyFormValues(),
    name: "Demo: BMW 3-serie diesel stasjonsvogn",
    brand: "bmw", model: "3-serie",
    regFrom: "2021",
    maxMileageKm: "80 000",
    fuels: ["diesel"], bodyTypes: ["estate"],
    exteriorColors: ["black", "white"], exteriorColorsPriority: "nice",
    // Utstyrsønsket kan ikke vurderes av demokilden (ukjent for alle biler): viser «ukjent» i stedet for «ikke oppfylt».
    "eq:carplay": "nice",
    plannedRegistration: "passenger",
    budgetMax: "450 000", budgetDeviation: "10",
    "cost.transport.use": "true", "cost.transport.currency": "EUR", "cost.transport.amount": "", "cost.transport.vat": "", "cost.transport.included": "true",
  };
}

export const EXAMPLES: readonly ExampleInfo[] = [
  {
    id: "gls",
    title: "GLS-eksempel (demo)",
    note: "Eksempelverdier, ikke dine valg. Kilometerstand er ikke satt. Velg prioritet for fargene og planlagt registrering før du lagrer. Demokilden har ingen GLS og oppgir ikke modellår, seter eller utstyr — du får derfor ingen fullstendige treff.",
    values: gls,
  },
  {
    id: "demo-bmw",
    title: "Demosøk som gir treff (BMW 3-serie)",
    note: "Bruker bare opplysninger demokilden har. Her finnes både biler som oppfyller kravene og biler som ikke gjør det, så du kan prøve forklaringene.",
    values: demoBmw,
  },
];

export function exampleById(id: string | undefined): ExampleInfo | null {
  return EXAMPLES.find((e) => e.id === id) ?? null;
}
