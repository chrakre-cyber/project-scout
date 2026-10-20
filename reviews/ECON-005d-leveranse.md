# ECON-005d — økonomivisning gjennom rettighetsgrensen med faste statusetiketter (leveranse til review)

**Status: REVIEW (005d). ECON-006 er ikke startet. Ingen migrasjon (ingen DB-endring), ingen hosted migrasjon, ingen deploy.** Uendret: økonomiflagg (alle `false`), økonomikjernen, avgiftsmotor, avrundingspolicy, `classifyBudget`/`src/domain/search-v2`, `src/domain/provider-rights.ts`, 005a/b/c-logikken, providere, migrasjoner. Forrige skive: 005c DONE (`reviews/ECON-005c-avslutning.md`).

## Hva er levert
| Lag | Fil | Innhold |
|---|---|---|
| Domene (rent) | `src/domain/search-economics/view.ts` | `EconomicsView`: ferdig visningsmodell (status, etikettnøkkel, beløp som desimalstrenger, koder, linjer, forhandlerinput-status). Ingen bigint, ingen kjerneinterne felt. `toEconomicsView` fra 005a-visningsstatus |
| Servergrense | `src/server/economics-view.ts` | `toDisplayEconomics(assessment, policy)`: rettighetsgrensen — beregnings-/visningsrett (fra `assessEconomics`) **og** effektiv feltvisningspolicy for pris |
| Visningsgrensen | `src/server/search-display.ts` | `DisplayItem.economics`; `DisplayOptions.economics` (forhandlerkontekst); økonomi vurderes først etter at rettigheter og proveniens er gyldige |
| Kontekst | `src/server/dealer-economics-context.ts` (server-only), `dealer-economics.ts` (`loadStoredInputsForSearch`, `storedKey`), store `listInputs(searchId)` | leser søkets bekreftede forhandlerinput og firmaprofil under firmabundet RLS; feil ⇒ tom kontekst (ingen antatte verdier) |
| Etiketter | `src/lib/search-labels.ts` | faste konstanter: `ECONOMICS_LABELS`, `ECONOMICS_NOT_BUDGET`, `economicsHeadline`, `economicsReasonText` (alle koder → norsk, reservetekst aldri rå kode), `formatNokString` |
| UI (minimal) | `src/components/search/EconomicsNote.tsx`, `ResultCard.tsx`, detaljsiden, forhåndsvisningssiden | kortlinje i resultatkortet; full forklaring på detaljsiden |

## Rettighetsgrensen (tre porter, alle fail-closed)
1. **Beregningsrett og visningsrett for avledet økonomi** (005b/005c): uten beregningsrett for pris ⇒ `unavailable`; uten visningsrett ⇒ `unavailable` og ingen tall forlater orkestreringen (`detail = null`); avslørt pris krever feltvisningsrett.
2. **Den EFFEKTIVE feltvisningspolicyen** (`DisplayPolicy`, også overstyrt/innsnevret): økonomien avslører annonseprisen, så den vises bare når prisen kan vises. Skjules prisen (f.eks. `policyFor` uten `price`), er økonomien `unavailable` — testet mot sentinel.
3. **Projeksjon**: UI får bare `EconomicsView`; aldri `EconomicsResult`, `MappingOutcome`, forhandlerinput, annonseverdier eller kandidat.
Rekkefølgen i visningsgrensen: rettighetsprofil i kraft → proveniens gyldig → økonomi. En annonse som feiler lukket (utløpt/trukket/ukjent profil, utløpte kildedata) når aldri økonomi.

## Faste statusetiketter
`Estimat — ikke validert: X kr` · `Minst X kr (ufullstendig)` · `Scenarier — fradragsstatus er ukjent` · `Ikke beregnet` (+ norske årsaker) · `Ikke tilgjengelig for denne kilden` · `Validert beregning` (uoppnåelig med registerprofilen). Statusen følger totalen som vises: **en nedre grense vises alltid som «Minst … (ufullstendig)», aldri som punktestimat**, også når kjernen kaller resultatet estimat. Alle visninger bærer «Dette er ikke en budsjettvurdering …». Budsjettnotatet («Innkjøpskostnad … er ikke beregnet …») er uendret. Ingen etikett eller tekst bruker positivt budsjettspråk (skannet: «innenfor budsjett/avvik», «fullt treff», «anbefalt», ✓ m.fl.). Uten forhandlerinput er tekniske avgiftsinput ukjente: resultatet blir i praksis en nedre grense («Minst … (ufullstendig)») eller «Ikke beregnet», aldri et estimat.

