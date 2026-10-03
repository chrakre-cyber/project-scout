# SWOT og risikoregister

03.10.2026. Konseptanalyse og arbeidsantakelser, ikke en ferdig markedsundersøkelse. Hypotesene testes gjennom dealerintervjuer, API-avklaring og pilot.

## SWOT

| Område | Vurdering | Konsekvens for planen |
|---|---|---|
| Styrke | Ett godt funn kan ha høy økonomisk verdi | Selg relevant innkjøpsmulighet og tidsbesparelse |
| Styrke | Forhandleren kjenner ønsket lager og norsk salgspris | Hold valuation utenfor MVP |
| Styrke | Smal, identifiserbar B2B-gruppe | Rekrutter direkte; test med fem firmaer |
| Styrke | Tekstoppsummering har tydelig praktisk bruk | Strukturert AI-output med belegg og unknown |
| Svakhet | Avhengighet av én dataleverandør | Gate A før vesentlig kostnad; provider-grense fra start |
| Svakhet | Margin avhenger av mva., avgifter og rett input | Profilbasert motor med validering og varslingssperrer |
| Svakhet | Én founder må styre oppsett, AI og QA | Ett oppdrag om gangen; realistisk tidsbuffer |
| Svakhet | Estimater kan bli oppfattet som kjøpsråd | Forklar forutsetninger og kontrollbehov i selve opportunity |
| Mulighet | Arbeidsflyt spesifikt for norsk import | Skill oss med forståelig kost/bidrag, ikke generisk AI |
| Mulighet | Flere kilder og tjenester senere | Planlegg adapter; bygg etter betalingsbevis |
| Mulighet | Forhandlerfeedback kan forbedre treffene | Logg relevans og årsaker før ML vurderes |
| Mulighet | Historiske observasjoner kan være verdifulle | Bare dersom avtalen tillater lagring og avledet bruk |
| Trussel | Tilgang avvises eller blir for dyr | Undersøk alternativ lovlig kilde og økonomi før live |
| Trussel | Marketplace/andre kopierer funksjonene | Kvalitet, kundeinnsikt og rask læring fremfor «AI moat» |
| Trussel | Feil regelår eller manglende bilspesifikasjoner | Versionssnapshot og unsupported-profil, aldri gjetting |
| Trussel | LLM-feil og misvisende seller claims | Korte belegg, evalueringssett og originalkontroll |

## Risikoregister

Sannsynlighet og konsekvens er kvalitative arbeidsvurderinger. De revideres når vi får data; «høy» er ikke beregnet statistikk.

| ID | Risiko | Sannsynlighet / konsekvens | Tidlig signal | Tiltak | Eier | Kontrollpunkt |
|---|---|---|---|---|---|---|
| R-001 | Datatilgang eller bruksrett mangler | Middels / kritisk | Ingen klar multi-dealer-/LLM-tillatelse | BUS-001/002; ingen reell pilot før avklart | Christian | Gate A |
| R-002 | Datakostnad bryter 990-kronersøkonomien | Ukjent / høy | Høy minimumspris eller liten kvote | Pris-/volumscenario, forbruksgrenser | Christian + ChatGPT | BUS-002 og før pilot |
| R-003 | Feil mva./avgift gir feil bidrag | Middels / kritisk | Avvik mot referanser, ukjente felter | TAX-002, versionsregel og margin-sperre | Christian + kontrollør | QA-002 |
| R-004 | Annonsefelt mapper feil modell/enhet | Middels / høy | Dealer avviser treff; miles/km-avvik | Feltprovenance, hardfilter og adapter-fixturer | Utvikler | DEV-006/QA-004 |
| R-005 | Firmadata eller nøkler lekker | Lav–middels / kritisk | Svak RLS eller service-key i klient | Serverkontroll, to-firma-test og secret-rutiner | Utvikler + kontrollør | QA-001/QA-004 |
| R-006 | Doble varsler eller tapte annonser | Middels / middels–høy | Retry gir resend; checkpoint hopper | Outbox/unique, overlap, locks, unknown-send avstemming | Utvikler | QA-003 |
| R-007 | AI finner på service-/skadehistorikk | Middels / høy | Evidence finnes ikke i kilden | Schema/beleggsjekk, 30 eval-caser og unknown | ChatGPT + kontrollør | QA-003 |
| R-008 | Christian har for lite tilgjengelig tid | Middels / høy | Oppgaver venter flere dager på beslutning | 36–56 t før pilot inkl. buffer; flytt dato ved behov | Christian | Ukentlig status |
| R-009 | Fem piloter viser ikke betalingsvilje | Middels / høy | Mange klikk, ingen kjøpsvurdering | Konkrete søk og betalt videreføring; ikke flere features automatisk | Christian | Gate C |
| R-010 | API-søk er ufullstendig uten at kunden vet det | Middels / høy | Treff over paginggrense | Snevrere vinduer/filter; synlig truncation | Utvikler | DEV-006 |
| R-011 | Regler/kurs endres uten vedlikehold | Middels / høy | Regelsett utløper | Gyldighet/versjon og kontroll før nye regelperioder | Christian + ChatGPT | QA-002 og drift |
| R-012 | LLM-/hosting-/e-postforbruk løper fra oss | Middels / middels | Høyt forbruk per annonse/agent | Cache, kvoter, tak og faktisk kostmåling | Utvikler + Christian | SET-004/DEV-013 |

## Prioritert respons nå

R-001/R-002 avklares først gjennom henvendelsen. R-003 håndteres før ekte marginvarsler. R-005/R-006 inngår i grunnarkitekturen, slik at senere QA kan vise belegg. R-009 måles i reell pilot; det løses ikke med flere dokumenter.
