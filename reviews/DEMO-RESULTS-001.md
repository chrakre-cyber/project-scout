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

## Kontroller (faktisk kjørt)
- `npx vitest run`: 94 filer / 2113 tester grønne (inkl. 6 nye).
- `npx tsc --noEmit`: ingen feil. `npx eslint src tests/demo-results-001.test.ts`: ingen funn.
- Ikke kjørt: emulator-e2e, DB-suiter, hosted.

## Begrensninger / neste
Utstyrsklassifisering (panorama, 360 osv.) kan ikke demonstreres før den syntetiske kildemodellen utvides med utstyr/hjuldrift — foreslått som egen oppgave, ikke gjort. Review må gjøres av annen enn utvikler før DONE.
