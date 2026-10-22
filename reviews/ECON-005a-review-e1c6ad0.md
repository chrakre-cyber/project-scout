# ECON-005a – uavhengig implementeringsreview

Commit: `e1c6ad05f3760e0ec004a296d132c58f8663a61f`.

**Konklusjon: To P2-funn i kostnadslinjebehandlingen. ECON-005a beholdes på REVIEW; 005b bør ikke startes før rettingene er kontrollert.** ECON-004s avgrensede DONE og de fire falske økonomiflaggene endres ikke.

## P2-1: Kostnad eksklusive mva. regnes som ferdig avklart uten brutto-/avgiftsgrunnlag

Fil: `src/domain/search-economics/cost-lines.ts`, kontrollen av `vatBasis` og returen `added_to_total` for øvrige kostnadstyper.

Bare `vatBasis === null` avvises. `excl` behandles som `incl`/`none`: beløpet legges direkte til budsjettsummen, linjen blir resolved, og en validert kjerne kan gi complete_validated. Det finnes ikke noe input for avgiftssats eller sluttbeløp på linjen som avklarer hva en eksklusiv pris koster brutto.

Reproduksjon med eksisterende syntetisk godkjente testprofil og kjernetotal 468 723 NOK: en `custom`-linje med 1 000 NOK og `vatBasis: "excl"` gir complete_validated med 469 723 NOK. Dersom denne kostnaden faktisk har 25 % mva., er budsjettsummen 469 973 NOK. 25 % her er en mulig fullføring, ikke en påstand om at alle tillegg har denne satsen. Problemet er at den nødvendige opplysningen mangler, mens resultatet likevel erklæres fullstendig.

Dette gjelder også mapperens håndtering av eksklusive transport-/forsikringslinjer. At vatBasis beholdes i costBasis-strengen endrer ikke regningen eller statusen.

**Retting:** Ikke innfør en ny mva.-motor for tillegg i denne skiven. Hold eksklusive beløp uavklarte med incomplete/unsupported inntil en uttrykkelig, dokumentert mapping til riktig brutto budsjettbeløp finnes. Bevar beløp og årsak. Incl/none skal fortsatt fungere når grunnlaget er avklart. Test at excl ikke kan gi positiv budsjettstatus uten det manglende grunnlaget.

## P2-2: Fast toleranse på 99 øre kan godkjenne at et beløp ikke er dekket

Fil: `src/domain/search-economics/cost-lines.ts`, `ROUNDING_TOLERANCE_ORE` og `covers()`.

`covers(0n, 99n)` blir true. Dermed blir en transportlinje på 99 øre med bekreftet to_border-omfang behandlet som mapped_to_input selv når kjernens transport er 0 NOK. Linjen legges ikke til totalen, men erklæres dekket og resolved. Med den syntetisk godkjente profilen gir dette complete_validated.

Begge støttede nærmeste-krone-policyer avrunder 0,99 NOK til 1 NOK, aldri 0. En generell 99-øre-toleranse er derfor ikke en gyldig kontroll av avrundingsmappingen. Samme problem finnes for andre beløp tett under neste hele krone.

**Retting:** Kontroller komponentdekning mot den faktiske støttede avrundingen eller en eksplisitt sporbar beløpsallokering. Ikke bruk en vilkårlig toleranse til å erklære en linje dekket. Uavklart eller motstridende mapping skal gi incomplete, ikke complete_validated. Test transport, forsikring og split, inkludert 0,49 / 0,50 / 0,51 / 0,99 NOK under relevante policyer og med uavklart policy. Ingen eksisterende juridisk avrundingsregel skal endres.

## Regresjonstester

`economics-005a-review-regressions.test.ts` kopieres til `tests/` i repoet. De to testene er kjørt og feiler på e1c6ad0: begge oppnår complete_validated i tilfeller der mapperen mangler grunnlag for dette. Testene bruker ekte beregningsresultater og eksisterende fixturer; ingen produksjonskode er mutert. Syntetiske godkjenningsflagg brukes bare til å prøve porten, ikke som parametergodkjenning.

Med dagens registerprofil er positive utfall fortsatt sperret av de falske flaggene, men beløp/mapping blir likevel feil. Funnene må derfor ikke løses ved bare å lene seg på dagens flagg.

## Uavhengige kontroller

- Alle **64 SHA-256-manifestoppføringer** stemmer.
- Leveransen og mapperne er lest, sammen med budget-/statuskontrakten og de relevante testene.
- **68 leverte tester** består: 24 mappingtester og 44 economics-core-tester.
- **To nye reviewer-tester feiler**, som forventet for funnene.
- Avgrenset **typecheck består** for nye mappermoduler og de to leverte testfilene med importerte domeneavhengigheter.
- **ESLint exit 0** for nye moduler og mappingtesten. Next-regelen melder at appens pages-mappe mangler i den partielle pakken.

Eksisterende lokale avhengigheter (Vitest 5.0.3) ble brukt; ingen ren npm ci. Ingen produksjonsfiler ble endret. Reviewkonfigurasjon og regresjonstester ligger bare i utpakket reviewkopi.

Ikke kjørt: full repo-suite med 1 009 tester, full app-typecheck/lint, check-docs, build, e2e eller DB. Utviklerens tall er separat belegg. Dette er en review av 005a, ikke en ny review eller regelgodkjenning av ECON-004.

## Videreføring

Modulplasseringen i `src/domain/search-economics/` er hensiktsmessig: integrasjonsmappingen holdes utenfor den rene beregningskjernen. Ferdige rettighetsbooleans er akseptabelt for denne skiven; reell rettighetsoppløsning og feltkontroll må fortsatt komme i 005b.

Rett de to avgrensede funnene og lever en rettingspakke. Ikke utvid til database, UI eller providers i denne runden.
