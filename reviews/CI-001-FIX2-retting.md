# CI-001-FIX2 — L3b: de seks oppgraderingstestene kjøres i en separat isolert klynge (21.10.2026)

**CI-001 forblir REVIEW.** Implementerer det Christian godkjente (alternativ B i `docs/econ/plan-l3-oppgraderingstester.md`): **L3a** mot Supabase-stakken (uendret) og **L3b** i en separat, midlertidig PostgreSQL-klynge. L3c er utsatt til etter første ekte kjøring. Dette er implementering, ikke aktivering: ingen endring av `main`, ingen Actions-kjøring, ingen GitHub-innstillinger, ingen hosted migrasjon/deploy, ingen automatisk installasjon. L4–L6, Playwright og hosted forblir åpne. Økonomiflagg `false`, E7 utsatt, E8 åpent.

## Hva som er endret
| Fil | Endring |
|---|---|
| `scripts/ci/isolated-upgrade-tests.json` (ny) | de seks testene som **identitet = testfil + fullt testnavn** (5× DATA-002D, 1× ECON-005b) |
| `scripts/ci/evaluate.mjs` (+ `.d.mts`) | `evaluateL3a`, `evaluateL3b`, `combineL3`, `l3bFromDir`; rapport viser **L3a, L3b og L3 samlet hver for seg**; L3b merket «IKKE Supabase» |
| `scripts/ci/run-l3b.sh` (ny) | kjører de to testfilene med `-t`-filter i `scripts/test-db-isolated.sh` → `l3b.json/rc/out/pg.txt`; mangler PostgreSQL-binærer ⇒ `l3b.nobinaries` (ingen installasjon) |
| `scripts/ci-supabase-local.sh` | kaller `run-l3b.sh` etter L3a (rå utskrift til privat katalog, `> /dev/null`); trinnsgrenser 79 min |
| `.github/workflows/supabase-local.yml` | `timeout-minutes: 90` (ellers uendret: manuell trigger, `contents: read`, ingen secrets/actions/artefakter) |
| `scripts/test-db-isolated.sh` | herdet: tomt øyeblikksbilde ⇒ `OPPGRADERING FEIL`, exit 3 (endret øyeblikksbilde ga allerede exit 3) |
| tester | `tests/ci-l3b.test.ts` (23), utvidelser i `tests/ci-workflow.test.ts` (+4), `tests/ci/l3b-fixtures.ts`, tilpasning av eldre L3-tester |
| feilinnsetting | `scripts/test-l3b-faults-offline.sh` (ny), `scripts/test-ci-orchestrator-offline.sh` utvidet |

## PASS-regelen (ikke svekket)
Samlet **L3 = PASS** bare hvis alt dette gjelder:
1. **L3a:** vitest-exit 0, minst én test, 0 feilet, **ingen uventet hoppet test** — kun hopp blant de seks identifiserte er tillatt, og de regnes i L3a selv som *ikke bestått* (status SKIPPED).
2. **L3b:** **hver av de seks** (sammenlignet på `fil::fullt navn`, ikke antall) er faktisk kjørt og `passed`; ingen av dem feilet/hoppet over/mangler; **ingen annen test er kjørt** (utover de som `-t`-filteret utelot); vitest-exit 0; klyngeskriptets «OPPGRADERING OK» finnes.
3. **Dekning:** hver kjent hoppet test i L3a står i settet bestått i L3b (defensiv kontroll).
4. Samlet PASS av hele kjøringen krever fortsatt PASS i L1, L2, L3 og L7 (L7 med registrert, vellykket build).
Manglende PostgreSQL-binærer ⇒ L3b **IKKE KJØRT** ⇒ L3 NOT_RUN ⇒ ikke PASS. Rapporten sier: «IKKE Supabase-stakken: midlertidig lokal PostgreSQL-klynge (<versjon>) med shim».

