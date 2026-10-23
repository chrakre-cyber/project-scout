# Hosted Supabase (Trinn H, H1–H4) — prioritert plan (ikke utført, 21.10.2026)

**Oppdatering 22.10.2026 (2):** forberedelsen er uavhengig reviewet (FIX1 re-review av 0d50a8d: tre P2 lukket, ingen nye blokkerende funn; `reviews/HOST-001-FIX1-re-review-0d50a8d.md`). HOST-001 forblir REVIEW; **ingen hosted kontakt eller kjøring er godkjent**.

**Oppdatering 22.10.2026:** forberedelsen (punkt 3) er gjort offline og levert til review — se `docs/econ/hosted-kjoreinstruks.md`, `docs/econ/hosted-rapportformat-eksempel.md` og `reviews/HOST-001-forberedelse.md`. Ingen hosted handling er utført.

**Status:** plan. **Ingenting er utført**, ingen hosted handling, ingen credentials etterspurt. Alle trinn krever Christians uttrykkelige tillatelse i hvert enkelt tilfelle (CLAUDE.md pkt 7, 11). Kilde: `docs/econ/forslag-supabase-kontroll.md` § 3/§ 5/§ 7. Dette er et **nytt, tomt TEST-prosjekt** — aldri produksjon, aldri pilotdata.

| Trinn | Innhold | Bestått når |
|---|---|---|
| H1 | nytt tomt hosted testprosjekt, opprettet av eier | prosjektet finnes; region/plan notert; ingen data |
| H2 | `supabase db push --dry-run`, deretter alle 13 migrasjoner. **DATA-002D-kartleggingen kjøres først mot målet; anvendelsen stoppes hvis ugyldige rader finnes** (fire migrasjoner er aldri anvendt hostet: `20261021090000`, `20261022090000`, `20261023090000`, og den skrivebeskyttede rettighetslesevegen `20261024090000` fra DATA-002D-2) | dry-run og anvendelse uten feil; versjoner notert |
| H3 | L4–L7 mot hosted URL med testbrukere (samme kontroller som lokalt) | som lokalt, med hosted-spesifikke funn rapportert |
| H4 | rapport med versjoner og rydding (slett testprosjektet/data) | rapport + bekreftet rydding |

## Prioritert rekkefølge
1. **Beslutninger (deg):** (a) godkjenn at H skal gjøres og når; (b) hvem eier prosjektet/kostnad (gratisnivå eller betalt — CLAUDE.md pkt 11: ingen kjøp som bieffekt); (c) region (personvern/EØS); (d) om hosted-kjøring skal gjøres lokalt fra din maskin eller via Actions (secrets i repoet er en egen innstillingsendring).
2. **H1 (deg):** opprett det tomme testprosjektet. Jeg kan ikke og skal ikke opprette det.
3. **Forberedelse (jeg, uten hosted tilgang):** skript og rapportformat for H2–H4 som leser URL/nøkler fra miljøvariabler/CLI (aldri i chat, git, logg eller rapport); dry-run-prosedyre; DATA-002D-sjekkliste; rydde-prosedyre; offline-tester; reviewpakke. Kan gjøres nå uten tillatelse til selve hosted-trinnet.
4. **Tilgang (deg):** gi tilgang på en måte som holder nøkler utenfor chat — f.eks. kjøre kommandoene selv lokalt etter mitt skript, eller lagre nøkler som GitHub-secrets (krever din innstillingsendring og egen avgjørelse; offentlig repo!). Jeg ber aldri om nøkler i chat.
5. **H2 (krever egen tillatelse):** dry-run først; anvendelse først etter at DATA-002D-kartleggingen er rapportert og godkjent av deg.
6. **H3 (krever egen tillatelse):** L4–L7 mot hosted; ny uavhengig review av resultatet.
7. **H4 (krever egen tillatelse):** rapport og sletting av testprosjektet/data.

## Hvem gjør hva
| Du | Jeg | Egen tillatelse kreves |
|---|---|---|
| beslutninger i punkt 1; opprette prosjektet (H1); eventuelt kjøre kommandoer lokalt eller sette secrets; godkjenne anvendelse etter DATA-002D | skript, prosedyrer, rapportformat, offline-tester, reviewpakke (punkt 3); lese/rapportere resultater uten å logge nøkler; skille hosted-funn fra lokale | enhver hosted migrasjon/anvendelse (H2), enhver kjøring mot hosted URL (H3), sletting/rydding (H4), secrets/innstillinger i GitHub, kjøp/betalt plan |
