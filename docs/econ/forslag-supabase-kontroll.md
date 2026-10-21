# Forslag: kontroll mot ekte Supabase (ikke utført — venter beslutning)

**Status 21.10.2026 (sluttoppdatering):** Trinn L er kjørt som CI-001 (lokal Supabase i GitHub-runner; DONE innen avgrenset omfang, kjøring 39629190050) — `reviews/CI-001-avslutning.md`. **Trinn H (H1–H4) er fortsatt åpent** (ikke utført): plan i `docs/econ/hosted-plan-h1-h4.md`.

**Status:** forslag 20.10.2026, utvidet 21.10.2026 med kartlegging (§ 7). Ingen kontroll er kjørt, ingen kode er endret, ingen hosted handling. Hittil er alt kjørt mot en **emulator** (Auth/PostgREST) og en **isolert PostgreSQL**; ingenting av det er bekreftelse av Supabase-integrasjon, og det skal ikke omtales slik.

## 1. Hva som ikke er verifisert i dag
Supabase Auth (GoTrue: innlogging, JWT-oppsett, refresh, utløp, cookies via `@supabase/ssr`); PostgRESTs faktiske semantikk og feilkoder slik lagringskoden antar dem (`mapError`: 23503/23514/42501, 23505→update, `maybeSingle`, `PGRST116`, filter/`limit`/`order`); migrasjonene anvendt i Supabase-miljø (fra tom og som oppgradering; tre migrasjoner er aldri anvendt hostet: `20261021090000`, `20261022090000`, `20261023090000`); RLS med ekte `anon`/`authenticated`-roller via PostgREST; de Supabase-avhengige DB-filene (`rls`, `agents`, `search-runs`, `qa-isolation`, `qa-validation`, `rights-retention`, `qa-limit`) — i den isolerte klyngen: 12 feil / 247 hoppet over.

## 2. Forutsetninger og blokkere
- **Docker + Supabase CLI (2.119.0 i repoet)** for lokal Supabase — finnes ikke i utviklingsmiljøet brukt hittil. Må kjøres på eiers maskin eller i et miljø med Docker. Konkret blokker.
- Brukere: `[auth] enable_signup = false` i `config.toml`. Testbrukere opprettes derfor via direkte innsetting i lokal `auth.users` som `postgres` (som `tests/e2e/econ006.e2e.mjs` allerede gjør mot den isolerte klyngen) — **ingen service-role-nøkkel er nødvendig**, og ingen nøkkel skrives i git, logger eller rapporter (CLAUDE.md pkt 7).
- Hosted trinn krever et **nytt, tomt testprosjekt** opprettet av eier (CLAUDE.md pkt 11: ingen betalte tjenester startes som bieffekt). Aldri produksjon, aldri pilotdata.

## 3. Trinn
### Trinn L — lokal Supabase (nødvendig før pilot)
| # | Kontroll | Bestått når |
|---|---|---|
| L1 | `npx supabase start`; `npx supabase db reset` anvender alle migrasjoner fra tom | ingen feil; versjoner (CLI, Postgres, GoTrue, PostgREST) noteres |
| L2 | `npm run qa:migrations` (`scripts/qa-upgrade-check.sh`, **destruktiv for lokal DB**) | alle oppgraderingsløp og atomisk feilscenario OK |
| L3 | `bash scripts/test-db.sh` (hele DB-suiten) | 0 feil og 0 hoppet over av årsaken «Auth/PostgREST mangler» (sammenlign med isolert baseline: 12/247) |
| L4 | Innlogging via ekte GoTrue: riktig/feil passord, bruker uten firma, utløpt/ugyldig JWT, refresh, utlogging; sesjonscookies i appen (`@supabase/ssr`) | samme oppførsel som i 005/006c-forløpene |
| L5 | Lagring/gjenåpning via ekte PostgREST: `search_drafts` (konflikt `base_version`), `dealer_economics_inputs` (insert → 23505 → update), `dealer_economics_profiles`, `listInputs`, `maybeSingle` | alle 88 nettleserkontroller (eller en dokumentert avgrenset delmengde) består uten emulator; feilkoder tilsvarer `mapError` |
| L6 | Firmaskille med ekte JWT-er: bruker B mot A sine rader direkte i PostgREST (GET/PATCH/DELETE/POST med falsk `dealership_id`), `anon`, bruker uten firma | 0 rader / 401 / 403 / avvist; ingenting lekker |
| L7 | Hemmeligheter: `qa:secrets`; ingen service-role i klientbunt, logger eller rapport | ingen funn |

