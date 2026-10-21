# CI-001 — avslutning: DONE innen avgrenset omfang (21.10.2026)

**Christians aksept:** CI-001 er DONE innen avgrenset omfang — **lokal Supabase på GitHub-runner, L1–L7 etter avtalt L3a/L3b-modell**. Dette er ikke hosted-kontroll, ikke pilotklarhet, ikke gjentakbarhetsgaranti og ikke regel-/parametergodkjenning. L3c er fortsatt utsatt; økonomiflaggene er `false`; E7 utsatt; E8 åpent.

**Grunnlag:** kjøring 39629190050 (<https://github.com/chrakre-cyber/project-scout/actions/runs/39629190050>), full commit `c2dd683136181100e010e889412f46fc76151112`, samlet PASS; sluttgjennomgang `reviews/CI-001-sluttgjennomgang-run39629190050.md`; rapport `reviews/CI-001-kjoring-5.md`; avstemming `reviews/CI-001-avstemming.md`; reviewgrunnlag `reviews/CI-001-forste-samlede-pass/`.

## Registrerte kontrollbegrensninger (fra sluttgjennomgangen)
- Reviewer bekreftet via GitHub at riktig commit ble kjørt og at jobb og orkestreringssteg endte i success, og sammenholdt 350 filer (src/, scripts/, tests/, supabase/, .github/, sentrale rotfiler) byte-for-byte med reviewpakken ca15928. Tidsdifferansene stemmer.
- **Originalloggen er ikke uavhengig bekreftet** (jobblogg-API-et svarte HTTP 403 uten innlogging; ingen credentials er brukt eller etterspurt). Tellingene er lest fra det leverte sammendraget, ikke rekonstruert fra Vitest-JSON eller rålogger.
- Reviewer har ikke kjørt tester, build, database, nettleser, Actions, Bash eller hosted kontroll i denne dokumentrunden; tidligere implementeringsreviewer gjelder med sine egne begrensninger.
- Manifestet for reviewgrunnlaget har tre oppføringer (README, jobbsammendrag, metadata); rapport og avstemming er ikke med. **Kontroll av arkivert README mot manifestet (`sha256sum -c`): README.md OK, jobbsammendrag.md OK, kjoringsmetadata.json OK.** (README manglet blant vedleggene reviewer mottok.)

## Presiseringer
1. **Observatørproxyen brukes bare i econ006/L5a.** L4b (l4-browser) og L5b (econ006d) går ikke gjennom den og er selvstendige nettleserbelegg mot ekte lokal Supabase. At L5a består støtter at den testede flyten fungerte gjennom proxyen; det beviser ikke at alle tre gikk gjennom den.
2. **CORS:** ingen separat måling. Bare at de testede flytene fungerte — ikke at CORS-adferd generelt er verifisert.
3. **Logginnsyn:** ingen funn i et sanert sammendrag beviser ikke at hele originalloggen er uten sensitive data. Reviewet lekkasjevern, L7-utfall og faktisk logginnsyn holdes adskilt. Påstanden om «seks offentlige kjøringer uten funn» i tidligere tekst er utviklerens avlesning og er ikke uavhengig kontrollert.
4. **L3:** L3a alene er HOPPET (6 kjente hopp); L3 samlet er PASS etter den avtalte L3a/L3b-modellen (L3b = separat PostgreSQL-klynge, ikke Supabase).
5. **Én vellykket kjøring** av den utvidede pakken (ca. 11,5 min observert); ingen stabilitetsgaranti.

## Restpunkter (egne oppgaver; ingen krever ny kjøring for å dokumentere dagens resultat)
| # | Restpunkt | Status |
|---|---|---|
| R1 | `partialInReal` for J3 i `scripts/ci/e2e-plan.json`: **beholdt som inaktiv metadata** (J3 OK ⇒ ingen effekt på PASS). Opprydding er valgfri og krever review | åpent, lav prioritet |
| R2 | **Main-integrasjon: CI-002** (egen oppgave, ikke startet) — se avhengigheter under | BACKLOG |
| R3 | Frivillig stabilitetskjøring av den utvidede pakken | valgfritt |
| R4 | **Hosted H1–H4: HOST-001** — plan i `docs/econ/hosted-plan-h1-h4.md` (ikke utført) | BACKLOG, krever eiers tillatelse |
| R5 | L3c (seks oppgraderingstester mot stakkens Postgres) | utsatt |

## Kartlagte avhengigheter for main-integrasjon (CI-002)
`main` har bare den gamle workflowfilen (PR #4, `a778c97`). Arbeidsgrenen avviker fra `main` med **567 filer** (+151 634/−405, hvorav ca. 158 filer under `docs/tax` og et stort antall `reviews/`). Workflow og skript kan **ikke** flyttes alene: den fungerende helheten krever
- `.github/workflows/supabase-local.yml` (grenens versjon: `timeout-minutes: 180`, nettleserløp);
- `scripts/ci-supabase-local.sh`, `scripts/ci/*` (evaluator, sanitizer, planer, login-budget, L3b-skript), `scripts/test-db*.sh`, `scripts/test-e2e-real-supabase.sh`, `scripts/qa-*.sh`, `scripts/test-*-offline.sh`;
- `tests/db/*` (L3a/L4a/L6 + harness), `tests/e2e/*` (inkl. `support/request-observer.mjs`, `backend.mjs`, `preflight.mjs`, `browser.mjs`), `tests/ci/*`, `tests/fixtures/*`, `tests/ci-*.test.ts`;
- `src/` (appen kjøres uendret av e2e-løpene; domene, server, providers, komponenter), `supabase/migrations` (12 filer) og `config.toml`;
- `package.json` og `package-lock.json` (inkl. `playwright-core` 1.56.1, `pg`, vitest/ESLint/TypeScript-oppsett), `vitest*.config.ts`, `next.config`, `tsconfig`;
- dokumentasjon/review som beslutningsgrunnlag.
Åpne spørsmål for CI-002: PR av hele grenen vs. delt strategi; hvilke `docs/tax`-/`reviews`-filer som skal med; om samme workflow skal kunne kjøres fra `main` uten at grenen finnes; behov for rotkonfig (fil-/branch-beskyttelse er GitHub-innstillinger og krever egen tillatelse). Ingenting av dette er gjort.

## Ingen endringer i denne runden
Ingen kodeendring, ingen ny Actions-kjøring, ingen endring på `main`, innstillinger, hosted miljø eller deploy.
