# Produktspesifikasjon — MVP 0.1

Versjon 0.1 · 03.10.2026 · Eier: Christian Åkre. Omfanget under er vedtatt i samtalen; tekniske detaljer er arbeidsbeslutninger som kan justeres uten nye produktfunksjoner.

## 1. Problem og verdiløfte

Norske bilforhandlere søker etter biler utenlands og bruker tid på å avgjøre om bilen passer lageret og kan importeres med ønsket fortjeneste. Scout finner annonser, gir et etterprøvbart kostestimat og oppsummerer hva annonsen oppgir.

MVP skal bevise: **Finner systemet biler som forhandleren faktisk ønsker å vurdere for kjøp?**

## 2. Målgruppe og mål

Fem pilotforhandlere med ulike bruktbilprofiler. Ett forhandlerfirma per brukerkonto i første pilot. Bilmarkedet er ikke begrenset til klassikere.

Mål innen dag 30: fungerende løsning og oppstart av pilot, betinget av datatilgang og beregningskontroll. Betalingsvilje og aktivitet måles etter 14 dagers faktisk bruk, ikke på dag 30 hvis piloten starter da.

## 3. Innenfor / utenfor

| Innenfor MVP | Utenfor MVP |
|---|---|
| Login og isolerte firmadata | Mobilapp og teamadministrasjon |
| Inntil 10 aktive agenter per firma | Flere markedsplasser/landmotorer |
| Strukturerte filtre og søketekst som støttes av UI | Automatisk norsk markedsverdi / FINN-integrasjon |
| Mock-provider og senere mobile.de-provider | Scraping som uavklart omgåelse av API-vilkår |
| Forhandlerens norske salgspris og marginmål | Egen ML-modell, læring fra klikk |
| Deterministiske kost- og marginberegninger | Alternativt bruksfradrag |
| Tabellbasert estimert transport | Live transportpris og booking |
| AI-oppsummering med belegg | VIN-/historikk-/inspeksjonsintegrasjon |
| Forklarbar rangering og e-post | Stripe / automatisert billing |
| Tre hovedskjermer | USA, Norden-utvidelse, DMS |

Fritekst-til-filtre er ikke en lanseringsblokkering. Strukturerte felt er alltid autoritative. Et tolket fritekstsøk må bekreftes av bruker før aktivering; oppgaven ligger etter kjerneflyten.

## 4. Brukerflyt

1. Bruker logger inn og tilhører ett forhandlerfirma.
2. Oppretter agent med merke, modell/variant, alder, km, gir, drivstoff, karosseri, land og prisramme.
3. Oppgir forventet norsk sluttkundepris, eksplisitt prisgrunnlag, klargjøringsreserve og minimum ønsket bidrag i kroner.
4. Ser filtrene og alle kalkyleforutsetninger; aktiverer agenten.
5. Systemet søker etter avtalt intervall, normaliserer og dedupliserer annonser.
6. Relevante biler får kostkalkyle, score og annonseanalyse.
7. Bruker ser kort på dashboardet og mottar varsel hvis bilen består varselkriteriene.
8. Opportunity-siden viser originalkilde, pris, forutsetninger, kostlinjer, usikkerhet, bidrag og annonsebelegg.
9. Bruker åpner originalannonsen og gjør egen kjøpsvurdering. Scout kontakter eller kjøper ikke bilen.

## 5. Tre skjermer

**Dashboard:** tidspunkt for siste vellykkede søk, nye annonser observert i Scout, relevante treff og opportunities som tilfredsstiller marginmålet. Vis demo-banner og kildefeil tydelig. «Ny i Scout» må ikke kalles «ny på mobile.de» uten kildebelegg.

**Mine agenter:** liste, aktiv/pause, antall treff, opprett/rediger. Maks 10 aktive håndheves på serveren, også ved samtidige forespørsler.

**Opportunity:** bilde dersom bruksrett er avklart, spesifikasjoner, annonsepris med valuta og brutto/netto-status, forventet norsk salgspris med mva.-grunnlag, estimert transport, avgiftsstatus, estimerte kostnader og bidrag. Originalannonse åpnes via godkjent URL. Ukjente data vises som «ikke oppgitt».

## 6. Økonomiske begreper

- `expected_retail_total_nok`: forhandlerens forventede totalpris til sluttkunde, inklusive aktuelle avgifter. Prisgrunnlaget må være eksplisitt.
- `sales_revenue_ex_vat_nok`: salgsinntekt etter beregnet utgående mva.; avgiftselementer håndteres av godkjent skatteprofil.
- `economic_cost_nok`: kjøp og kostnader med riktig behandling av fradragsberettiget mva.
- `estimated_contribution_nok`: salgsinntekt eks. utgående mva. minus økonomisk kost og klargjøringsreserve. Før faste driftskostnader, finansiering, skatt og eventuelle kostnader som ikke er inkludert.
- `funding_estimate_nok`: eget likviditetsestimat med oppgitt betalingsforløp; import-mva. er ikke automatisk en kontantbetaling ved grensen for alle forhandlere.

Bruk etiketten **«Estimert bidrag før faste kostnader»**. Ikke vis dette som garantert fortjeneste. Tidligere illustrative margintall er ikke validerte testfasiter.

## 7. Kvalitet og sikkerhetskrav

- Pris, kurs, transport og avgiftsregler har enhet, dato, kilde og versjon.
- Annonsens mva.-etikett gir ikke automatisk rett til netto eksportpris eller norsk fradrag.
- Ufullstendig eller ikke validert skatteprofil blokkerer marginvarsel. Treffet kan fortsatt vises som «må kontrolleres».
- AI beskriver «annonsen oppgir», med kort belegg. Fravær av skadeomtale betyr ikke skadefri bil.
- Bruker A får aldri tilgang til firma Bs agenter, prisestimater, muligheter eller varsler.
- Nøkler, API-passord og service-role credentials brukes kun på serveren.
- AI og e-post kan feile uten at annonser eller kalkyler går tapt.
- Status «aktiv» betyr at agenten er aktivert; søkefeil må vises separat.

## 8. Ferdigkriterium for pilot

Fem forhandlere kan bruke kjerneflyten. Datatilgang, lagring, visning og LLM-behandling er godkjent for den faktiske tjenesten. Ingen åpne kritiske feil. Referansekontroll av støttede avgiftsprofiler er dokumentert. Ingen varsler ved ukjent margin, ingen kjente duplikatvarsler i feil-/retrytest, og dokumentert isolasjon mellom firmaer.

Piloten kan støtte færre avgiftsprofiler enn demoen. Elbil, hybrid eller særtilfeller kan vises uten margin inntil den konkrete profilen er validert; produktet skal ikke gi falsk dekning.

## 9. Pris og måling

Prishypotese: 990 kr/mnd eks. mva., 30 dager gratis, ingen binding, inntil 10 aktive agenter, manuell faktura. Minimum tre av fem skal ved pilotavslutning akseptere konkret betalt videreføring. Vi måler kontakt med selger og vurdering av kjøp, ikke bare klikk eller hyggelige tilbakemeldinger.
