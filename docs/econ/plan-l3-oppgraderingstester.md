# Plan: kjør de seks hoppede oppgraderingstestene (L3b) — forslag før implementering (21.10.2026)

**Status 21.10.2026 (oppdatert):** godkjent av Christian og implementert som CI-001-FIX2 (alternativ B; L3c utsatt) — se `reviews/CI-001-FIX2-retting.md`. Teksten under er den opprinnelige planen.

**Opprinnelig status:** plan, ikke implementert. CI-001 forblir REVIEW (re-review av 3e6c059 registrert: begge P2 lukket, ingen nye blokkerende funn; `reviews/CI-001-re-review-3e6c059.md`). Ingen endring av `main`, ingen Actions-start, ingen innstillinger, ingen hosted. PASS-kravet svekkes ikke, og hoppede tester merkes aldri som bestått.

## 1. Hva de seks testene er (verifisert i sandboxen)
To `describe.skipIf(!SCOUT_DB_ISOLATED)`-blokker: **DATA-002D** «oppgradering fra eldre tilstand» (5 tester) og **ECON-005b** «oppgradering — eksisterende ikke-syntetiske profiler får ingenting» (1 test). De bygger en *scratch-database* (`create database …`), legger inn `supabase-shim.sql` (uten `create role`), anvender migrasjonene i rekkefølge **unntatt** den som testes, legger inn eldre data, anvender så migrasjonen og kontrollerer resultatet (byte-for-byte uendrede rader, presis stopp ved ugyldige rader, ingen antatte rettigheter). De trenger ikke Auth/PostgREST.
- Kjørt nå i den isolerte klyngen (`scripts/test-db-isolated.sh … -t oppgradering`): **6 bestått, 87 hoppet over (andre tester utenfor filteret), 0 feilet.** Dette er en ekte kjøring mot PostgreSQL 16 + shim, ikke Supabase-stakken.
- Hvorfor de hoppes på Supabase-stakken: de er bevisst låst bak `SCOUT_DB_ISOLATED` fordi de oppretter/dropper databaser og bruker shim. Å bare sette flagget mot den lokale Supabase-databasen er **ikke** trygt uten avklaring: `postgres`-rollen i Supabase er ikke nødvendigvis superbruker/CREATEDB, shim-objekter (`auth`, `extensions`) ville komme i en tilfeldig database i stakken, og vi vet ikke hvordan migrasjonenes `create role`-vakter oppfører seg der.

## 2. Anbefalt løsning: egen isolert testfase «L3b» (ny kontroll i samme workflow)
1. **L3a** = dagens L3 mot Supabase-stakken, uendret: de seks hoppes fortsatt over og rapporteres som «HOPPET OVER (kjent)». De regnes aldri som bestått i L3a.
2. **L3b** = nytt trinn i `scripts/ci-supabase-local.sh`, kjørt *etter* L3a: `bash scripts/test-db-isolated.sh tests/db/data002d-field-map.test.ts tests/db/econ005b-rights.test.ts -t "oppgradering fra eldre tilstand|oppgradering — eksisterende" --reporter=json --outputFile=$W/l3b.json`. Skriptet oppretter en midlertidig, lokal PostgreSQL-klynge (127.0.0.1, tilfeldig port, trust, slettes etterpå) med PostgreSQL-binærene som ligger på runneren (ubuntu-latest har PostgreSQL installert; **ikke verifisert her**; ingen installasjon, mangler binærene blir L3b «IKKE KJØRT»). Rå utskrift går til den private katalogen som øvrige trinn.
3. **Vurdering (`scripts/ci/evaluate.mjs`), uten å svekke noe:**
   - L3b er PASS bare hvis vitest-JSON viser *nøyaktig de seks navngitte testene* (fullName-sett lik en fast liste i koden) som `passed`, 0 feilet, 0 hoppet over, og «OPPGRADERING OK» fra klyngeskriptets egen forhåndskontroll finnes.
   - **Samlet L3 = PASS** krever: L3a uten feil, og at settet av *kjente hoppede* i L3a er **identisk** med settet av *bestått i L3b* (en test som hoppes i L3a men ikke kjøres/består i L3b, eller en ukjent hoppet test, gir SKIPPED/FAIL). Alt annet er som i dag: FAIL/SKIPPED/NOT_RUN teller ikke som bestått, og samlet PASS krever PASS i L1, L2, L3, L7.
   - Rapporten viser L3a og L3b hver for seg, med tydelig tekst: «6 testet i isolert PostgreSQL-klynge (PostgreSQL <versjon>, shim), ikke i Supabase-stakken».
