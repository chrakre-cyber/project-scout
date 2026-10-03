# Arbeidsfordeling og overlevering

03.10.2026. Dette beskriver roller du kan gi verktøyene. Ingen separate AI-agenter eller automatiske koblinger er startet med denne pakken.

| Rolle | Best egnet | Konkret ansvar | Leverer til |
|---|---|---|---|
| Produkteier og kommersielt ansvarlig | Christian | Scope, pilotkunder, API-avtale, budsjett og kjøpsbeslutninger | ChatGPT / utvikler |
| Prosjekt- og produktstøtte | ChatGPT i denne arbeidsflaten | Spesifikasjoner, prioritering, research, beslutningslogg og oppdrag | Christian / utvikler |
| Arkitektur og domene-review | ChatGPT/Codex | Provider-kontrakt, datamodell, kostmodell, feilmodi | Hovedutvikler |
| Hovedutvikler | Claude Code, alternativt Codex | Kode, migrasjoner og oppgavenære tester i repositoryet | Kontrollør |
| Kontrollør | Codex når Claude bygger; annet separat review når Codex bygger | Testbevis, integritet, firma-isolasjon, feil i beregninger | Christian |
| UI/UX | Claude Design eller designarbeid her | Skisser for tre skjermer og forståelig kalkylevisning | Hovedutvikler |
| Automatisering | Hovedutvikler + n8n | Scheduler, retry, kvoter og varslingskø | Kontrollør |
| Forhandler- og regelforståelse | Christian + ChatGPT | Sammenholde output med kilder og reelle kjøpscaser | Produkteier |

## Én ansvarlig per oppgave

Utvikler skriver på én oppgave/branch. Kontrollør gjør først review uten å skrive om løsningen. Oppdagede feil blir konkrete endringer med begrunnelse. Velger du Codex som hovedutvikler, endres ansvarsfeltet i backloggen; det trengs ikke to utviklere som skriver samtidig.

AI-navn beskriver foreslått kapasitet, ikke dokumentert tilgjengelig konto eller garantert egnethet. Christian må starte arbeidsøkter, gi rett tilgang, ta nødvendige produktbeslutninger og kontrollere resultatet.

## Oppdraget må inneholde

Task-ID, mål, inputfiler, avhengigheter, tillatte endringer, akseptkrav, relevante tester og hva som skal rapporteres. Bruk `templates/TASK_HANDOFF.md`.

## Statusflyt

BACKLOG → READY → IN_PROGRESS → REVIEW → DONE.

BLOCKED er en sidestatus med årsak, eier og neste tiltak. READY betyr at nødvendig input er klart. DONE krever leveranse og belegg for akseptkrav. Delvis arbeid blir ikke DONE. Kontrollør kan flytte REVIEW tilbake til IN_PROGRESS med konkrete feil.

## Overleveringsrapport

1. Task-ID og commit / leveransefil.
2. Hva brukeren nå kan gjøre.
3. Endrede filer og eventuell migrasjon.
4. Kontroller som faktisk er kjørt, med resultat.
5. Kjente begrensninger, kostnader eller blokkeringer.
6. Foreslått neste oppgave.

## Din tidsbruk

AI-arbeid er sesjoner du styrer, ikke fakturerte utviklertimer. Backloggens «din tid» og «utføring» er separate: førstnevnte er Christian sin aktive innsats, sistnevnte er forventede AI-støttede arbeidsøkter. De kan ikke summeres til en garanti for kalenderdato.

Avtaler og kundekontakt håndteres av Christian. Systemet sender bare operative pilotvarsler etter at mottakere og samtykke/oppsett er avklart. Ingen andre meldinger sendes av prosjektstøtten uten et konkret oppdrag.
