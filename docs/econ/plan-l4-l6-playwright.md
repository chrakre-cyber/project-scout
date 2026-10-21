# Plan: L4–L6 og Playwright mot lokal Supabase på GitHub-runner (kort, ikke implementert)

**Status 21.10.2026:** plan. Ingen implementering, ingen kjøring. CI-001 forblir REVIEW. Hosted (H1–H4), økonomiflagg (`false`), E7 (utsatt), E8 (åpent) og øvrige avgrensninger er uendret. **L3c er utsatt.** Utgangspunkt: første kjøring (`reviews/CI-001-forste-kjoring.md`) viste at lokal stakk (GoTrue v2.197.0, PostgREST v16.4, PostgreSQL 17.11) starter og at L1, L2, L3a og L7 kan kjøres på `ubuntu-latest` (ca. 4 min, enkeltobservasjon).

## 1. Eksisterende testdekning (ikke ny, skal gjenbrukes — og hva den ikke dekker)
| Område | Allerede dekket | Mot hva | Hull |
|---|---|---|---|
| **API-nivå mot ekte Auth/PostgREST** | `tests/db/*` (kjørt som L3a: 511 bestått): passordinnlogging (`signIn`), `refreshSession`, `signOut` (global), bruker uten firma, `anon`, JWT-forfalskning/metadata (`qa-isolation`), A↔B-isolasjon for agenter/kjøringer/embeds (`rls`, `qa-isolation`, `qa-limit`) | ekte GoTrue + PostgREST | `dealer_economics_inputs`, `dealer_economics_profiles` og `search_drafts` testes bare med `SET ROLE`/claims (`econ005c-…`), **ikke** gjennom PostgREST; feil passord/ugyldig/utløpt token mot Auth-endepunktene er ikke eksplisitt dekket |
| **Nettleserflyt, gammelt agent-UI** | `tests/e2e/dev002-auth` (11), `dev004-agents` (34), `dev005-search-runs` (35), `qa001-app-paths` (18), `search001a-prototype` | skrevet mot lokal Supabase (aldri kjørt i CI; krever Playwright og `SCOUT_ENABLE_LEGACY_ROUTES`) | gammel `/agents`-flate, ikke dagens `/searches`-flyt |
| **Nettleserflyt, dagens Merovo-flyt** | `econ006` (94 sjekker), `econ006d` (26), `search005` | **emulator** (`mini-supabase.mjs`) + isolert PostgreSQL — **ikke** Supabase | aldri kjørt mot ekte GoTrue/PostgREST/`@supabase/ssr`-cookies |
| Rettighetsavslag i nettleser | `patched-build.mjs`-kopier (3–5 byggekopier) | emulator | uendret mekanikk, må kunne kjøres mot stakken |

## 2. Nye tester som trengs (skilt fra det eksisterende)
**L4 innlogging via ekte GoTrue** (nytt, API + én nettleserflyt):
- API (vitest, `tests/db/auth-gotrue.test.ts`): riktig passord ⇒ sesjon; feil passord og ukjent bruker ⇒ samme generelle feil (ingen kontoinfo); utløpt/ugyldig/forfalsket JWT mot PostgREST ⇒ 401/avvist (utløpt token signeres med stakkens lokale JWT-hemmelighet, kun i testprosessen); refresh etter utløp; utlogging ugyldiggjør refresh-token; bruker uten firma ser ingenting.
- Nettleser: login-/logout-flyt i appen med `@supabase/ssr`-cookies (httpOnly/SameSite-egenskaper), omdirigering av anonym, sesjon overlever reload, utløpt sesjon sender til innlogging.
**L6 firmaskille med ekte JWT-er via PostgREST** (nytt, vitest `tests/db/rest-isolation.test.ts`): bruker B mot As rader i `search_drafts`, `dealer_economics_inputs`, `dealer_economics_profiles` med GET/PATCH/DELETE/POST (inkl. falsk `dealership_id`, falsk `search_id`/kandidat), `anon`, bruker uten firma; forventet 0 rader/401/403/avvist (`23503/23514/42501`) uten å røpe eksistens. Gjenbruker `tests/db/harness.ts`.
**L5 lagring/gjenåpning via ekte PostgREST i nettleser** (ny «ekte»-modus for eksisterende skript, ikke nye forløp): `econ006` + `econ006d` kjøres mot stakken i stedet for emulatoren. Krever bare at oppsettet byttes: `startMiniSupabase` ⇒ lokal API-URL + publishable key (fra `supabase status -o env`, maskert); testbrukere som i `harness.createUser` (direkte i `auth.users` + `identities`, bevist i L3a). Feilkoder sammenlignes med `mapError` (`23505→update`, `PGRST116` osv.). Rettighetsavslag fortsetter å bruke patchede appkopier. Forløp som ikke lar seg flytte ⇒ rapporteres som «avgrenset delmengde» **bare** hvis Christian har godtatt det (S3); ellers regnes de som ikke bestått.
**Playwright:** `playwright` står ikke i `package.json` i dag.

