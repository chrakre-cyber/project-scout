# CI-001 — GitHub Actions for lokal Supabase (L1–L3 og L7): leveranse til uavhengig review (21.10.2026)

**Task:** CI-001 (oppfølging av `docs/econ/forslag-supabase-actions.md`, Christians pålegg 21.10.2026). **Ikke DONE** før uavhengig review. **Workflowen er ikke kjørt, ikke merget til `main` og ingen innstilling er endret.** L4–L6 og Playwright-integrasjonen er neste, avgrensede steg og står åpne; hosted Supabase (Trinn H) er en separat beslutning. Dette er ikke en redusert pilotkontroll, ikke pilotklarhet og ikke regel-/parametergodkjenning. Økonomiflagg `false`, E7 utsatt, E8 åpent.

## Brukerutfall
Når workflowen senere startes manuelt, kjører den lokal Supabase i container på en standard Ubuntu-runner og leverer **én sanert rapport** (logg + jobbsammendrag) med BESTÅTT / FEILET / HOPPET OVER / IKKE KJØRT per kontroll og et samlet utfall. Samlet «PASS» krever PASS i alle fire kontroller; feil, hoppede og ikke kjørte kontroller gir «IKKE FULLT BESTÅTT» og exit-kode 1.

## Rammer (oppfylt og låst av tester)
| Krav | Hvordan |
|---|---|
| Bare `workflow_dispatch` | eneste trigger, ingen inndata (`tests/ci-workflow.test.ts`) |
| `contents: read`, tidsgrense, ingen dobbeltkjøring | `permissions: contents: read`; `timeout-minutes: 75` (trinnsgrenser summerer til 67 min); `concurrency: supabase-local`, `cancel-in-progress: false` |
| Ingen hosted Supabase, secrets, betalte runnere, deploy | ingen `secrets.*`, `ubuntu-latest`, ingen `supabase link/db push/login`, ingen `supabase.com`-referanser, ingen deploy/environment |
| Ingen tredjeparts-actions, ingen artefakter | ingen `uses:` (koden hentes med `git fetch` av kjørt SHA, uten lagrede innloggingsdata); ingen upload/cache. Alt leveres som sanert tekst. (Årsak: SHA-festing av actions kunne ikke avklares uten å lese andre repoer.) |
| Ingen nøkler/databaseuttrekk/usanitert diagnostikk | rå utskrift fra `supabase start`/`db reset`/underskript går til en privat midlertidig katalog (`chmod 700`) og skrives aldri ut; nøkler fra `supabase status -o env` leses til fil og maskeres med `::add-mask::` + egen literal-liste; rapporten bygges bare av allowlistede linjer (PASS/FAIL/SKIP/== i underskriptene; testnavn; versjonslinjer), sanert (`scripts/ci/sanitize.mjs`: JWT, `sb_secret_`/`sb_publishable_`, DB-URL, navngitte nøkler, Bearer, lange opake strenger, literals) og sperret (`hasLeak` på sluttrapporten; ved treff undertrykkes hele rapporten og jobben feiler). Aldri `set -x`, `env`, `docker logs/inspect`, `supabase status` til stdout |
| Feil/hoppet over ≠ bestått | `scripts/ci/evaluate.mjs`: `FAIL`, `SKIPPED`, `NOT_RUN` teller aldri som `PASS`; en tom/feilende spørring regnes som feil |
| Ikke endre synlighet/innstillinger; ikke merge/push til `main`; ikke starte kjøringer | ikke gjort |

## Endrede/nye filer
- `.github/workflows/supabase-local.yml` (ny)
- `scripts/ci-supabase-local.sh` (orkestrering L1→L2→L3→build→L7)
- `scripts/ci/sanitize.mjs`, `scripts/ci/evaluate.mjs` (+ `.d.mts`)
- `scripts/qa-upgrade-check.sh` (L2) — **rettet, se under**
- `scripts/test-qa-migrations-offline.sh`, `scripts/test-ci-orchestrator-offline.sh`, `tests/ci/emulated-cli/{npx,docker}` (emulerte tørrkjøringer, se «Kontroller»)
- `tests/ci-workflow.test.ts`, `tests/ci-sanitize.test.ts`, `tests/ci-evaluate.test.ts`
- Docs: `docs/econ/forslag-supabase-actions.md` (§ 10), DECISIONS runde 62, MVP_BACKLOG, TEST_PLAN. Ingen app-/domene-/migrasjonsendring.

## Funn i eksisterende L2-skript (rettet)
`scripts/qa-upgrade-check.sh` var utdatert siden DEV-005B0 og ville feilet på den ekte stakken uavhengig av migrasjonene:
1. forventet sluttilstand hardkodet til 6 migrasjoner (nå 12) og «RLS på 5 tabeller» (nå 8) → nå utledet fra `supabase/migrations/*.sql` og «ingen tabell i `public` uten RLS»;
2. to «uendret data»-sjekker (`data_md5`, `data5_md5`) feilet med SQL-feil (`uuid || uuid`) og ble **vakuumt grønne** (tom = tom) → kolonnene castes til tekst, og `check()` regner tom respons som FEIL.
Ingen test er svekket; kontrollene er strengere enn før. Verifisert i emulering (se under), ikke på ekte Supabase CLI.

