/**
 * Hva den SYNTETISKE kilden («synthetic-demo») faktisk kan levere til søkemodellen via kandidatadapteren
 * (SEARCH-004). Brukes til å fortelle brukeren hvilke krav demokilden ikke kan vurdere («ikke oppgitt»), i stedet for
 * å la det se ut som en bil bare mangler egenskapen. En kontrakttest sammenligner tabellen med de faktiske
 * annonsene: felt satt til false er null for ALLE kandidater, felt satt til true er kjent for minst én.
 * Merke/modell er bare kjent der kildens tekst er mappet til en katalognøkkel (se synthetic-mapping-data.ts).
 */
import type { SourceCapabilities } from "@/domain/search-v2/types";

export const SYNTHETIC_SOURCE_CAPABILITIES: SourceCapabilities = {
  id: "synthetic-demo",
  fields: {
    brand: true, model: true, variant: true,
    modelYear: false, firstRegistration: true, maxMileage: true, seats: false,
    bodyTypes: true, fuels: true, transmissions: true, driveTrains: false,
    exteriorColors: true, interiorColors: false, interiorMaterials: false,
  },
  equipment: false,
};
