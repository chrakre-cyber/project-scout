# CI-001 trinn 3 — workflow-integrasjon av L4b (nettleser) og L5a/L5b (til uavhengig review, 21.10.2026)

**CI-001 forblir REVIEW.** Stoppet før aktivering: **ingen Actions-kjøring startet, ingen endring på `main`, ingen GitHub-innstillinger, ingen hosted migrasjon/deploy.** L3c er utsatt. Økonomiflagg `false`, E7 utsatt, E8 åpent.

**Viktigst, først:** Ingenting i trinn 3 er kjørt mot ekte Supabase (image-henting er blokkert i sandboxen). Det som er kjørt er statiske tester, vurderingslogikk mot syntetiske løpsutskrifter, en emulert orkestrering og emulatormodus (merket «IKKE Supabase»). **L4b og L5 er ikke bekreftet bestått noe sted.** Econ006 J3 er fortsatt HOPP i ekte modus ⇒ L5a er DELVIS og **L5/samlet kan ikke bli PASS** så lenge J3 hoppes. API-dekning (L6) er ikke godkjent som erstatning, og L5-omfanget er uendret (93 + 26 sjekker + J3).

## Registrert først: re-review av 7f49445 (`reviews/CI-001-FIX4-review-7f49445.md`)
P2 om overstyring av databasemål er lukket, ingen nye blokkerende funn. Trinn 2 er implementert og reviewet, **ikke bekreftet bestått mot ekte Supabase**. Reviewers begrensninger bevart: ikke kjørt Bash, database, nettleser/e2e, ekte Supabase, Actions, build eller qa:secrets; econ006d 26/26 ikke gjentatt; tax-engine og economics-source-driven ikke kjørt; lokal vert beviser ikke at databasen er tom.

## Hva som er levert
| Fil | Innhold |
|---|---|
| `scripts/ci-supabase-local.sh` | Etter L7 (løpene bygger appen på nytt): `l4`, `econ006d`, `econ006` via `scripts/test-e2e-real-supabase.sh`, hver med egen tidsgrense fra planen (`run2`: stdout/stderr adskilt, bare stdout tolkes). Nettleser finnes? (samme søk som løpene, ingen installasjon). Mangler den: ingen venting, wrapperen gir exit 3 ⇒ IKKE KJØRT. L3b kjøres sist, uendret |
| `scripts/ci/login-budget.mjs` | GoTrue `sign_in_sign_ups` = 30 per 5 min: innlogginger registreres (hele budsjettet regnes brukt etter L3a), og løp **venter** til nok budsjett er tilgjengelig. Testene reduseres aldri |
| `scripts/ci/e2e-plan.json` | Låst plan per løp: sjekknavn (l4 12, econ006d 26, econ006 93 + én av to varianter), innloggingsbehov (5/2/9), tidsgrense (900/1500/2100 s = 75 min i sum), kjent delvis sjekk (J3) |
| `scripts/ci/e2e-names.mjs` | Normalisering/parsing av sjekklinjer ⇒ entydig identitet per sjekk |
| `scripts/ci/evaluate.mjs` | Egne seksjoner **L4b, L5a, L5b, L5 samlet** med modus i overskrift. Regler: ingen exit-kode ⇒ IKKE KJØRT; exit 3 ⇒ IKKE KJØRT; 124/2 ⇒ FEIL; modus må være ekte (emulator ⇒ FEIL); hver planlagt sjekk nøyaktig én gang (manglende/duplisert/ukjent ⇒ FEIL); FEIL-linje ⇒ FEIL; sammendrag må stemme med linjene; kjent J3-HOPP ⇒ DELVIS; ukjent HOPP ⇒ HOPPET OVER. Samlet PASS krever alle åtte nøkler PASS |
| `.github/workflows/supabase-local.yml` | Kun `timeout-minutes` 90 ⇒ 180 og kommentarer. Fortsatt kun `workflow_dispatch`, `contents: read`, ingen secrets, ingen tredjeparts-actions, ingen artefakter |
| `tests/e2e/econ006.e2e.mjs`, `l4-browser.e2e.mjs` | De to modusavhengige sjekkene har samme navn for OK og HOPP (identitet uavhengig av modus) |
| Tester | `tests/ci-e2e-integration.test.ts` (15) + `tests/ci/e2e-fixtures.ts`; eksisterende CI-tester utvidet med e2e-filer; `scripts/test-ci-orchestrator-offline.sh` oppdatert |

Tidsbruk (ikke garanti): planens tidsgrenser summerer til 75 min for nettleserløpene; orkestreringens samlede budsjett er 154 min mot jobbgrense 180. Første ekte kjøring kan bli lang pga. ventetid på innloggingsbudsjett.

## Bevis — holdt adskilt
1. **Statiske tester / vurderingslogikk:** 84 filer / **1 901 tester** består (`npx vitest run`), `tsc --noEmit` exit 0, `eslint` exit 0, `npm run build` exit 0, `qa-secret-scan.sh`: INGEN FUNN (Supabase-sjekken hoppet, stakk kjører ikke). Før retting feilet én eksisterende L3b-test fordi fixturen manglet e2e-filer; rettet i testen.
2. **Integrasjonstester (`ci-e2e-integration.test.ts`):** hvert løp rapporteres separat med modus; J3-HOPP ⇒ L5a DELVIS og L5 ikke PASS; exit 3, manglende filer, 124, 2, FEIL, manglende/duplisert/ukjent sjekk, ukjent HOPP, emulatormodus og usammenhengende sammendrag gir aldri PASS; rapporten inneholder ingen nøkler/URL-er; statisk: rekkefølge L7 → e2e → L3b, ingen nettleserinstallasjon, ingen skjermbilder/opplasting/artefakter, planens tid under jobbgrensen, workflow uten triggere/secrets utover kravene.
3. **Emulert orkestrering (`reviews/CI-001-trinn3/orkestrering-emulert.txt`):** uten nettleser (`CHROME_PATH=/finnes/ikke`) rapporteres L4b, L5a og L5b hver som IKKE KJØRT uten ventetid; samlet IKKE FULLT BESTÅTT; ingen falske nøkler i utskrift. IKKE Supabase.
4. **Emulatormodus (IKKE Supabase) i sandbox med Chromium:** `econ006` 94/94, `econ006d` 26/26, `l4` 11 OK + 1 HOPP (exit 4) (`reviews/CI-001-trinn3/*`).
5. **Ekte Supabase / GitHub-runner: ikke kjørt.** Ingen Actions-kjøring.

## Begrensninger og forventet utfall ved første godkjente kjøring
- Forventet beste utfall i dag: L4b PASS (hvis alle 12 inkl. revokering består), L5b PASS, **L5a DELVIS (J3)** ⇒ L5 og samlet **IKKE FULLT BESTÅTT**. Det er riktig oppførsel, ikke en feil.
- GitHub-hostede runnere har normalt Chrome forhåndsinstallert; er det ikke tilfelle blir løpene IKKE KJØRT (ingen installasjon).
- Risiko: ekte GoTrue/PostgREST kan avvike fra emulatoren; feil skal rapporteres og rettes, ikke omgås. Workflowfilen på `main` er fortsatt den gamle kopien; en kjøring fra grenen bruker grenens fil.
- Skjermbilder går til midlertidig katalog på runneren og lastes aldri opp.

## Neste oppgave
Uavhengig review av trinn 3. Deretter (egen godkjenning): PR med bare workflowfila/skriptene og én manuell kjøring; resultatet vurderes separat.
