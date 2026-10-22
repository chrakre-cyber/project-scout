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

export type ExampleId = "gls" | "demo-bmw" | "demo-ix3";

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

/**
 * DEMO-RESULTS-001: demosøk for det kuraterte, SYNTETISKE iX3-resultatsettet (`dix3-*`, se fixtures/demo-ix3.ts). Kravene er bare de demokilden kan oppgi
 * (merke/modell, drivstoff, girkasse, karosseri, førstegangsregistrering, kilometerstand). Utstyr, interiørfarge og farge er ØNSKER («ønskelig»): demokilden kan
 * ikke vurdere utstyr/interiør (ukjent for alle), og ønsker påvirker aldri kravstatusen. Hjuldrift og batterihelse er ikke tatt med: hjuldrift ville vært et krav som
 * kilden ikke kan vurdere (alle biler ville blitt «Må kontrolleres»), og batterihelse finnes ikke i søkemodellen.
 */
function demoIx3(): FormValues {
  return {
    ...emptyFormValues(),
    name: "Demo: BMW iX3 elektrisk",
    brand: "bmw", model: "ix3",
    regFrom: "2023-03",
    maxMileageKm: "40 000",
    fuels: ["electric"], transmissions: ["automatic"], bodyTypes: ["suv"],
    exteriorColors: ["grey"], exteriorColorsPriority: "nice",
    interiorColors: ["black"], interiorColorsPriority: "nice",
    "eq:panoramic_roof": "nice", "eq:camera_360": "nice", "eq:park_front": "nice", "eq:park_rear": "nice",
    plannedRegistration: "passenger",
    budgetMax: "450 000", budgetDeviation: "10",
    "cost.transport.use": "true", "cost.transport.currency": "NOK", "cost.transport.amount": "8 000", "cost.transport.vat": "excl", "cost.transport.included": "true",
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
  {
    id: "demo-ix3",
    title: "Demosøk BMW iX3 (syntetiske resultater)",
    note: "Syntetiske demodata — ikke ekte annonser og ikke hentet fra noen leverandør. Kravene er det demokilden kan oppgi; utstyr, interiørfarge og farge er ønsker. Demokilden kan ikke vurdere utstyr og interiør, så de vises som «ikke oppgitt». Her finnes biler som oppfyller kravene, biler som må kontrolleres og biler som ikke oppfyller dem.",
    values: demoIx3,
  },
];

export function exampleById(id: string | undefined): ExampleInfo | null {
  return EXAMPLES.find((e) => e.id === id) ?? null;
}
