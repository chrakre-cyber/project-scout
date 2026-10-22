# ECON-005d — rettingsrapport (review av 47fb78a, ett P2)

**Status: ECON-005d forblir REVIEW. ECON-006 er ikke startet. Ingen migrasjon, ingen hosted migrasjon, ingen deploy.** Review: `reviews/ECON-005d-review-47fb78a.md`. Uendret: økonomiflagg (alle `false`), økonomikjernen, avgiftsmotor, avrundingspolicy, `classifyBudget`, 005a/b/c-logikken (utover `rights` på tidlige avslag, se under), komponent og etiketter, DB.

## Funnet
`toDisplayEconomics` sjekket `unavailable` og prisens feltpolicy, men projiserte `not_calculated` (tidlige avslag fra `assessEconomics`) uten å kontrollere retten til å vise avledet økonomi. Reproduksjon gjennom `previewForDisplay` (profil med beregningsrett, rå pris synlig, men `derivedEconomics.display = false`; gyldig kandidat og bekreftelse; `lastSeenAt` i fremtiden) ga `not_calculated` med årsaken `source_observation_in_future` og `dealerInput: in_use` i stedet for den uniforme `unavailable`. Samme omgåelse fantes uten økonomikontekst (`NO_CONTEXT_VIEW` ble gitt uten rettighetskontroll). Ingen beløp lekket; årsak og bekreftelsesstatus gjorde det.

## Årsak og retting
Tidlige avslag bar `rights: none(null)` (derive/display = false uansett), så projeksjonen kunne ikke skille et reelt rettighetsavslag fra at beregningen stoppet tidlig for en bruker med visningsrett.
- **`assessEconomics`:** alle tidlige `not_calculated` (paringsavvik, ugyldig/fremtidig observasjon, adapteravslag som scenario/pris) bærer nå den ekte rettighetsbeslutningen for økonomiens minstekrav (`economicsDecision(rights, ["price"], ["price"])`: beregningsrett, visningsrett for avledet økonomi og visningsrett for pris), via `early()`. `unavailable`-grenen er uendret.
- **`toDisplayEconomics`:** for `not_calculated` kreves nå `rights.display` (i tillegg til effektiv prisvisningspolicy som før). Uten rett ⇒ uniform `unavailable` uten årsaker, uten status for forhandlerbekreftelse og uten tall. Med rett ⇒ «Ikke beregnet» med relevante årsaker (som før). Tidlige avslag er altså **ikke** gjort utilgjengelige uavhengig av rettigheter.
- **Uten økonomikontekst:** ny `toDisplayEconomicsWithoutContext(rights, policy)` bruker samme porter (prisvisning i effektiv policy og økonomiens visningsrett); uten rett ⇒ `unavailable`, med rett ⇒ «Ikke beregnet» / `no_dealer_context`. `search-display.ts` bruker den når kontekst mangler.
- **`toDisplayItem`:** parameteren `economics` er nå påkrevd (standardverdien `NO_CONTEXT_VIEW` kunne omgå porten). Ingen eksterne kallere fantes.
- Den vanlige `assessed`-grenen er uendret (beskyttet av 005a-visningsstatusen og `detail = null` uten visningsrett).

## Tester (nye: 30)
`tests/economics-005d-independent-regressions.test.ts` (reviewerens regresjon, kopiert uendret) og `tests/economics-005d-fix-coverage.test.ts` (29): tre tidlige avslag (fremtidig observasjon, scenario som ikke støttes, annonse uten pris) × {uten visningsrett, uten beregningsrett, skjult pris via feltrett, skjult pris via overstyrt policy, med visningsrett, med eksplisitt prispolicy}; reviewers reproduksjon (begge sider); detaljvisning; manglende kontekst (uten rett, skjult pris, full rett, direkte `toDisplayEconomicsWithoutContext` inkl. ukjent kilde og trukket profil); `assessEconomics` bærer ekte `rights` på tidlige avslag (paringsavvik, ugyldig observasjon via stub-adapter); uendret oppførsel for `unavailable` og `assessed`; markup uten årsaker/bekreftelsestekst uten rett.

## Før / etter
| | Før (47fb78a) | Etter |
|---|---|---|
| Reviewerens regresjon | 1 feiler | består |
| Reviewerens 1 + nye 29 (30) | **13 feiler**, 17 består | **30 består** |
| `tests/economics-005*` (alle) | — | 402 består |
| Full vitest | 1 366 | **1 396 grønne** (59 filer) |
| `tsc --noEmit`, `eslint .` | — | rene |
| DB i isolert klynge | uendret (ingen DB-endring) | uendret: 258 bestått, 12 feil, 247 hoppet over (Auth/PostgREST mangler) — ikke kjørt på nytt |

**Mutasjonskontroll** (alle drept): visningsrettsporten for tidlige avslag fjernet (9 feil), paringsavvik uten ekte rettigheter (2), alle tidlige avslag uten ekte rettigheter (9), manglende kontekst omgår grensen (2), uten kontekst: visningsrett ignorert (2), uten kontekst: prispolicy ignorert (2).

## Kontroller og begrensninger
Kjørt (utviklerens, ikke review): vitest (hele), tsc, eslint. **Ikke kjørt:** kjørende app/e2e (markup testet med `renderToStaticMarkup`), lagringen (`listInputs`) mot ekte PostgREST, Supabase-avhengige DB-filer, `qa:*`, build, hosted migrasjon, deploy; DB-suiten er ikke kjørt på nytt (ingen DB-endring). Ingen uavhengig review av rettingen ennå.
