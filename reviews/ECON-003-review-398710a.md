# ECON-003 – uavhengig review

Dato: 19.10.2026. Reviewet pakke ved commit `398710a287880a377991e297c7e254272d80c181`, med oppgitt base `57eee19fbe073a4ca62d70fcc12928782bed1abb`.

**Konklusjon: ingen blokkerende funn. ECON-003 anbefales godkjent og avsluttet som fixture-/aritmetikkleveranse innen avtalt omfang.** Dette godkjenner ikke produksjonsregler for import-mva., valutakurs, fradragsrett eller landed cost.

## De seks kontrollpunktene

1. **Forventninger og beregning:** Historiske heltallsforventninger er literaler som samsvarer med ECON-001. B-scenarioene og kursrollescenarioet har literale forventninger, ikke forventninger generert med testorakelet ved kjøring. Jeg har krysskontrollert aritmetikken separat. Utviklerens felles forfatterskap for literaler og orakel er en reell proveniensbegrensning, men ingen sirkulær beregningsavhengighet eller talltilpasning er funnet i koden. Tester som låser literaler er regresjonsvern, ikke primærkildebevis.
2. **Observerte og oppgitte verdier:** A-observert gjenbruker OBSERVED_RUNS med separate prisversjoner. A-oppgitt gjenbruker GOLDEN_CASES og er merket stated_not_documented. De kobles på case og avgift, uten at ulik pris/mva./total fremstilles som samme observerte kjøring. Kjøretøydata oppgraderes ikke til verified.
3. **Transport og mva.:** Transport føres én gang i kontant-/kostnadssummen, og øker også mva.-grunnlaget i de uttrykkelig merkede scenarioene. Vrakpant inkluderes ikke på nytt utover totalRegistrationTaxesNok. Ingen dobbelttelling funnet i disse fixturene.
4. **Unknown:** landedCost(..., unknown) returnerer null som verdi og to navngitte scenarioer. recoverable utelater import-mva. fra permanent økonomisk kost, mens kontantbehovet fortsatt inkluderer den. Ingen oppdiktet fradragsrett.
5. **Kursroller:** Anskaffelseskursen bestemmer kjøpesummen. Tollkursen bestemmer tollgrunnlaget og dermed scenarioets import-mva. Recoverable økonomisk kost påvirkes ikke av endret tollkurs i den modellerte situasjonen. Begge roller og den syntetiske kursen er merket.
6. **Konvensjoner og åpne rettsspørsmål:** Half-up er uttrykkelig en fixture-konvensjon. CASE-002s fritak er betinget, og U-003/U-008/U-013 samt R-IMP-VAT-002/R-DED-001 står åpne. Forsikring er null som scenarioforutsetning, ikke som opplysning om faktiske kjøretøy. Ingen landed-cost-produksjonskode er introdusert i den leverte diffen.

## Kontroller faktisk utført

- Alle 30 manifestoppføringer verifisert mot SHA-256 og størrelse uten avvik.
- Alle sju avgiftsmotorfiler er byte-identiske med tidligere reviewet motor ved 5967fc2. ECON-003 endrer ikke avgiftsmotoren.
- Nye fixturer, testorakel, 20-testfilen, dokumentasjon, oppgitte ECON-001-forutsetninger og den leverte diffen gjennomlest.
- Levert repro/decimal-check.py kjørt: 43 sammenligninger bestod. A- og B-tall, transportdeltaer, to kursroller, råverdier og oppgitte avrundingsalternativer stemte.
- 161 egne kontroller kjørt med separat heltallsskalert aritmetikk. Omfatter 36 kombinasjoner av kjøretøy, anskaffelseskurs, tollkurs og transport, alle tre mva.-tilstander, literalene for standardscenarioene, observerte sumidentiteter og avgiftsmotorens tre totaler/estimatstatus. Alle bestod.
- TypeScript-fixturene ble kjørt via Node sin innebygde typefjerning i midlertidige kjørekopier med lokale importendelser. Originalfilene er uendret.

Full Vitest-suite, de 20 testene med Vitest, typecheck, lint, check-docs, build, e2e og DB er ikke kjørt på nytt i denne reviewen. De 801 rapporterte testene er utviklerens resultat, ikke mitt. Jeg har kjørt aritmetikkontrollene over direkte mot den leverte koden og de leverte forventningene.

## Restpunkter og avgrensning

- A-oppgitt blir ikke dokumentert offisiell referanse av at aritmetikken stemmer.
- Half-up mot half-even er ikke avgjort for faktiske krav. Fravær av x,5 i valideringsdata er ingen kilde for tie-policy. Generelle produksjonsgrenser, negative beløp og andre regelregimer er ikke verifisert av fixtureleveransen.
- Tilfeller med EV-pris under/omkring fritaksgrensen og annen transport-/mva.-behandling må vurderes i ECON-004 etter avklaring av reglene. +10 000 i kontantbehov er resultatet for disse tre scenarioene, ikke en universell regel om 8 000 i transport.
- Ingen kilde- eller parametergodkjenning for MVA/FX gis her. ECON-004 må ikke kopiere fixture-konvensjoner til produksjon og omtale dem som vedtatte regler.

## Neste steg

Brukeren kan godkjenne ECON-003 som test- og fixtureleveranse. Registrer reviewbelegget og avslutt oppgaven med bevarte forbehold. ECON-004 starter først etter separat beskjed, med kildeavklaring for de åpne MVA-/kurs-/fradragsspørsmålene før autoritativ produksjonsberegning.
