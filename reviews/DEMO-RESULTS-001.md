# DEMO-RESULTS-001 — kuratert syntetisk BMW iX3-demosett

**Status:** REVIEW. Alle data er syntetiske demodata; ingen live scraping, ingen leverandørkall, ingen endring i rettighets-/produksjonslogikk.

## Avvik fra oppdraget
Oppdraget refererte til et «eksisterende BMW iX3-demosøk». Repoet hadde bare eksemplene `gls` og `demo-bmw` (3er). Jeg la derfor til eksempelet `demo-ix3` («Demosøk BMW iX3 (syntetiske resultater)») i eksisterende maskineri og noterte avviket i DECISIONS (runde 91). Ingen nye produkter eller kilder.

## Endringer
- `src/providers/marketplace/synthetic/fixtures/demo-ix3.ts` (ny): 10 poster `dix3-001..010`; koblet inn i `fixtures/index.ts`.
- `src/server/search-examples.ts`: eksempel `demo-ix3` (BMW iX3, elektrisk, automat, SUV, reg. fra 2023-03, maks 40 000 km; grå/svart/utstyr er ønsker). Eksisterende syntetisk-merknad er beholdt.
- `src/adapters/search-catalog/demo-catalog.ts`, `prototypes/merovo-search/js/data.js`, `src/adapters/search-candidate/synthetic-mapping-data.ts`: iX3 lagt til (katalogkontrakten holdes lik mellom prototype og katalog).
- Tester: `tests/demo-results-001.test.ts` (ny); `tests/search-candidate-adapter.test.ts` (indeks fra mappinglengde, `dix3-` skilt ut fra DEV-003-datasettet); `tests/fixtures/synthetic-identity-baseline.json` (+10 poster; de 115 eksisterende er uendret, verifisert).
- Docs: FIXTURES.md, DECISIONS, MVP_BACKLOG, TEST_PLAN.

## Utfall (fra evaluatoren, ikke hardkodet)
| Gruppe | Poster | Grunn |
|---|---|---|
| Oppfyller kravene | 001, 002, 003 | alle krav kjent og oppfylt (002 er nøyaktig 40 000 km) |
| Må kontrolleres | 004, 005, 006 | km ikke oppgitt / registrert bare «2023» / girkasse ikke oppgitt |
| Oppfyller ikke | 007, 008, 009, 010 | registrert 2021-09 / 78 000 km / 2022-11 + 64 500 km / 40 500 km |

Toppresultat (via `orderForPresentation`): `dix3-001` — iX3 Inspiring, 03/2024, 22 000 km, elektrisk, automat, ca. 36 950 € netto, grå.

## Ukjent = ukjent
Råformatet/kandidatadapteren har ikke utstyr, interiørfarge, hjuldrift eller batterihelse. Bakhjulsdrift, svart interiør, panorama, 360-kamera, parkeringssensorer og batterihelse 96,3 % står derfor bare i annonseteksten (demodata) og er `null`/ukjent for vurderingen; ønskene vises som «ikke oppgitt». Batterihelse og RWD er ikke søkekriterier (testet). Pris er annonsepris, ikke total innkjøpskost; ingen mva./fradrag utledes.

## Runde 2: lokale demo-assets, galleri og berikelse
**Assets** (`public/demo/vehicles/bmw-ix3/`, 8 JPEG, konvertert fra de vedlagte AVIF-filene, maks 1600 px bredde, ca. 1,8 MB totalt; filnavn = id-ene fra oppdraget): `fd2067ac…` (front 3/4, hovedbilde), `8f28cf3f…` (bak 3/4), `d3aa8613…` (forfra), `266b1dd3…` (alt. bak 3/4), `6b7d602a…` (bredt interiør), `0184fcc1…` (cockpit), `bace29ac…` (interiør/konsoll), `39633f28…` (felg). Bildene er lokale demo-assets, ikke leverandørhentet; alt-tekstene starter med «Demobilde», og galleriet har en fast merknad om at de ikke er hentet fra mobile.de eller annen leverandør.

**Kobling:** `src/server/demo-media.ts` har et register nøklet på kildens annonse-id (bare `dix3-001`, bare for syntetisk kilde `synthetic-demo`) og gir `ListingMedia` (`origin: "local_demo_asset"` + bildeliste) og `ListingEnrichment`. `toDisplayItem` legger dem på `DisplayItem` (`media`, `enrichment`, `null` når ingen). UI leser bare disse formene: `ResultCard` bruker `media.images[0]` som miniatyr (ellers eksisterende `CarPlaceholder`), detaljsiden viser `ListingGallery` (stort første bilde + rutenett, ingen skript) i stedet for plassholderen, og `DemoEnrichment` viser berikelsen. Senere provider-media kan levere samme `ListingMedia` fra en annen resolver (med egen rettighetskontroll) uten å bygge om detaljsiden. Ingen andre annonser har bilder, og ingen bilder er gjenbrukt.

**Berikelse (ikke søkekriterier):** batteristatus 96,3 %, batterikapasitet 78 kWh, 286 hk, bakhjulsdrift, lakk «Sophistograu metallic», sort interiør, 1 eier, kjent utstyr (panoramatak, 360-kamera, parkeringssensorer foran/bak, hengerfeste). Panelet er merket «Demoberiket informasjon … ikke søkekriterier og ikke brukt i vurderingen». Søkeskjemaet/schemaet er uendret; evaluatoren ser fortsatt utstyr/interiør/hjuldrift som ukjent (`null`), så ønskene vises «ikke oppgitt». Ukjent felt i berikelsen er `null` og vises «ikke oppgitt».

**Øvrige endringer:** `demo-ix3`-søket har nå budsjett 450 000 NOK med transport 8 000 NOK ekskl. mva. som inngår i budsjettet (budsjettet er fortsatt «ikke beregnet» i forhåndsvisningen). Annonseteksten til `dix3-001` er utvidet (derfor ny revisjon for den ene posten i identitets-baselinen; de 124 andre er uendret). De to testene som listet `DisplayItem`-nøkler er oppdatert med `media` og `enrichment`. Rå fargen i annonsen er «Grå» (kilden har ingen «Sophistograu»-mapping; lakknavnet står i berikelsen). Ingen endring i provider-rights, TAX/ECON, MOBILE-001 eller ECON-003.

**Ikke gjort:** ingen visuell nettleserkontroll av sidene (kun build og komponent-/datatester).

## Kontroller (faktisk kjørt)
- `npx vitest run`: 94 filer / 2120 tester grønne (inkl. 13 i `tests/demo-results-001.test.ts`: iX3-resultat, miniatyr, galleri i rekkefølge og filer finnes, berikelse ikke krav, ukjent = null, ingen nettverk i demo-koden).
- `npx next build`: OK.
- `npx tsc --noEmit`: ingen feil. `npx eslint src tests/demo-results-001.test.ts`: ingen funn.
- Ikke kjørt: emulator-e2e, DB-suiter, hosted.

## Begrensninger / neste
Utstyrsklassifisering (panorama, 360 osv.) kan ikke demonstreres før den syntetiske kildemodellen utvides med utstyr/hjuldrift — foreslått som egen oppgave, ikke gjort. Review må gjøres av annen enn utvikler før DONE.
