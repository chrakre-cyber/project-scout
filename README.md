# Project Scout — Project Hub v0.1

Opprettet: 03.10.2026 · Produkteier: Christian Åkre · Status: Sprint 0, dokumentgrunnlag klart.

## Målet

Gi norske bilforhandlere relevante innkjøpsmuligheter fra mobile.de, vurdert mot egne søk, norsk salgspris og ønsket margin. Innen 30 kalenderdager er målet en fungerende løsning og oppstart av pilot med fem forhandlere. Reell pilot krever godkjent datatilgang og validerte beregninger.

**Dette er en prosjekt- og spesifikasjonspakke, ikke en ferdig app.** GitHub, Supabase, Vercel, n8n og mobile.de-konto er ikke opprettet av denne leveransen. Ingen henvendelser er sendt. Ingen avgiftsmotor eller kode er implementert eller godkjent.

## Kjøre demo-appen (DEV-001)

Appskallet er en **syntetisk demo**: ingen ekte annonser, ingen mobile.de-data, ingen innlogging og ingen avgifts- eller marginberegning.

Krav: Node.js 20.9 eller nyere (testet med Node 22.22, npm 10.9).

```bash
npm ci            # ren installasjon fra package-lock.json
npm run dev       # utvikling på http://localhost:3000
npm run build && npm run start   # produksjonsbygg lokalt
npm run check     # typecheck + lint + tester + build
npm run qa:migrations   # QA-001: migrasjonskjede fra ren DB og fra DEV-002-data (lokal Supabase, destruktiv lokalt)
npm run qa:secrets      # QA-001: secret-skann av repo, historikk og build
npm run qa:demo         # QA-001: demomodus uten Supabase-konfigurasjon
```

Visninger: `/dashboard` (syntetiske annonser fra datakilden, 24 per side, filter per demo-agent), `/agents` (demo-agenter, kun lesing) og `/opportunities/<id>` (detaljside; kost/bidrag vises som «ikke beregnet»).

Annonser hentes gjennom `MarketplaceProvider` (DEV-003). I dag brukes bare den syntetiske provideren med 109 oppdiktede annonser; se `src/providers/marketplace/synthetic/fixtures/FIXTURES.md`. Kildefeil kan simuleres lokalt uten nettverk, f.eks. `SCOUT_SYNTHETIC_FAILURE=unavailable npm run start` (se `.env.example`).

Versjoner (låst i `package-lock.json`): Next.js 16.3.8, React 19.3.0, TypeScript 5.9.3, Tailwind CSS 4.3.3, ESLint 9 med eslint-config-next 16.3.8, Vitest 5.0.3.

### Supabase, innlogging og firmadata (DEV-002)

