/**
 * Prototypens feltkatalog slik adapteren kjenner den (id, visningsnavn, felttype og grenser).
 *
 * NØDVENDIG DUPLISERING: prototypen (`prototypes/merovo-search/js/data.js`) er JavaScript utenfor domenelaget og
 * importeres aldri av kildekoden. Tabellen her er en bevisst kopi av det adapteren må vite for å validere et
 * eksportdokument strukturelt. En test sammenligner den felt for felt med prototypens faktiske katalog
 * (id, etikett, type, enhet, grenser), så en endring i prototypen gir en rød test i stedet for stille avvik.
 * Statusen «støttet nå / planlagt senere / ikke relevant» hentes fra domenets PROTOTYPE_MAPPING, ikke herfra.
 *
 * Valgmengder (options) er ikke kopiert for felt adapteren ikke kan overføre; for disse valideres bare formen.
 * Støttede lister (karosseri, drivstoff, gir, hjuldrift, farger, materiale, merke/modell, utstyr) valideres mot
 * domenets enums eller den injiserte katalogen.
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

/** Felt som i prototypen har egen prioritet via `equipment`-seksjonen (ikke boolsk utstyr). */
export const PRIORITY_SELECT_FIELDS: readonly string[] = ["towbar", "cruise", "climate"];

/** Prototypens faste kostnadslinjer → domenets kostnadstype. */
export const FIXED_COST_KINDS: Readonly<Record<string, "transport" | "travel" | "insurance" | "preparation">> = {
  transport: "transport",
  travel: "travel",
  insurance: "insurance",
  prep: "preparation",
};
