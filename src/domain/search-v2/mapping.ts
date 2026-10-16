/**
 * Mappingtabell: alle kriterier i prototypen `prototypes/merovo-search` (SEARCH-001A-UI) → søkemodell v1.
 *
 * Tabellen er data for dokumentasjon og avvisning; domenet importerer ikke prototypekode. En test
 * sammenligner tabellen med prototypens faktiske feltkatalog, så et nytt prototypefelt uten
 * tabellrad (eller en rad uten felt) feiler. Felter som ikke er `supported_now` avvises ved parsing
 * («criterion_not_supported»), de ignoreres aldri.
 *
 * ADAPTER (senere oppgave, bygges ikke her): en ren funksjon `prototypeDraftToSearchSpec` skal
 *  1. lese prototypefilen (`merovo.search-draft`, v2; v1 først etter prototypens egen migrering),
 *  2. bare overføre rader med status `supported_now` til feltet i `modelField`,
 *  3. returnere alle andre utfylte felter som en eksplisitt liste «ikke støttet» til brukeren (aldri stille bortfall),
 *  4. oversette enheter: prototypens `modelYear.unit "år"` → `year`; `firstReg` (ÅÅÅÅ / ÅÅÅÅ-MM) → presisjon
 *     «year»/«month»; `mileage` (km); `equipment[key].priority` → `equipment[].priority`;
 *     farger/materiale har INGEN prioritet i prototypen: adapteren må få prioriteten uttrykkelig fra brukeren
 *     (aldri velge «must» på egen hånd) eller avvise filen,
 *  5. oversette kostnadslinjer (`kind`, `label`, `currency` uavhengig av beløp, `vatBasis`, `includedInBudget`),
 *     budsjettet (`amountMinor`-streng → NOK, `basisPoints` → deviationBasisPoints), uten valutaomregning,
 *  6. IKKE utlede planlagt registrering: prototypen har ingen slik verdi; den må velges av brukeren,
 *  7. validere resultatet med `specFromJson`/`validateSpec` mot en injisert katalog.
 */

export type MappingStatus = "supported_now" | "planned_later" | "not_relevant_for_matching";
export type MappingKind = "field" | "equipment_group" | "budget";

export interface MappingRow {
  kind: MappingKind;
  /** Felt-id (eller utstyrsgruppe-id / budsjettnøkkel) i prototypen. */
  prototypeId: string;
  status: MappingStatus;
  /** Sti i søkemodellen når status er `supported_now`, ellers `null`. */
  modelField: string | null;
  note: string;
}

const now = (kind: MappingKind, prototypeId: string, modelField: string, note: string): MappingRow => ({ kind, prototypeId, status: "supported_now", modelField, note });
const later = (kind: MappingKind, prototypeId: string, note: string): MappingRow => ({ kind, prototypeId, status: "planned_later", modelField: null, note });
const na = (kind: MappingKind, prototypeId: string, note: string): MappingRow => ({ kind, prototypeId, status: "not_relevant_for_matching", modelField: null, note });

