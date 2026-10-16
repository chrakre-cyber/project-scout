/**
 * Eksplisitte mappingdata for den SYNTETISKE kilden «synthetic-demo» (DEV-003-datasettet) mot katalogen som
 * prototypen bruker som demonstrasjonskatalog. Syntetiske data: ingen mobile.de-data og ingen produksjonskatalog.
 *
 * Bare kombinasjoner som finnes i katalogen er mappet. Resten (Toyota, Skoda, Hyundai, Ford, Tesla, Kia, Peugeot,
 * Porsche 911, VW ID.4 …) er bevisst ikke mappet: kandidatfeltet blir null med forklaring.
 * Endring av innholdet her (eller mappingversjonen) gir ny kandidatrevisjon.
 */
import type { CandidateMappingData } from "./mapping";

export const SYNTHETIC_MAPPING_DATA: CandidateMappingData = {
  sourceId: "synthetic-demo",
  version: "1",
  brands: [
    { source: "Audi", target: "audi" },
    { source: "BMW", target: "bmw" },
    { source: "Mercedes-Benz", target: "mercedes-benz" },
    { source: "Porsche", target: "porsche" },
    { source: "Volkswagen", target: "volkswagen" },
    { source: "Volvo", target: "volvo" },
  ],
  models: [
    { brand: "audi", source: "A6", target: "a6" },
    { brand: "audi", source: "Q5", target: "q5" },
    { brand: "bmw", source: "3er", target: "3-serie" },
    { brand: "bmw", source: "X3", target: "x3" },
    { brand: "mercedes-benz", source: "C-Klasse", target: "c-klasse" },
    { brand: "mercedes-benz", source: "E-Klasse", target: "e-klasse" },
    { brand: "volkswagen", source: "Passat", target: "passat" },
    { brand: "volkswagen", source: "Golf", target: "golf" },
    { brand: "volvo", source: "XC60", target: "xc60" },
  ],
  exteriorColors: [
    { source: "Svart", target: "black" },
    { source: "Hvit", target: "white" },
    { source: "Grå", target: "grey" },
    { source: "Blå", target: "blue" },
    { source: "Rød", target: "red" },
    { source: "Gul", target: "yellow" },
  ],
};
