# ECON-005d — avslutning: DONE innen levert omfang

**Christians aksept (20.10.2026):** ECON-005d er DONE innen levert omfang: økonomivisning som ferdig visningsmodell (`DisplayItem.economics`) gjennom rettighetsgrensen, med faste statusetiketter i minimal visning (kort + detalj). **ECON-005 som helhet er ikke DONE** — se `reviews/ECON-005-avstemming.md`. Økonomiflagg uendret `false`; ingen parametergodkjenning, ingen hosted migrasjon, ingen deploy.

## Belegg
**Uavhengig review (reviewers kontroller):**
1. `reviews/ECON-005d-review-47fb78a.md` — ett P2 (tidlige avslag og manglende kontekst passerte uten kontroll av økonomiens visningsrett). 332 manifestoppføringer, 55 filer / 1 240 tester, typecheck og ESLint rene; reviewerens regresjon feilet som forventet.
2. `reviews/ECON-005d-re-review-a75102a.md` — P2 lukket, ingen nye blokkerende funn. 335 manifestoppføringer, 57 filer / 1 270 tester, `tsc --noEmit --incremental false` og ESLint uten funn; reviewerens regresjon består. **Reviewers kontrollbegrensninger (bevart):** `tax-engine.test.ts` og `economics-source-driven.test.ts` er ikke kjørt (primærkildearkivene mangler i pakken), så reviewer har ikke selv bekreftet utviklerens 1 396 tester; ingen ny før-kjøring mot gammel kode i re-reviewen; **ikke kjørt av reviewer:** PostgreSQL, Auth/PostgREST, ekte lagring og `listInputs` mot Supabase, `check-docs`, `qa:*`, build, kjørende app, e2e, hosted migrasjon, deploy. Render-testene (`renderToStaticMarkup`) er ikke nettleser- eller integrasjonstester. Utviklerens DB-resultater er separat belegg.

**Utviklerens kontroller (separat belegg, ikke review):** `reviews/ECON-005d-leveranse.md` (47fb78a) og `reviews/ECON-005d-retting.md` (a75102a): vitest 1 396 grønne (59 filer), `tsc`/`eslint`; DB-suiten i isolert PostgreSQL 16 sist kjørt uendret (258 bestått, 12 feil, 247 hoppet over — Auth/PostgREST mangler; ikke en grønn full DB-suite); mutasjonskontroll.

## Hva «levert omfang» er — og ikke er
Levert: visningsmodell, tre fail-closed porter (beregnings-/visningsrett, effektiv prisvisning, projeksjon uten kjerneinternt), faste etiketter uten budsjettspråk, ingen lagring av avledede tall, kontekstløs og tidlig-avslag-oppførsel under samme porter. **Ikke levert i 005d** (restomfang, se avstemmingen): flate for å registrere forhandleropplysninger, forklaring/nedbrytning, e2e i nettleser, E7/E8.