export const PROTOTYPE_MAPPING: readonly MappingRow[] = [
  now("field", "brand", "vehicle.brand", "Stabil katalognøkkel. Kandidatens merke må være mappet til nøkkel; ellers ukjent."),
  now("field", "model", "vehicle.model", "Krever merke. Ikke gjett modellfamilie fra delstreng."),
  now("field", "variant", "vehicle.variant", "Fritekst under gyldig modell; avvises aldri fordi en forslagsliste mangler den. Delstreng uten hensyn til store/små bokstaver."),
  later("field", "packages", "Pakke og enkeltutstyr er separate kriterier; en pakke beviser ikke enkeltutstyr. Krever kildemapping før den kan vurderes."),
  now("field", "modelYear", "requirements.modelYear", "Egen opplysning; utledes aldri av registreringsår. Ukjent modellår på kandidaten gir ukjent."),
  now("field", "firstReg", "requirements.firstRegistration", "Fra–til med eksplisitt presisjon (år/måned/dato). Ufullstendig kandidatdato som ikke avgjør grensen gir ukjent."),
  now("field", "mileage", "requirements.maxMileageKm", "Maksimum i km."),
  now("field", "body", "requirements.bodyTypes", "Liste med ELLER. Planlagt registrering (varebil) er IKKE et karosserifilter."),
  now("field", "seats", "requirements.seats", "Fra–til; eksakt antall = samme verdi begge sider."),
  later("field", "doors", "Krever kildekatalog for dørvalg."),
  now("field", "fuel", "requirements.fuels", "Liste med ELLER."),
  now("field", "gear", "requirements.transmissions", "Liste med ELLER."),
  now("field", "drive", "requirements.driveTrains", "Liste med ELLER. Krever eget kandidatfelt (driveTrain)."),
  later("field", "power", "Effekt krever kanonisk enhet (watt) og avklart presisjon; se prototypens `normalizedWatts`."),
  later("field", "displacement", "Avansert felt."),
  later("field", "cylinders", "Avansert felt."),
  later("field", "weight", "Krever vekttype (egenvekt ≠ tillatt totalvekt)."),
  later("field", "consumption", "Krever enhet og testmetode; liter/100 km og kWh/100 km blandes ikke."),
  later("field", "euro", "Utslippsklasse er separat fra CO₂; ingen avgift fra Euro-klasse."),
  later("field", "sliding", "Avansert detalj."),
  now("field", "extColor", "appearance.exteriorColors", "Liste med ELLER og én felles prioritet. Kandidatens farge er katalognøkkel; ukjent farge gir ukjent."),
  later("field", "extFinish", "Metallic/matt er separate fra fargen; krever kildemapping."),
  later("field", "towbar", "Presis betydning av hvert valg må avklares (prototypens tolkning er foreløpig)."),
  later("field", "trailerBraked", "Egne kg-felter; krever kandidatfelt."),
  later("field", "trailerUnbraked", "Egne kg-felter; krever kandidatfelt."),
  later("field", "noseWeight", "Egne kg-felter; krever kandidatfelt."),
  later("field", "cruise", "Regel for om adaptiv oppfyller generelt cruisekrav er ikke vedtatt."),
  now("field", "intColor", "appearance.interiorColors", "Liste med ELLER og én felles prioritet."),
  now("field", "material", "appearance.interiorMaterials", "Liste med ELLER og én felles prioritet."),
  later("field", "climate", "Regel for minimum/eksakt antall soner er ikke vedtatt."),
  later("field", "newUsed", "Tilstand/vilkår; ikke i første operative kriteriesett."),
  later("field", "damage", "Ukjent skadestatus er aldri «skadefri»; krever egen semantikk."),
  later("field", "service", "Tilstand/vilkår."),
  later("field", "warranty", "Tilstand/vilkår."),
  later("field", "certification", "Katalog avhenger av kilde og marked."),
  later("field", "owners", "Tilstand/vilkår."),
  later("field", "prevUse", "Tilstand/vilkår; registreringstype er ikke tidligere bruk."),
  later("field", "inspection", "Tysk HU/TÜV er ikke norsk EU-kontroll."),
  later("field", "seller", "Der kilden skiller selgertype."),
  later("field", "country", "Land først når kilden støtter det."),
  later("field", "vat", "Annonsens mva.-påstand bekrefter ikke netto kjøp; krever egen semantikk."),
  later("field", "adAge", "Krever kildens publiseringstid."),
  na("field", "freeText", "Supplerende fritekst bekrefter ingen strukturerte krav og brukes ikke i matching."),
  now("equipment_group", "parking", "equipment[]", "Hvert element er et boolsk utstyrskriterium med nøkkel fra injisert katalog og egen prioritet. Pakke beviser ikke utstyr; fravær av omtale er ukjent."),
  now("equipment_group", "driving", "equipment[]", "Som «parking». Valgene cruisekontroll/hengerfeste (ikke i denne gruppen) er egne rader."),
  now("equipment_group", "seats", "equipment[]", "Som «parking»."),
  now("equipment_group", "interior_other", "equipment[]", "Som «parking»."),
  now("budget", "budget.amount", "budget.maxTotalNokMinor", "Positivt NOK-budsjett i øre; eksakt bigint, JSON-streng ≤ 2^53-1."),
  now("budget", "budget.deviation", "budget.deviationBasisPoints", "0–10 000 basispunkter; avslått = null. Øvre grense rundes ned til hel øre."),
  now("budget", "budget.costs", "budget.costs", "Kostnadslinjer er forutsetninger; øker aldri budsjettgrensen. Valuta bevares også uten beløp; ukjent ≠ 0."),
];

const BY_KEY = new Map(PROTOTYPE_MAPPING.map((r) => [`${r.kind}:${r.prototypeId}`, r]));
/** Felt-id i prototypen (kind «field») → rad. */
const BY_FIELD = new Map(PROTOTYPE_MAPPING.filter((r) => r.kind === "field").map((r) => [r.prototypeId, r]));

export function mappingFor(kind: MappingKind, prototypeId: string): MappingRow | undefined {
  return BY_KEY.get(`${kind}:${prototypeId}`);
}

/** Felt-id fra prototypen som finnes i tabellen, men ikke er støttet nå. Brukes til tydelig avvisning. */
export function unsupportedPrototypeField(id: string): MappingRow | undefined {
  const row = BY_FIELD.get(id);
  return row && row.status !== "supported_now" ? row : undefined;
}