### Trinn H — hosted TEST-prosjekt (nødvendig før pilot; krever eiers uttrykkelige godkjenning)
H1 nytt tomt prosjekt opprettet av eier · H2 `supabase db push --dry-run`, deretter anvendelse av alle migrasjoner (inkl. de tre ikke-anvendte); **DATA-002D-kartleggingen kjøres først mot målet, og anvendelsen stoppes hvis ugyldige rader finnes** · H3 gjenta L4–L7 mot hosted URL med testbrukere · H4 rapport med versjoner og rydding (slett testprosjektet/data). Pilotdata og produksjon er utenfor dette forslaget.

## 4. Gjennomføring og bevis
- **Forslag til liten implementering (egen oppgave, ikke gjort):** `e2e`-skriptet får en modus som hopper over emulator og isolert klynge og leser URL/publishable key/DB-URL fra `supabase status` (som `test-db.sh`), pluss `scripts/test-e2e-econ006-supabase.sh`. Resten av forløpene er uendret.
- **Bevis:** kommandoutskrifter og versjoner i rapport; resultatfil lik `reviews/ECON-006c/e2e-resultat.txt`; mutasjonskjøring som for 006c.
- **Uavhengighet:** reviewer kjører L1–L3 selv eller er vitne; utviklerens og reviewers kjøringer holdes adskilt (som i øvrige avslutningsrapporter).
- **Hva som kan påstås etterpå:** «bekreftet mot lokal Supabase <versjon>» (Trinn L) og «bekreftet mot hosted testprosjekt <dato>» (Trinn H) — ikke mer. Pilotklarhet er en separat beslutning (økonomiregler er fortsatt ugodkjente, flagg `false`).

## 5. Nødvendig vs valgfritt
**Nødvendig før pilot:** L1–L7 og H1–H4. **Valgfritt:** ytelsesmåling (paring/økonomi per annonse i store lister), flere nettlesere/ekte mobil/skjermleser, CI-oppsett med Supabase, belastningstest, automatisk gjentakelse ved hver migrasjon.

## 6. Beslutninger jeg trenger fra Christian
**S1** hvor kjøres Trinn L (din maskin / et miljø med Docker jeg får tilgang til)? · **S2** godkjenner du et tomt hosted testprosjekt for Trinn H (opprettet av deg), og når? · **S3** skal «avgrenset delmengde» være tillatt for L5 hvis noe forløp ikke lar seg kjøre uten emulator, så lenge det rapporteres? Estimat (utførelsestid, når miljø finnes): ≈ 1 dag for L inkl. liten e2e-tilpasning, ≈ 0,5 dag for H, pluss review.

## 7. Kartlegging 21.10.2026: verktøy, hvor testene kan kjøres, og hva Christian må gjøre
*Ingen credentials sendes i chat eller legges i repoet. Ingenting under er utført mot Supabase; § 7.2 beskriver bare det som ble undersøkt i utviklingsmiljøet.*

### 7.1 Nødvendige verktøy
| Verktøy | Behov | Status |
|---|---|---|
| Docker Engine (daemon) | kjører lokal Supabase-stakk (Postgres, GoTrue, PostgREST, Kong m.fl.; ca. 2–3 GB images, ≥ 4 CPU / 8 GB RAM anbefalt) | Se § 7.2 |
| Supabase CLI 2.119.0 | `supabase start / db reset / status / db push`; ligger i `devDependencies` (`npx supabase`) | tilgjengelig (npx) |
| Node 22, npm | app, vitest, Playwright | tilgjengelig |
| Playwright + Chromium | nettleserflyt (`scripts/test-e2e-econ006*.sh`) | tilgjengelig i utviklingsmiljøet |
| `psql` / PostgreSQL-klient | DB-kontroller, SQL-oppretting av testbrukere | tilgjengelig |
| Tilgang til containerregister (`public.ecr.aws`, evt. `ghcr.io`) | CLI-en henter Supabase-images derfra | **blokkert i utviklingsmiljøet** (§ 7.2) |
Trinn H (hosted testprosjekt) trenger i tillegg: Supabase-konto/organisasjon (eier), nytt tomt prosjekt, nettverkstilgang til `*.supabase.co` og Management API (`api.supabase.com`).

