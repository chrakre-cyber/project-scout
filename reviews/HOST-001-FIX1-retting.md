# HOST-001-FIX1 — tre P2-funn fra review av f0759f7 rettet (til uavhengig review, 22.10.2026)

**HOST-001 forblir REVIEW.** Ingen hosted kontakt, migrasjoner, Actions, secrets, innstillingsendringer, `main`-endringer eller deploy; ingen credentials brukt. Stoppet etter leveransen. Økonomiflagg `false`; L3c utsatt; CI-002 utsatt. Reviewen er registrert: `reviews/HOST-001-review-f0759f7.md` (reviewers kontrollbegrensninger bevart: kun lokale kontroller; Bash-skript, PostgreSQL/offline DB-suite, PostgREST, Supabase, build, nettleser, Actions og dokumentkontroll med primærkilder ikke kjørt; utviklerens 2 033 tester og DB-/emuleringsbelegg ikke gjentatt; to `hosted-static`-feil i reviewers uttrukne kopi skyldtes manglende git-repo/Bash, ikke produktfeil).

## Før / etter
Uavhengig probe (`reviews/HOST-001-fix1/foer-etter-probe.mjs`; syntetiske verdier, ingen nettverk/DB) kjørt mot f0759f7 (`probe-FOER.txt`) og mot rettingen (`probe-ETTER.txt`):
| Funn | Før (f0759f7) | Etter |
|---|---|---|
| P2-1 adresse uten `sslmode` | godtatt; klient fra bare connectionString ⇒ effektiv ssl `false` (ukryptert) | **avvist**; `sslmode=require` og duplisert sslmode avvist; `verify-full` ⇒ effektiv ssl `{rejectUnauthorized:true}` |
| P2-2 belegg fra prosjekt A under prosjekt B | rapport **«BESTÅTT»** | **IKKE FULLT BESTÅTT**, beleggene forkastet («hører til et annet mål») |
| P2-3 hemmelighetsavhengige tester | to testbodies bruker hemmeligheten; bare én utelates | én trenger den (utløpt token) og er utelatt; den andre er skrevet om; alle dekket |
Nye regresjonstester kjørt mot **f0759f7-koden**: **38 feilet / 98 bestått** (de 136 hosted-testene). Etter rettingen: **136 bestått**.

## Retting
**P2-1 TLS (felles policy for alle hosted databaseklienter).**
- `scripts/hosted/target.mjs`: adressen må ha **nøyaktig én `sslmode=verify-full`**; manglende/svakere (`require`, `verify-ca`, `prefer`, `allow`, `disable`)/duplisert/kolliderende sslmode (også URL-kodede og store-/småbokstav-varianter) og **alle andre `ssl*`-parametere** (`ssl`, `sslcert`, `sslkey`, `sslrootcert`, `sslcrl`, `sslpassword`, `sslcompat`, `uselibpqcompat`) avvises. Begrunnelse: i pg 8 tolkes `require`/`verify-ca` som `verify-full` men endrer betydning i pg 9; `verify-full` er den eneste entydige.
- Ny `hostedDbConfig(env, {stage})`: validerer hele målet og returnerer **eksplisitte felt** (aldri `connectionString`, som kan overstyre) med `ssl: { rejectUnauthorized: true }`; driverens **effektive** ssl/vert/port/bruker/database kontrolleres. Valgfri `SCOUT_HOSTED_DB_CA_FILE` (offentlig CA; uleselig/ikke-sertifikat ⇒ avvist, aldri stille fall tilbake).
- Brukt av CLI (`connect`), H3-harnessen (`adminDb()` i hosted-modus; `connectIngest` er stengt i hosted-modus) og dermed opprydding. Localhost-standarden (`assertLocal`, uten `SCOUT_HOSTED_TESTS=1`) er uendret. Supabase CLI får adressen med `sslmode=verify-full`.

**P2-2 belegg bundet til mål, modus og migrasjonsgrunnlag.**
- Ny `scripts/hosted/binding.mjs`: hvert belegg får `binding` (fingeravtrykk, modus, repo-hash, tidspunkt, + kjedeledd). `report` bruker bare belegg som **verifiseres mot gjeldende mål/modus/repo-hash, er yngre enn 24 t og henger i kjeden** (inspeksjon → dry-run → anvendelse; H4: tørrkjøring → sletting → kontroll). Alt annet forkastes («ikke verifisert», aldri bestått); godtatte belegg vises med faktisk tidspunkt. **H3- og H4-belegg har nå samme binding** (H4 manglet målmetadata).
- `inspect` forkaster tidligere dry-run/anvendelse (nytt utgangspunkt); gaten krever at dry-run har samme modus og hører til **samme inspeksjon**; sletting (H4) krever en nylig (< 60 min) tørrkjøring for samme mål/modus/repo-hash.

**P2-3 hemmelighetsavhengige tester.**
- Kartlagt (statisk test parser alle `it`-blokker i de hosted-egnede filene): bare **to** brukte hemmeligheten. «Token signert med feil nøkkel» er **skrevet om** (intensjon bevart): kontrolltoken er et **faktisk utstedt** token (200), det forfalskede har samme claims, signert med tilfeldig nøkkel (401) — trenger ikke hemmeligheten og virker også med asymmetrisk signering. Testens tittel er **bevart** (den inngår i den fastlåste identitetslisten `scripts/ci/l4-l6-tests.json`, som er uendret; `scripts/ci/` har ingen endring). Grønt mot ekte PostgREST-binær (17 bestått/8 hoppet).
- «Utløpt token» krever å signere et utløpt token og **utelates** uten **både** `SUPABASE_TEST_JWT_SECRET` **og** `SCOUT_HOSTED_JWT_ALG=HS256` (hosted med asymmetrisk signering kan ikke antas å godta HS256-kontrolltokens). Filteret bygges av `SECRET_DEPENDENT_TESTS` (alle identiteter); utelatte tester gir **L4a DELVIS**, aldri bestått. En statisk test feiler hvis en ny hemmelighetsavhengig test ikke er listet (og hvis en oppføring er utdatert).

## Kontroller kjørt (ingen mot hosted)
| Kontroll | Resultat |
|---|---|
| `npx vitest run tests/hosted-*.test.ts` | **136 bestått** (før: 38 feilet på gammel kode) |
| `npx vitest run` | 92 filer / **2 080 tester bestått** |
| `bash scripts/test-hosted-offline.sh` (isolert PostgreSQL, ikke Supabase) | 20 bestått (uendret) |
| `scripts/test-rest-isolation-offline.sh` (ekte PostgREST-binær, ikke Supabase) | 17 bestått, 8 hoppet (inkl. omskrevet feil-nøkkel-test) |
| `tsc` / `eslint` / `qa-secret-scan.sh` | exit 0 / ingen funn / INGEN FUNN |

## Begrensninger
Ikke kjørt mot hosted/Supabase. **Uverifisert:** at Supabase CLI aksepterer `sslmode=verify-full` mot Supabase-sertifikatene uten egen CA (feiler lukket hvis ikke; eier kan sette `SCOUT_HOSTED_DB_CA_FILE` for våre klienter, CLI følger systemets tillit); at Node verifiserer Supabase-sertifikatene uten CA-fil; at hosted-oppsettet bruker HS256 (eier må bekrefte for å kjøre utløpt-token-testen); øvrige antakelser i `docs/econ/hosted-kjoreinstruks.md` § 7. H3 er fortsatt bare API-nivå (nettleserdeler ikke forberedt).