## 3. Playwright på runneren — alternativer
| | Beskrivelse | Konsekvens |
|---|---|---|
| **A (anbefalt)** | `playwright-core` som `devDependency` med eksakt versjon (lockfil endres) og bruk av **forhåndsinstallert Chrome** på `ubuntu-latest` via `executablePath`/`channel: "chrome"` (ingen nettleser-nedlasting, ingen `apt`) | endrer `package.json`/lock (krever godkjenning); at Chrome ligger på runneren er ikke verifisert — mangler den ⇒ L5 «IKKE KJØRT» (ingen installasjon) |
| B | `npx playwright@<versjon> install --with-deps chromium` i workflowen | nedlasting + `apt`/sudo = installasjon på runneren; krever eksplisitt godkjenning |
| C | Playwright bare lokalt (som i dag, `PW`-miljøvariabel) | ingen CI-dekning; L5 forblir åpen i Actions |

## 4. Trinnvis gjennomføring (hvert trinn: egen leveranse, review, ingen kjøring før godkjent)
1. **Trinn 1 — L6 + API-delen av L4** (kun vitest mot stakken; ingen Playwright, ingen avhengighetsendring). Utvid `scripts/ci/evaluate.mjs` med L4a/L6 etter samme regler som L3 (feil/hoppet/uventet ⇒ ikke PASS, identiteter ikke antall). Estimat ca. 1 dag + review.
2. **Trinn 2 — «ekte»-modus i e2e + Playwright (A)**: ny `tests/e2e/support/real-supabase.mjs`, miljøbryter i `econ006`/`econ006d`, `scripts/ci/run-e2e-real.sh`; L5 og nettleserdelen av L4 som egne kontroller i rapporten. Lokal verifisering først mot emulert/lokal oppsett der det går. Estimat ca. 1,5–2 dager + review.
3. **Trinn 3 — integrasjon i workflowen** (ett nytt trinn, `timeout-minutes` justeres), første kjøring med egen godkjenning.

## 5. PASS-regler (uendret grunnholdning)
- Hver ny kontroll (L4, L5, L6) har egen status PASS/FAIL/SKIPPED/NOT_RUN; samlet jobb-PASS krever PASS i **alle** inkludert de nye. Hoppede eller ikke kjørte sjekker er aldri bestått.
- L5: alle sjekker i de to skriptene (94 + 26 i dag) kjørt og bestått mot stakken, eller en navngitt, godkjent delmengde som rapporteres som delmengde — aldri stilltiende redusert.
- Statisk test av vurderingen + feilinnsetting (som for L3b): mangler `build`/Playwright/Chrome ⇒ NOT_RUN; en sjekk som feiler ⇒ FAIL; uventet kjørt/manglende sjekk ⇒ ikke PASS.

## 6. Nøkler, testdata og logg (uendret mønster)
- App-prosessen får **bare** `NEXT_PUBLIC_SUPABASE_URL` og publishable key; secret/service-nøkkel og DB-URL brukes bare i testprosesser som lager brukere, og maskeres (`::add-mask::` + literal-liste) før bruk.
- Ingen Playwright-trace/video/HAR/`storageState`; skjermbilder lastes ikke opp; ingen artefakter. Rapporten bygges bare av allowlistede linjer og saneres (som i `scripts/ci/`).
- Testdata er syntetiske (`@example.test`, tilfeldige passord per kjøring, syntetiske firma/annonser); ingen e-post sendes (lokal stakk).
- Repoet er offentlig ⇒ loggen er offentlig; første kjøring av hvert trinn gjennomgås før videre bruk.

## 7. Risiko og begrensninger
- Kjøretid ukjent: 3–5 appbygg (hovedløp + rettighetskopier) og Chrome-flyter legger til anslått 15–30 min (ikke målt; første kjøring ca. 4 min for L1–L3/L7 er en enkeltobservasjon).
- Minne/CPU på runneren (stakk + Next-bygg + Chrome) er ukjent.
- Forskjeller emulator ⇒ ekte GoTrue/PostgREST kan avdekke feil i appens cookie-/sesjonshåndtering, rate limits og feilkoder; slike funn rapporteres, ikke omgås.
- Dette løser ikke hosted (H1–H4) eller regel-/parametergodkjenning.

## 8. Beslutninger fra Christian (før implementering)
1. Godkjenner du rekkefølgen Trinn 1 → 2 → 3, og at hvert trinn leveres til review før neste?
2. Playwright: alternativ A (devDependency `playwright-core` + forhåndsinstallert Chrome; endrer `package.json`/lockfil) eller C (utsett L5 i CI)? B (installasjon på runneren) bare med eksplisitt godkjenning.
3. Er «avgrenset delmengde» tillatt for L5 hvis noe forløp ikke lar seg flytte (S3), eller skal alt kreves?
