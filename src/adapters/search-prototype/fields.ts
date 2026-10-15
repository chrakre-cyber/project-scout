/**
 * Prototypens feltkatalog slik adapteren kjenner den (id, visningsnavn, felttype og grenser).
 *
 * NØDVENDIG DUPLISERING: prototypen (`prototypes/merovo-search/js/data.js`) er JavaScript utenfor domenelaget og
 * importeres aldri av kildekoden. Tabellen her er en bevisst kopi av det adapteren må vite for å validere et
 * eksportdokument strukturelt. En test sammenligner den felt for felt med prototypens faktiske katalog
 * (id, etikett, type, enhet, grenser), så en endring i prototypen gir en rød test i stedet for stille avvik.
 * Statusen «støttet nå / planlagt senere / ikke relevant» hentes fra domenets PROTOTYPE_MAPPING, ikke herfra.
 *
 * Valgmengdene (FIELD_OPTIONS) er kopiert for ALLE valgfelt, også dem adapteren ikke kan overføre, slik at et
 * skadet dokument blir «ugyldig» og ikke «blokkert». Merke, modell og utstyr valideres mot den injiserte katalogen
 * (og farger/materiale i tillegg mot prototypens valg); modellens pakkenavn kan ikke valideres uten pakkekatalog.
 */
export type FieldKind =
  | "brand" | "model" | "variant" | "packages" | "range" | "regrange" | "max" | "multi" | "colors"
  | "select" | "radio" | "power" | "weight" | "consumption" | "towbar" | "equipSelect" | "month" | "text";

export interface FieldSpec {
  id: string;
  label: string;
  kind: FieldKind;
  unit?: string;
  min?: number;
  max?: number;
  /** For kind «max»: true når grensen er et minimum («minst»). */
  minimum?: boolean;
  /** Høyeste tekstlengde for variant/tekst. */
  maxLength?: number;
}

const f = (id: string, label: string, kind: FieldKind, extra: Partial<FieldSpec> = {}): FieldSpec => ({ id, label, kind, ...extra });

export const PROTOTYPE_FIELDS: readonly FieldSpec[] = [
  f("brand", "Merke", "brand"),
  f("model", "Modell", "model"),
  f("variant", "Variant", "variant", { maxLength: 60 }),
  f("packages", "Utstyrspakke (modellavhengig)", "packages"),
  f("modelYear", "Modellår", "range", { unit: "år", min: 1950, max: 2100 }),
  f("firstReg", "Førstegangsregistrering", "regrange"),
  f("mileage", "Kilometerstand (maks)", "max", { unit: "km", min: 1, max: 2000000, minimum: false }),
  f("body", "Karosseri", "multi"),
  f("seats", "Antall seter", "range", { unit: "seter", min: 1, max: 20 }),
  f("doors", "Antall dører", "select"),
  f("fuel", "Drivstoff / drivlinje", "multi"),
  f("gear", "Girkasse", "multi"),
  f("drive", "Hjuldrift", "multi"),
  f("power", "Effekt", "power"),
  f("displacement", "Slagvolum", "range", { unit: "cm³", min: 50, max: 10000 }),
  f("cylinders", "Sylindre", "range", { unit: "sylindre", min: 1, max: 16 }),
  f("weight", "Vekt (maks)", "weight"),
  f("consumption", "Forbruk (maks)", "consumption"),
  f("euro", "Utslippsklasse", "multi"),
  f("sliding", "Skyvedør", "radio"),
  f("extColor", "Utvendig farge", "colors"),
  f("extFinish", "Lakktype", "multi"),
  f("towbar", "Hengerfeste", "towbar"),
  f("trailerBraked", "Tilhengervekt med brems (minst)", "max", { unit: "kg", min: 1, max: 10000, minimum: true }),
  f("trailerUnbraked", "Tilhengervekt uten brems (minst)", "max", { unit: "kg", min: 1, max: 10000, minimum: true }),
  f("noseWeight", "Kuletrykk (minst)", "max", { unit: "kg", min: 1, max: 500, minimum: true }),
  f("cruise", "Cruisekontroll", "equipSelect"),
  f("intColor", "Interiørfarge", "colors"),
  f("material", "Interiørmateriale", "multi"),
  f("climate", "Klima", "equipSelect"),
  f("newUsed", "Ny / brukt", "radio"),
  f("damage", "Skadestatus (oppgitt i annonsen)", "radio"),
  f("service", "Service (oppgitt i annonsen)", "multi"),
  f("warranty", "Garanti (oppgitt i annonsen)", "multi"),
  f("certification", "Bruktbilprogram / sertifisering", "select"),
  f("owners", "Tidligere eiere (maks)", "max", { unit: "eiere", min: 0, max: 20, minimum: false }),
  f("prevUse", "Tidligere bruk (oppgitt i annonsen)", "multi"),
  f("inspection", "Kontroll gyldig til (minst)", "month"),
  f("seller", "Selgertype", "multi"),
  f("country", "Land (selgers)", "multi"),
  f("vat", "Mva. oppgitt i annonsen", "radio"),
  f("adAge", "Annonsens alder", "select"),
  f("freeText", "Søk i annonsetekst (supplerende)", "text", { maxLength: 200 }),
];


