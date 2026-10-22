# Syntetiske fixturer — opphav (DEV-003)

Alle poster i denne mappen er **oppdiktet av Project Scout** for utvikling og demo. De er ikke ekte annonser, ikke mobile.de-responser, ikke basert på mobile.de-format og ikke referansepriser eller avgiftsfasit. Merker og modeller er generiske eksempler.

| Fil | Innhold | Opphav |
|---|---|---|
| `handwritten.ts` | `demo-001`–`demo-009` (10 råposter, demo-004 har 2 revisjoner) | Håndskrevet. `demo-001`–`demo-008` er bilene fra DEV-001-demoen med reviewrettingene (demo-004/005 har ukjent prisgrunnlag). `demo-009` er i USD (ustøttet valuta, review R1). |
| `generated.ts` | `syn-001`–`syn-100` (102 råposter: + revisjon av syn-010 og duplikat av syn-020) | Deterministisk generert fra indeksen (ingen tilfeldighet). Samme datasett ved hver kjøring. |

Råformatet (`../raw.ts`) er et internt testformat med egne feltnavn, desimalstrenger og kodeverdier. Det finnes for å øve normalisering, ikke for å etterligne en kilde. Mapping mot et ekte kildeformat lages i DEV-006 mot godkjent dokumentasjon/testkonto, med egne API-formatfixturer.

Belegg-strenger (prisgrunnlag og mva. fra tekst) står ordrett i den syntetiske annonseteksten, der normaliseringen krever det.

## Varianter som dekkes

Prisgrunnlag brutto/netto med belegg, brutto uten belegg (→ unknown), ingen opplysning; mva.-sats og fradragspåstand fra felt eller tekst, påstand uten belegg i teksten (→ forkastet); valutaer EUR, CHF, SEK, GBP, PLN og USD (ustøttet); pris 0 (→ ikke oppgitt); registrering med dato/måned/år, mangler eller ugyldig; km og miles; manglende kilometer; ukjent drivstoffkode; effekt 0 (→ null); CO2 med WLTP/NEDC/ukjent/mangler; ugyldig landkode; manglende selger og tekst; ukjent endringstid; endret annonse; duplikat.

Normalisert datasett (DEV-003): 109 unike annonser.

## DEV-006C: variasjonsposter (`demo-variation.ts`)
Seks håndskrevne, oppdiktede BMW 3er-annonser (`dvar-001`…`dvar-006`) med kjente fargeverdier, lagt til slik at forklaringene i `/searches` kan vise: oppfylt ønske (001, 002), kjent ikke-oppfylt ønske (003), ukjent ønske (004, ingen farge), ukjent krav (005, mangler kilometer) og kjent kravbrudd (006, bensin). De bruker bare felt kilden allerede har (ingen utstyr, seter eller modellår) og har ingen originalannonse. Datasettet har dermed 115 unike annonser. Tester skal ikke hardkode antallet: de beskriver DEV-003-datasettet ved å utelate `dvar-`-postene, eller sammenligner mot det kilden faktisk oppgir.

## Fornyelse av observasjonstider (ECON-006e)
Fixturenes `observed`-datoer er en **mal**. Appen flytter dem ved oppstart til et vindu på 0–48 timer *før en eksplisitt datasettepoke* (`synthetic/epoch.ts`). Innhold, `modifiedAt` og dermed kandidat-id/revisjon røres ikke. Dataene er **syntetisk genererte, ikke hentet fra leverandør**; merkingen «Syntetisk generert <dato> — ikke hentet fra leverandør» vises i søkeskallet og står i proveniensen.

- **Standardepoke:** konstanten `SYNTHETIC_DEFAULT_EPOCH` (UTC, satt ved siste fornyelse). Den rulleres ikke av koden.
- **Overstyring (server-only):** `SCOUT_SYNTHETIC_EPOCH=ÅÅÅÅ-MM-DDTTT:MM:SSZ`, f.eks. `SCOUT_SYNTHETIC_EPOCH=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)` før `npm run start`. Må være ≤ nå (ingen toleranse), ikke før 2026-10-01 + 48 t og ikke før datasettets siste endringstid + 48 t. Ugyldig verdi ⇒ kilden feiler lukket; epoken justeres aldri.
- **Levetid:** data brukes av økonomien fra epoken og i minst 5 og høyst 7 døgn (rettighetsprofilens oppbevaring 604 800 s, uendret kontroll). Deretter «kildedataene er for gamle» — fornyelse er en bevisst handling, ikke en rullering.
- **Rutine for å fornye standarden (committ):** (1) `date -u +%Y-%m-%dT%H:%M:%SZ`; (2) sett `SYNTHETIC_DEFAULT_EPOCH` til et tidspunkt ≤ nå; (3) kjør `npx vitest run` — kandidat-id/revisjon-testen (`tests/synthetic-epoch.test.ts`) må fortsatt være grønn uten endret baseline; (4) oppdater «Standardepoke» i `docs/econ/forslag-demodata-fornyelse.md` og beslutningsloggen. Endres innhold eller `modifiedAt`, er ny revisjon og ny forhandlerbekreftelse en forventet konsekvens og skal dokumenteres.
- **Partnerdemo:** eier setter `SCOUT_SYNTHETIC_EPOCH` til klargjøringstidspunktet og restarter; gjenta etter ca. 5 døgn. Fortell mottaker at dataene er «generert <dato>».

## DEMO-RESULTS-001: BMW iX3-demosett (`demo-ix3.ts`)
Ti oppdiktede iX3-annonser (`dix3-001`…`dix3-010`) for demosøket `demo-ix3` («Demosøk BMW iX3 (syntetiske resultater)»). Syntetiske; ikke fra mobile.de eller noen annen leverandør, ingen originalannonse. Klassifiseringen gjøres av den vanlige evaluatoren, ikke av dataene: 3 oppfyller kravene (001–003), 3 må kontrolleres (004 mangler km, 005 registrert bare «2023», 006 mangler girkasse) og 4 oppfyller ikke (007 registrert for tidlig, 008 og 010 for mange km, 009 begge deler). Toppannonsen (001) er modellert på demotilfellet (iX3 Inspiring, 03/2024, 22 000 km, ca. 36 950 € netto, grå). Utstyr, interiørfarge, bakhjulsdrift og batterihelse (96,3 %) finnes bare i annonseteksten: kilden/råformatet har ikke slike felt, så de er ukjent for vurderingen og ikke søkekriterier. Datasettet har dermed 125 unike annonser; tester som beskriver DEV-003-datasettet utelater `dvar-`- og `dix3-`-postene.