## Kontroller (faktisk kjørt av utvikler; ikke review)
- `npx vitest run`: **75 filer / 1 717 tester** består (53 nye: workflow 8, sanitize 14, evaluate 31). `tsc --noEmit` og `eslint .` uten feil. Mutasjonskontroll av workflowtesten: fem injiserte brudd (push-trigger, `id-token: write`, `uses:`, `bash -x`, større runner) fanges alle.
- YAML parset med `js-yaml` (trigger, rettigheter, concurrency, steg, timeout som forventet).
- **Emulert tørrkjøring av L2** (`bash scripts/test-qa-migrations-offline.sh`): `npx supabase` og `docker exec … pg_dump` emulert mot en isolert PostgreSQL-klynge. Før rettingen: 4 FAIL + 2 vakuumt grønne sjekker; etter: «MIGRASJONSKJEDE: ALLE KONTROLLER BESTÅTT» (50 PASS). **Dette er ikke L2:** ekte CLI, migrasjonsmotor og containere er ikke med.
- **Emulert tørrkjøring av orkestreringen** (`bash scripts/test-ci-orchestrator-offline.sh`, inkl. ekte `npm run build`): 8/8 kontroller — ingen falsk nøkkel/passord/JWT/DB-URL i stdout eller jobbsammendrag; L1 og L2 BESTÅTT og L7 BESTÅTT (21 PASS, 0 SKIP, inkl. sammenligning mot de falske lokale nøklene); L3 FEILET (517 tester: 252 bestått, 12 feilet, 253 hoppet over — samme 12 feil som kjent isolert baseline, Auth/PostgREST finnes ikke i emuleringen); samlet «IKKE FULLT BESTÅTT» med exit 1; L4–L6, Playwright og hosted oppført som ÅPNE.
- **Ikke kjørt:** selve workflowen, `supabase start`, ekte GoTrue/PostgREST, Docker-bildehenting, ekte `qa:migrations`/`test-db.sh`/`qa:secrets` mot ekte stakk. Tider i forslaget (20–35 min) er fortsatt estimater.

## Begrensninger / forventet førstegangsutfall
1. **L3 kan ikke bli «PASS» slik suiten står nå:** to `describe.skipIf(!SCOUT_DB_ISOLATED)`-blokker (DATA-002D- og ECON-005b-oppgradering, 6 tester) hoppes alltid over utenfor den isolerte klyngen. De rapporteres som «HOPPET OVER med KJENT årsak» og regnes **ikke** som bestått ⇒ samlet utfall blir «IKKE FULLT BESTÅTT» selv om alt annet består. Beslutning trengs (ikke tatt): (a) akseptere dem som kjent, dokumentert delmengde, eller (b) en egen oppgave som lar dem kjøre mot ekte stakk.
2. L2 mot **ekte** CLI kan avvike fra emuleringen (utskriftsformat, `supabase migration up`-oppførsel, atomisk feilmelding «1 linje»). Første kjøring avgjør.
3. L7 kan gi «HOPPET OVER» hvis `supabase status -o env` ikke eksponerer alle nøkkelnavn (ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET, PUBLISHABLE_KEY, SECRET_KEY) — da regnes den som ikke bestått.
4. Ukjent: bildehenting fra `public.ecr.aws`/Docker Hub fra runneren, minne (stakk + Next-bygg), faktisk kjøretid.
5. Repoet er offentlig: logg/sammendrag er offentlige. Saneringen er sist forsvarslinje; en kjøring som likevel viser noe skal slettes (Actions → run → Delete run) og rapporteres.
6. `git fetch` uten token forutsetter offentlig repo; blir repoet privat må checkout-steget endres.
7. Under arbeidet traff mine første filer secret-skannets mønstre (falske nøkler i emuleringen/testene); jeg skrev om til runtime-sammensatte verdier og **omskrev min egen siste, ikke-reviewede commit** (force-with-lease på denne arbeidsgrenen) slik at historikken er ren. Den gamle commiten kan en kort tid ligge igjen som uferdig objekt på GitHub; den inneholdt bare falske testverdier.

## Hva som senere må gjøres for å aktivere første kjøring (ikke gjort)
1. Uavhengig review av denne leveransen, og Christians godkjenning.
2. Christian sjekker i GitHub (jeg endrer ingenting): **Settings → Actions → General**: Actions tillatt (workflowen bruker ingen tredjeparts-actions, så «Allow actions created by GitHub» eller strengere holder), **Workflow permissions = Read repository contents**; **Billing → Spending limit = 0 USD**; ingen larger runners.
3. Workflowfilen må ligge på **standardgrenen (`main`)** for at «Run workflow» skal dukke opp. To alternativer, begge krever eksplisitt godkjenning: (A) merge denne grenen til `main`; (B) legg bare `.github/workflows/supabase-local.yml` på `main` (eller en tilsvarende minimal endring) og kjør workflowen *fra arbeidsgrenen* ved å velge grenen under «Use workflow from». Scriptene hentes fra den valgte grenens commit.
4. Start: Actions → «Supabase lokal kontroll (L1–L3, L7)» → Run workflow → velg `claude/wonderful-bardeen-yussx3` → Run. (Alternativt starter jeg via API etter uttrykkelig tillatelse.)
5. Les det sanerte sammendraget; reviewer vurderer logg og rapport. Ved mistanke om lekkasje: slett kjøringen.
6. Beslutning om L3-hoppene (punkt 1 over) før «PASS» er mulig; deretter neste avgrensede steg: L4–L6 med Playwright og «ekte»-modus i e2e.

## Neste oppgave
Uavhengig review av CI-001; deretter L4–L6 (egen avgrenset leveranse) og beslutning om L3-hoppene.
