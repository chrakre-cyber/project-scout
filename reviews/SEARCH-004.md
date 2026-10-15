# SEARCH-004 — kandidatadapter for normaliserte syntetiske annonser · leveranserapport

Status: **REVIEW** (ikke DONE). Utfører Claude Code, kontrollør Codex. UI-/lagringsintegrasjon er **ikke** startet.

## 0. Utgangspunkt

- Branch `claude/wonderful-bardeen-yussx3`, **base/HEAD før endring: `70f2d90`** (`70f2d90` = SEARCH-003-FIX1-ZIP oppå koden `8e019be`; ingen kodeendring i `70f2d90`). Arbeidstreet var rent. Ingen avvik fra oppdragets beskrivelse.
- **Commits:** implementasjon `@IMPL@`; sluttcommit = den neste commiten (kun rapportens commit-hash; hash i ZIP-ens MANIFEST/README).
- Christians lokale app er fortsatt på SYNC-001; SEARCH-003/FIX1 og denne leveransen er ikke lagt inn lokalt. Ingen automatisk synkronisering antatt.
- Bevart uendret: domenet (`src/domain/**`), prototypen, SEARCH-003-adapteren, provider-kontrakten (`NormalizedListing`, `MarketplaceProvider`), eksisterende søkepipeline, agenter, lagring, pakker. Windows-/utløpsrettelsene og DEC-030/031 er uberørt.

## 1. Hva som er levert

`src/adapters/search-candidate/` (ren TypeScript utenfor domenet; ingen DOM, nettverk, klokke eller tilfeldighet):

| Fil | Innhold |
|---|---|
| `candidate.ts` | `buildCandidateAdapter(mapping, catalog)` → `adapter.adapt(listing: unknown)`; validering, konvertering, identitet, revisjon, kilometer |
| `mapping.ts` | Mappingkontrakten (`CandidateMappingData`), normalisering og validering mot katalogen |
| `synthetic-mapping-data.ts` | Eksplisitte mappingdata for kilden `synthetic-demo`, versjon `1` |
| `sha256.ts` | SHA-256 i ren TS (sammenlignet med `node:crypto`) |

`tests/search-candidate-adapter.test.ts` (76 tester). Adapteren brukes bare gjennom tester. Den lager aldri en `CostAssessment`.

## 2. Kontrakt

```ts
const a = buildCandidateAdapter(mappingData: unknown, catalog: SearchCatalog);   // { ok:true, adapter } | { ok:false, issues }
a.adapter.adapt(listing: unknown):
  { ok: true;  candidate: CandidateV2; meta: CandidateMeta }
  | { ok: false; issues: Issue[] }          // ugyldig input: aldri candidate/meta, aldri unntak, aldri mutasjon
```

**1. Ugyldig vs ukjent.** Struktur og verdier for alle felt adapteren bruker (og revisjonen bygger på) valideres: eksakte nøkler på alle objektnivåer, typer, enums (`Fuel`, `Transmission`, `BodyType`), reelle kalenderdatoer (gjenbruker domenets `firstRegistrationIssue`), tidsstempler (domenets `parseUtcInstant`, `lastSeenAt ≥ firstSeenAt`), tall, enslige Unicode-surrogater (ville gitt hash-kollisjoner), kilde = mappingens `sourceId`. **Prisgrunnlaget valideres fullt ut** fordi det inngår i revisjonen: `stated`-format, `amount` konsistent med `stated` (via domenets `toMoney`), brutto/netto krever belegg (DEC-019), ukjent grunnlag har ingen belegg, mva.-opplysning krever belegg og opphav. Et gyldig, men ukjent/ikke-mappet kildeverdi er **ikke** en feil: feltet blir `null` med en forklaring.

**2. Mapping.** Eksplisitte data med `sourceId` og `version`. Eksakt oppslag etter dokumentert normalisering (Unicode NFC, trim, hvitt rom → ett mellomrom, språkuavhengig `toLowerCase`) — ingen delstreng, fuzzy, familie. **Modeller slås opp under det mappede merket** (modellnavn er ikke entydige på tvers av merker). Mappingmål valideres mot katalogen; kollisjoner etter normalisering (også med like mål) avvises; modelloppføring for et merke ingen kilde mapper til avvises som dødt. Mappingen leses som `unknown` og valideres strengt.

**3. Null og forklaringer.** Hvert `null`-felt i `CandidateV2` har en forklaring i `meta.explanations` (`not_stated`, `unmapped`, `requires_mapped_brand`, `unrepresentable`, `not_in_source_model`). Manglende/umappet merke gir aldri en modell. Variant bevares som data; utstyr og pakker utledes aldri av variant eller tekst.

**4. Registrering/modellår m.m.** `firstRegistration` overføres med nøyaktig presisjon. `modelYear`, `seats`, `driveTrain`, `interiorColor`, `interiorMaterial`, `equipment`, `packages`, `currentCategory` finnes ikke i `NormalizedListing` og er alltid `null` (`not_in_source_model`). Karosseri «van» sier ingenting om kategori eller scenario.

