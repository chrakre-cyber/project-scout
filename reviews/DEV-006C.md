# DEV-006C — forklarte søkeresultater for partnerdemo (16.10.2026)

**Status: REVIEW** (ikke DONE). Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `cf17efc`, rent arbeidstre. Kode-commit: se «Commit» nederst.

## Eksplisitte erklæringer
- **Kun syntetiske data er aktivert.** Ingen ekte leverandør, ingen scraping, ingen live data, ingen nettverkskilde. Interne kilde-id er fortsatt `synthetic-demo`; ingen annonse imiterer mobile.de, VEND, AutoScout, Volvo, noen OEM eller markedsplass.
- **Visningsrettigheter for ekte leverandørdata er IKKE implementert.** `/searches`-forhåndsvisningen har ingen sjekk av visningsrett og lagrer ingenting. **Ingen ekte leverandørdata må kobles til denne flyten før håndheving av visningsrettigheter er bygget** (egen oppgave). Eksisterende rettighets-/retention-arkitektur (DEV-005B0) er ikke endret eller omgått.
- Ingen avgifts-, mva.- eller totalkostnadslogikk. Budsjett er fortsatt «ikke beregnet»; ingen kandidat er fullt eller økonomisk verifisert treff. TAX-status er urørt.
- Ingen migrasjon, ingen endring av agentmodell, auth, RLS, tenancy eller deploy.

## Filer endret
Ny: `src/lib/search-explain.ts`, `src/providers/marketplace/synthetic/fixtures/demo-variation.ts`, `tests/search-explain.test.ts`, `reviews/DEV-006C.md`.
Endret: `src/components/search/ResultCard.tsx`, `src/app/searches/[id]/preview/page.tsx`, `src/app/searches/[id]/preview/[listingId]/page.tsx`, `src/app/searches/layout.tsx`, `src/lib/search-labels.ts`, `src/server/search-examples.ts`, `src/providers/marketplace/synthetic/fixtures/index.ts` og `FIXTURES.md`, `README.md`, `MVP_BACKLOG.md`, `tests/search-005-form.test.ts`, `tests/search-candidate-adapter.test.ts`, `tests/e2e/search005.e2e.mjs`.
Ikke endret: søkemodellen (`src/domain/search-v2`), kandidatadapter, kapabiliteter, `NormalizedListing`, providerkontrakter, migrasjoner. SEARCH-005-skjermbildene er uendret (e2e-kjøringen overskrev dem lokalt; de ble tilbakestilt).

## Matching og forklaring
Matchreglene er uendret: kjent brudd på krav → «Oppfyller ikke kravene»; ukjent krav → «Må kontrolleres»; ønsker påvirker aldri status; modellår utledes ikke; utstyr/variant oppdiktes ikke; ukjent er ikke «ikke oppfylt» og ikke 0.
Nytt (ren visning, `search-explain.ts`, bygget kun på `VehicleEvaluation`):
- **Kildeetikett** «Syntetiske demodata – ikke ekte leverandørdata» på hvert resultatkort, detaljsiden, forhåndsvisningens merknad og `/searches`-layouten. (Det globale gule `DemoBanner` er urørt.)
- **Hvorfor vist** (én setning per kort/detalj), **kravsammendrag** («Alle N krav er oppfylt» / «k av N krav oppfylt, u må kontrolleres» / «b ikke oppfylt») og **ønskesammendrag** («1 av 2 ønsker oppfylt, 1 ukjent»). Eksisterende rad-for-rad-forklaring beholdt.
- Treffteksten sier eksplisitt at det ikke er et økonomisk verifisert treff og at innkjøpskostnad ikke er beregnet. Ingen ny status («sterkt treff» finnes ikke); status heter fortsatt «Oppfyller kravene».
- **Rekkefølge** innen hver statusgruppe: flest oppfylte ønsker først, stabil (kildens rekkefølge ved likhet). Ikke en score; endrer ikke status; ukjent og ikke oppfylt teller likt (0 oppfylt) og straffes ikke utover det.
- Demosøket «BMW 3-serie» har fått et ekstra utstyrsønske (CarPlay, «Ønskelig») som demokilden ikke kan vurdere: det vises som «ukjent» for alle biler og viser at ukjent ikke blir «ikke oppfylt».

## Syntetiske tilfeller lagt til (`dvar-001`…`dvar-006`, BMW 3er diesel/bensin stasjonsvogn)
| Id | Utfall i demo-BMW-søket |
|---|---|
| dvar-001, dvar-002 | Oppfyller kravene; fargeønske (svart/hvit) oppfylt → 2 sterke treff |
| dvar-003 | Oppfyller kravene; fargeønske kjent ikke oppfylt (blå) |
| dvar-004 | Oppfyller kravene; farge ikke oppgitt → ukjent ønske |
| dvar-005 | Kilometerstand mangler → «Må kontrolleres» (kravet ukjent) |
| dvar-006 | Bensin → kjent kravbrudd (utelukket), selv med oppfylt farge |
De bruker bare felt kilden allerede har (ingen utstyr/seter/modellår), har ingen originalannonse og er merket som syntetiske. Datasettet er nå 115 annonser (109 + 6).

## Tester faktisk kjørt (alle på denne arbeidskopien)
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | begge uten feil |
| `npx vitest run` | **24 filer, 556 tester bestått** (547 før + 9 nye i `tests/search-explain.test.ts`; 2 eksisterende tester utvidet) |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **emulator** + isolert PG, ikke Supabase) | **64 / 64** (61 + 3 nye DEV-006C-sjekker) |
Eksisterende tester som hardkodet 109 er endret til egenskaper (alt vurdert, ingenting avkortet, sum av statuser = antall vurderte); testene som beskriver DEV-003-datasettet utelater `dvar-`-postene, og en egen test sikrer at variasjonspostene er syntetiske og kan adapteres.

**Ikke kjørt:** DB-/RLS-/sikkerhetssuitene mot Supabase (`npm run test:db`) og `test-db-isolated.sh`/mutasjonstestene (ingen DB-, migrasjons- eller sikkerhetskode er endret). Ingen påstand om at disse er kjørt på nytt.

## Kjente begrensninger
- Ønsker kan bare demonstreres på farge (kilden kan ikke levere utstyr, seter, modellår, hjuldrift eller interiør); utstyrsønsker er «ukjent» for alle biler. Utvidet kilde er bevisst ikke gjort.
- Rekkefølgen er presentasjon, ikke rangering eller anbefaling. Det finnes ingen kvalitetsscore.
- Ingen total innkjøpskostnad; ingen budsjettstatus.
- Etiketten står ikke i det globale `DemoBanner`; ikke testet i Safari/Firefox/skjermleser; emulatorbasert nettlesertest er ikke ekte Supabase Auth.
- Resultater lagres ikke; visningsrettigheter for ekte leverandører mangler (se over).
