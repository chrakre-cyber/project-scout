# Start her — Project Scout

Dato: 03.10.2026. Dette er den første arbeidsøkten, ikke en liste over ting som allerede er utført.

## Dine tre første oppgaver

| Rekkefølge | Gjør dette | Tid | Ferdig når |
|---|---|---:|---|
| 1 | Opprett privat GitHub-repository `project-scout`. Pakk ut zip-filen og last opp innholdet i `project-scout/` til roten. | 20–40 min | Alle dokumentene vises på hovedgrenen; ingen hemmeligheter er lastet opp |
| 2 | Tilpass og send API-forespørselen i `MOBILE_DE_REQUEST.md` via mobile.de sin offisielle kontaktvei. | 30–60 min | Forespørsel er sendt, dato og svarfrist står på BUS-001 |
| 3 | Skriv ned fem aktuelle pilotforhandlere og tre biltyper du tror de vil søke etter. | 30–45 min | Fem kandidater og neste kontaktsteg er notert på BUS-003 |

API-forespørselen skal forklare at dette er en betalt tjeneste for flere norske forhandlere. Vi trenger avklaring av lagring, visning, varsler og LLM-behandling, ikke bare brukernavn og passord.

## Det du gir utviklingsverktøyet først

Åpne repositoryet i Claude Code eller Codex. Gi denne instruksen:

> Les README.md, CLAUDE.md/AGENTS.md, PRODUCT_SPEC.md, ARCHITECTURE.md og SPRINT_1_HANDOFF.md. Start med DEV-001. Bruk mock-data og ingen betalte integrasjoner. Beskriv kort løsningen og implementer innenfor oppdraget. Rapporter endrede filer, hvordan appen startes, utførte kontroller og kjente begrensninger. Ikke endre produktomfang eller avgiftsregler.

Etter DEV-001 følger DEV-002, DEV-003 og DEV-004, med kontroll ved hvert steg. Eksterne kontoer eller secrets som verktøyet mangler, logges som blokkeringer. Demoen skal fortsatt kunne kjøres uten mobile.de.

## Oppsett — først når det trengs

- GitHub nå: kode, dokumenter og beslutninger.
- Supabase før DEV-002: Christian oppretter prosjekt og deler kun nødvendige konfigurasjonsverdier i egnet secret-funksjon.
- Vercel når DEV-001 kan bygges lokalt: opprett privat/styrt testmiljø og kontroller tilgang før pilotdata legges inn.
- n8n før DEV-013: det er ikke nødvendig for første demo.
- LLM- og e-postkonto før DEV-011/DEV-012; legg inn forbruksgrenser.

Velg EU/EØS-region der tjenesten tilbyr det og avklar databehandlerforhold før ekte kundedata. Faktiske tilgjengelige regioner og kommersielle vilkår kontrolleres ved opprettelse.

## Første ferdigkriterium

Christian kan åpne en tydelig merket demo, se syntetiske bilkort og navigere til en bil. Med Supabase på plass kan han logge inn, opprette en agent og finne den igjen. Ingen ekte markedstilgang eller avgiftsvalidering antydes i demoen.

Når du kommer tilbake hit, del repository-lenken eller seneste filer og skriv for eksempel: «BUS-001 sendt, DEV-001 ferdig; prioriter neste oppgave.» Da kan vi fortsette fra faktisk status.
