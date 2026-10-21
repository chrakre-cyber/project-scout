# Forslag: Trinn L (lokal Supabase) på GitHub Actions — kartlegging (ikke implementert)

**Status 21.10.2026:** kartlegging og forslag. **Ingen workflow er opprettet, ingen kjøring startet, ingen innstilling endret, ingen tjeneste opprettet.** Ingen credentials er etterspurt. Trinn H (hosted testprosjekt) er en separat, senere beslutning. Bakgrunn: Docker Desktop lar seg ikke installere på Christians PC (alternativ O1 i `forslag-supabase-kontroll.md` faller bort); dette utreder O2.

## 1. Kontrollert i repoet (faktiske funn)
| Spørsmål | Funn | Hvordan kontrollert |
|---|---|---|
| Privat eller offentlig? | **Offentlig** (`visibility: public`, `chrakre-cyber/project-scout`, standardgren `main`) | GitHub-API via repoverktøyet |
| Actions aktivert? | **Ikke avgjort.** Det finnes ingen workflows, så «aktivert» kan ikke observeres; innstillingen (Settings → Actions → General) er ikke lesbar for meg. Christian må se etter | `list_workflows` ⇒ 0 |
| Eksisterende workflows | **Ingen.** `.github/` finnes ikke (verken lokalt eller på GitHub). Backlogg/avstemming sier også: «repoet har ingen CI-konfigurasjon» | filsystem + `get_file_contents` |
| Hva ligger klart for L1–L7? | `supabase/config.toml` (`project_id = project-scout`, auth: `enable_signup=false`, e-postbekreftelse av), 12 migrasjoner, `supabase`-CLI 2.119.0 som `devDependency`, `scripts/test-db.sh` (L3), `scripts/qa-upgrade-check.sh` (L2, avviser ikke-lokal DB), `scripts/qa-secret-scan.sh` (L7), `vitest.db.config.ts` + `tests/db/*` (bruker `SUPABASE_TEST_URL`/`…PUBLISHABLE_KEY`/`…DB_URL`) | gjennomgang |
| Merknad | Repoet er offentlig og har en `homepage` (`merovo-demo.vercel.app`). Alt i repoet — inkl. `reviews/`, `docs/` og de arkiverte primærkildene (`docs/tax/primarkilder`, 44 MB) — er derfor offentlig lesbart. Jeg har ikke endret synlighet; vurder om det er ønsket (CLAUDE.md pkt 11: ingen offentliggjøring som bieffekt) | |

## 2. Konsekvens av offentlig repo
- **Kostnad:** etter GitHubs dokumentasjon er standard GitHub-hostede Linux-runnere (`ubuntu-latest`) gratis og uten minuttkvote for offentlige repoer; større/“larger” runnere, ekstra lagring utover gratisgrensene og private repoer faktureres/kvoteres. **Dette er kjent fra dokumentasjonen, ikke bekreftet mot Christians konto** — jeg kan ikke lese plan, kvote eller betalingsoppsett. Ukjent: kontoplan, om en utgiftsgrense/betalingsmetode er satt, og om policyen er uendret nå. Christian kan se Settings → Billing and plans → Usage. Forslag: bruk kun `ubuntu-latest`, aldri larger runners, og sett «spending limit» til 0 USD før første kjøring.
- **Logger og artefakter er offentlige** (for alle som kan se repoet, også uten innlogging for logger). Alt som skrives til loggen må regnes som publisert. Det er hovedrisikoen og styrer designet i § 5.
- **Forks og PR-er:** ingen hemmeligheter trengs, og workflowen utløses bare manuelt, så eksterne PR-er kan ikke kjøre den.