Appen bruker bare `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (i `.env.local`, se `.env.example`). Ingen secret/service-role-nøkkel brukes i appen. Uten variablene kjører appen i demomodus.

Lokalt (krever Docker):

```bash
npx supabase start          # lokal Postgres, Auth og API (lokale utviklingsnøkler)
npx supabase db reset       # migrasjoner fra tom database + syntetisk seed (to firma)
npm run test:db             # RLS-/constraint-/samtidighetstester mot lokal Supabase
```

Hostet prosjekt (gjøres av prosjekteier):

1. Kjør migrasjonene i `supabase/migrations/` (`npx supabase link` + `npx supabase db push`, eller lim inn SQL i SQL-editoren). Ikke kjør `supabase/seed.sql` mot et prosjekt med ekte data.
2. Auth: behold e-post/passord som innloggingsmetode, men slå av «Allow new users to sign up».
3. Opprett brukere i Auth-dashboardet (Add user, auto-confirm). Knytt dem til firma i SQL-editoren: `select private.admin_create_dealership('Firmanavn');` og `select private.admin_add_member('bruker@firma.no', '<firma-id>');`.

Kodeplassering: `src/domain/` (rene domenetyper og valuta, ingen UI/provider), `src/providers/marketplace/` (provider-kontrakt, feiltyper, syntetisk provider med normalisering og fixturer), `src/demo/` (syntetiske demo-agenter når man ikke er innlogget), `src/lib/supabase/` og `src/proxy.ts` (Supabase-klient og sesjonsfornying), `src/server/` (sesjon/firmakontekst og agentlagring), `supabase/` (konfigurasjon, migrasjoner, lokal seed), `src/lib/format.ts` (visning, «ikke oppgitt»), `src/components/`, `src/app/` og `tests/`.

### Søkekjøringer (DEV-005)

Fra `/agents` kan en aktiv agent kjøres manuelt («Søkekjøringer» → «Kjør søk»). Søket går mot den **syntetiske** demokilden (ingen live mobile.de-data). Hver kjøring lagres med kriteriesnapshot, status, tellere og resultater, og finnes igjen etter reload. Kontroller: `npm run test:db` (RLS/idempotens), `node tests/e2e/dev005-search-runs.e2e.mjs` (se toppen av filen), `npm run qa:migrations`.

## Start her

1. Les [START_HER.md](START_HER.md): dine tre første oppgaver og første utviklingsoppdrag.
2. Les [produktspesifikasjonen](PRODUCT_SPEC.md) og [Sprint 0](SPRINT_0.md).
3. Opprett et privat GitHub-repository, `project-scout`, og legg inn innholdet i denne mappen i repositoryets rot. `CLAUDE.md` og `AGENTS.md` skal ligge i roten.
4. Avklar mobile.de-tilgang med [utkastet](MOBILE_DE_REQUEST.md). Lagre svaret som avtaledokumentasjon; oppdater BUS-001.
5. Start oppgavene som står READY i [backloggen](MVP_BACKLOG.md). Arbeid på mock-sporet fortsetter mens API-vilkårene avklares.

## Dokumentkart

| Fil | Formål |
|---|---|
| PRODUCT_SPEC.md | Låst MVP, brukerflyt, akseptkrav og begreper |
| MVP_BACKLOG.md | Oppgaver, ansvar, estimater, avhengigheter og status |
| ROADMAP.md | 30-dagers plan og beslutningsporter |
| DECISIONS.md | Beslutninger og åpne avklaringer |
| AI_TEAM_ROLES.md | Hvem som gjør hva, og hvordan arbeid overleveres |
| SPRINT_0.md | Arbeidsliste for dag 1–3 |
| PILOT_PLAN.md | Rekruttering, to ukers pilot og målemetode |
| SWOT_AND_RISKS.md | SWOT og risikoregister med tiltak |
| ARCHITECTURE.md | Modulgrenser, datakildekontrakt og kjøring |
| DATABASE_SCHEMA.md | Logisk datamodell, tilgangskontroll og integritet |
| MOBILE_DE_INTEGRATION.md | Verifiserte API-fakta og kommersielle avklaringer |
| IMPORT_ENGINE_SPEC.md | Kost-, mva.- og marginregler; valideringsport |
| AI_ANALYSIS_SPEC.md | Strukturert annonseanalyse med kildebelegg |
| OPPORTUNITY_SCORE.md | Forklarbar score og varselkriterier |
| TEST_PLAN.md | Tester og krav før ekte pilot |
| SOURCES.md | Kilder kontrollert 03.10.2026 og deres begrensninger |
| SPRINT_1_HANDOFF.md | Oppdrag som kan gis til Claude Code/Codex |
| TASK_HANDOFF.md | Mal for nye utviklingsoppdrag |
| MOBILE_DE_REQUEST.md | Engelsk utkast til API-forespørsel |
| PILOT_INTERVIEW.md | Spørsmål til forhandlere |
| CLAUDE.md / AGENTS.md | Felles spilleregler i repositoryet |

## Hvordan vi holder oversikt

GitHub blir fasit når repositoryet er opprettet. Denne pakken er utgangspunktet. Backloggstatus skal oppdateres når arbeid faktisk er dokumentert. Ikke merk kontoer, tester eller datatilgang ferdige uten belegg.

Ved starten av en arbeidsøkt deler du siste backlogg/commit eller den konkrete leveransen her. ChatGPT kan da prioritere de neste 2–4 oppgavene. Claude Code/Codex arbeider på et tydelig oppdrag om gangen; review skjer før neste avhengige oppgave. Verktøyene synkroniserer ikke automatisk med hverandre, og denne chatten overvåker ikke prosjektet i bakgrunnen.

## Daglig rytme

- 10 minutter: status, blokkeringer og dagens oppgave.
- 30–90 minutter: din kundeavklaring, oppsett eller kontroll, etter kapasitet.
- AI-verktøy: implementerer avtalt leveranse i egen arbeidsøkt.
- 10 minutter: kontroll av resultat og oppdatering av backlogg/beslutninger.

## Rammer

Founding Dealer: foreslått 990 kr/mnd eks. mva., inntil 10 aktive agenter, 30 dager gratis, ingen binding, manuell fakturering. Dette er en prishypotese som skal testes, ikke dokumentert betalingsvilje.

Kontantmål før pilot: 10–20 000 kr. Leverandørpriser og mobile.de-vilkår er uavklarte. Ressursestimat og forutsetninger står i roadmapet. Ingen eksternt utviklingsteam er lagt inn.