4. **Skriptherding (samme fase):** `test-db-isolated.sh` skriver i dag «OPPGRADERING FEIL» uten å avslutte med feil → gjøres til exit ≠ 0 (ellers vakuøst grønt mønster, som P2-funnene).
5. **Valgfritt trinn L3c (ikke del av PASS, kun informasjon):** forsøk samme seks mot Supabase-stakkens Postgres med scratch-database *hvis* `postgres`-rollen kan opprette databaser. Rapporteres separat som «forsøkt/ikke mulig»; endrer ikke L3-vurderingen. Bør bare gjøres etter første ekte kjøring har vist hva stakken tillater.

## 3. Alternativer vurdert
| Alternativ | Vurdering |
|---|---|
| A. Sette `SCOUT_DB_ISOLATED=1` mot Supabase-stakken | enkelt, men ukjent rettighets-/kollisjonsrisiko, og tester kjøres da mot en delt stakk med shim — frarådes som PASS-grunnlag |
| **B. L3b i egen isolert klynge (anbefalt)** | seks tester kjøres faktisk, trygt og slettbart; ærlig merket som ikke-Supabase |
| C. Skille ut de seks som egen vitest-konfig/fil | ren organisering, men ingen ny kjøring; kan gjøres senere |
| D. Akseptere «6 hoppet over, kjent» som permanent delvis | ikke bestått; samlet PASS umulig — dagens tilstand |

## 4. Tester og bevis (til implementeringen)
- **Statisk/enhet:** `evaluate.mjs` med fixtures: seks bestått ⇒ L3b PASS; én feilet ⇒ FAIL; én hoppet ⇒ FAIL; sjette mangler ⇒ FAIL; ekstra ukjent test ⇒ ikke PASS; L3a-hopp som ikke dekkes av L3b ⇒ L3 ikke PASS; L3b ikke kjørt ⇒ NOT_RUN og L3 ikke PASS; «OPPGRADERING OK» mangler ⇒ FAIL. `evaluateDir` med manglende `l3b.*` ⇒ samlet ikke PASS.
- **Feilinnsetting i ekte isolert klynge (kjørbar her):** en endret migrasjonskopi (`MIGRATIONS_DIR`, som `test-db-mutations.sh`) som får minst én av de seks til å feile ⇒ L3b FAIL; og normaltilfelle ⇒ 6 bestått.
- **Statisk workflowtest:** ingen ny trigger/secret/action; trinnet bruker ikke nettverk eller hosted.
- **Emulert orkestrering** (`test-ci-orchestrator-offline.sh`) utvides slik at L3b kjører ekte i den isolerte klyngen (L3a feiler fortsatt i emuleringen uten Auth/PostgREST, samlet fortsatt «IKKE FULLT BESTÅTT»).
- Skillet statisk / emulert / isolert klynge (ekte PostgreSQL, ikke Supabase) / **ekte Supabase (ingen kjøring ennå)** holdes i rapporten.

## 5. Begrensninger og risiko
- L3b bruker PostgreSQL 16 + shim, ikke Supabase-imaget (kan ha annen versjon/utvidelser); det dekker migrasjonslogikken, ikke Supabase-spesifikk oppførsel.
- Runnerens PostgreSQL-binærer er ikke verifisert; fravær ⇒ L3b IKKE KJØRT ⇒ L3 ikke PASS (ingen stille omgåelse).
- Ekstra kjøretid ca. 1–2 min (estimat; ikke målt på runner). Jobbgrensen (75 min) og trinnsgrensene justeres.
- Dette løser ikke L4–L6, Playwright eller hosted (H1–H4), som står åpne.

## 6. Beslutninger fra Christian
1. Godkjenner du B (L3b i isolert klynge) som måte å faktisk kjøre de seks på, med L3 = PASS bare når L3a ok **og** L3b kjører nøyaktig de seks og alle består?
2. Skal L3c (forsøk mot stakken, kun informasjon) tas med nå eller vente til etter første ekte kjøring? (Anbefaling: vente.)
3. Er det greit at jeg herder `test-db-isolated.sh` (exit ≠ 0 ved «OPPGRADERING FEIL») i samme runde?
Estimat: ≈ 0,5 dag implementering + tester + review. Ingen av dette starter før du har svart.
