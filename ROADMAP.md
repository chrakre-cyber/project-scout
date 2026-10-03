# Fremdriftsplan — fra grunnlag til pilot

Planstart: lørdag 03.10.2026. Dag 30: søndag 01.11.2026. Kalenderen er et arbeidsmål, ikke leverandørløfte. Ekstern svartid kommer i tillegg. Hvis Christian arbeider bare på hverdager eller har mindre kapasitet, flyttes milepælene fremover.

## Plan med leveranser

| Periode | Mål / leveranse | Hovedansvar | Christians aktive tid | AI-støttede arbeidsøkter | Port |
|---|---|---|---:|---:|---|
| Sprint 0: 03.–05.10 | Repo, API-forespørsel, pilotliste, oppsettsplan | Christian + ChatGPT | 3–5 t | 3–5 t | Oppdrag kan starte mot mock |
| Sprint 1: 06.–10.10 | Login, firma-isolasjon, agent CRUD og mock-provider | Hovedutvikler + Codex | 4–7 t | 12–18 t | G1: agent lagres og gjenfinnes |
| Sprint 2: 11.–17.10 | Datainnhenting, kost/bidrag, score og valideringsgrunnlag | Hovedutvikler + ChatGPT | 7–11 t | 20–30 t | G2: sporbar kalkyle, ukjent blokkeres |
| Sprint 3: 18.–24.10 | Tre skjermer, annonseanalyse, e-post og scheduler | Hovedutvikler + design + Codex | 6–9 t | 18–26 t | G3: hele flyten kjøres mot testdata |
| Sprint 4: 25.10–01.11 | Feilretting, pilotport og onboarding av fem | Christian + Codex | 8–12 t | 14–22 t | B: klar for reell pilot |
| Etter pilotstart, 14 dager | Observer bruk og test betalt videreføring | Christian + ChatGPT | 6–9 t | 3–6 t | C: betalingsbevis |

Summen før pilot er **28–44 timer aktiv founder-innsats**, pluss 8–12 timer reserve: planlegg **36–56 timer**. AI-støttede arbeidsøkter før pilot er 67–101 timer, som inkluderer implementering, review og retting; dette er ikke en leveringsgaranti. To ukers pilotoppfølging kommer i tillegg. Det tidligere anslaget på 30–45 founder-timer var stramt og inkluderte for lite buffer.

## Kritiske avhengigheter

Mock-spor: prosjektgrunnlag → app/db/agent → mock-data → kalkyle/score → analyse/varsler → QA.

Live-spor: API-avtale → fungerende credentials og rettigheter → live-adapter → representativ datakvalitet → live-QA → pilot.

Regelspor: skatteprofiler → kilder/felt → uavhengige referanseberegninger → motor → avvik lukket → marginvarsler.

Pilotstart krever at alle tre spor er klare. Gode demoresultater erstatter ikke datatilgang eller avgiftskontroll.

## Beslutningsporter

| Port | Tidspunkt | Beslutningsgrunnlag | Hvis ikke bestått |
|---|---|---|---|
| A — data og økonomi | 07.10, eller når leverandørsvar kommer | Skriftlig avklaring av tjenestebruk, kostnad, kvoter og rettigheter | Mock-arbeid fortsetter; avgrens irreversible kostnader. Vurder annen avtalt kilde; ingen uautorisert scraping |
| G1 — grunnflyt | 10.10 | Login, agent opprett/rediger/pause, 10-grense og firmatilgang kontrollert | Rett grunnflyten før integrasjoner |
| G2 — økonomimotor | 17.10 | Dokumenterte profiler, kalkylesnapshot og feilsperrer | Vis treff uten margin; blokker marginvarsel |
| G3 — ende til ende | 24.10 | Søk → kalkyle → analyse → lagring → kontrollert e-post | Stopp nye features og rett feil |
| B — pilotklar | Senest 01.11 som mål | QA-port, datavilkår, støttede profiler, driftsrutine og fem kandidater | Flytt pilotstart; oppdater ny dato og blocker |
| C — business | 14 dager etter faktisk pilotstart | Minst tre av fem aksepterer konkret 990 kr eks. mva. videreføring; øvrige pilotmål dokumentert | Intervju og rett verdiløftet før v1 |

Hvis piloten starter 01.11.2026, er første evalueringsmål 15.11.2026. Ved senere start flyttes evalueringsdatoen tilsvarende.

## Budsjettstyring

Kontantmål før pilot: 10–20 000 kr, inklusive betalt datatilgang og verktøy. Faktiske priser må undersøkes ved bestilling. Legg inn forbruksgrenser for LLM, søk, hosting og e-post. Gratisnivå er ikke et premiss for kommersiell drift.

Ved dag 5: dokumenter minimum API-kostnad og forventet månedlig drift. Ved dag 15: se faktisk forbruk per 100 annonser og per agent. Før pilot: kontroller at 990-kroners hypotesen ikke er åpenbart ulønnsom ved forventet bruk. Ukjent eller høy API-pris krever ny økonomivurdering før avtale inngås.

## Etter betalingsbevis

Prioriter ut fra faktisk bruk: datakilde nummer to, transportkvalitet, billing, VIN/historikk og team. Ingen av disse bygges før pilot som del av denne planen.