### 7.2 Undersøkelse i utviklingsmiljøet (21.10.2026, kun lesende/oppstartsforsøk)
- `docker` (klient 29.6.2) er installert, men **daemonen kjører ikke**. Et forsøk på å starte `dockerd` manuelt (root, `vfs`-lagring, egen socket) **lyktes**; containere kan startes.
- **Docker Hub** fungerer (`alpine` ble lastet ned og kjørt). **`public.ecr.aws`: manifest nås, men bildelagene gir `403 Forbidden`** gjennom miljøets proxy; `ghcr.io` er ikke verifisert for Supabase-bilder (bare en gjettet bildenavn ble prøvd). Siden Supabase CLI henter sine images fra `public.ecr.aws/supabase/*`, **kan lokal Supabase ikke startes i dette miljøet** uten at proxyen åpnes for registeret (eller et godkjent speil).
- `api.supabase.com` er **ikke nåbar** fra miljøet (forbindelse mislykkes) → **Trinn H kan ikke kjøres herfra**.
- Konklusjon: Trinn L og H må kjøres et annet sted (§ 7.3). Alt som ble startet under undersøkelsen er stoppet og ryddet.

### 7.3 Hvor testene kan kjøres
| Alt. | Sted | Fordeler | Krav / forbehold |
|---|---|---|---|
| **O1 (anbefalt for Trinn L)** | **Christians maskin** med Docker Desktop | Enklest; ingen tredjepart; nøkler forblir lokale | Christian kjører kommandoene (`npx supabase start`, `db reset`, `npm run qa:migrations`, `bash scripts/test-db.sh`, e2e) og deler **bare tekstutskriften**. Jeg leverer et ferdig skript som skjuler nøkler i utskriften (egen oppgave) |
| O2 | GitHub Actions (repoets eget CI) | Kjørbar uten Christians maskin; reviewer kan se/kjøre samme workflow; Docker og registertilgang finnes på runnerne; ingen hemmeligheter trengs for Trinn L (lokal stakk genererer egne nøkler) | Krever at jeg legger til `.github/workflows/…yml` (ny implementering, egen godkjenning), at Actions er slått på, og at Christian bekrefter minutt-forbruk/plan (CLAUDE.md pkt 11: ingen betalte tjenester som bieffekt). Loggene må vurderes for innhold hvis repoet er offentlig. Jeg kan starte/lese kjøringer via de eksisterende GitHub-verktøyene |
| O3 | Dette utviklingsmiljøet | – | **Ikke mulig** uten at proxyen åpnes for `public.ecr.aws` (§ 7.2) |
| **H** (Trinn H) | Christians maskin eller GitHub Actions, mot nytt hosted **testprosjekt** | Eneste måte å verifisere faktisk hosted Auth/PostgREST og migrasjonsanvendelse | Se § 7.4; ikke fra dette miljøet |

### 7.4 Konkrete handlinger for Christian (ingen hemmeligheter i chat eller repo)
**Beslutninger (svar i chat uten hemmeligheter):** (1) velg sted for Trinn L: O1 (din maskin) eller O2 (GitHub Actions) · (2) hvis O2: bekreft at jeg får legge til workflowen, at Actions-minutter er akseptable, og om repoet er offentlig/privat · (3) velg om/ når Trinn H skal gjøres · (4) bekreft at en dokumentert delmengde av nettleserforløpene er akseptabel for L5 hvis noe ikke lar seg kjøre uten emulator.
**Hvis O1:** (a) installer Docker Desktop og start den; (b) `git pull` grenen `claude/wonderful-bardeen-yussx3`, `npm ci`; (c) kjør kommandoene fra § 3 Trinn L (jeg gir eksakt liste og et skript som maskerer nøkler); (d) send meg **kun** tekstutskriften (kopier fra terminalen; skriptet skriver ikke ut nøkler). Lokale nøkler fra `supabase status` skal ikke limes inn i chat eller committes — `.env*` er allerede ignorert av git.
**Hvis Trinn H:** (a) opprett selv et **nytt, tomt** Supabase-prosjekt (egen konto, region EU, kun testbruk; velg ikke betalte tillegg; noter at gratisplanen har begrensninger) og ikke koble det til noe annet; (b) generer database-passord selv og oppbevar det i din passordbehandler; (c) lag et personlig tilgangstoken (`SUPABASE_ACCESS_TOKEN`) og la det ligge **bare** som miljøvariabel på din maskin eller som **kryptert GitHub Actions-secret** (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, prosjekt-ref) — aldri i chat, repo, issue eller logg; (d) bekreft i Dashboard at åpen registrering er avslått og e-postbekreftelse er som i `config.toml` (eller si fra om avvik); (e) godkjenn uttrykkelig at migrasjonene, inkludert de tre som aldri er anvendt hostet, kjøres mot dette testprosjektet (jeg kjører først `--dry-run` og DATA-002D-kartleggingen, og stopper ved ugyldige rader); (f) etter kjøringen: slett testprosjektet og tilbakekall tokenet.
**Jeg gjør (etter godkjenning, egen runde):** liten e2e-/skripttilpasning for å kjøre uten emulator, evt. workflow, kjøring, rapport med versjoner og adskilt reviewerbevis.

