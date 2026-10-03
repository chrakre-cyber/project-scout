# Import-, kost- og bidragsmotor — spesifikasjon v0.1

03.10.2026. Dette er en implementeringskontrakt med valideringsport, ikke en ferdig avgiftsberegner. Kilder S03–S07 i SOURCES.md. Alle satser, særregler og salgsprofiler som skal brukes i pilot må kontrolleres separat med virkningsdato.

## Formål og korrigering av tidligere eksempel

Tidligere eksempler brukte «norsk retail minus landed cost» som bruttofortjeneste. Det er ikke tilstrekkelig for en mva.-registrert importforhandler. Prisgrunnlag, utgående mva. ved salg og fradragsberettiget inngående mva. må behandles eksplisitt. Import-mva. og likviditet er separate resultatlinjer.

Skatteetatens håndbok beskriver fradrag for personkjøretøy anskaffet for videresalg og mva. ved importørens salg av bruktimporterte biler som ikke tidligere er registrert i Norge. Dette gjør et eksplisitt profilvalg nødvendig. Ingen konkret forhandlers fradragsrett bekreftes av vår annonseanalyse.

## Inputs

| Input | Krav |
|---|---|
| Kjøpspris / currency / price_basis | Brutto/netto/ukjent; kjøpsgrunnlag må bekreftes; ikke trekk fra utenlandsk mva. ut fra annonsetekst alene |
| FX-rate | NOK per valutaenhet, kilde, dato, versjon og eventuell handelspåslag; tollkurs og betalingskurs skilles ved behov |
| Transport | Prisgrunnlag og oppdeling til norsk grense / innenlands for å unngå dobbelttelling |
| Forsikring og andre kostnader | Beløp, valuta, mva.-basis, fradragsstatus og hva som er inkludert |
| Bilspesifikasjoner | Kategori, drivlinje, vekt, CO2 med målemetode og første registrering med presisjon |
| Norsk registreringsdato | Dato avgiftsprofil/bruksfradrag skal vurderes på |
| Importør/salgsprofil | Mva.-status, videresalg som lagerbil, norsk førstegangsregistrering og godkjent regelprofil |
| Norsk forventet total salgspris | Eksplisitt om sluttkundepris inkluderer mva. og registreringsavgifter |
| Klargjøringsreserve | Beløp og mva.-basis; ufradragsberettiget del beholdes som kostnad |
| Minimum bidrag | Kroner på samme økonomiske grunnlag som resultatet |

## Beregningsflyt

```text
calculateLandedCost(listing, assumptions, ruleSet)
  -> kostlinjer, importVAT, economicCost, fundingComponents,
     supportedProfile, confidence, warnings, inputProvenance
calculateContribution(costResult, retailAssumptions, salesTaxProfile)
  -> salesVAT, revenueExVAT, preparationCost, estimatedContribution,
     complete, warnings
```

LLM kalles ikke fra disse funksjonene. Bruk decimal eller integer-regning og eksplisitt avrunding per regel. Summer presise linjer; UI avrunder bare visningen.

1. Bekreft dokumenterbart kjøpsgrunnlag og valutakonvertering.
2. Beregn tollverdi etter støttet profil. Skatteetatens generelle side beskriver innkjøpspris med frakt og forsikring fram til norsk grense. Hvilke konkrete transaksjonskostnader og kurser som skal inngå, må fremgå av profilen.
3. Beregn import-mva. etter aktuell kjøretøyprofil. Generell sats 25 % er ikke en universell regel for alle elbil-/særtilfeller.
4. Beregn engangsavgift fra versjonert offisielt regelsett og ordinært bruksfradrag. Ikke gjett manglende CO2/vekt. Ikke omregn mellom målemetoder uten dokumentert regel.
5. Legg til relevante registrerings-/vrakpant-/klimagass-/andre avgiftslinjer uten overlapp. Klimagassavgift kan kreve type og mengde i klimaanlegget.
6. Skill fradragsberettiget mva. fra endelig økonomisk kost. Ukjent fradragsrett blokkerer økonomisk bidrag.
7. Beregn salgs-mva. og salgsinntekt etter godkjent salgsprofil. Ikke del hele totalprisen på 1,25 hvis profilelementer er utenfor mva.-grunnlaget.
8. Trekk kost og reserve på samme grunnlag. Vis hva som ikke er inkludert.
9. Lag snapshot av alle input, versjoner, datoer og manuelle bekreftelser.

