# Forslag: kontroll mot ekte Supabase (ikke utført — venter beslutning)

**Status:** forslag 20.10.2026. Ingen kontroll er kjørt, ingen kode er endret, ingen hosted handling. Hittil er alt kjørt mot en **emulator** (Auth/PostgREST) og en **isolert PostgreSQL**; ingenting av det er bekreftelse av Supabase-integrasjon, og det skal ikke omtales slik.

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
