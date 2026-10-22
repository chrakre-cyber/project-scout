# ECON-006a — retting etter uavhengig review av f39bac8 (tre P2)

**Status:** ECON-006a forblir REVIEW. 006b er ikke startet. Økonomiflaggene er `false`. Ingen endring av beregningsregler, avgiftsmotor, avrunding (`UNCONFIRMED_HALF_UP`), `classifyBudget`, ECON-002/003. Ingen migrasjon, lagring, hosted migrasjon eller deploy. Reviewen: `ECON-006a-review-f39bac8.md` (levert av Christian; Christians vedlagte regresjonstest er tatt inn uendret bortsett fra `fx: {}` for å tilfredsstille `tsc`).

## P2-1 — øre i søkekostnader
**Årsak:** `formatNokString` godtar bare heltallsstrenger; «1.50» ble «ukjent beløp».
**Retting:** ny `formatNokExact` i `src/lib/search-labels.ts`: ren strengbehandling (ingen flyttall, ingen avrunding), tusenskille, komma, minst to desimaler når det finnes en brøkdel (`0.5` → «0,50 kr», `1000.99` → «1 000,99 kr», `1000` → «1 000 kr», `0.125` → «0,125 kr»). Ugyldig streng → «ukjent beløp». `formatNokString` (hele NOK fra kjernen) er uendret. Brukt i søkelinjer og i nedbrytningsradene.

## P2-2 — kjente poster forsvant ved nedre grense/scenarier
**Årsak:** «øvrige poster» ble rekonstruert som differanse og bare når totalen var `value`; tollavgift stod bare som memo.
**Retting (avgrenset metadatautvidelse, ingen regel):** `EconomicsResult.costMeta` (`types.ts`, `landed-cost.ts`) lister de kjente postene kjernen allerede la til «øvrige kostnader» (klimagassavgift, registreringsgebyr, importavgifter, annen kjent kostnad, separat betalt provisjon, separat betalingskostnad, oppgitt tollavgift) med eksakt beløp og basis, samt `othersNok` (summen avrundet én gang, som før). Samme `add` som før, bare logget; totalene er uendret (verifisert av hele den eksisterende kjernetestpakken).
`explain.ts` bruker listen: hver post er en egen rad som er `inGrossOutlay`, uavhengig av om totalen er verdi/nedre grense/scenarier. Oppgitt tollavgift er én kostnadsrad (ikke i tillegg som memo); ordinær sats 0/ikke relevant/ukjent forblir memo. Fritekstetiketter vises som data. Differansen mellom kjernens avrundede sum og de eksakte postene vises bare når den ≠ 0 som `other_rounding` (ren aritmetikk, bigint). Ukjente poster gir ingen rad (ikke rekonstruert, ikke 0). Betalingskostnad «inngår i prisen» telles ikke. Scenariototaler: mva.-raden er ukjent, og ingen scenarioverdi trekkes fra en annen. Gammel `other_known`-differanse er fjernet (id `other_known` brukes nå for «annen kjent kostnad» fra forhandler).

## P2-3 — grunnlag og antakelsestilstand per rad
**Årsak:** transport etter grensen, forsikring og lasting fikk alltid `known`/`stated_input`.
**Retting:** `costMeta` bærer hvordan hver av disse ble oppgitt. Rad: `dealer_entered` → kjent/forhandleroppgitt; `quoted` → kjent/dokument; `assumed_default` og `scenario_assumption` → antatt/antakelse; `excluded_by_scenario` → egen tilstand «utelatt etter scenarioantakelse (regnet som 0)» (beløp 0 slik totalene faktisk regner); `not_applicable` → ikke relevant; ukjent → null. Basis gjettes ikke fra at et beløp finnes. Dokumentasjonstelleren teller bare rader med tilstand «kjent» blant kostnadspostene (nå også tilleggspostene) og bare basis «dokument» som dokumentert; antatte, utelatte og ikke-relevante poster er ikke kjente kostnadsposter.

## Endrede filer
`src/domain/economics/{types,landed-cost}.ts` (kun metadata `costMeta`; `othersNok` hentet ut i en variabel uten endret rekkefølge/avrunding), `src/domain/search-economics/explain.ts`, `src/lib/search-labels.ts`, `src/components/search/EconomicsExplanation.tsx`; tester: `tests/economics-006a-independent-regressions.test.ts` (reviewerens 3), `tests/economics-006a-fix1.test.ts` (ny, 38 tester), `tests/economics-006a-explanation.test.ts` (to forventninger oppdatert: gebyr = egen rad `registration_fee`; ingen `other_rounding` i golden-tilfellene).

## Kontroller faktisk kjørt
- Før/etter: de samme to nye testfilene kjørt mot f39bac8 (git worktree): **37 av 42 feilet** (reviewerens 3 feilet som rapportert; mange av mine feilet i tillegg fordi `formatNokExact` ikke fantes). Etter: **alle grønne**.
- `npx vitest run`: 62 filer / **1 469 tester grønne** (1 427 før). `tsc` og `eslint .` rene. `node docs/tax/check-docs.mjs` OK.
- Eksisterende kjernetester (`economics-core`, 005-serien, golden-avstemming) uendret og grønne ⇒ ingen total endret.
- Mutasjoner (kopi/sed, filene gjenopprettet): basis tapt → 7 feiler; ingen itemisering i kjernen → 7; tollavgift alltid memo → 1; format uten øre → 11; avrundingsrad undertrykt → 1; scenarioekskludering som kjent → 1.
- Kontrolltilfeller: se `tests/economics-006a-fix1.test.ts` (0,01/0,50/1,50/1 000,99/1 000 i funksjon og i rendret markup; ukjent beløp; gebyr + manglende transport (nedre grense, rader summerer eksakt til nedre grense); gebyr + ukjent fradrag; alle syv tilleggskomponenter samtidig med eksakt summeavstemming mot brutto utlegg; øre i øvrige poster med avrundingsrad; ukjent gebyr; fire basis × tre poster; scenarioekskludering/ikke relevant/ukjent; teller mot radene).

## Begrensninger
- Ikke kjørt: nettleser/e2e, kjørende app, ekte Supabase/PostgREST, DB-suiten (ingen DB-endring), qa:*, build, hosted migrasjon, deploy. Ingen uavhengig review av rettingen ennå.
- Hvis kjernens `others` inneholder øre (registreringsgebyr/annen kost med brøk), vises avrundingsdifferansen som egen rad; dette er visning av eksisterende avrunding, ikke en ny regel.
- BEV-funnet og etikettvurderingen fra leveransen står uendret.
