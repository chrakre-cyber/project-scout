# Sjekkliste: tre manuelle kalkulatorkjøringer (PHEV, EV, diesel)

> **Merk (runde 9):** §B er et *anbefalt* dokumentasjonssett. Det som kreves for klasse 1 følger evidensmodellen og referanseregisteret (`2026-10-18/REGISTRERING.md` §4): uavhengig kalkulator, eksakte input, dato, resultat og skjermbilde. URL/versjon, klokkeslett og bruksfradragsprosent er ønskelig, men kreves ikke; denne sjekklisten omdefinerer ikke klassen.

Du leverer filene; jeg beregner SHA-256 og registrerer proveniens. Ingen hash- eller kodearbeid for deg.

## A. Før hver kjøring (enkelt)
1. Åpne `GUIDE-<kjøretøy>.md`. Du kan **gjennomføre alle tre kontrollene med de oppgitte testinputene** (arbeidsdato, referansevekt, CO₂) — **tekniske kjøretøydokumenter er ikke påkrevd**. Kjøringene dokumenterer da kalkulatorens beregning for disse inputene, **ikke de konkrete bilene** (`referenceScope = explicit_inputs`).
2. Velg **norsk registreringsdato** (innenfor 2026, ≥ første registrering) og noter den. Velg standard bruksfradrag (tabell), ikke alternativ beregning.
3. Ikke gjett. Det som ikke er oppgitt i guiden er ditt valg — noter hva du valgte.

## B. Under kjøringen — skjermbilder (PNG/PDF, uten beskjæring/redigering, ett sett per kjøring)
Navn: `<GR-PENDING-…>_S<nn>_<kort tekst>.png`
| Nr. | Hva | Må vise |
|---|---|---|
| S00 | startsiden | adresselinje (URL), klokke/dato (hele skjermen), evt. versjon/dato på siden |
| S01…Sn | hvert inputsteg, utfylt, før «Neste» | alle felt med etiketter og valgte verdier (nedtrekk inkl.) |
| S-sum | oppsummering av input (hvis finnes) | alle input |
| S-res1 | resultatsiden øverst | samlet avgift |
| S-res2 | alle delposter utvidet | engangsavgift, vrakpant, bruksfradrag-prosent, evt. avgift før fradrag, merknader/advarsler |
| S-res3 | detaljside/PDF-eksport (hvis finnes) | lagre også PDF |
I en melding: **kjøredato og klokkeslett**, **hvem som kjørte**, **norsk registreringsdato du tastet**, og eventuelle valg som ikke står i guiden.

## C. Tekniske dokumenter — VALGFRITT (bare for kjøretøyspesifikk referanse)
Typegodkjenning/CoC (minimumsvekt, CO₂-felt, motortype/ladbarhet) og vognkort/utenlandsk registreringsbevis med første registreringsdato. Uten disse registreres kjøringen som `explicit_inputs`. Med dem kan den i tillegg registreres som `vehicle_specific`.

## D. To typer validering (klasse 1-definisjonen er uendret)
| Type | Krever | Dokumenterer | Dokumenterer ikke |
|---|---|---|---|
| **explicit_inputs** | skjermbilder S00–S-res3 + melding (kjøredato, norsk reg.dato, valg) | at kalkulatoren gir X for disse inputene → kontroll av motorens regler (satser, bruksfradragstrinn, vrakpant, sluttavrunding) | at inputene er bilens egne data |
| **vehicle_specific** | det samme **pluss** tekniske dokumenter (C) | i tillegg at avgiften gjelder dette kjøretøyet | regelverk etter kjøredato, MVA |

## E. Etter mottak (mitt arbeid)
1. Filene legges i `docs/tax/golden-runs/<referanse-ID>/`; **jeg beregner SHA-256** og skriver proveniens (mottatt dato, filnavn, hva hver fil viser).
2. Jeg leser skjermbildene, fyller `GR-…md` (ingenting rekonstrueres; avvik mellom melding og skjermbilder flagges) og kjører motoren mot de dokumenterte inputene.
3. Referansen registreres (`references.json`, klasse 1 etter eksisterende definisjon, `referenceScope`). **Jeg godkjenner ingen parameter.**

## F. Hvis kalkulatoren og motoren ikke stemmer
Avviket registreres som **uavklart** til årsaken er undersøkt — det klassifiseres ikke automatisk som «endring etter testdatoen» eller noe annet. Jeg undersøker adskilt:
1. **Kjøredato** — når kalkulatoren ble kjørt (og hvilken regelversjon den viser).
2. **Norsk registreringsdato** — datoen som ble tastet inn (styrer bruksfradragstrinn og hvilken regelperiode som gjelder).
3. **Motorens regelprofil** — `NO-OTA-2026-A-PB`: gyldig fra 2026-01-01, kilder verifisert per 2026-10-18, intern sperre 2026-12-31.
Pluss inputfeil/overføringsfeil, avrundingsrekkefølge (U-012), dag 29–31 (U-009) og eventuell annen kalkulatorlogikk. Bare hvis det dokumenteres (skjermbilde/kilde) at kalkulatorens regler er endret etter 2026-10-18, kan avviket klassifiseres som regelendring — og først etter at årsaken er undersøkt.

## G. Hva som kreves før en parameter kan godkjennes (alle tre)
1. **Evidenskrav:** regelen er **E1** (ikke E1P) med E1-kilder. Etter runde 12 er R-OTA-001, -002 (avgrenset), -003, -005, -007, -010 (avgrenset) og R-IMP-OTH-001 E1; **R-OTA-014 er E1P og ikke godkjenningsklar** — uansett klasse 1. R-OTA-015 (NEDC/egenvekt-10) og R-OTA-016 (dag 29–31) er E1P og blokkert.
2. **Validering:** klasse 1-referanse (en `explicit_inputs`-kjøring er nok for å validere beregningen).
3. **Uttrykkelig godkjenning** av deg, regel for regel.
Klasse 1 alene gjør ingen parameter godkjenningsklar. Jeg godkjenner ikke noe.
