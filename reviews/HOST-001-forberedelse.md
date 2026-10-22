# HOST-001 — forberedelse av hosted-kontrollene H2–H4 (til uavhengig review, 22.10.2026)

**Dette er bare forberedelse.** Ingenting er kjørt mot hosted. Ikke opprettet prosjekt, ikke kontaktet hosted tjeneste, ikke anvendt migrasjon, ikke startet Actions, ikke lagt inn secrets, ikke endret innstillinger/`main`, ikke betalt, ikke slettet noe. Ingen credentials er etterspurt, brukt eller skrevet noe sted. CI-002 er utsatt. Økonomiflagg `false`, E7 utsatt, E8 åpent, L3c utsatt. **Stoppet for uavhengig review.**

## 1. Kartlegging av gjenbruk (kort; full tabell i `docs/econ/hosted-kjoreinstruks.md` § 1)
Gjenbrukt: migrasjonene, DATA-002D-kartleggingen (kjøres nå skrivebeskyttet FØR anvendelse), `tests/db/auth-gotrue.test.ts` (L4a) og `rest-isolation.test.ts` (L6), testharnessen (`createUser`, `createFirmWithMember`, `signIn`, `cleanup`), `evaluateGroup` og `sanitize.mjs`, `qa-secret-scan.sh`, `test-db-isolated.sh` (kun offline-testing), `supabase db push [--dry-run]`. **Ikke gjenbrukbart:** `db reset`, `qa-upgrade-check.sh`, `test-db.sh`, hele L3a-suiten, L3b (destruktive/lokale). **Ikke forberedt:** nettleserløpene L4b/L5a/L5b (lokal preflight, lokal DB, observatør bare for loopback-`http`) — **H3 kan derfor ikke bli samlet BESTÅTT i denne omgangen** og rapporten viser dem som IKKE KJØRT.

## 2. Levert
| Fil | Innhold |
|---|---|
| `scripts/hosted/target.mjs` | ren validering av ETT hosted testprosjekt: ref (20 tegn), `TESTPROSJEKT:<ref>`-bekreftelse, uttrykkelig modus (`fresh`/`upgrade`), **trinnet må tillates uttrykkelig** (`SCOUT_HOSTED_STAGE`), API = nøyaktig `https://<ref>.supabase.co`, DB = direkte (`db.<ref>…`, bruker `postgres`) eller pooler (bruker `postgres.<ref>`), TLS kreves, avviser overstyringsparametere (`host/hostaddr/port/dbname/database/service/options/user/password`) og kontrollerer driverens effektive vert; localhost/IP/http avvises. Feil nevner bare kategori; bare fingeravtrykk (sha256, 8 tegn) og maskert ref vises |
| `scripts/hosted/migrations.mjs` | repoets migrasjonsliste + hash; klassifisering `empty`/`prefix`/`current`/`diverged` (hull/ukjente ⇒ diverged) |
| `scripts/hosted/inspect.mjs` | **skrivebeskyttet** inspeksjon (`begin read only`, bare SELECT, rollback): historikk, tabeller, tall, brukere (`@example.test` = testbruker), DATA-002D-kartlegging. Skiller **tomt prosjekt** (`fresh`) fra **oppgradering** (`upgrade`) og stopper ved avvik, ikke-testbrukere, ukjent utgangspunkt eller DATA-002D ≠ OK/ikke relevant. Rapporten har bare tall, versjoner og flagg |
| `scripts/hosted/gate.mjs` | port for dry-run/anvendelse: inspeksjon < 60 min, samme prosjekt/modus/repo-hash, DATA-002D OK, noe å anvende; anvendelse krever i tillegg vellykket nylig dry-run og, ved `upgrade`, `SCOUT_HOSTED_BACKUP=bekreftet` |
| `scripts/hosted/report.mjs` | rapportformat H2/H3/H4; PASS bare når alle påkrevde punkter er PASS; hoppet/delvis/ikke kjørt/ukjent ⇒ aldri bestått; «ikke relevant» kun for DATA-002D i `fresh`; teksten saneres og avvises ved lekkasje. Eksempler (syntetiske): `docs/econ/hosted-rapportformat-eksempel.md` |
| `scripts/hosted/cleanup.mjs` | H4-opprydding: tørrkjøring (bare tall) og sletting av bare testdata (`@example.test`-brukere + firma der ALLE medlemmer er slike) i én transaksjon som rulles tilbake ved feil/rest; blandede firma, ikke-testbrukere og foreldreløse firma røres ikke; skjema røres aldri |
| `scripts/hosted/cli.mjs`, `run.sh` | kommandoene `check-target`, `inspect`, `dry-run`, `apply`, `h3-api`, `cleanup [--execute]`, `report`. Alt som berører nettverk krever gyldig mål + uttrykkelig trinn (+ gate for dry-run/apply); sletting krever dessuten `SLETT:<fingeravtrykk>` FØR forbindelse åpnes; underprosess-utskrift fanges og saneres; dry-run må liste nøyaktig de ventende migrasjonene; `apply` kontrolleres etterpå mot repoet; ingen `--force`/`reset`/`link`/`login` |
| `tests/db/harness.ts` (+ de to testfilene) | ny `assertTarget()`: **uten `SCOUT_HOSTED_TESTS=1` er den identisk med `assertLocal()`** (som er uendret); med flagget kreves gyldig hosted-mål og trinn `h3-api`. Bare `auth-gotrue` og `rest-isolation` bruker den; alle andre DB-tester bruker fortsatt `assertLocal()` |
| `vitest.config.ts`, `.gitignore` | `tests/hosted-db/**` ekskludert fra standardkjøringen (krever isolert klynge); `.hosted/` og `.env.hosted.local` ignorert |
| `docs/econ/hosted-kjoreinstruks.md` | kartlegging, tomt vs. oppgradering, oppsett (variabelnavn, ikke verdier), trinn med tillatelser, rapportformat, begrensninger |
| `scripts/test-hosted-offline.sh`, `vitest.hosted-offline.config.ts`, `tests/hosted-db/*` | DB-tester av inspeksjon og opprydding mot isolert PostgreSQL |

