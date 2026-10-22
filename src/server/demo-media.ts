/**
 * Lokale DEMO-ASSETS og demoberikelse for syntetiske annonser (DEMO-RESULTS-001). Bilder og tilleggsopplysninger hører til den kuraterte
 * demoannonsen `dix3-001` og leveres fra `public/demo/…` — de er IKKE hentet fra mobile.de eller noen annen leverandør, og vises alltid
 * med demomerking. Slås opp på serversiden fra kildens egen annonse-id og når UI bare som ferdig visningsmodell (ingen rå id).
 *
 * Erstatning senere: UI leser bare `ListingMedia` (`origin` + bildeliste). Provider-media (med egen rettighetskontroll) kan levere samme
 * form via en annen resolver uten at detaljsiden bygges om. Berikelsen er ikke søkekriterier og leses aldri av evaluatoren.
 */
import type { NormalizedListing } from "@/domain/types";

export interface MediaImage { src: string; alt: string; group: "exterior" | "interior" | "detail" }
export interface ListingMedia {
  /** `local_demo_asset` = bilde som ligger i repoet som demo; aldri leverandørhentet. */
  origin: "local_demo_asset" | "provider";
  images: readonly MediaImage[];
}
/** Demoberiket informasjon: kjent på demobilen, men ikke del av råformatet og ikke et søkekriterium. Ukjent er `null`, aldri 0/«nei». */
export interface ListingEnrichment {
  origin: "demo_enrichment";
  batteryHealthPct: number | null;
  batteryCapacityKwh: number | null;
  powerHp: number | null;
  driveTrain: string | null;
  paintName: string | null;
  interiorColor: string | null;
  owners: number | null;
  /** Utstyr som er kjent på demobilen. Tom liste = ikke oppgitt (ikke «uten utstyr»). */
  knownEquipment: readonly string[];
}

const DIR = "/demo/vehicles/bmw-ix3";
const img = (file: string, group: MediaImage["group"], alt: string): MediaImage => ({ src: `${DIR}/${file}.jpg`, group, alt });

/** Rekkefølgen er galleriets rekkefølge; første bilde er hovedbilde/miniatyr. */
export const IX3_DEMO_IMAGES: readonly MediaImage[] = [
  img("fd2067ac-7084-4171-809f-68ed2478385a", "exterior", "Demobilde: BMW iX3 sett skrått forfra"),
  img("8f28cf3f-953c-41f9-ae50-35397f3598d5", "exterior", "Demobilde: BMW iX3 sett skrått bakfra"),
  img("d3aa8613-dc57-4661-bd9d-b71244ce70c6", "exterior", "Demobilde: BMW iX3 sett rett forfra"),
  img("266b1dd3-7737-42c7-8266-cdd51de47372", "exterior", "Demobilde: BMW iX3 sett skrått bakfra, alternativ vinkel"),
  img("6b7d602a-b44e-4d37-8b20-8e7213f369ca", "interior", "Demobilde: bredt interiør"),
  img("0184fcc1-8bd6-4ce6-a766-d91071135c7d", "interior", "Demobilde: førerplass med instrumentering og infotainment"),
  img("bace29ac-7d45-4db3-8f3f-cf2128a0b904", "interior", "Demobilde: interiør og midtkonsoll"),
  img("39633f28-0749-4357-88af-14b7fc737e09", "detail", "Demobilde: felg"),
];

const IX3_ENRICHMENT: ListingEnrichment = {
  origin: "demo_enrichment",
  batteryHealthPct: 96.3,
  batteryCapacityKwh: 78,
  powerHp: 286,
  driveTrain: "Bakhjulsdrift",
  paintName: "Sophistograu metallic",
  interiorColor: "Sort",
  owners: 1,
  knownEquipment: ["Panoramatak", "360-kamera", "Parkeringssensorer foran og bak", "Hengerfeste"],
};

const DEMO_SOURCE = "synthetic-demo";
/** Bare den kuraterte toppannonsen har egne bilder og berikelse; alle andre poster får ingen (ingen gjenbruk av bilder på andre biler). */
const MEDIA_BY_LISTING: Readonly<Record<string, { media: ListingMedia; enrichment: ListingEnrichment }>> = {
  "dix3-001": { media: { origin: "local_demo_asset", images: IX3_DEMO_IMAGES }, enrichment: IX3_ENRICHMENT },
};

/** Bare syntetiske annonser kan få lokale demo-assets. Ekte leverandørmedia krever egen rettighetskontroll og går ikke gjennom denne. */
function entryFor(l: NormalizedListing) {
  if (l.provenance.kind !== "synthetic" || l.source !== DEMO_SOURCE) return null;
  return MEDIA_BY_LISTING[l.sourceListingId] ?? null;
}
export const demoMediaFor = (l: NormalizedListing): ListingMedia | null => entryFor(l)?.media ?? null;
export const demoEnrichmentFor = (l: NormalizedListing): ListingEnrichment | null => entryFor(l)?.enrichment ?? null;