## To økonomiske output

**Estimert bidrag før faste kostnader** = salgsinntekt etter utgående mva. − økonomisk anskaffelseskost − klargjøringsreserve på godkjent mva.-grunnlag.

**Likviditetsestimat** er en egen beregning av betalingsforløp og midlertidig kapitalbinding. Det må ikke ukritisk legge til fradragsberettiget import-mva. som grensebetaling for en registrert forhandler. Dersom betalingsforløpet mangler, vis kostkomponenter og «likviditetsbehov ikke beregnet».

Marginprosent, hvis den vises, er bidrag / salgsinntekt eks. utgående mva.; dokumenter nevneren. Ikke bland kroner og prosent.

## Syntetisk regneeksempel — bare matematikk

Anta at godkjent skatteprofil allerede har levert salgsinntekt eks. utgående mva. = 1 000 000 kr, økonomisk anskaffelseskost = 820 000 kr og reserve på samme grunnlag = 30 000 kr. Da er bidrag = 150 000 kr. Eksemplet fastsetter ingen avgiftssats, konkret importkost eller norsk retail-konvertering.

## Usikkerhetsmodell

- HIGH: støttet og validert regelprofil, alle kritiske input dokumenterte og estimater innen godkjent policy. Dette er kalkyletillit, ikke bevis på bilens tilstand.
- MEDIUM: støttet profil og alle kritiske felt, men eksempelvis transport fra datert estimattabell. Marginvarsel tillates bare hvis policyen er godkjent i QA-002 og konservativt bidrag fortsatt når målet.
- LOW: manglende prisgrunnlag, registreringspresisjon ved avgiftsgrense, uavklart mva.-status, manglende kritisk avgiftsfelt eller uvalidert/utløpt profil. Returner `estimatedContribution=null` og ingen marginvarsel.

Confidence er forklarte kvalitetsregler, ikke en statistisk sannsynlighet. Detaljert linjeestimat kan vises selv om totalen er ufullstendig, men det kalles ikke full importkost.

## Transport og følsomhet

Transporttabellen har område, pris, hva som inngår, mva.-grunnlag, kilde og gyldig dato. Ikke vis oppdiktet transportpris som reelt tilbud. UI: «Estimert transport». Samme frakt føres bare én gang, selv om deler inngår i mva.-grunnlaget.

For marginvarsel benyttes konservativt scenario innen oppgitte estimatintervaller: høyere transport/kost og relevant kursbuffer. Hvis intervaller ikke finnes, er dette en åpen forutsetning som vises og må godkjennes før varsling. Ingen fast bufferprosent er vedtatt i denne pakken.

## Validering — TAX-001/TAX-002/QA-002

Velg første profiler med forhandlercasene. Dokumenter profiler som er unsupported. Bygg minst 50 beregningstilfeller over relevante aldersgrenser, drivlinjer og prisgrunnlag, med uavhengige referanser for alle profiler som gis margin i pilot. Skatteetatens kalkulator kontrollerer avgiftsdelen, ikke hele dealer-salgs-/mva.-regnestykket.

Test alle delregler og behold input/dato/kilde, output og avvik. Aksept: ingen uforklarte avvik utover dokumentert offisiell avrunding. Manglende referanser er en blocker, ikke et bestått testresultat. Ordinært bruksfradrag brukes; alternativ metode er utenfor MVP.
