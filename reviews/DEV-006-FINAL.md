# DEV-006 FINAL — samlet status for Merovo partnerdemo-sporet (16.10.2026)

**Samlet status: REVIEW** (ikke DONE). Branch `claude/wonderful-bardeen-yussx3`, HEAD ved skriving `8cb11a2`. Dette er en sammenstilling av DEV-006A–E; det er ingen ny kode i denne leveransen. Alle påstander under er hentet fra de enkelte rapportene og fra kontroller kjørt i de oppgavene.

## Delleveranser
| Oppgave | Innhold | Status | Rapport |
|---|---|---|---|
| DEV-006A | Baselinevurdering: godkjent arbeid lå allerede i branchen; ingen kode flettet | REVIEW | `DEV-006A.md` |
| SEARCH-005-review | Verifisering av nytt søk/lagrede utkast før DEV-006B (ingen kodeendring) | REVIEW | `SEARCH-005-Codex-review.md` |
| DEV-006C | Forklarte resultater: «hvorfor vist», krav-/ønskesammendrag, kildeetikett, ønskebasert visningsrekkefølge, 6 syntetiske variasjonsposter (115 annonser) | REVIEW | `DEV-006C.md` |
| DEV-006D | Merovo-skall for `/searches/**`, tagline, flytstripe, statusikoner | REVIEW | `DEV-006D.md` |
| DEV-006E | Merovo-innlogging; redirect etter innlogging og fra `/login` → `/searches` (godkjent endring); Merovo-«ikke funnet» i søkeflyten | REVIEW | `DEV-006E.md` |
(DEV-006B er ikke utført som egen oppgave i denne sekvensen; nytt søkeskjema er allerede integrert via SEARCH-005.)

## Hva som er sant om demoen nå
- Innlogging (`/login`, Merovo-stil) → `/searches` i Merovo-skall → lagrede søkeutkast → forhåndsvisning mot **syntetiske** annonser med forklaring per bil → detaljside.
- **Kun syntetiske data.** Ingen ekte leverandør, scraping, live data, AI/LLM, billing eller avgiftsberegning. Ingen total innkjøpskostnad og ingen budsjettstatus (alltid «ikke beregnet»). Ukjent er ukjent.
- Matchreglene er uendret: kjent krav-brudd utelukker; ukjent krav → «Må kontrolleres»; ønsker utelukker aldri og påvirker ikke status.
- Auth, sesjon, tenancy, RLS, 10-agent-grensen og rettighets-/retention-arkitekturen er ikke endret i DEV-006-sporet. Eneste atferdsendring: redirect-mål etter innlogging (DEV-006E).

## Kontroller faktisk kjørt (siste kjøring, DEV-006E, på HEAD før hash-commit)
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | uten feil |
| `npx vitest run` | 24 filer, 556 / 556 bestått |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| Nettleser-e2e (`scripts/test-e2e-search005.sh`, Chromium mot **testemulator** + isolert PostgreSQL 16) | 74 / 74 |
| `tests/db/search-drafts.test.ts` via `test-db-isolated.sh` (kjørt i DEV-006A, ingen DB-kode endret siden) | 65 / 65 |

## IKKE verifisert (må sies tydelig)
- **DB-/RLS-/sikkerhetssuitene mot faktisk Supabase** (`agents`, `rls`, `qa-isolation`, `qa-limit`, `qa-validation`, `search-runs`, `rights-retention`) er ikke kjørt i dette sporet: de krever Supabase Auth, som ikke finnes i sandkassen (12 feilet / 247 hoppet over ved forsøk i den isolerte klyngen, alle på innlogging). Christian har ifølge oppdragsteksten manuelt verifisert kjerneflyten i SEARCH-005 mot Supabase; jeg har ikke selv kjørt eller sett det.
- Nettleserkontrollene er mot emulator, ikke ekte Auth/PostgREST. Ikke testet i Safari/Firefox/skjermleser. Fargekontrast ikke målt med verktøy.
- Mutasjonstestene (`test-db-mutations.sh`) ble ikke kjørt i DEV-006.

## Forutsetninger før en lukket demo publiseres
1. Kjør `npm run test:db` (alle suiter) mot lokal/hosted Supabase med migrasjonen `20261015…` og rapporter resultatet.
2. **Visningsrettigheter for ekte leverandørdata er ikke bygget.** Ingen ekte leverandørdata må kobles til `/searches` før det er gjort.
3. Hosting/tilgangskontroll for partnerdemoen og invitasjon av brukere er ikke gjort (ingen deploy er utført).
4. Avklar gjenstående gammel flate (`/agents`, `/dashboard`, `/opportunities`, `/`) som fortsatt er nåbar via URL; og at en bruker uten firma får upresis melding på `/searches`.
5. Ikke publiser/ikke dele før Codex har gjennomgått DEV-006A–E.

## Åpne/ikke gjort
Aktivering av utkast til agent, sletting av utkast, resultatlagring, avgiftsmotor (TAX-grunnlaget er fortsatt REVIEW med 0 godkjente parametere og 0 klasse 1-referanser), ekte providere.

## Pakkeinnhold
`reviews/DEV-006-FINAL.md`, `DEV-006A.md`, `SEARCH-005-Codex-review.md`, `DEV-006C.md`, `DEV-006D.md`, `DEV-006E.md`, `MVP_BACKLOG.md`, og et utvalg skjermbilder (DEV-006D: 01, 06, 08, 12, 13, 15; DEV-006E: 16–19). De største skjermbildene (05, 07) er utelatt for størrelse; hele settene ligger i repoet under `reviews/DEV-006D/` og `reviews/DEV-006E/`. Ingen `.env`-filer, nøkler eller `node_modules` er med.
