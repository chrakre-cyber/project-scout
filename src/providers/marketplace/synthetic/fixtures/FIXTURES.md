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

Normalisert datasett: 109 unike annonser.
