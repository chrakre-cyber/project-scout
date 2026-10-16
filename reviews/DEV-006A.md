# DEV-006A — konsolidering til én kontrollert kodebaseline (16.10.2026)

**Status: REVIEW.** Kun vurdering og dokumentasjon; ingen kode endret fordi det ikke fantes godkjent arbeid utenfor baselinen å flette inn.

## Vurdering før endring
1. Branch `claude/wonderful-bardeen-yussx3`, HEAD `b7b6cdb` (TAX-001E). Remote lik lokal. `main` = `dcf08b3` (opprinnelig opplasting, 47 commits bak).
2. Arbeidstreet rent (ingen endrede/usporede filer). `.env.local` er ignorert av git.
3. Til stede i baselinen: DEV-001…004 (auth, tenancy, agenter, RLS, maks 10 aktive), QA-001-fiks av grensetriggeren, DEV-005A (søkekjøringer), DEV-005B0 (rettigheter/retention, migrasjon 20261008/20261009, `src/domain/rights.ts`, `trusted-ingest.ts`), SEARCH-001A prototype, SEARCH-002 søkemodell v2 (`src/domain/search-v2`), SEARCH-003 prototypeadapter, SEARCH-004 kandidatadapter, SEARCH-005 (nye søk med utkast, migrasjon 20261015), SYNC-001 lokale rettelser (Windows-normalisering i arkitekturtest, «Utløper senest»-tekst, QA-rapporter, `start-scout-local.cmd`), TAX-001A–E (kun dokumenter).
4. Godkjent arbeid som kun finnes utenfor baselinen: **ingen funnet i repoet eller i sandkassen**. Christians lokale mappe (`local-reference`) er ikke tilgjengelig her; sist avstemt i SYNC-001 (137 identiske, 5 avvik innarbeidet, 3 kun lokale lagt til). Endringer i den lokale mappen etter SYNC-001 kan ikke vurderes herfra.
5. Konflikter: ingen funnet (ingen duplikate implementasjoner; adaptere ligger ved siden av eksisterende kode, ingenting erstattet).
6. Filer foreslått flettet/endret: ingen kode. Endret: `reviews/DEV-006A.md`, `MVP_BACKLOG.md`.
7. DEV-005B0 rettighetshåndhevelse: **til stede** (migrasjoner, `rights.ts`, `trusted-ingest.ts`, `tests/rights.test.ts`, `tests/db/rights-retention.test.ts`). Statusen i backloggen er REVIEW, ikke DONE.
8. Ny søkemodell/adaptere: til stede og integrert i baselinen (`src/domain/search-v2`, `src/adapters/search-prototype`, `search-candidate`, `search-catalog`). SEARCH-005 kobler nytt søkeskjema inn i brukerflyten; den leveransen har status REVIEW (ikke bekreftet DONE av Codex).

## Kontroller faktisk kjørt
- `npx vitest run`: 23 filer, **547 tester bestått**.
- `npm run typecheck`: OK. `npm run lint`: OK.
- `bash scripts/test-e2e-search005.sh` (nettleser mot **emulator**, ikke Supabase): 61/61 OK.
- `bash scripts/test-db-isolated.sh tests/db/search-drafts.test.ts` (isolert PG, shim, ikke Supabase): 65/65 bestått.
- `bash scripts/test-db-isolated.sh` (alle DB-filer): 89 bestått, 12 feilet, 247 hoppet over. Feilene og de hoppede testene i `agents`, `qa-isolation`, `qa-limit`, `qa-validation`, `rights-retention`, `rls`, `search-runs` skyldes at de logger inn via Supabase Auth (GoTrue) som ikke finnes i den isolerte klyngen («Innlogging feilet … fetch failed»). Dette er en miljøbegrensning, ikke en påvist regresjon; testene er **ikke kjørt** her og må kjøres mot lokal Supabase (`npm run test:db`) før RLS/10-agenter/rettigheter kan regnes som verifisert på denne baselinen.

## Blokkere / åpent
- DB-suitene som krever GoTrue er ikke kjørt (se over).
- Lokal mappe etter SYNC-001 ikke sammenlignet. Hvis Christian har nyere godkjent lokal kode: lever mappen/ZIP-en, så kjøres ny avstemming.
- `main` er ikke oppdatert (ikke bedt om). Ingen PR opprettet.
- Genererte review-ZIP-er ligger i repoets rot (forslag fra SYNC-001 om å fjerne dem er ikke utført).
