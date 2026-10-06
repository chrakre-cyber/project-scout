# MVP-backlogg — masterliste

Oppdatert 03.10.2026. DONE på PM-oppgavene betyr at dokumentene finnes i denne leveransen. Ingen konto eller kode er ferdigstilt. Eier er foreslått utfører, ikke en automatisk tilkoblet agent.

Status: BACKLOG / READY / IN_PROGRESS / REVIEW / DONE / BLOCKED. Prioritet: P0 nødvendig for kjerneflyt/pilot; P1 nyttig; P2 sekundært. «Din tid» er aktiv Christian-tid; «utføring» er AI-støttet arbeidsøkt og inkluderer ikke leverandørens svartid. Estimater er arbeidsanslag.

## Oppgaver med ferdigkriterier

| ID | Mål / leveranse og Definition of Done | Best egnet | Status | Pri. | Din tid | Utføring | Avhengigheter |
|---|---|---|---|---|---:|---:|---|
| PM-001 | README + låst PRODUCT_SPEC; brukerflyt og eksklusjoner definert | ChatGPT | DONE | P0 | 15–30 min lesing | Levert | – |
| PM-002 | Backlogg + roadmap; eiere, estimater og porter finnes | ChatGPT | DONE | P0 | 15–30 min lesing | Levert | PM-001 |
| PM-003 | Beslutningslogg, roller og Sprint 0; første handlinger tydelige | ChatGPT | DONE | P0 | 15–30 min lesing | Levert | PM-001 |
| PM-004 | Arkitektur, datamodell og innledende dev-/testspecs; grenser og usikkerhet definert | ChatGPT | DONE | P0 | 30–45 min lesing | Levert | PM-001 |
| SET-001 | Privat repo med pakken i rot, tilgjengelig for utviklingsverktøy | Christian | READY | P0 | 20–40 min | 15–30 min støtte | PM-001 |
| SET-002 | Supabase opprettet; secrets håndteres separat og tilgang avklart | Christian + utvikler | DONE | P0 | 30–45 min | 30–60 min | PM-004 |
| SET-003 | Vercel testdeploy virker fra repo; env og testtilgang kontrollert | Christian + utvikler | BACKLOG | P0 | 20–30 min | 30–60 min | SET-001, DEV-001 |
| SET-004 | n8n, LLM og e-postkonto klargjort med forbruksgrenser før integrasjon | Christian + utvikler | BACKLOG | P0 | 45–75 min | 1–2 t | SET-001 |
| BUS-001 | API-forespørsel sendt; multi-dealer, LLM, bilder, caching, varsler, pris og kvoter etterspurt | Christian | READY | P0 | 30–60 min | Utkast levert | PM-001 |
| BUS-002 | Skriftlige vilkår, pris, rettigheter og brukbare credentials vurdert; Gate A dokumentert | Christian + ChatGPT | BACKLOG | P0 | 45–90 min | 1–2 t | BUS-001; ekstern svartid |
| BUS-003 | Fem pilotkandidater med kontakt og tre ønskede biler hver | Christian | READY | P0 | 45–60 min | 15–30 min støtte | PM-001 |
| BUS-004 | Fem intervjuer; faktisk innkjøpsproblem, prisgrunnlag og pilotdato notert | Christian | BACKLOG | P0 | 3–5 t | 1 t oppsummering | BUS-003 |
| BUS-005 | Pilotvilkår, ansvarlig selskap, databehandling og mottakere avklart | Christian + ChatGPT | BACKLOG | P0 | 1–2 t | 2–3 t | BUS-002, BUS-004 |
| TAX-001 | Første import-/salgsprofil og nødvendige felt valgt; unsupported cases og kilder definert | ChatGPT + Christian | READY | P0 | 30–60 min | 2–3 t | PM-004 |
| TAX-002 | Uavhengige referansecaser for mva., avgifter og salg; input/dato/fasit dokumentert | Christian + ChatGPT | BACKLOG | P0 | 3–5 t | 4–6 t | TAX-001, BUS-004 |
| UX-001 | Skisser for tre skjermer; demo, mva., bidrag og kontrollbehov forståelige | Claude Design / ChatGPT | READY | P1 | 30–45 min | 2–4 t | PM-001 |
| DEV-001 | Next.js-appskall, tydelig mock-demo og lokal startinstruks | Hovedutvikler | DONE | P0 | 15–30 min | 2–4 t | SET-001, PM-004 |
| DEV-002 | Migrasjoner, Auth, membership og RLS; firma A kan ikke lese/skrive Bs data | Hovedutvikler | DONE | P0 | 20–40 min | 4–6 t | DEV-001, SET-002 |
| DEV-003 | MarketplaceProvider + syntetisk mock; normalisering og feiltyper kontrollert | Hovedutvikler | DONE | P0 | 15–30 min | 3–4 t | DEV-001 |
| DEV-004 | Agent CRUD/pause, inputkontroll og atomisk maks 10 aktive per firma | Hovedutvikler | DONE | P0 | 30–45 min | 4–6 t | DEV-002, DEV-003 |
| QA-001 | Gate G1 bestått; isolasjon og agentgrense dokumentert, feil lukket | Codex / kontrollør | REVIEW | P0 | 30–60 min | 2–3 t | DEV-004 |
| QA-001-FIX | Rett QA-001-funn F1 (sidekanal i grensetrigger, ny migrasjon), F2 (vakt mot REPEATABLE READ) og F3 (500 på spørringsparametre); kandidatrettinger for F1 og F3 er validert lokalt | Hovedutvikler | REVIEW | P1 | 10–15 min (kjøre migrasjon på hostet) | 1–2 t | QA-001 |
| DEV-005 | Ingestion, stable kilde-ID, revisjoner, pagination og run-logg; samme annonse gir ikke duplikat | Hovedutvikler | REVIEW | P0 | 20–40 min | 4–6 t | DEV-003, DEV-004 |
| DEV-006 | MobileDeProvider virker mot avtalt API; mapping, kvoter og rettighetsvalg kontrollert | Hovedutvikler | BLOCKED | P0 | 30–60 min | 4–6 t | BUS-002, DEV-005 |
| DEV-007 | Kost-/mva.-motor med versjoner, manglende-data-sperrer og linjesporing | Hovedutvikler | BACKLOG | P0 | 45–90 min | 6–10 t | TAX-001, TAX-002, DEV-003 |
| DEV-008 | Bidragsmotor skiller salgs-mva., kost og likviditet; negative/ukjente resultater håndteres | Hovedutvikler | BACKLOG | P0 | 30–60 min | 3–5 t | DEV-007 |
| DEV-009 | Transport/kurs har kilde, dato og prisgrunnlag; manual override spores | Hovedutvikler + Christian | BACKLOG | P0 | 45–60 min | 2–3 t | TAX-001, DEV-007 |
| DEV-010 | Score er forklarbar; hardfilter brytes aldri og ukjent margin varsles ikke | Hovedutvikler | BACKLOG | P0 | 20–30 min | 2–3 t | DEV-005, DEV-008, DEV-009 |
| DEV-011 | Annonseanalyse med schema og korte belegg; ukjent og motstrid håndteres | Hovedutvikler + ChatGPT | BACKLOG | P0 | 30–60 min | 3–5 t | DEV-005, SET-004 |
| DEV-012 | E-post outbox, unik varselnøkkel, retry og status; replay gir ikke kjent dobbeltutsending | Hovedutvikler | BACKLOG | P0 | 20–40 min | 3–5 t | DEV-010, DEV-011, SET-004 |
| DEV-013 | n8n scheduler kaller serverlogikk; locks, quota, timeout og run-logg virker | Hovedutvikler | BACKLOG | P0 | 30–45 min | 3–5 t | DEV-005, DEV-012, SET-004 |
| DEV-014 | Dashboard/agents/opportunity koblet til data; kilde, tidspunkt og ukjent vises korrekt | Hovedutvikler | BACKLOG | P0 | 45–75 min | 5–7 t | UX-001, DEV-004, DEV-010, DEV-011 |
| DEV-015 | Valgfri fritekst-til-filtre; bruker bekrefter før aktivering | Hovedutvikler + ChatGPT | BACKLOG | P2 | 20–40 min | 3–5 t | QA-004; krever ledig buffer |
| QA-002 | Avgifts-/marginreferanser bestått for alle profiler vi vil vise med margin | Christian + kontrollør | BACKLOG | P0 | 2–4 t | 4–6 t | DEV-008, DEV-009, TAX-002 |
| QA-003 | Annonseanalyse-evaluering og feil-/retrytest av innhenting og varsler bestått | Codex / kontrollør | BACKLOG | P0 | 45–75 min | 3–5 t | DEV-011, DEV-012, DEV-013 |
| QA-004 | Live ende-til-ende, sikkerhet, gjenoppretting og Gate B dokumentert | Codex + Christian | BACKLOG | P0 | 1–2 t | 4–6 t | DEV-006, DEV-014, QA-001, QA-002, QA-003, BUS-005, SET-003 |
| PIL-001 | Fem onboardet; minst 20 aktive agenter totalt og startdato logget | Christian | BACKLOG | P0 | 2–3 t | 1 t støtte | QA-004, BUS-004 |
| PIL-002 | 14 faktiske dager; relevans, kontakt, aktivitet og betalingsaksept dokumentert | Christian + ChatGPT | BACKLOG | P0 | 6–9 t | 3–6 t | PIL-001 |

