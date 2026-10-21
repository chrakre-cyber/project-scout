# CI-001 — første manuelle Actions-kjøring (21.10.2026)

**Kjøring:** https://github.com/chrakre-cyber/project-scout/actions/runs/39578387230 (run #1, `workflow_dispatch`, startet av Christians tillatelse). **Kjørt commit:** `7ff3bbdef470fcb23d9eb6c148f9bf30da189523` på `claude/wonderful-bardeen-yussx3` (kode identisk med den reviewede `215bc2c`; avviker bare i fire dokumentasjonsfiler). **Workflowfil på `main`:** `a778c97` (PR [#4](https://github.com/chrakre-cyber/project-scout/pull/4), kun `.github/workflows/supabase-local.yml`, blob `83fa4fd2…`, SHA-256 `3d3d2a17…c7767a93` = reviewet fil). Tid: 09:37:22–09:41:45 UTC (ca. 4 min; estimatet 20–35 min var for høyt).

**Utfall: jobb `success`, rapportert «Samlet: PASS»** (utviklerens avlesning av den offentlige loggen — ikke en uavhengig reviewers vurdering). CI-001 forblir REVIEW.

| Kontroll | Resultat i kjøringen |
|---|---|
| Verktøy | Ubuntu 24.04 (image 20261012.334.1), Node v22.23.3, Docker 28.0.4, psql 16.15, supabase CLI 2.119.0 |
| **L1** lokal Supabase fra tom database | BESTÅTT — 12 migrasjoner anvendt og registrert i rekkefølge; PostgreSQL 17.11; images `ghcr.io/supabase/{gotrue:v2.197.0, kong:2.8.1, postgres:17.11.0.002, postgrest:v16.4}` (altså hentet fra ghcr.io, ikke ECR) |
| **L2** oppgraderingstester (`qa:migrations`, ekte CLI) | BESTÅTT — 50 PASS, 0 FAIL |
| **L3a** DB-suiten mot Supabase-stakken (ekte Auth/PostgREST) | HOPPET OVER (ikke bestått) — 517 tester: 511 bestått, 0 feilet, **6 hoppet over** (nøyaktig de seks navngitte oppgraderingstestene) |
| **L3b** de seks i separat PostgreSQL-klynge (**IKKE Supabase**, PostgreSQL 16.15 + shim) | BESTÅTT — 6 av 6 kjørt og bestått |
| **L3 samlet** | BESTÅTT etter regelen (L3a uten feil/uventede hopp + hver av de seks bestått i L3b) |
| **L7** hemmelighetsskann inkl. build-artefakter | BESTÅTT — 21 PASS, 0 FAIL, 0 SKIP (build registrert og vellykket) |
| Åpne | L4, L5, L6, Playwright og hosted Supabase (Trinn H): ÅPNE, ikke kjørt |

## Hva dette er og ikke er
- **Er:** første ekte belegg for L1, L2, L3a og L7 mot lokal Supabase (containere på en GitHub-runner), og for at L3b (PostgreSQL 16 uten Supabase) kjører de seks navngitte testene. Runnerens PostgreSQL-binærer fantes (ingen installasjon). Loggen inneholdt bare den sanerte rapporten; ingen nøkkel-liknende innhold ble observert i den hentede loggen (siste 400 linjer = hele loggen).
- **Er ikke:** hosted Supabase, L4–L6 (innlogging via appen, lagring i nettleser, firmaskille med ekte JWT-er), Playwright, pilotklarhet eller regel-/parametergodkjenning. De seks testene er fortsatt **ikke** kjørt mot Supabase-stakken (L3a hoppet dem); de er kjørt i en annen PostgreSQL-versjon (16.15 mot stakkens 17.11).
- Én kjøring er ikke gjentakbarhet: stabilitet over flere kjøringer er ikke vist.

## Bieffekter (rapportert)
Vercel-integrasjonen på repoet laget en preview-deployment for PR #4 og kan ha trigget en automatisk produksjons-redeploy ved merge til `main` (uendret appkode). Ikke styrt eller sett herfra.

## Forslag (ikke gjort)
1. Uavhengig review av selve kjøringen og denne rapporten (reviewer kan lese den offentlige loggen).
2. Neste avgrensede steg: L4–L6 + Playwright mot den lokale stakken (egen leveranse/godkjenning); L3c (forsøk på de seks mot stakkens Postgres 17) er fortsatt utsatt og kan nå vurderes siden kjøringen viser at det fungerer å kjøre i stakken.
3. Vurder å la Vercel ignorere `.github/`-endringer; oppdater kjøretidsestimatet i dokumentasjonen til ca. 4–5 min (én måling).
