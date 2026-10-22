/**
 * Kuratert SYNTETISK resultatsett for demosøket «BMW iX3» (DEMO-RESULTS-001): ti oppdiktede annonser (`dix3-001`…`dix3-010`) som lar
 * produktomvisningen vise realistisk klassifisering — uten live leverandørdata.
 *
 * Alle poster er oppdiktet av Project Scout. De er ikke ekte annonser, ikke fra noen leverandør eller markedsplass (ingen påstand om mobile.de eller
 * annen integrasjon), og har ingen originalannonse. Posten er bare ÉN råpost i den eksisterende syntetiske kilden; klassifiseringen («Oppfyller kravene» /
 * «Må kontrolleres» / «Oppfyller ikke kravene») gjøres av den vanlige vurderingen (`evaluateCandidate`) mot demosøket `demo-ix3` — ingen etikett eller
 * status står i dataene her, og ingenting her kan overstyre vurderingen.
 *
 * HVA KILDEN KAN OG IKKE KAN OPPGI (uendret): råformatet har merke/modell/variant, førstegangsregistrering, kilometerstand, drivstoff, girkasse, karosseri,
 * effekt og utvendig farge. Det har IKKE utstyr, interiørfarge, hjuldrift eller batterihelse, og kandidatadapteren utleder aldri slikt fra fritekst. Slike
 * opplysninger står derfor bare i annonseteksten («ubetrodd tekst, vises som den er») og er IKKE søkekriterier: for vurderingen er de ukjent/null. Batterihelse
 * (96,3 % i toppannonsen) finnes ikke i søkemodellen og er bare vist demodata.
 *
 * Pris er annonsepris med oppgitt prisgrunnlag; den er aldri total innkjøpskostnad til Norge, og ingen mva.-/fradragsrett utledes av annonsen.
 *
 * Utfall med demosøkets krav (BMW iX3, elektrisk, automat, SUV, førstegangsregistrert fra 2023-03, maks 40 000 km):
 *   Oppfyller kravene (3): 001, 002, 003 — alle krav kjent og oppfylt (002 ligger nøyaktig på kilometergrensen).
 *   Må kontrolleres (3):   004 (kilometerstand ikke oppgitt), 005 (registrert bare «2023» — for grovt mot grensen 2023-03), 006 (girkasse ikke oppgitt).
 *   Oppfyller ikke (4):    007 (registrert 2021-09, før 2023-03), 008 (78 000 km), 009 (registrert 2022-11 og 64 500 km), 010 (40 500 km: 500 km over grensen).
 */
import type { SyntheticRawListing } from "../raw";

const NOTE = "Syntetisk demoannonse (ikke en ekte annonse, ikke fra noen markedsplass). Exportpreis netto.";
const base = (n: number) => ({
  modifiedAt: "2026-10-05T09:00:00Z",
  observed: { firstSeenAt: `2026-10-${String(n).padStart(2, "0")}T08:00:00Z`, lastSeenAt: "2026-10-12T18:00:00Z" },
  seller: { type: "DEALER" as const, country: "DE", city: "Demostad" },
});
const price = (amount: string) => ({ amount, currency: "EUR", type: "NET" as const, typeEvidence: "Exportpreis netto" });
const ix3 = { make: "BMW", model: "iX3", fuel: "ELECTRIC", gearbox: "AUTOMATIC", body: "SUV", powerKw: 210 };

