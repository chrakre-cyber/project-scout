# ECON-004 SRC1 FIX1 — avgrenset rettingsreview

Reviewet commit: `bd67c8d3c10ca69015b8e50757f8b583180ce6d4`.
Basis: `76200ffc08646482cbe97503090a64c0dc9de6af`.

**Konklusjon: Begge P2-funn er lukket. Ingen nye blokkerende funn i den avgrensede rettingen. ECON-004 forblir REVIEW på grunn av uavklarte regler; denne reviewen godkjenner ingen økonomiflagg eller produksjonsregler.**

## P2-1 — lukket

Akseptdatoens status registreres nå i hovedflyten, før valuta-/kursgrenene. Egen kjøring bekrefter NOK og EUR, direkte kurs og fallback, kombinert med ukjent, forventet og faktisk dato:

- Ukjent dato gir `incomplete` og nøyaktig én `customs_acceptance_date_unknown`.
- Forventet dato gir nøyaktig én `customs_acceptance_date_expected` og kan ikke alene gi validated.
- Faktisk dato tilfører ingen datoårsak. Fallback beholder sin egen estimatårsak.
- Direkte tollkurs utenfor perioden blokkeres fortsatt. Kursperiodens validering ligger fortsatt i tollkursgrenen.

## P2-2 — lukket

Ved ukjent håndtering og akseptert `recoverable` blir ikke-registrert kanal filtrert bort og forklart i `excludedScenarios`. Resultatet beholder ukjent håndtering, `accepted: false`, `vat_handling_unknown` og `scenarios`, også med én rad. Ingen faktisk registrering er utledet.

Ved `non_recoverable` og ukjent fradragsrett finnes begge kanaler. Eksplisitt ikke-registrert + recoverable blokkeres fortsatt.

## Utførte kontroller

- Alle 29 manifestoppføringer kontrollert mot størrelse og SHA-256; manifestets commit-ID stemmer.
- Lest runtime- og typediff, samt justeringene av eksisterende tester. Endringene i testforutsetningene samsvarer med rettingen.
- Kjørt levert økonomikjerne med uendret avgiftsmotor og fixtures fra forrige reviewpakke gjennom Nodes TypeScript-stripping. 71 egne kontrollpåstander bestod. Disse omfatter datomatrisen, scenariofiltrering, råkursnormalisering, transportdeling, suspensjon, fixture-sperre og eksplisitt selvmotsigelse.
- De 11 diagnostiske inputene fra forrige review er kjørt igjen; funnene er kontrollert direkte mot resultatene.

## Begrensninger

Dette er en avgrenset rettingsreview, ikke full applikasjons- eller juridisk review. Hele Vitest-suiten, typecheck, lint, check-docs, build, e2e og DB er ikke kjørt av reviewer. Utviklerens 893 beståtte tester er utviklerens resultat. Kildearkivet er ikke revidert på nytt. Diagnostiske tilfeller i resultatfilen er ikke alle klassifisert som feil.

U-013 og øvrige kilde-/godkjenningspunkter står åpne. Økonomiflaggene forblir false, og ECON-005 er ikke startet. Ingen kode i reviewpakken er endret.