## 3. Kontroller faktisk kjørt (ingen mot hosted)
| Kontroll | Resultat |
|---|---|
| `npx vitest run` (standard) | 92 filer / **2 033 tester bestått** (inkl. 89 nye hosted-tester utenfor DB) |
| `bash scripts/test-hosted-offline.sh` (isolert PostgreSQL, ikke Supabase) | **20 bestått**: tomt vs. oppgradering (prefiks, current, hull, ukjent versjon, uten historikk, ikke-testbrukere), DATA-002D (OK; INVALID for display/matching/begge ⇒ migrasjonen **stopper faktisk** med `data002d_invalid_existing_rows`, radene uendret; UNKNOWN; NOT_APPLICABLE; ALREADY_APPLIED), inspeksjon skrivebeskyttet (bare `begin read only`/`select`/`rollback`, databasen uendret, skriving i samme transaksjon avvises med 25006), opprydding (tørrkjøring skrivebeskyttet, bare testdata slettet, tilbakerulling ved feil, idempotent) |
| `tsc --noEmit` / `eslint` | exit 0 / ingen funn |
| `qa-secret-scan.sh` | INGEN FUNN (syntetiske test-URL-er settes sammen ved kjøring) |
| `scripts/test-rest-isolation-offline.sh` (ekte PostgREST-binær mot isolert PG, ikke Supabase) | 17 bestått, 8 hoppet — L4a/L6 uendret med `assertTarget()` |
| Uten miljø: `bash scripts/hosted/run.sh inspect` | exit 2 «hosted-mål avvist», ingen forbindelse |
| Uendret (git diff mot forrige commit): `src/`, `supabase/`, `.github/`, `scripts/ci/`, `tests/e2e/`, `scripts/ci-supabase-local.sh` | ingen forskjell |

Testenes hovedpunkter: **målvalidering** (43: gyldig direkte/pooler, ~35 avviste varianter inkl. annet prosjekt/localhost/overstyringsparametere/ukryptert, feilmeldinger uten ref/adresser/passord); **gate** (alle avvisningsgrunner, anvendelse uten dry-run, `upgrade` uten bekreftet sikkerhetskopi); **CLI med falsk DB/prosess** (ingen forbindelse/prosess uten gyldig mål + riktig trinn for alle seks nettverkskommandoer; sletting krever bekreftelse før forbindelse; dry-run/apply-kommandoer, sanering, apply ikke uten dry-run; H3 bare to testfiler, `-t`-utelatelse uten JWT-hemmelighet ⇒ L4a DELVIS); **rapport** (hoppet/delvis/ikke kjørt aldri bestått; DATA-002D skilt mellom fresh/upgrade; ingen ref/passord/URL); **statisk** (localhost-sperrene uendret og fortsatt standard, `assertTarget` bare i to filer, ingen `set -x`/`console`, `--dry-run` bare for dry-run, ingen `--force`/`reset`/`link`/`login`).

## 4. Begrensninger
- **Ikke kjørt mot hosted eller Supabase i det hele tatt.** DB-tester er mot isolert PostgreSQL (ikke Supabase); CLI er prøvd med falske avhengigheter.
- **Uverifiserte antakelser hos Supabase:** at `postgres`-rollen kan sette inn i `auth.users` og bruke `extensions.crypt` som testharnessen; Supabase CLI-ets dry-run-utskriftsformat (listen leses som `<14 sifre>_*.sql`; avvik gir FEIL, aldri bestått); pooler-oppførsel; innloggingsgrenser ved mange testinnlogginger; at `qa-secret-scan.sh` oppfører seg likt uten lokal stakk; at et nytt prosjekt ikke har tabeller i `public`/`private` (ellers STOPP som «ukjent utgangspunkt»).
- **H3 er bare API-nivå** (L4a/L6/L7); L4b/L5a/L5b ikke forberedt ⇒ samlet H3 aldri BESTÅTT ennå. Utløpt-token-testen krever hosted JWT-hemmelighet; uten den utelates den ⇒ L4a DELVIS.
- CLI-et får databaseadressen som argument (`--db-url`) — kjøres bare fra eierens maskin; utskrift fanges og saneres.
- Eiers sletting av selve prosjektet kan ikke måles; rapporten viser IKKE KJØRT til eier bekrefter.
- Rapportene som lagres lokalt i `.hosted/` inneholder fingeravtrykk og tall; de er git-ignorert og skal ikke sjekkes inn rå.

## 5. Tillatelser som kreves senere (ingenting av dette er gjort)
Opprette testprosjekt (H1, eier); lagre verdier i `.env.hosted.local` (eier); hvert av trinnene `h2-inspect`, `h2-dry-run`, `h2-apply`, `h3-api`, `h4-cleanup`, `h4-cleanup-execute` (hver for seg); eventuelt GitHub-secrets/Actions (egen innstillingsendring; frarådet); sletting av prosjektet (eier). Se `docs/econ/hosted-kjoreinstruks.md` § 4 og § 6.

## 6. Forslag til review
Vurder særlig: (1) at `assertTarget` ikke svekker localhost-sperren; (2) gate-reglene og stoppkriteriene for `fresh`/`upgrade`; (3) DATA-002D-forhåndskontrollen mot migrasjonens faktiske oppførsel; (4) opprydding bare for testdata; (5) rapportregler (hoppet/delvis aldri bestått); (6) at ingen hemmeligheter kan nå utskrift/rapport.
