/**
 * Hjelper for å bygge en injiserbar katalog fra rene data (SearchCatalog-kontrakten i types.ts).
 * Domenet leverer ingen katalog selv: innholdet kommer fra den som injiserer den (test-fixture nå,
 * kontrollert kildekartlegging senere). Oppslag bruker Map/Set, så arvede nøkler som «toString» eller
 * «__proto__» aldri er gyldige verdier.
 */
import type { SearchCatalog } from "./types";

export interface StaticCatalogData {
  id: string;
  /** Merkenøkkel → modellnøkler. */
  brands: Readonly<Record<string, readonly string[]>>;
  equipment: readonly string[];
  exteriorColors: readonly string[];
  interiorColors: readonly string[];
  interiorMaterials: readonly string[];
}

export function staticCatalog(data: StaticCatalogData): SearchCatalog {
  const brands = new Map<string, Set<string>>();
  for (const b of Object.keys(data.brands)) brands.set(b, new Set(data.brands[b]));
  const equipment = new Set(data.equipment);
  const ext = new Set(data.exteriorColors);
  const int = new Set(data.interiorColors);
  const mat = new Set(data.interiorMaterials);
  return {
    id: data.id,
    hasBrand: (b) => brands.has(b),
    hasModel: (b, m) => brands.get(b)?.has(m) ?? false,
    hasEquipment: (k) => equipment.has(k),
    hasExteriorColor: (k) => ext.has(k),
    hasInteriorColor: (k) => int.has(k),
    hasInteriorMaterial: (k) => mat.has(k),
  };
}