## 3. Hvilke kontroller kan kjøres (og hva som kreves)
| Kontroll | Kan kjøres på Actions? | Nødvendig endring / merknad |
|---|---|---|
| **L1** `supabase start` + `db reset` fra tom, versjoner noteres | **Ja** | Docker finnes på runneren. Versjoner (CLI, Postgres, GoTrue, PostgREST) leses fra `supabase status`/image-tagger og skrives til rapport uten nøkler. Ukjent: om bildene (hentes fra `public.ecr.aws`; i min sandbox ga ECR 403) kan hentes fra runneren — må vises i første kjøring |
| **L2** `qa:migrations` | **Ja** (ingen endring av skriptet) | destruktivt, men kun mot runnerens egen midlertidige stakk; skriptet nekter ikke-lokal DB |
| **L3** `scripts/test-db.sh` (hele DB-suiten mot ekte Auth/PostgREST) | **Ja** | Må rapportere «0 hoppet over av årsaken Auth/PostgREST mangler». Dekker store deler av L4/L6 på API-nivå, forutsatt at `tests/db/*` allerede går mot ekte PostgREST når `SUPABASE_TEST_URL` er satt |
| **L4** innlogging via ekte GoTrue (feil passord, bruker uten firma, utløpt/ugyldig JWT, refresh, utlogging, `@supabase/ssr`-cookies) | **Delvis → krever ny test** | Eget API-nivå-skript (fetch mot `/auth/v1`) + nettleserflyt mot appen. Utløpt JWT kan lages ved å signere med den lokale JWT-hemmeligheten eller vente ut en kort `jwt_expiry` — begge bare mot den kortlevde lokale stakken |
| **L5** lagring/gjenåpning via ekte PostgREST (88→94 nettleserkontroller) | **Delvis → krever e2e-endring** | e2e-skriptene bruker `mini-supabase.mjs`. Trengs en «ekte»-modus som peker appen på lokal API-URL + publishable key og lager testbrukere via GoTrue (ikke direkte `auth.users`-SQL). Feilkodene (23505 osv.) sammenlignes med `mapError`. Rettighetsavslag bruker fortsatt testkopier av appen (egne byggetrinn). Forbehold: forløp som ikke lar seg flytte rapporteres som avgrenset delmengde (S3) |
| **L6** firmaskille med ekte JWT-er (B mot A, `anon`, bruker uten firma) | **Ja, ny test** | Nye vitest-/fetch-tester; mange tilfeller dekkes allerede av `tests/db/rls.test.ts`/`qa-isolation` hvis de går mot ekte PostgREST |
| **L7** hemmeligheter (`qa:secrets`, ingen service-role i klientbunt/logger) | **Ja** | Skriptet leser lokale nøkler uten å skrive dem ut. I tillegg: søk i arbeidsloggene (§ 5) |
| Playwright/Chromium | Ja, men **ny avhengighet** | `playwright` står ikke i `package.json` (e2e leser `PW` fra miljøet). Krever enten en devDependency eller `npx playwright@<versjon> install --with-deps chromium` i workflowen — en installasjon som må godkjennes eksplisitt |

## 4. Nødvendige endringer (når det besluttes)
1. `.github/workflows/supabase-local.yml`: **kun `workflow_dispatch`** (ingen `push`/`pull_request`/`schedule`), `permissions: contents: read`, `concurrency` (én kjøring om gangen), `timeout-minutes: 45`, `runs-on: ubuntu-latest`, ingen `secrets.*`, tredjeparts-actions festet til commit-SHA (checkout, setup-node, upload-artifact), `persist-credentials: false`.
2. `scripts/ci-supabase-local.sh`: kjører L1→L7 i rekkefølge, skriver en filtrert tekstrapport (`report.txt`) og maskerer verdier (§ 5).
3. e2e «ekte»-modus (L4/L5/L6): ny hjelper som erstatter emulatoren; app-prosessen får **bare** `NEXT_PUBLIC_SUPABASE_URL` og publishable key. Emulatoren beholdes for offline-kjøring.
4. Dokumentasjon: rapportformat som skiller «lokal Supabase <versjon> på GitHub Actions» fra emulator og fra hosted; oppdatering av `forslag-supabase-kontroll.md`, TEST_PLAN og beslutningslogg.
5. Konfigurasjon: eventuelt `supabase start -x <tjenester>` for å utelate Studio/edge-runtime/logging som ikke trengs (kortere tid); må vises ikke å endre auth/PostgREST-oppførsel. Ingen endring av migrasjoner eller `config.toml` forventes.

