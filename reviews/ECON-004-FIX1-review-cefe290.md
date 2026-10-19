# ECON-004 – uavhengig rettingsreview FIX1

Dato: 19.10.2026. Reviewet pakke ved `cefe290b598d55e3a2f25ca5be0b985a573b0fce`, sammenlignet med tidligere reviewet `f12d44a399509d97f2d353c147609825c1536329`.

**Konklusjon: alle fire tidligere P2-funn er rettet og kan lukkes. Ingen nye blokkerende funn i den avgrensede rettingsdiffen. ECON-004 beholdes som REVIEW på grunn av de uavklarte produksjonsreglene, ikke på grunn av de fire kodefunnene.**

## Bekreftede rettinger

1. Ukjent drivlinje bevarer begge mulige fritaksscenarioer. Den tidligere falske nedre grensen 437 500 NOK er nå 362 500 NOK, under det mulige BEV-totalet på 379 248. Eksplisitt not_applicable avgrenser scenarioet som oppgitt. Dette er verifisert innen kjernens egne scenarioforutsetninger, ikke en rettslig godkjenning av fritak.
2. Avrundingslikhet i øvrige kostnader registreres før totalenes entydighet avgjøres. Totalene blir lower_bound med laveste kandidat. Testtilfellet 2,5 gir 458 725 NOK og kandidatene 3/2, mens 2,4 og 2,6 gir henholdsvis entydige 458 725 og 458 726 NOK.
3. AmountInput med assumed_default gir estimateReasons med assumed_default_amount. Syntetisk godkjente regel-/avrundingsflagg gjør ikke slike antakelser til validated. Et kontrolltilfelle uten antakelser kan fortsatt gi validated med syntetisk godkjente flagg.
4. Fixture-kilde krever test-opt-in, uavhengig av fixtureOnly. Manglende eller ukjent source.kind avvises. Eksisterende fixtureOnly-vakt er bevart.

## Kontroller faktisk utført

- Alle 16 manifestoppføringer kontrollert mot filstørrelse og SHA-256 uten avvik.
- ZIP SHA-256 samsvarer med levert verdi: aef1448da814081149152cd238626421a94bfba3cc8687602f200435d2fc89f9.
- Den leverte rettingsdiffen, endret kode og nye regresjons-/egenskapstester gjennomlest.
- 208 direkte kontroller mot rettet kode bestod, inkludert de fire opprinnelige reproduksjonene, entydige beløp rundt avrundingslikhet, syntetisk validert kontrolltilfelle, tre ECON-003-regresjonstotaler og 192 sammenligninger av nedre grenser mot mulige utfyllinger.
- De 192 sammenligningene omfatter fire kjøpspriser, ukjent drivlinje/transport/forsikring/øvrige avgifter og tre fradragstilstander, med to utfyllinger og to totaltyper. Dette er en endelig prøveserie, ikke et matematisk bevis for alle input.
- Kjørt økonomikode fra FIX1 med uendrede avgiftsmoduler og fixturer fra forrige fullpakke. Avgiftsmotoren er ikke med i FIX1; oppgitt tom tax-diff er lest, og ingen avgiftskodeendring inngår i den leverte patchen. Det er ikke en ny uavhengig eksportkontroll av alle filer i remote-commit.
- TypeScript kjørt via Node sin innebygde typefjerning i midlertidige kjørekopier med lokale importendelser. Originalfilene er uendret.

Full Vitest-suite, typecheck, lint, check-docs, build, e2e og DB er ikke kjørt på nytt her. Opplysningen om 856 tester og testutfall mot gammel kode er utviklerens resultat. De fire tidligere feilutfallene var allerede reprodusert uavhengig i første review, og deres nye utfall er kontrollert her.

## Gjenværende arbeid

Ingen nye kodeendringer anbefales ut fra denne rettingsdiffen. Neste fase er kildeavklaring og vurdering av produksjonsomfang for U-003, U-008, U-013 og R-IMP-VAT-002/-003/R-DED-001. Dagens tall er fortsatt estimater/scenarioer under de beskrevne forutsetningene; de falske godkjenningsflaggene i registeret skal ikke settes til true bare fordi de tekniske testene består.

Behold ECON-004 som REVIEW til disse akseptkravene er håndtert eller brukeren uttrykkelig avgrenser leveransen. Ikke start ECON-005 automatisk. Reviewen er ikke en godkjenning av økonomikjernens produksjonsparametere eller en ny juridisk vurdering.