## Nåværende blokkering

DEV-006: ingen skriftlig avtale/credentials. Christian eier BUS-001/BUS-002. Neste tiltak er forespørselen; mock-utvikling kan fortsette. TAX-002 kan bruke manuelt dokumenterte reelle caser før live-integrasjon; syntetiske eksempler erstatter ikke uavhengig fasit.

## Hvordan du oppdaterer en rad

Skriv dato, ny status, commit/fil og testbelegg i seksjonen under. Juster estimate når faktisk arbeid tilsier det. DONE krever hele akseptkravet, REVIEW betyr at leveransen venter kontroll. Senere oppgaver flyttes til READY først når avhengighetene er oppfylt.

## Hendelseslogg

- 03.10.2026: PM-001–PM-004 dokumentleveranser opprettet. Resten er uutført. DEV-006 blokkert av datatilgang.
- 03.10.2026: DEV-001 → REVIEW (branch `claude/wonderful-bardeen-yussx3`). Next.js-appskall med tre visninger, demo-banner og åtte syntetiske bilkort. Kontroller kjørt: `npm ci` fra ren tilstand, `npm run check` (typecheck, lint, 13 Vitest-tester, build), `next start` med HTTP-røyktest av alle ruter (200/307/404 som forventet) og Playwright-klikkflyt desktop/mobil uten konsollfeil. Venter separat review før DONE. Observasjon: repoet finnes (SET-001 i praksis utført), men dokumentene ligger flatt i roten, mens README/CLAUDE.md lenker til `docs/`, `planning/`, `prompts/` og `templates/`.
- 04.10.2026: DEV-001 reviewrettinger (R2, R3, R4, R8 rettet; R1 valuta videreført til DEV-003). Typecheck, lint, 16/16 tester, build og `next dev`-kontroll bestått. Detaljer: `reviews/DEV-001-leveranserapport.md`. Status fortsatt REVIEW til rettingene er kontrollert.
- 05.10.2026: DEV-001 → DONE. Godkjenning oppgitt av Christian i oppdraget for DEV-003; review-belegg i `reviews/DEV-001-leveranserapport.md` (commit `0425db0`).
- 05.10.2026: DEV-003 → REVIEW. Syntetisk MarketplaceProvider med normalisering, 109 annonser, paginering/truncation, revisjoner, duplikat, feiltyper; DEV-001 R1 (valuta) og R6 (mva.-felt, `lastSeenAt`) løst. Typecheck, lint, 45 tester (4 filer), build, HTTP-røyktest og Playwright-klikkflyt bestått. Detaljer: `reviews/DEV-003-leveranserapport.md`. Venter uavhengig review før DONE.
- 05.10.2026: DEV-003 → DONE og SET-002 → DONE, oppgitt av Christian i oppdraget for DEV-002.
- 05.10.2026: DEV-002 → REVIEW. Migrasjon for firma, medlemskap og agenter med RLS, kolonnerettigheter, triggere og atomisk maks 10 aktive; Supabase Auth (e-post/passord, åpen registrering av); R5 løst (DEC-020). Kontrollert mot lokal Supabase: migrasjon fra tom DB, 18 DB-/RLS-tester, 11 nettleserkontroller og 55 enhetstester. Ikke kontrollert mot hostet prosjekt (variablene finnes ikke i utviklingsmiljøet). Detaljer: `reviews/DEV-002-leveranserapport.md`.
- 06.10.2026: DEV-002 → DONE, inkl. hosted smoke test, oppgitt av Christian i oppdraget for DEV-004.
- 06.10.2026: DEV-004 → REVIEW. Opprett/rediger/valider/aktiver/pause/reaktiver agenter; validering i server og database (CHECK), aktiveringskrav (DEC-024), R7 lukket (DEC-023), 10 representative agentoppsett. Kontrollert mot lokal Supabase: 95 enhetstester, 60 DB-tester, 23 + 11 nettleserkontroller, migrasjon fra tom DB og fra DEV-002-data. Ikke kjørt mot hostet prosjekt. Kontroller til QA-001 ligger i `tests/db/` og `tests/e2e/`. Detaljer: `reviews/DEV-004-leveranserapport.md`.
- 06.10.2026: DEV-004 → DONE, oppgitt av Christian i oppdraget for QA-001, inkl. hosted smoke test (redigering, validering, aktivering, pause, reaktivering og persistens etter reload). Hosted smoke test — externally verified by product owner; ikke kjørt av Claude.
- 06.10.2026: QA-001 → REVIEW. **Gate G1: PASS** (ingen åpne P0/P1). Åpne: F1–F3 (P2) og F4–F6 (P3). Utført mot lokal Supabase av samme verktøy som skrev DEV-001–004, derfor REVIEW til produkteier har godkjent gaten og vurdert F1 (P2 etter min vurdering; P1 ved streng lesing av rubrikken, da blir gaten FAIL til rettelsen er migrert). Kontroller kjørt: typecheck, lint, 105 enhetstester, 195 DB-tester + 2 forventede feil, 17 migrasjonskontroller (ren oppbygging, oppgradering fra DEV-002-data, atomisk feil, schema-likhet), 53 e2e-kontroller i nettleser (+7 kjente), 21 secret-kontroller, 23 demomodus-kontroller, 19 testmutasjoner og 2 kanarigrupper som alle ga røde tester, bortsett fra A2 (all app-side firmafiltrering fjernet) som med hensikt forble grønn og beviser at RLS er autoritativ. QA-001-FIX foreslått. DEV-005 kan starte etter godkjenning. Detaljer: `reviews/QA-001-gate-G1.md`.
- 06.10.2026: QA-001-FIX → REVIEW. F1 (P1, omklassifisert av Christian), F2 og F3 rettet: ny migrasjon `20261006100000_qa001_fix_active_limit_trigger.sql` (tenantsjekk før grensen, avvisning under REPEATABLE READ, DEC-025) og `lookupMessage` i `/agents`. F1/F2-vaktene er ordinære regresjonstester (ikke lenger `it.fails`). Fra ren database: 119 enhetstester, 202 DB/RLS-tester, e2e 11 + 23 + 26, migrasjonskontroller inkl. oppgradering fra DEV-004-schema, secret-skann, build. 5 målrettede mutasjoner ga røde tester. **Gate G1: PASS**, ingen åpne P0/P1/P2; F4–F6 (P3) åpne. Ikke kjørt mot hostet prosjekt: migrasjonen må kjøres der. Detaljer: `reviews/QA-001-gate-G1.md` (seksjon «QA-001-FIX — oppfølging»).
- 07.10.2026: DEV-005 → REVIEW (ikke DONE). Manuell, deterministisk søkekjøring for aktiv agent mot den syntetiske provideren, med lagret kjøring, kriteriesnapshot og resultater (per-firma snapshot, DEC-026; matching i domenet, DEC-027). **Avvik fra backlogg-teksten:** delt ingestion med revisjoner og delte annonsetabeller er utsatt (krever skriving uten tenant og avklart lagringsrett). Detaljer: `reviews/DEV-005-leveranserapport.md`.

## Dagens anbefalte rekkefølge

SET-001 → BUS-001 → BUS-003 → start DEV-001. SET-002 og TAX-001 forberedes deretter. Full Sprint 0 finnes i `SPRINT_0.md`.
