# DEV-002 — leveranserapport

Dato: 05.10.2026 · Branch: `claude/wonderful-bardeen-yussx3` · Status: REVIEW (ikke DONE)

## Leveranse

- **Database:** firma, medlemskap og søkeagenter med RLS, kolonnevise rettigheter, triggere og atomisk grense på 10 aktive agenter per firma.
- **Innlogging:** Supabase Auth med e-post/passord. Firmakontekst hentes fra medlemskapet. En innlogget bruker kan opprette agent i eget firma og finne den igjen etter reload.
- **R5:** penger er tekst ved databasegrensen og høyst 2^53-1. Visning skjer uten flyttall.
- **Uendret:** demo (syntetisk provider, valuta-fallback, normalisering) virker som før, også uten Supabase-konfigurasjon.

## Motstrid i dokumentene

SPRINT_1_HANDOFF sier «SQL-migrasjoner fra logisk modell», mens oppdraget sier at senere schema ikke skal lages. Løsning (DEC-022): bare `dealerships`, `dealership_members` og `search_agents` migreres nå. Aktiv-grensen tas med fordi DATABASE_SCHEMA krever at DEV-002 kontrollerer den under samtidighet. Agenter lagres som ikke aktive fra UI; aktivering og pause er DEV-004.

## Databaseobjekter (`supabase/migrations/20261005090000_dev002_tenancy_and_agents.sql`)

| Objekt | Innhold |
|---|---|
| `public.dealerships` | id, name (1–200), settings (objekt), created_at |
| `public.dealership_members` | user_id (PK, FK `auth.users`, cascade), dealership_id (FK, restrict), created_at — én membership per bruker |
| `public.search_agents` | id, dealership_id (FK), name (1–120), filters/assumptions (objekt + pengeformat-CHECK), active, version ≥ 1, last_success_at, created_at, updated_at; `unique (id, dealership_id)` |
| Triggere | `search_agents_before_write`: versjon/tidsstempler, forbud mot firmabytte. `search_agents_active_limit`: maks 10 aktive (radlås på firma, SECURITY DEFINER) |
| `private.*` | `my_dealership_ids()` (RLS-hjelper), `is_money_json` / `agent_money_valid` (CHECK), `admin_create_dealership`, `admin_add_member` (bare databaseeier). Ikke eksponert i API |
| `supabase/seed.sql` | To syntetiske firma, kun lokal bruk, ingen brukere |

## Auth og firmakontekst

- Supabase-klienten lages bare på serveren (`@supabase/ssr`, cookies) med URL og publishable key. Det finnes ingen nettleserklient for data.
- `src/proxy.ts` fornyer sesjonen. `getSessionContext()` validerer brukeren med `auth.getUser()` og henter firma via `dealership_members` under RLS.
- `/login`: e-post/passord via server action, med felles feilmelding. «Logg ut» står i headeren.
- Åpen registrering er av (lokalt i `config.toml`; for hostet prosjekt i dashboardet). Brukere og medlemskap opprettes av prosjekteier.
- Opprettelse av agent: firma-ID tas fra konteksten. Skjemafelt som `dealership_id`, `active` og `version` ignoreres.

## RLS og rettigheter

| Tabell | anon | authenticated |
|---|---|---|
| dealerships | ingen | SELECT eget firma |
| dealership_members | ingen | SELECT egen rad. Ingen skriving |
| search_agents | ingen | SELECT/INSERT/UPDATE bare i eget firma (`USING` + `WITH CHECK`). INSERT bare (dealership_id, name, filters, assumptions, active); UPDATE bare (name, filters, assumptions, active); ingen DELETE |

Supabase gir som standard `anon`/`authenticated` alle rettigheter på nye tabeller; migrasjonen trekker disse tilbake og gir minimale rettigheter eksplisitt.

## R5 — bigint/JSON og TypeScript (DEC-020)

- **Format:** penger i JSONB/PostgREST er `{"amountMinor": "<heltall som tekst>", "currency": "XXX"}`. CHECK i databasen avviser JSON-tall, desimaler, 0, ekstra felt og verdier over 9 007 199 254 740 991.
- **Konvertering:** `moneyFromDb`/`moneyToDb` (`src/domain/currency.ts`) feiler med `MoneyBoundaryError` i stedet for å runde stille. Domenet bruker `number` bare innenfor trygt heltall.
- **Visning:** `minorToDecimalString` gir eksakt desimalstreng, som Intl formaterer uten flyttallsdivisjon.

## Endrede filer

- **Nye:**
  - Supabase: `supabase/{config.toml,.gitignore,seed.sql}`, migrasjonen
  - App: `src/lib/supabase/{config,server}.ts`, `src/proxy.ts`, `src/server/{session,agents,agent-records}.ts`, `src/app/login/{page,actions}.tsx|ts`, `src/components/AuthStatus.tsx`
  - Tester og skript: `tests/{money-boundary,agent-records}.test.ts`, `tests/db/{harness.ts,rls.test.ts,README.md}`, `tests/e2e/dev002-auth.e2e.mjs`, `scripts/test-db.sh`, `vitest.db.config.ts`
  - `reviews/DEV-002-leveranserapport.md`
