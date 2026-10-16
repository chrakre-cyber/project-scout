/**
 * Demokatalog for søk (SEARCH-005): merker, modeller, farger, materialer og utstyr slik prototypen
 * `prototypes/merovo-search` (SEARCH-001A-UI) kjenner dem. DEMONSTRASJONSUTVALG — ikke en fullstendig
 * katalog og ikke produksjonsfasit. Katalogen er injisert i domenet gjennom `SearchCatalog`.
 *
 * NØDVENDIG DUPLISERING: prototypen er JavaScript utenfor kildekoden og importeres aldri. En kontrakttest
 * (tests/search-catalog.test.ts) sammenligner denne filen felt for felt med prototypens data.js, så en endring
 * i prototypen gir rød test i stedet for stille avvik. Pakker (`packages`) er bevisst utelatt: de støttes ikke
 * som kriterium i søkemodell v1.
 */
import { staticCatalog } from "@/domain/search-v2/catalog";
import type { SearchCatalog } from "@/domain/search-v2/types";

export const DEMO_CATALOG_ID = "merovo-demo-catalog-v1";

export interface CatalogOption {
  key: string;
  label: string;
}
export interface CatalogModel extends CatalogOption {
  /** Variantforslag (fritekst er alltid tillatt under gyldig modell). */
  variants: readonly string[];
}
export interface EquipmentGroup {
  id: string;
  section: "exterior" | "interior";
  title: string;
  /** Antall elementer som vises direkte; resten ligger bak «Vis flere». */
  visible: number;
  items: readonly CatalogOption[];
}

export const DEMO_BRANDS: readonly CatalogOption[] = [
  { key: "audi", label: "Audi" },
  { key: "bmw", label: "BMW" },
  { key: "land-rover", label: "Land Rover" },
  { key: "mercedes-benz", label: "Mercedes-Benz" },
  { key: "porsche", label: "Porsche" },
  { key: "volkswagen", label: "Volkswagen" },
  { key: "volvo", label: "Volvo" },
];

export const DEMO_MODELS: Readonly<Record<string, readonly CatalogModel[]>> = {
  "audi": [
    { key: "a4", label: "A4", variants: ["A4 Avant 40 TDI","A4 Avant 45 TFSI"] },
    { key: "a6", label: "A6", variants: ["A6 Avant 40 TDI","A6 Avant 55 TFSI e"] },
    { key: "q5", label: "Q5", variants: ["Q5 40 TDI quattro","Q5 50 TFSI e"] },
    { key: "q7", label: "Q7", variants: ["Q7 50 TDI quattro","Q7 55 TFSI e"] },
  ],
  "bmw": [
    { key: "3-serie", label: "3-serie", variants: ["320d xDrive","330e"] },
    { key: "5-serie", label: "5-serie", variants: ["520d xDrive","530e"] },
    { key: "x3", label: "X3", variants: ["xDrive20d","xDrive30e"] },
    { key: "x5", label: "X5", variants: ["xDrive30d","xDrive45e"] },
  ],
  "land-rover": [
    { key: "defender", label: "Defender", variants: ["Defender 110 D250"] },
    { key: "discovery", label: "Discovery", variants: ["Discovery D250"] },
    { key: "range-rover", label: "Range Rover", variants: ["Range Rover D350","Range Rover P440e"] },
  ],
  "mercedes-benz": [
    { key: "c-klasse", label: "C-klasse", variants: ["C 220 d","C 300 e"] },
    { key: "e-klasse", label: "E-klasse", variants: ["E 220 d","E 300 e"] },
    { key: "gle", label: "GLE", variants: ["GLE 350 de 4MATIC","GLE 450 4MATIC"] },
    { key: "gls", label: "GLS", variants: ["GLS 400 d 4MATIC","GLS 450 4MATIC","GLS 580 4MATIC"] },
    { key: "s-klasse", label: "S-klasse", variants: ["S 400 d 4MATIC","S 580 e"] },
  ],
  "porsche": [
    { key: "cayenne", label: "Cayenne", variants: ["Cayenne E-Hybrid"] },
    { key: "macan", label: "Macan", variants: ["Macan 4","Macan S"] },
  ],
  "volkswagen": [
    { key: "golf", label: "Golf", variants: ["Golf 1.5 eTSI","Golf GTI"] },
    { key: "passat", label: "Passat", variants: ["Passat 2.0 TDI"] },
    { key: "tiguan", label: "Tiguan", variants: ["Tiguan 2.0 TDI 4Motion"] },
    { key: "touareg", label: "Touareg", variants: ["Touareg 3.0 TDI"] },
  ],
  "volvo": [
    { key: "xc60", label: "XC60", variants: ["XC60 B5 AWD","XC60 T6 Recharge"] },
    { key: "xc90", label: "XC90", variants: ["XC90 B5 AWD","XC90 T8 Recharge"] },
  ],
};

export const DEMO_EXTERIOR_COLORS: readonly CatalogOption[] = [
  { key: "black", label: "Svart" },
  { key: "white", label: "Hvit" },
  { key: "grey", label: "Grå" },
  { key: "silver", label: "Sølv" },
  { key: "blue", label: "Blå" },
  { key: "red", label: "Rød" },
  { key: "green", label: "Grønn" },
  { key: "brown", label: "Brun" },
  { key: "beige", label: "Beige" },
  { key: "yellow", label: "Gul" },
  { key: "orange", label: "Oransje" },
  { key: "other", label: "Annen farge" },
];