## Bevis — tre typer holdt adskilt
**1. Statiske tester (fixtures, ingen kjøring av skriptene):** 78 filer / **1 754 tester** består (27 nye), `tsc` og `eslint` uten feil. `tests/ci-l3b.test.ts` dekker: bestått (6 identiteter) ⇒ PASS; én feilet; én hoppet/todo/pending; én mangler (5 av 6 uten feil ⇒ FAIL); omdøpt test/feil fil/seks *andre* bestått tester ⇒ FAIL (antall alene godtas ikke); uventet test kjørt (bestått og feilet) ⇒ FAIL, filtrerte ⇒ ok; exit ≠ 0, manglende «OPPGRADERING OK», ugyldig/manglende rapport ⇒ FAIL; manglende binærer / ikke kjørt ⇒ NOT_RUN; samlet: L3b NOT_RUN/FAIL/L3a FAIL/uventet hopp i L3a/udekket kjent hopp ⇒ ikke PASS; `evaluateDir` uten L3b-filer eller med `l3b.nobinaries` ⇒ samlet IKKE FULLT BESTÅTT. Mutasjonskontroll av vurdereren (5 injiserte svekkelser, bl.a. «tell som bestått hvis tilstede», fjernet uventet-sjekk, fjernet NOT_RUN-regel, fjernet dekningskontroll, fjernet OK-krav) fanges alle.
**2. Emulering (ingen Docker/Supabase):** `bash scripts/test-ci-orchestrator-offline.sh` (ekte `npm run build`, emulert `supabase`/`docker`): 10/10 kontroller. L1/L2 BESTÅTT, **L3a FEILET** (Auth/PostgREST finnes ikke), **L3b BESTÅTT** (kjørte ekte i en midlertidig PostgreSQL-klynge, 6 av 6), **L3 samlet FEILET**, samlet IKKE FULLT BESTÅTT/exit 1, ingen falske nøkler i utskrift eller sammendrag. (`reviews/CI-001-fix2/orkestrering-emulert.txt`.)
**3. Ekte kjøring i midlertidig PostgreSQL-klynge (IKKE Supabase, IKKE Actions):** `bash scripts/test-l3b-faults-offline.sh`: 11/11 kontroller (`…/l3b-feilinnsetting-ekte-isolert-klynge.txt`): normal ⇒ PASS (6 av 6, PostgreSQL 16.14); mutert ECON-005b-migrasjon ⇒ FAIL (testen navngitt som feilet); endret øyeblikksbilde ⇒ FAIL (klyngeskript exit 3, «OPPGRADERING FEIL»); filter som utelater én test ⇒ FAIL; filter uten treff ⇒ FAIL; for bredt filter ⇒ FAIL (uventet test rapportert); `PGBIN` mangler ⇒ NOT_RUN.
**4. Ekte Supabase-/Actions-kjøring:** **ingen.** Workflowen er aldri startet; `supabase start`, ekte CLI, GoTrue/PostgREST, Docker-bildehenting og PostgreSQL-binærene på `ubuntu-latest` er ikke observert.

## Før/etter
| | Før (3e6c059) | Etter |
|---|---|---|
| De seks testene | hoppet over, «L3 SKIPPED», aldri kjørt i CI | hoppet over i L3a (ikke bestått), **kjørt og bestått i L3b** |
| Samlet L3 | kunne ikke bli PASS | PASS bare ved reglene over |
| Antall alene | – | godtas ikke: identitet kreves |

## Begrensninger
1. L3b = PostgreSQL 16 + shim, **ikke** Supabase-imaget (annen versjon/utvidelser mulig). Det beviser migrasjonslogikken for de seks, ikke Supabase-spesifikk oppførsel. L3c (forsøk mot stakkens Postgres) er utsatt.
2. At `ubuntu-latest` har PostgreSQL-binærer er ikke verifisert; mangler de blir L3b IKKE KJØRT og L3 ikke PASS (ingen installasjon, ingen omgåelse).
3. Kjøretid for L3b på runner er ikke målt (sandbox: ca. 2,5 s per L3b-kjøring, målt lokalt).
4. De øvrige begrensningene fra CI-001 gjelder uendret (L2 mot ekte CLI ukjent, offentlig repo ⇒ første kjøring må gjennomgås, L4–L6/hosted åpne).
5. Aktivering krever fortsatt: review → Christians kontroll av Actions-innstillinger → workflowfil på `main` → manuell start (`reviews/CI-001-leveranse.md`).