export const demoIx3RawListings: SyntheticRawListing[] = [
  // 001 — toppannonsen, modellert på demotilfellet: iX3 Inspiring, 03/2024, 22 000 km, elektrisk, automat, bakhjulsdrift, ca. 36 950 € netto, grå utvendig.
  // Utstyr, interiørfarge, hjuldrift og batterihelse står bare i teksten (ikke i råformatet) og er ukjent for vurderingen.
  {
    id: "dix3-001", ...base(1), price: price("36950"),
    vehicle: { ...ix3, variant: "Inspiring", firstRegistration: "2024-03", mileage: { value: 22_000, unit: "KM" }, color: "Grå" },
    description: `${NOTE} Oppgitt i demoteksten: bakhjulsdrift, svart interiør, panoramatak, 360-kamera, parkeringssensorer foran og bak. Batterihelse 96,3 % (demodata, ikke et søkekriterium).`,
  },
  // 002 — oppfyller kravene; nøyaktig 40 000 km (grensen er «høyst», så akkurat på grensen er oppfylt). Svart utvendig: fargeønsket (grå) er kjent og ikke oppfylt — ønsker utelukker aldri.
  { id: "dix3-002", ...base(2), price: price("34900"), vehicle: { ...ix3, variant: "Inspiring", firstRegistration: "2023-11", mileage: { value: 40_000, unit: "KM" }, color: "Svart" }, description: `${NOTE} Batterihelse 94,1 % (demodata).` },
  // 003 — oppfyller kravene; annen utførelse og farge (hvit).
  { id: "dix3-003", ...base(3), price: price("41200"), vehicle: { ...ix3, variant: "Impressive", firstRegistration: "2024-05", mileage: { value: 12_800, unit: "KM" }, color: "Hvit" }, description: NOTE },
  // 004 — kilometerstand er ikke oppgitt: kravet er ukjent (null, ikke 0) → må kontrolleres.
  { id: "dix3-004", ...base(4), price: price("35800"), vehicle: { ...ix3, variant: "Inspiring", firstRegistration: "2024-01", mileage: null, color: "Grå" }, description: NOTE },
  // 005 — førstegangsregistrering oppgitt bare som år («2023»): tidsrommet 2023-01…2023-12 ligger på begge sider av grensen 2023-03 → ukjent, ikke bestått, ikke brudd → må kontrolleres.
  { id: "dix3-005", ...base(5), price: price("33300"), vehicle: { ...ix3, variant: "Inspiring", firstRegistration: "2023", mileage: { value: 27_000, unit: "KM" }, color: "Svart" }, description: NOTE },
  // 006 — girkasse er ikke oppgitt: kravet «automat» er ukjent → må kontrolleres.
  { id: "dix3-006", ...base(6), price: price("39500"), vehicle: { ...ix3, variant: "Impressive", gearbox: null, firstRegistration: "2024-02", mileage: { value: 18_000, unit: "KM" }, color: "Blå" }, description: NOTE },
  // 007 — kjent kravbrudd: registrert 2021-09, før 2023-03 (kilometerstand er innenfor).
  { id: "dix3-007", ...base(7), price: price("27900"), vehicle: { ...ix3, variant: "Inspiring", firstRegistration: "2021-09", mileage: { value: 36_000, unit: "KM" }, color: "Grå" }, description: NOTE },
  // 008 — kjent kravbrudd: 78 000 km, over grensen 40 000 (registreringen er innenfor).
  { id: "dix3-008", ...base(8), price: price("28700"), vehicle: { ...ix3, variant: "Inspiring", firstRegistration: "2023-06", mileage: { value: 78_000, unit: "KM" }, color: "Hvit" }, description: NOTE },
  // 009 — to kjente kravbrudd: registrert 2022-11 (før 2023-03) og 64 500 km (over 40 000).
  { id: "dix3-009", ...base(9), price: price("26500"), vehicle: { ...ix3, variant: "Inspiring", firstRegistration: "2022-11", mileage: { value: 64_500, unit: "KM" }, color: "Svart" }, description: NOTE },
  // 010 — kjent kravbrudd på kanten: 40 500 km er 500 km over grensen (registreringen er innenfor).
  { id: "dix3-010", ...base(10), price: price("35200"), vehicle: { ...ix3, variant: "Impressive", firstRegistration: "2024-04", mileage: { value: 40_500, unit: "KM" }, color: "Grå" }, description: NOTE },
];