/**
 * Gyldige valgverdier (uten «alle»-valget "") for prototypens valgfelt, kopiert fra prototypens katalog og
 * sammenlignet med den i kontrakttest. Brukes også for felt adapteren ikke kan overføre, slik at et ukjent valg gir
 * «ugyldig dokument» og ikke «blokkert». Merke, modell, pakker og utstyr valideres ikke her (katalogen er autoritativ).
 */
export const FIELD_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  body: ["sedan", "estate", "suv", "hatchback", "coupe", "convertible", "van", "other"],
  doors: ["2-3", "4-5", "6-7"],
  fuel: ["petrol", "diesel", "electric", "hybrid", "plugin_hybrid"],
  gear: ["automatic", "manual"],
  drive: ["awd", "fwd", "rwd"],
  euro: ["euro4", "euro5", "euro6"],
  sliding: ["right", "left", "both"],
  extColor: ["black", "white", "grey", "silver", "blue", "red", "green", "brown", "beige", "yellow", "orange", "other"],
  extFinish: ["metallic", "matt"],
  towbar: ["any", "fixed_removable_swivel", "removable_swivel", "swivel_only"],
  cruise: ["any", "adaptive"],
  intColor: ["beige", "black", "blue", "brown", "grey", "red", "other"],
  material: ["leather", "part_leather", "faux_leather", "fabric", "alcantara", "velour", "other"],
  climate: ["ac", "auto", "min2", "min3", "exact2", "exact3", "exact4"],
  newUsed: ["new", "used"],
  damage: ["exclude", "only"],
  service: ["history", "recent"],
  warranty: ["warranty"],
  certification: ["audi-plus", "bmw-ps", "mb-certified", "das-weltauto"],
  prevUse: ["demo", "taxi", "rental"],
  seller: ["dealer", "private", "company"],
  country: ["AT", "BE", "CH", "DE", "DK", "ES", "FR", "IT", "NL", "PL", "SE"],
  vat: ["specifiable", "not_specifiable"],
  adAge: ["1", "3", "7", "14"],
};

/** Felt som i prototypen har egen prioritet via `equipment`-seksjonen (ikke boolsk utstyr). */
export const PRIORITY_SELECT_FIELDS: readonly string[] = ["towbar", "cruise", "climate"];

/** Prototypens faste kostnadslinjer → domenets kostnadstype. */
export const FIXED_COST_KINDS: Readonly<Record<string, "transport" | "travel" | "insurance" | "preparation">> = {
  transport: "transport",
  travel: "travel",
  insurance: "insurance",
  prep: "preparation",
};