**5. Kilometer.** km bevares. Miles: eksakt heltall i mikro-km (`miles × 1 609 344`) og **én** korrekt avrundet divisjon, uten avrunding til hele km. For ≤ 1 000 000 000 km er ulp < 1,2·10⁻⁷ mens minste avstand til et heltall er 10⁻⁶, så `mileageKm <= grense` ⇔ eksakt rasjonal sammenligning (bevist med egenskapstest, > 300 000 grensesammenligninger mot BigInt). Større verdier (> 621 371 192 mi / > 10⁹ km) gir `mileageKm = null` med forklaring `unrepresentable` — aldri nedrundet til treff. `null` = ukjent, eksplisitt `0` = kjent 0 km.

**6. Enums.** Gyldige `Fuel`/`Transmission`/`BodyType` overføres uendret; `null` forblir `null` (normaliseringen gjør ukjente koder til `null`, og `other` finnes bare når kilden sa OTHER). Ingen strømtype, avgiftsprofil, netto eksportpris, fradrag eller norske kostnader utledes.

**7. Identitet.** `id = <source.length>:<source>/<sourceListingId>` — lengdeprefikset gjør sammensetningen injektiv for alle strenger (separatorer, Unicode inkl. NFC/NFD og emoji; ingen normalisering av kilde-ID). Samme annonse gir samme id ved ny observasjon.

**8. Revisjon.** `version = "rev1:" + SHA-256(kanonisk JSON)` med fast nøkkelrekkefølge over: revisjonskontrakt, mappingens `sourceId`+`version`, identitet, **mappede nøkler**, original-URL, kildens endringstid, provenance-art, hele prisen (oppgitt beløp/valuta, minste enhet, prisgrunnlag og belegg, mva.-sats/påstand/belegg/opphav), alle spesifikasjoner, annonsetekst og selger. **Utenfor:** `firstSeenAt`/`lastSeenAt`, provenance-beskrivelse og normaliseringsnotater. Ingen nåtid, tilfeldighet eller «bare sourceModifiedAt» (statisk kontroll i test). Domenet er uendret og uavhengig av adapteren; `CostAssessment.candidateVersion` er et ugjennomsiktig felt der denne revisjonen brukes.

**9. Provenance/metadata.** `meta` bærer kilde, annonse-id, `synthetic: true`, provenance (art, beskrivelse, normaliseringsnotater), mappingens id/versjon, tidsstempler, oppgitt pris (merket som annonsepris, ikke totalpris) og forklaringer. `CandidateV2` er uendret. Ingen påstand om live mobile.de-data eller verifisert historikk; annonsetekst er ubetrodd data.

**10. Pris.** Adapteren lager ingen `CostAssessment`; uten en validert vurdering er `classifyBudget` fortsatt `not_calculated` (`no_assessment`). En annonsepris blir aldri totalpris eller budsjettreff.

## 3. Eksempel: vellykket og forklarte ukjente

`demo-002` (Toyota RAV4, EUR 41 900 netto, mva. 19 % belegg i tekst): `brandKey = null` (Toyota er ikke i demokatalogen) med `{field:"brandKey", code:"unmapped", sourceValue:"Toyota"}` og `{field:"modelKey", code:"requires_mapped_brand", sourceValue:"RAV4"}`; `firstRegistration = {date, 2022-11-15}`; `mileageKm = 41000`; `fuel plugin_hybrid`, `transmission automatic`, `bodyType suv`; `exteriorColor = "white"`; alle felt kildemodellen mangler = `null`. `meta.statedPrice = {41900 EUR, net, vat 1900 bp, reclaimableClaim claimed}` — ikke et budsjettreff.

**Faktisk dekning for de 109 syntetiske annonsene** (alle gir `ok`; ingen avvist; ingen oppdiktet full dekning): merke mappet 63/109 (umappet: Toyota 10, Skoda 10, Tesla 8, Kia 8, Peugeot 8, Hyundai 1, Ford 1); modell mappet 45/109 (umappet under mappet merke: VW ID.4 9, Porsche 911 8, Volvo V60 1; resten av de umappede merkene får ingen modell); farge mappet 91/91 oppgitte (18 uten farge); førstegangsreg. år 31 / måned 36 / dato 33 / ukjent 9; km 90, miles 9 (omregnet), ukjent 10; drivstoff ukjent 6, gir ukjent 5. Alle 109 har unik id og unik revisjon.

## 4. Krav → testbelegg (`tests/search-candidate-adapter.test.ts`, 76 tester)

