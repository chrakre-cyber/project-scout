# ECON-006a — visningsmodell v2 og skrivebeskyttet forklaring (levert til uavhengig review)

**Oppgave:** ECON-006a (første skive av ECON-006; plan `docs/econ/ECON-006-implementeringsplan.md`, beslutninger B1–B7 i `DECISIONS.md` runde 53).
**Status:** levert til uavhengig review. Ikke DONE. 006b/006c er ikke startet. Utviklerens egne kontroller nedenfor er ikke en uavhengig review.

## Hva som er levert (brukerutfall)
Detaljsiden for en annonse viser, når økonomien kan vises (rettighetsgrensen passert), en skrivebeskyttet forklaring:
- **Hovedmerking** «Estimat — ikke validert» (eller nedre grense / scenarier / «Ikke beregnet»), to summer: **brutto utlegg** og **økonomisk kostnad**, med fast forklaring av at brutto utlegg ikke nødvendigvis er kontantbetaling ved grensen (B5).
- **Nedbrytning** med rader (kjøpesum med original valuta, transport, forsikring, lasting, import-mva., engangsavgift, vrakpant, «øvrige poster» som ren differanse). Hver rad har tilstand (kjent / antatt / ukjent / nedre grense / ikke aktuell) og grunnlag (annonsepåstand, forhandleroppgitt, dokument, antatt, motorestimat, beregnet …). Tollverdi, toll og mva.-grunnlag vises adskilt og summeres ikke.
- **Forutsetninger:** kurs per rolle (anskaffelse/toll) med kilde, dato og gyldighet; «Testkurs — ikke en offisiell kurs» for fixturekurs; tolldato (faktisk/forventet), registreringsdato (om satt som standard), fradrag og mva.-håndtering; at reglene ikke er godkjent for validering.
- **Usikkerhet** gruppert (regel / inputgrunnlag / forutsetning / mangler / ikke innsamlet).
- **Mangler som inputfelt**, med skille mellom felt som kan registreres (skjema kommer i 006b — vises som «ikke tilgjengelig ennå») og felt som ikke samles inn i dag (EV-kvalifisering, provisjon, betalingskostnader, avgifter ved innførsel).
- **Dokumentasjonsdekning** (B4): «N av M kjente kostnadsposter har dokumentbasert grunnlag» med forbehold om at dette ikke sier at tall er riktige, sikre eller godkjente. Ingen score, ingen prosent. Annonsepåstand teller aldri som dokumentasjon.
- «Ikke rådgivning» vises i tillegg til, ikke i stedet for, usikkerhetsforklaringen.

## Rettighetsgrensen (uendret prinsipp)
Forklaringen bygges kun i `toEconomicsView` (bak `toDisplayEconomics`), dvs. etter beregningsrett per kildefelt, visningsrett og effektiv prisvisning. Uten rett: uniform `unavailable` uten forklaring, rader, årsaker eller tall (testet). Ingenting lagres; forklaringen er et rent uttrykk av kjerneresultat + 005a-mapper.

## Endrede filer
- Ny: `src/domain/search-economics/explain.ts`, `src/components/search/EconomicsExplanation.tsx`, `tests/economics-006a-explanation.test.ts`.
- Endret: `src/domain/search-economics/{view,index}.ts` (`explanation: Explanation | null` på tall- og ikke-beregnet-varianter), `src/server/economics-view.ts` (sender `detail`), `src/components/search/EconomicsNote.tsx` (full visning), `src/lib/search-labels.ts` (006a-etiketter), `tests/economics-005d-display.test.ts` og `tests/economics-005d-fix-coverage.test.ts` (nøkkellister/testider for ny `explanation`-nøkkel; semantikk uendret).
- Docs: `DECISIONS.md` (runde 53), `MVP_BACKLOG.md`, `docs/econ/ECON-006-implementeringsplan.md` (§ 8a), `reviews/ECON-005-avstemming.md` (tillegg).

## Ikke endret (bevisst)
Beregningsregler, avgiftsmotor, avrunding (`UNCONFIRMED_HALF_UP`), `classifyBudget`, økonomiflaggene (alle `false`), migrasjoner, lagring, forhandlerinput-skjema (006b). Ingen hosted migrasjon, ingen deploy.

## Kontroller faktisk kjørt (utvikler)
- `npx vitest run`: 60 filer, **1 427 tester grønne** (1 396 før + 31 nye).
- `npx tsc --noEmit`: ingen feil. `npx eslint .`: ingen feil eller advarsler. `node docs/tax/check-docs.mjs`: OK.
- Nye tester (31): avstemming av nedbrytningen mot `MEROVO_DEFAULT_EXPECTED` for tre cases × {recoverable, non_recoverable} (B-Merovo-scenario / fixturekonvensjon, ikke produksjonsregel); ukjent fradrag; syntetisk tollkurs 10,7000 vist som testkurs; «øvrige poster» som differanse; ukjent = null (aldri 0); dokumentasjonsdekning og språk (ingen score/prosent/sikkerhets- eller godkjenningsspråk); mangel → inputfelt og `collectable`; gjennom `previewForDisplay` med demoformat: diesel 858 087, PHEV 3 900 629 (avstemt), BEV = to scenarier 485 077 / 410 077 med `ev_qualification` ikke registrerbar; JSON-sikker; rettighetsvakt; rendering for estimat / scenarier / ikke beregnet / utilgjengelig / kompakt; renhets- og lagringsskanning.
- **Mutasjonskontroll** (kopi/sed, filen gjenopprettet og verifisert): «øvrige poster» alltid av ⇒ 1 test feiler; ukjent→0 ⇒ 1 feiler; annonsepåstand som dokument ⇒ 1 feiler; tollverdi i brutto utlegg ⇒ 8 feiler; EV-kvalifisering som registrerbar ⇒ 3 feiler; regler «godkjent» ⇒ 3 feiler.

## Funn og begrensninger (ærlig)
1. **BEV når ikke punktestimat via pipelinen** (EV-kvalifisering samles ikke inn). Vises ærlig som scenarier; golden-tallene (CASE-002: 410 077 / 391 411) er bekreftet kun på kjernenivå. Punktestimat krever eget scope-vedtak.
2. Forventede tall er fixturekonvensjon (kjøpesum og kurs er testinput; U-013 halvt-opp er ikke produksjonsregel). Ingen mobile.de-respons, ingen offisielle referanseavgifter, A-stated-tall brukes ikke som forventning.
3. **Ikke kjørt:** nettleser/e2e (006c), kjørende app, ekte Supabase/PostgREST, Supabase-avhengige DB-filer, `qa:*`, build, hosted migrasjon/deploy. DB-suiten er ikke berørt (ingen DB-endring) og ikke kjørt på nytt her.
4. Teksten i etikettene er ikke språkvasket av en uavhengig leser; ordlyden bør vurderes i review (spesielt `GROSS_OUTLAY_EXPLAIN`, `COVERAGE_DISCLAIMER`).
5. Skjema for forhandleropplysninger finnes ikke ennå (006b); forklaringen sier det eksplisitt.

## Neste oppgave
Uavhengig review av 006a. Deretter, kun etter Christians godkjenning: 006b (forhandlerskjema + firmaprofil, videreført ECON-005-restarbeid).