## 5. Nøkler og testdata ut av logger og artefakter
Utgangspunkt: den lokale stakken genererer egne, kortlevde nøkler på runneren; ingen repo-secrets brukes og ingen hosted nøkler berøres. Likevel regnes alt i loggen som offentlig:
- `npx supabase start` skriver status inkl. nøkler. Kjør med `>/dev/null` (stdout) og vis kun filtrert feilhale; **aldri** `supabase status` uten `-o env` til fil, aldri `set -x`/`bash -x`, aldri `env`/`printenv`/`docker inspect`/`docker logs` uten filter.
- Les nøkler fra `supabase status -o env` inn i variabler og kall **umiddelbart** `echo "::add-mask::$verdi"` for hver (secret key, anon/publishable, JWT-hemmelighet, DB-passord/URL) før noe annet trinn kjører. Passord til testbrukere genereres tilfeldig per kjøring og maskeres likt.
- Verdier gis til trinn via filbeskrevet miljø (`$GITHUB_ENV` kun etter maskering) og bare til prosessene som trenger dem; app-prosessen får aldri secret-/service-nøkkel.
- Playwright: ingen trace, video, HAR eller `storageState`; konsoll- og nettverkslogger skrives ikke ut. Skjermbilder lastes ikke opp som standard (valgfritt, syntetiske data).
- **Artefakter:** kun `report.txt`, `e2e-resultat.txt` og versjonsliste; oppbevaring 7 dager. Et siste trinn kjører samme mønstre som `qa-secret-scan.sh` (JWT-form, `sb_secret_`, tilkoblings-URL med passord) over alt som skal lastes opp, og feiler jobben **før** `upload-artifact` ved treff. Kjørelogg kan ikke etterskannes før publisering — derfor maskering og stille kommandoer først.
- Testdata er syntetiske: testbrukere `…@example.test`, syntetiske firma og annonser (demodata), ingen ekte personer. Lokal stakk sender ingen e-post ut (mottak går til lokal Mailpit/Inbucket; bekreftelser er av). CLAUDE.md pkt 9 er dermed oppfylt.
- Rotasjon er unødvendig fordi nøklene er kortlevde, men hvis en nøkkel likevel havner i en offentlig logg: slett kjøringen (Actions → Delete workflow run) og dokumenter hendelsen.

## 6. Forventet kjøretid (ESTIMAT — ikke målt)
| Trinn | Anslag |
|---|---|
| checkout, Node, `npm ci` | 1–2 min |
| `supabase start` første gang (bildehenting) | 3–6 min (usikker: ECR-tilgang og hastighet ukjent) |
| L1 `db reset` | < 1 min |
| L2 `qa:migrations` | 2–4 min |
| L3 DB-suiten | 1–3 min |
| Playwright-installasjon | 1–2 min |
| L4–L6 inkl. 1–3 appbygg og nettleserforløp | 10–20 min |
| L7 | < 1 min |
| **Sum** | **≈ 20–35 min per kjøring** (første kjøring lengre ved feilsøking) |
Ukjent og må måles i første kjøring: faktisk bildehenting, minnebruk (hele stakken + Next-bygg + Chromium på 4 vCPU/16 GB for offentlige repoer), og om DB-testene er stabile mot ekte tjenester. Gratis minutter er ikke relevante for offentlige repoer (§ 2), men en kjøring på 20–35 min × noen få forsøk er uansett lite.