export const DEMO_INTERIOR_COLORS: readonly CatalogOption[] = [
  { key: "beige", label: "Beige" },
  { key: "black", label: "Svart" },
  { key: "blue", label: "Blå" },
  { key: "brown", label: "Brun" },
  { key: "grey", label: "Grå" },
  { key: "red", label: "Rød" },
  { key: "other", label: "Annen farge" },
];

export const DEMO_INTERIOR_MATERIALS: readonly CatalogOption[] = [
  { key: "leather", label: "Skinn" },
  { key: "part_leather", label: "Delskinn" },
  { key: "faux_leather", label: "Kunstskinn" },
  { key: "fabric", label: "Stoff" },
  { key: "alcantara", label: "Alcantara" },
  { key: "velour", label: "Velur" },
  { key: "other", label: "Annet" },
];

export const DEMO_EQUIPMENT_GROUPS: readonly EquipmentGroup[] = [
  {
    id: "parking", section: "exterior", title: "Parkering og kamera", visible: 6,
    items: [
      { key: "park_front", label: "Parkeringssensor foran" },
      { key: "park_rear", label: "Parkeringssensor bak" },
      { key: "rear_camera", label: "Ryggekamera" },
      { key: "camera_360", label: "360-kamera" },
      { key: "auto_park", label: "Automatisk parkering" },
      { key: "exit_assist", label: "Utkjøringsassistent" },
    ],
  },
  {
    id: "driving", section: "exterior", title: "Kjøreutstyr og eksteriør", visible: 12,
    items: [
      { key: "air_suspension", label: "Luftfjæring" },
      { key: "adaptive_chassis", label: "Adaptivt understell" },
      { key: "panoramic_roof", label: "Panoramatak" },
      { key: "sunroof", label: "Soltak / skyvetak" },
      { key: "power_tailgate", label: "Elektrisk bakluke" },
      { key: "led_headlights", label: "LED-hovedlys" },
      { key: "laser_light", label: "Laserlys" },
      { key: "high_beam_assist", label: "Fjernlysassistent" },
      { key: "blind_spot", label: "Blindsonevarsling" },
      { key: "lane_keep", label: "Filholder" },
      { key: "traffic_sign", label: "Trafikkskiltgjenkjenning" },
      { key: "winter_package", label: "Vinterpakke" },
      { key: "xenon", label: "Xenonlys" },
      { key: "heated_windscreen", label: "Oppvarmet frontrute" },
      { key: "extra_wheels", label: "Ekstra hjulsett" },
      { key: "emergency_brake", label: "Nødbremsassistent" },
      { key: "adaptive_cornering", label: "Adaptivt kurvelys" },
      { key: "sport_suspension", label: "Sportsfjæring" },
      { key: "night_vision", label: "Nattsynsassistent" },
      { key: "tyre_pressure", label: "Dekktrykkovervåking" },
      { key: "headlight_washers", label: "Lykterengjøring" },
      { key: "roof_rails", label: "Takrails" },
    ],
  },
  {
    id: "seats", section: "interior", title: "Seteutstyr", visible: 7,
    items: [
      { key: "power_seats", label: "Elektriske seter" },
      { key: "seat_memory", label: "Setehukommelse" },
      { key: "heated_seats_front", label: "Setevarme foran" },
      { key: "heated_seats_rear", label: "Setevarme bak" },
      { key: "ventilated_seats", label: "Ventilerte seter" },
      { key: "massage_seats", label: "Massasjeseter" },
      { key: "sport_seats", label: "Sportsseter" },
    ],
  },
  {
    id: "interior_other", section: "interior", title: "Annet interiørutstyr", visible: 8,
    items: [
      { key: "heated_steering", label: "Rattvarme" },
      { key: "head_up", label: "Head-up-display" },
      { key: "carplay", label: "Apple CarPlay" },
      { key: "android_auto", label: "Android Auto" },
      { key: "dab", label: "DAB-radio" },
      { key: "navigation", label: "Navigasjon" },
      { key: "premium_audio", label: "Premium lydanlegg" },
      { key: "wireless_charging", label: "Trådløs lading" },
      { key: "isofix", label: "Isofix" },
      { key: "parking_heater", label: "Parkeringsvarmer" },
      { key: "keyless", label: "Nøkkelfri adgang" },
      { key: "digital_cockpit", label: "Digitalt instrumentpanel" },
    ],
  },
];

export function buildDemoCatalog(): SearchCatalog {
  return staticCatalog({
    id: DEMO_CATALOG_ID,
    brands: Object.fromEntries(DEMO_BRANDS.map((b) => [b.key, (DEMO_MODELS[b.key] ?? []).map((m) => m.key)])),
    equipment: DEMO_EQUIPMENT_GROUPS.flatMap((g) => g.items.map((i) => i.key)),
    exteriorColors: DEMO_EXTERIOR_COLORS.map((c) => c.key),
    interiorColors: DEMO_INTERIOR_COLORS.map((c) => c.key),
    interiorMaterials: DEMO_INTERIOR_MATERIALS.map((m) => m.key),
  });
}

export const DEMO_CATALOG: SearchCatalog = buildDemoCatalog();