- **Endret:**
  - App: `src/app/agents/page.tsx` (lagrede agenter når innlogget, demo ellers), `src/app/layout.tsx`, `src/components/DemoBanner.tsx` (tekst), `src/domain/currency.ts`, `src/lib/format.ts`
  - Oppsett: `package.json` / `package-lock.json` (@supabase/supabase-js 2.117.2, @supabase/ssr 0.12.7, server-only; dev: supabase CLI 2.119.0, pg 8), `vitest.config.ts`
  - Docs: `.env.example`, `README.md`, `DATABASE_SCHEMA.md`, `ARCHITECTURE.md`, `DECISIONS.md` (DEC-020–022), `MVP_BACKLOG.md`, `reviews/DEV-001-leveranserapport.md`

## Kontroller som faktisk er kjørt

Alle mot **lokal** Supabase (CLI 2.119.0 i Docker: Postgres 17, Auth, PostgREST) med lokale utviklingsnøkler.

| Kontroll | Resultat |
|---|---|
| `npm run typecheck`, `npm run lint` | OK |
| `npm test` (enhet) | 55/55 (6 filer), inkl. R5-grense og agent-mapping |
| `npm run build` | OK, både med og uten Supabase-variabler |
| `npx supabase db reset` (migrasjon fra tom database + seed) | OK, kjørt flere ganger |
| Rettigheter i katalogen | anon: ingen. authenticated: som i tabellen over. Admin-funksjoner: bare postgres |
| `npm run test:db` | 18/18 bestått (se RLS-resultater under). Stabilt to ganger rett etter reset |
| Mutasjonskontroll | Insert-policy uten firmasjekk → 3 tester røde. Aktiv-grense uten lås → 2 tester røde (samtidige kall ga flere enn 10 aktive). Gjenopprettet med `db reset`, deretter 18/18 |
| Nettleser e2e (`tests/e2e/dev002-auth.e2e.mjs`, Chromium) | 11/11 OK på endelig bygg, 0 sidefeil |
| Klientbundle (`.next/static`) | 0 treff for lokal secret key, service-role-nøkkel, JWT-secret, `sb_secret_` og `service_role`. Ingen servermoduler i klienten |
| Diff-skann før commit | Ingen nøkler, JWT-er eller passord |

### RLS-isolasjon (resultat)

| Påstand | Resultat |
|---|---|
| A leser bare firma A og eget medlemskap; B tilsvarende | Bestått |
| A finner ikke Bs agent, heller ikke med eksplisitt ID | Bestått |
| A og B kan ikke opprette agent for hverandre med manipulert firma-ID (42501, ingen rad skrevet) | Bestått |
| A kan ikke endre Bs agent (0 rader, B uendret) | Bestått |
| Firma-ID, versjon og last_success_at kan ikke settes; DELETE avvist | Bestått |
| Medlemskap/firma kan ikke opprettes, endres eller slettes fra klienten | Bestått |
| Admin-funksjoner avvist for ordinær bruker | Bestått |
| Bruker uten firma ser ingenting og kan ikke opprette | Bestått |
| Anonym klient: 42501 på alle tabeller. Åpen registrering avvist | Bestått |
| A oppretter agent og finner den igjen i ny sesjon | Bestått |
| Versjon øker ved endring; firmabytte avvist også for databaseeier; navn/JSON/én membership håndheves | Bestått |
| R5: JSON-tall, 2^53, desimal og ekstra felt avvist; 2^53-1 lagret og lest eksakt | Bestått |
| 11. aktive avvist (insert og update); pause frigjør plass; annet firma upåvirket | Bestått |
| 20 samtidige aktiveringer via API → nøyaktig 10 | Bestått |
| To transaksjoner om siste plass: den andre venter på låsen og avvises etter commit | Bestått |
| Nettleser: injisert `dealership_id=B`, `active=true`, `version=99` i skjemaet → agent i A, ikke aktiv, v1 | Bestått |
| Nettleser: etter utlogging og innlogging som B vises ikke As agent | Bestått |

## Kjente begrensninger og blockers

- **Ikke kontrollert mot hostet Supabase-prosjekt.** `NEXT_PUBLIC_SUPABASE_*` finnes ikke i utviklingsmiljøet. Christian må kjøre migrasjonen og stille inn Auth (se README). Deretter bør `npm run test:db` kjøres mot en lokal kopi, og innlogging prøves mot hostet prosjekt.
- **Ikke testet:** gjenoppretting fra backup (del av pilotporten, QA-004).
- **Auth-oppsett:** åpen registrering må slås av manuelt i dashboardet for hostet prosjekt; `config.toml` gjelder bare lokalt.
- **Agentlagring:** UI-et lagrer bare navn og merke/modell som ikke aktiv. Filtre, forutsetninger, redigering, aktivering og pause er DEV-004. Demo-agentene vises fortsatt når man ikke er innlogget.
- **Ingen generert DB-typedefinisjon:** rader valideres i kode (`agent-records.ts`).
- **Advarsler:** `npm audit` melder fortsatt kjente funn i dev-verktøy (R9). Supabase CLI forsøker å sende telemetri (blokkert av nettverksreglene her).

## Neste oppgave

Uavhengig review av DEV-002. Deretter skal migrasjonen kjøres mot hostet prosjekt, og innlogging kontrolleres der (Christian). Så DEV-004 (agent CRUD/pause, full validering).