## 7. Begrensninger
- Dette er **lokal Supabase i en container på en GitHub-runner**, ikke hosted: bekrefter ikke hosted konfigurasjon, nettverk, e-postleverandør, rate limits, region eller migrasjon mot et ekte prosjekt (Trinn H er fortsatt åpent og nødvendig før pilot).
- Det som kan påstås etterpå: «bekreftet mot lokal Supabase <versjon> kjørt i GitHub Actions <dato/kjøring>» — ikke «Supabase-integrasjon bekreftet generelt», ikke pilotklarhet, ikke regelgodkjenning.
- Uavhengighet: reviewer kan lese de offentlige loggene og bekrefte kjøringen. Å **starte** kjøringen krever skrivetilgang til repoet; ellers må Christian eller jeg starte, og reviewer vurderer logg og rapport. Utviklerkjøring og reviewers vurdering holdes adskilt.
- Første kjøring kan avdekke at ECR-bilder ikke kan hentes, at minnet ikke strekker til, eller at e2e ikke lar seg flytte fullt ut (⇒ avgrenset delmengde for L5, S3).
- `main` har ingen workflow; en `workflow_dispatch`-workflow kan bare startes fra GitHub når filen finnes på standardgrenen (`main`). Å legge den dit er en merge/endring i `main` som krever eksplisitt beslutning — alternativ: kjøre fra en gren via API når filen finnes der (kan kreve at filen først finnes på `main` for å vises i UI).

## 8. Beslutninger som trengs fra Christian
1. **Godkjenner du O2 (GitHub Actions) for Trinn L?** (Sparer deg for Docker; repoet er offentlig, så kjøringen er gratis i henhold til GitHubs dokumentasjon.)
2. **Sjekk (ingen hemmeligheter i chat):** Settings → Actions → General er slått på; Billing → spending limit er 0 USD; bekreft plan og at du ikke har satt opp betalte larger runners.
3. Skal repoet fortsatt være **offentlig** (logger/artefakter blir offentlige) — eller skal det gjøres privat først (da gjelder minuttkvote og ukjente minutter)? Jeg endrer ikke synlighet.
4. Godkjenner du at jeg i en senere runde: (a) skriver workflow + skript + e2e-«ekte»-modus på denne grenen, (b) legger til Playwright (devDependency eller `npx` i workflowen), (c) at workflowen får ligge på `main` for å kunne startes? Hver av disse er en egen, uttrykkelig godkjenning.
5. S3: er «avgrenset delmengde» tillatt for L5 hvis noe forløp ikke lar seg kjøre uten emulator?
Estimat for implementering: ≈ 1 dag (workflow + skript + e2e-modus) pluss 1–3 kjøringer og review.

## 9. Ikke gjort i denne runden
Ingen workflow opprettet, ingen kjøring startet, ingen repo- eller Actions-innstilling endret, ingen avhengighet installert, ingen credentials etterspurt, ingen hosted aktivitet, ingen kodeendring. Økonomiflagg `false`, E7 utsatt, E8 åpent.

## 10. Oppdatering 21.10.2026 — L1–L3 og L7 klargjort (til review, ikke kjørt)
Christian ba om klargjøring av oppsettet for L1–L3 og L7 (L4–L6 og Playwright er neste steg og står åpne). Levert i `reviews/CI-001-leveranse.md`: `.github/workflows/supabase-local.yml`, `scripts/ci-supabase-local.sh`, `scripts/ci/{sanitize,evaluate}.mjs`, tester og emulerte tørrkjøringer. Avvik fra forslaget over: **ingen tredjeparts-actions og ingen artefakter** (rapporten leveres som sanert tekst i logg/jobbsammendrag), full historikk hentes med `git fetch` av kjørt SHA, `timeout-minutes: 75`. Funn: `scripts/qa-upgrade-check.sh` var utdatert (6 migrasjoner/5 tabeller hardkodet, to vakuumt grønne sjekker) og er rettet. Aktivering krever fortsatt Christians kontroll av Actions-innstillinger og at workflowfilen finnes på `main` (se leveransen). Ingen kjøring er startet.
