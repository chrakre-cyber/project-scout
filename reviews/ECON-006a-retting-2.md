# ECON-006a — retting 2 etter re-review av 853c1d8 (restpunkt i P2-3)

**Status:** ECON-006a forblir REVIEW; 006b ikke startet; økonomiflaggene `false`. Beregningsbeløp, regler, avrunding, `classifyBudget` og avgiftsmotor er uendret. Ingen migrasjon, hosted migrasjon eller deploy. Reviewerens regresjonsfil er tatt inn uendret som `tests/economics-006a-review-fix1-regression.test.ts`.

## Funn
`excluded_by_scenario` gir et rasjonalt nullbeløp i kjernen (truthy), og metadata-flyten sendte klimagassavgift og registreringsgebyr til `addOther` med en typekonvertering til `AmountInput` — dermed `known` / `stated_input` / «0», og de telte som kjente kostnadsposter. Summen var riktig; merkingen og telleren var feil.

## Retting
- `landed-cost.ts`: klimagassavgift og registreringsgebyr loggføres som kostnadskomponent (`otherItems`) bare når inputen er et faktisk beløp (`!("state" in …)`); ellers legges nullbeløpet til som før (samme sum), uten komponent. Ingen typekonvertering lenger. Nye metadata i `costMeta`: `climateGas`, `registrationFee`, `customsDuty` (`AmountMeta`: beløp / scenarioekskludert / ikke relevant / ukjent; `customsDuty` er `null` når ikke oppgitt = ordinær sats).
- `explain.ts`: tilstandene vises adskilt. Scenarioekskludert → «utelatt etter scenarioantakelse», beløp 0, basis antakelse; ikke relevant → ikke relevant; ukjent → ukjent (null); faktisk oppgitt/dokumentert beløp 0 → kjent med riktig basis. Bare «kjent» teller blant kjente kostnadsposter. Tollavgift scenarioekskludert vises som utelatt (memo), ikke som oppgitt.

## Kontroller faktisk kjørt
- Før/etter: reviewerens fil og FIX2-kontrollene kjørt mot 853c1d8: **10 av 56 feilet** (reviewerens restpunkttest + 9). Etter: alle grønne.
- Nye kontroller (`tests/economics-006a-fix1.test.ts`, FIX2-blokken): klimagassavgift og registreringsgebyr × {scenarioekskludert, ikke relevant, ukjent, oppgitt 0, dokumentert 0} — rad (tilstand, beløp, basis) og teller (kjente kostnadsposter, dokumentert) kontrollert hver for seg og at totalen er uendret; standardoppsett; tollavgift ekskludert / ikke relevant / oppgitt 0. En eldre forventning («ukjent gebyr gir ingen rad») er endret til «ukjent rad (null)», som er mer ærlig og i tråd med forsikring/lasting.
- `npx vitest run`: 63 filer / **1 486 tester grønne**; `tsc`, `eslint .`, `check-docs.mjs` rene/OK.
- Mutasjoner: ingen rad for ikke-beløp → 8 feiler; ekskludert igjen som beløpskomponent → 4; tollavgift ekskludert vist som oppgitt → 1.

## Begrensninger
Ikke kjørt: nettleser/e2e, ekte Supabase/PostgREST, DB-suiten (ingen DB-endring), qa:*, build, hosted migrasjon, deploy; ingen uavhengig review av denne rettingen ennå. Pakkens `repo/`-kopi mangler primærkilder (to kildeavhengige testfiler feiler der).