| Krav | Test |
|---|---|
| Kontrakt mot faktiske annonser (provider + fixturer, uendret); alle gyldige behandles; null-felt forklart | «alle syntetiske annonser … behandles» (itererer alle 109) |
| Mapping: normalisering, kollisjoner, mål mot katalog, per-merke-modeller, ingen fuzzy, strengt data | «mappingkontrakt» |
| Identitet: separatorer/Unicode, injektivitet, stabil ved ny observasjon | «kandidat-id» |
| Revisjon: deterministisk; uendret ved `lastSeenAt`/`firstSeenAt`/notater; endret ved pris, valuta, prisgrunnlag, belegg, mva.-felt, bilopplysninger (hvert felt), tekst, selger, URL, endringstid, mappingversjon og mappingens mening; ingen sammenfall | «kandidatrevisjon»: kjent brudd |
| Gammel `CostAssessment` avvises av eksisterende `classifyBudget` etter endret pris/valuta/mva./bilopplysning; pris alene ⇒ `not_calculated` | «pris alene er aldri budsjettreff…» |
| Miles ved innkjøpsagentens km-grense; kjent 0 vs ukjent; unrepresentable; eksakt aritmetikk | «kilometerstand» |
| Ugyldige datoer, manglende data, containere/enums, uventede typer, prisgrunnlag, enslige surrogater, kastende getter/Proxy; fiendtlig tekst som data; ingen mutasjon | «ugyldig input» (inkl. søppel på hver sti × 15 verdier) |
| Modellår/registreringsår separate; utstyr ukjent uten strukturert belegg; van ≠ kategori | tre tester i kontraktseksjonen |
| Ende-til-ende: ekte prototypeeksport → tilleggsvalg → `SearchSpec` → kandidatadapter → `evaluateCandidate` | «ende-til-ende»: kjent brudd ⇒ `excluded` (har forrang over ukjent), ukjent må-ha ⇒ `needs_review`, ønske ekskluderer ikke, alt kjent ⇒ `match`; scenario `van` endrer ingenting |

**GLS-eksemplet** (prototypens «Fyll ut GLS-eksempel») krever modellår, seter og utstyr (`camera_360`, `carplay` som «må ha») som dagens kildemodell mangler, og GLS finnes ikke i datasettet. Resultat mot alle 109 annonser: **0 match**; Mercedes-annonser med mappet modell får kjent modellbrudd (`excluded`), annonser med umappet merke får `needs_review` med ukjent `brand`, og alle har ukjent `modelYear`, `seats` og utstyr. Ingen oppdiktet fullt treff.

**Mutasjonsprøving** (manuelt skript, én endring av gangen, ikke en del av repoet): 41 mutasjoner av adapteren (40 anvendt) — 38 drept ved første kjøring; to overlevde (rå farge ute av revisjon, «tom modell = ikke oppgitt») og fikk målrettede tester, og ett mønster («lastSeenAt før firstSeenAt») var feilplassert og ble kjørt på nytt riktig. Alle er nå drept. Dekket bl.a.: miles avrundet/flyttallsmultiplikasjon/uten grense, km-grense, id uten lengdeprefiks/separator, hvert revisjonsfelt, mappingversjon, normalisering (små bokstaver/trim/NFC), modelloppslag uten merke, kollisjoner og mål uten kontroll, modellår fra registrering, ukjent drivstoff → other, fabrikert utstyr, van → kategori, prisgrunnlag/belegg/konsistens uten kontroll, enslige surrogater.

## 5. Kontroller faktisk kjørt (Linux)

`tsc --noEmit` ren · `eslint .` ren · `vitest run` (ikke-DB) **516/516** i 21 filer (440 bevart + 76 nye) · `qa-secret-scan.sh` «INGEN FUNN» · `npm run build` OK. Ingen DB-test, reset/purge, hosted handling, nettverk/API, nye pakker, deploy, nettleser- eller Windows-kjøring.

## 6. Begrensninger

- Adapteren er ikke koblet til UI, pipeline, agenter eller lagring, og `NormalizedListing`/provider-kontrakten er uendret. Kandidatfeltene `modelYear`, `seats`, `driveTrain`, interiør, utstyr, pakker og kategori forblir `null` til kildemodellen utvides i en egen oppgave.
- Mappingen dekker bare merker/modeller som finnes i prototypens demokatalog (ikke en produksjonskatalog). Det er bevisst at mye er umappet; dette dokumenteres ikke som feil.
- Revisjonen er konservativ: endret `sourceModifiedAt` eller endret annonsetekst gir ny revisjon selv om øvrig innhold er likt.
- Adapteren avviser ukjente nøkler i `NormalizedListing`; ved en framtidig utvidelse av kildemodellen må adapter (og revisjonskontrakten `search-candidate-revision/1`) oppdateres bevisst.
- Revisjonskontrakten er `rev1`; en endring av kanonisk innhold krever ny kontraktsversjon.

## 7. Neste mulige oppgave (ikke startet)

Utvidelse av kildemodellen (modellår/seter/utstyr) og/eller eksplisitt UI-/lagringsintegrasjon etter kontrollert lokal oppdatering. Ikke del av SEARCH-004.
