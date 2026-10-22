# ECON-005d – uavhengig review av 47fb78a

Commit: `47fb78a83c9e542ad431996c534b87b0a80f9aca`.
Grunnlag: reviewpakken med 332 manifestoppføringer, kode, tester og diff mot e24e683.

## Konklusjon

**Ett P2-funn. ECON-005d bør forbli REVIEW til retting og re-review.** Ingen parametergodkjenning gis.

## P2 – tidlige avslag passerer uten kontroll av økonomiens visningsrett

Sted: `src/server/economics-view.ts`, `toDisplayEconomics`, særlig grenen for `a.kind === "not_calculated"`.

Funksjonen sjekker `a.kind === "unavailable"` og prisens feltpolicy, men returnerer deretter årsak og forhandlerbekreftelsesstatus for `not_calculated` uten å kontrollere retten til å vise avledet økonomi. Den vanlige `assessed`-grenen er beskyttet av 005a-visningsstatusen; tidlige avslag i `assessEconomics` går utenom den.

**Reproduksjon gjennom den faktiske visningsgrensen:** gyldig profil med beregningsrett for price/registration/specs, rå pris synlig, men `derivedEconomics.display = false`; gyldig kandidat og kandidatbundet forhandlerbekreftelse; `lastSeenAt` i fremtiden. `previewForDisplay` returnerer:

```json
{"status":"not_calculated","labelKey":"not_calculated","reasons":["source_observation_in_future"],"dealerInput":{"state":"in_use"},"positiveBudgetEligible":false}
```

Forventet er den uniforme modellen uten årsaker, bekreftelsesstatus eller tall:

```json
{"status":"unavailable","labelKey":"rights_not_granted","positiveBudgetEligible":false}
```

Dette lekker ikke et kostnadsbeløp, men viser økonomiens interne avslagsårsak og bekreftelsesstatus til tross for nektet økonomivisning. På detaljsiden gjengis disse opplysningene. Det bryter den erklærte visningskontrakten og skillet mellom «ikke tilgjengelig» og «ikke beregnet».

**Rettingskrav:** håndhev økonomiens beregnings-/visningsrett og effektiv prisvisning før alle økonomigrener projiseres. Bevar samtidig «Ikke beregnet» med årsaker for brukere/kilder som faktisk har visningsrett. Tidlige `not_calculated`-resultater bærer i dag `rights: none(...)`; en retting må skille reelt rettighetsavslag fra at beregningen stoppet tidlig. Ikke gjør alle tidlige avslag utilgjengelige uavhengig av rettigheter. Kontroller også oppførselen uten økonomikontekst, slik at en manglende kontekst ikke omgår samme visningspolicy.

Vedlagt `economics-005d-independent-regressions.test.ts` inneholder den uavhengige regresjonen. Den feiler på levert kode med ovenstående forskjell. Legg til kontrolltilfeller med tillatt visning, skjult pris, manglende kontekst og øvrige tidlige avslag.

## Reviewerens egne kontroller

- 332 av 332 manifest-hasher stemmer før reviewerens lokale testtillegg.
- Pakkens kjørbare eksisterende tester: **55 filer, 1 240 tester består**.
- Ny uavhengig regresjon: **1 test feiler**, som forventet for funnet.
- Full TypeScript-kontroll og ESLint består på levert tilstand før testtillegget.
- Statisk gjennomgang av projeksjon, feltpolicy, proveniensrekkefølge, komponent/etiketter, sidekobling og ny lesing av forhandlerkontekst.

De to kildeavhengige testfilene `tax-engine.test.ts` og `economics-source-driven.test.ts` er utelatt fordi primærkildearkivene ikke følger pakken. Utviklerens fulle resultat på 1 366 tester er derfor ikke selv bekreftet. Eksisterende lokale avhengigheter er brukt.

PostgreSQL, Auth/PostgREST, faktisk `listInputs` mot Supabase, `check-docs`, `qa:*`, build, kjørende app, e2e, hosted migrasjon og deploy er ikke kjørt av reviewer. Render-testene erstatter ikke nettleserkontroll eller ekte lagringsintegrasjon.

Økonomiflaggene skal fortsatt være false. Ingen utvidelse av kjerne, godkjenninger eller ECON-006 trengs for denne rettingen.