## Ingen positive utfall, ingen lagring
`positiveBudgetEligible` er false for alle statuser unntatt `validated` (som ikke kan oppstå med registerprofilen); budsjettstatus er `not_calculated` og `isFullHit` false for alle varianter (estimat, nedre grense, scenarier, ingen input, ukjent mva.-håndtering) selv med svært høyt budsjett. Visningslagene har ingen skriveoperasjoner og importerer ingen lagring (kildeskannet). Ingen avledede tall lagres; forhandlerinput leses bare (ingen skriving i 005d). Ingen UI for å registrere forhandleropplysninger er laget: i appen vises derfor «Ingen bekreftede forhandleropplysninger…» til en slik flate finnes (utenfor 005d).

## Tester (nye: 34 + oppdaterte)
`tests/economics-005d-display.test.ts` (34): statuser med ekte kjerne (estimat / nedre grense / scenarier / uten input / uten kontekst / prisgrunnlag ukjent), modellen er JSON-trygg og har kun kjente nøkler, hver årsakskode kjernen produserer har egen norsk tekst; rettighetsporter (ingen beregningsrett, ingen visningsrett, feltrett for pris, overstyrt policy, ugyldig profil, nektede registrering/specs, fremmed og foreldet bekreftelse); ingen positive utfall (5 varianter × budsjett, ren projeksjon av validert vs øvrige, nedre grense ≠ punktestimat); faste etiketter (snapshot, positive-språk-skann, markup for kort/full/ikke beregnet/må bekreftes på nytt); detaljvisning = forhåndsvisning, `loadStoredInputsForSearch` (validering/indeksering/utelatelse), ingen lagring/Supabase i visningslagene, UI bruker bare modellen, flagg ikke berørt. Oppdatert: `tests/provenance.test.ts` og `tests/search-display-ui.test.ts` (DisplayItem har nå nøkkelen `economics`: forventet endring av grensen). 005c-lagertestene fikk `listInputs` i sine lagringsstubber.
**Mutasjonskontroll:** pris-policy-porten fjernet (1 feil), nedre grense som estimat (6), positiv-flagg lekket (1), unavailable sendt videre (1), positiv etikett (4), endret «Minst …»-etikett (4), kortvisning uten budsjettnotat (1), unavailable som ikke-beregnet (2) — alle drept. Overlevende: `storedInputs`-oppslag uten nøkkel er ekvivalent (bindingskontrollen i `assessEconomics` avviser feilkoblet input uansett).

## Kontroller (utviklerens, ikke uavhengig review)
| Kontroll | Resultat |
|---|---|
| `vitest run` (hele) | **1 366 tester, 57 filer, alle grønne** (1 332 før 005d) |
| `tsc --noEmit`, `eslint .` | ingen feil, ingen advarsler |
| DB i isolert PostgreSQL 16 (hele suiten) | uendret: 258 bestått, 12 feil, 247 hoppet over (Auth/PostgREST mangler i den klyngen) |

**Ikke kjørt:** sidene/serverkomponentene i en kjørende app og e2e (ingen nettleserkjøring; markup er testet med `renderToStaticMarkup`), `dealer-economics-store.ts` (inkl. nye `listInputs`) mot ekte PostgREST, Supabase-avhengige DB-filer, `qa:*`, build, hosted migrasjon, deploy. Ingen uavhengig review av 005d ennå.

## Begrensninger / beslutninger å se
1. Forhandlerinput kan i dag bare komme fra lagring (005c); ingen skjema/UI for å bekrefte det er laget (utenfor 005d). Appen viser derfor typisk «Minst … (ufullstendig)» eller «Ikke beregnet» med forhandlerinput «ingen».
2. Resultatkortet viser en kompakt økonomilinje; full forklaring (kontant/samlet, forutsetninger, kostnadslinjer, ikke innsamlede poster) kun på detaljsiden.
3. E7 (informasjon «kjent kostnad overstiger øvre grense») og E8 (`EconomicTarget`) er fortsatt utsatt.
4. Kandidat-/kildeparing (005c) kjører for hver annonse i listen (kandidatadapteren på nytt); ytelse er ikke målt for ekte datamengder.

## Neste
Uavhengig review av 005d. ECON-006 (forklarings-UI) startes ikke før Christians beslutning.
