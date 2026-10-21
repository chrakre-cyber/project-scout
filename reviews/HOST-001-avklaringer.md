# HOST-001 — avklaringer som trengs fra Christian før H1/H2 (22.10.2026)

Ingenting er aktivert eller godkjent. **Hosted-trinnene trenger ikke Docker:** Docker er bare nødvendig for lokal Supabase (`supabase start`). H2–H4 bruker bare Node, nettverk til prosjektets verter og (for H2) Supabase CLI via `npx` (CLI-ets `db push` mot en ekstern adresse starter ikke noen lokal container — dette er ikke verifisert før første kjøring).

## 1. Hvor skal kjøringen utføres? (viktigst)
| Alternativ | Krever | Vurdering |
|---|---|---|
| **A. Din maskin** | Node 22 + npm + git; skriptene er bash (`scripts/hosted/run.sh`) ⇒ på Windows trengs WSL eller Git Bash; ingen Docker; Chrome ikke nødvendig for H3 på API-nivå | passer best med «hemmeligheter forlater aldri din maskin»; du kjører, jeg leser sanerte rapporter |
| **B. Mitt skybaserte miljø** (denne økten) | du legger DB-passord/nøkkel som miljøhemmeligheter i miljøinnstillingene (aldri i chat) og åpner nettverk for prosjektets verter (`<ref>.supabase.co`, `db.<ref>.supabase.co` eller `*.pooler.supabase.com`) | lar meg kjøre trinnene etter din tillatelse per trinn; Docker er ikke nødvendig; hemmeligheter ligger i miljøet; **innstillingsendringer og hemmeligheter er dine handlinger** og krever din uttrykkelige beslutning |
| C. GitHub Actions / Codespaces | repo-secrets/innstillinger; repoet er offentlig | **frarådet** for hosted (offentlig logg; egen innstillingsendring) |
Spørsmål: **A eller B?** Hvis A: hvilket OS, og har du WSL/Git Bash og Node ≥ 22?

## 2. H1 (du oppretter prosjektet) — før du gjør det
1. **Region** (anbefalt EU/EØS) og **plan** (gratis; noter at gratisprosjekter kan pauses, og at du ikke skal velge betalte tillegg). Bekreft at **ingen kostnad** er akseptert.
2. Prosjektet skal være **helt tomt** og uten pilot-/produksjonsdata ⇒ modus **`fresh`** (ikke `upgrade`). Bekreft.
3. Hvem eier prosjektet og sletter det etter H4?

## 3. Tilkobling og nøkler (verdiene skal aldri i chat)
1. **Tilkoblingstype:** direkte tilkobling (`db.<ref>.supabase.co`) er ofte kun IPv6; fungerer nettverket ditt (eller mitt miljø) med IPv6? Hvis ikke: bruk **Session pooler** (port 5432, bruker `postgres.<ref>`). Skriptene støtter begge; jeg anbefaler session pooler. Transaction pooler (6543) frarådes for migrasjoner.
2. **DB-passord**: du genererer det selv og lagrer det i `.env.hosted.local` (A) eller som miljøhemmelighet (B). Adressen må ha `?sslmode=verify-full`.
3. **CA-sertifikat:** kan du laste ned Supabase sitt offentlige CA-sertifikat (Database → SSL i dashboardet) og legge stien i `SCOUT_HOSTED_DB_CA_FILE`? Uten den kan sertifikatkontrollen feile (fail-lukket).
4. **Publishable key:** kopieres fra dashboardet (offentlig nøkkel).
5. **JWT-hemmelighet / HS256:** nye prosjekter bruker ofte asymmetriske nøkler. Hvis du ikke vet/vil oppgi dem, utelates utløpt-token-testen og L4a blir DELVIS (akseptabelt?).
6. Påloggingsinnstillinger i prosjektet: la standardene stå (testbrukere settes inn direkte i databasen, ingen e-post sendes — CLAUDE.md pkt 9).

## 4. Omfang og tillatelser
1. **H3 nettleserdelene (L4b/L5a/L5b)** er ikke forberedt. Vil du (a) godta H3 bare på API-nivå inntil videre (samlet H3 kan da ikke bli BESTÅTT), eller (b) at jeg forbereder nettleserdelene som en egen, reviewet oppgave først? (b) forutsetter at kjøringen skjer der Chrome finnes (mitt miljø har det).
2. Bekreft at du vil **tillate hvert trinn for seg** (`h2-inspect`, `h2-dry-run`, `h2-apply`, `h3-api`, `h4-cleanup`, `h4-cleanup-execute`) og at du selv sletter prosjektet i H4.
3. Hvem **kjører** trinnene — du eller jeg (bare mulig ved alternativ B)? Og skal kjørerapportene (sanerte) gå til uavhengig review mellom H2 og H3?
4. Ønsket tidsramme (for eksempel samme dag, eller etter at du har prosjektet klart).

## 5. Det jeg ikke gjør før svar og tillatelse foreligger
Ingen forbindelse til hosted, ingen migrasjon, ingen secrets/innstillinger, ingen Actions, ingen kjøp, ingen sletting. Flagg `false`, L3c utsatt, CI-002 utsatt.
