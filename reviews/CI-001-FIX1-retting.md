# CI-001-FIX1 — retting etter review av 9baba31 (21.10.2026)

**CI-001 forblir REVIEW.** Review: `reviews/CI-001-review-9baba31.md` (to P2). Ingen merge/push til `main`, ingen Actions-kjøring, ingen endring av GitHub-innstillinger, ingen hosted migrasjon eller deploy. Ikke utvidet til L4–L6/Playwright. PASS-kravet er ikke svekket. De seks kjente L3-hoppene står uendret som åpne og **ikke bestått**. Økonomiflagg `false`, E7 utsatt, E8 åpent.

## Skille mellom bevistyper (viktig)
| Type | Hva | Hva det IKKE er |
|---|---|---|
| **Statisk** | tekst-/enhetstester av skriptene og vurdereren (`tests/ci-qa-script.test.ts`, `tests/ci-independent-regressions.test.ts`, `tests/ci-evaluate.test.ts`) | ingen kjøring av shellflyten |
| **Emulert** | skriptene kjørt mot isolert PostgreSQL med emulert `npx supabase`/`docker` og innsatte pg_dump-feil (`scripts/test-qa-migrations-faults-offline.sh`, `scripts/test-ci-orchestrator-offline.sh`) | ikke ekte Supabase CLI, ikke containere |
| **Ekte Supabase-kjøring** | **ingen** — workflowen er aldri startet | alt over er ikke L1–L3/L7 mot ekte stakk |

## P2-1 — L7 kunne bli PASS uten registrert build
`evaluateL7(scan, 0, null)` ga PASS. **Retting** (`scripts/ci/evaluate.mjs`): PASS krever `buildRc === 0`. `null`/uleselig exit-kode ⇒ SKIPPED («build ble ikke registrert: build-artefakter er ikke skannet (manglende kontroll)»), feilet build ⇒ SKIPPED med forklaring, FAIL i skannet slår fortsatt gjennom. `rcOf` behandler uleselig exit-kodefil som ikke registrert. Samlet PASS er dermed umulig.
- **Før:** reviewerens test feilet på 9baba31 (`reviews/CI-001-fix1/for-l7-regresjon.txt`: «expected 'PASS' not to be 'PASS'»).
- **Etter (statisk):** reviewerens test (uendret, `tests/ci-independent-regressions.test.ts`) består. Supplement: `evaluateDir` med L1/L2/L3 PASS og alt annet vellykket men uten `build.rc` ⇒ L7 ikke PASS, forklart, samlet «IKKE FULLT BESTÅTT»; tom/uleselig `build.rc` ⇒ ikke PASS; build exit 1/124 ⇒ ikke PASS; normaltilfelle (build 0) ⇒ L7 PASS og samlet PASS; skannefeil ⇒ FAIL; ikke kjørt ⇒ NOT_RUN.

## P2-2 — mislykkede schema-dumper kunne bestå som identiske
`dump > fil` sjekket ikke status, og to tomme/like delvise filer ga «identisk». **Retting** (`scripts/qa-upgrade-check.sh`):
- `dump_to FIL` (alle 6 dumper): lykkes bare hvis pipelinen gir exit 0 (`pipefail`), utskriften er ikke tom **og** fullstendig (avslutningslinjen «PostgreSQL database dump complete»). Ellers `FAIL  schema-dump … er ugyldig (årsak)`, `fails++`, og ingen gyldig fil blir liggende (gammel fil fjernes; markørfil `.ok` settes kun ved gyldig dump).
- `same_schema REF ANNEN …` (alle 5 sammenligninger): krever gyldig dump på begge sider, ellers `FAIL … ikke sammenlignet`; ellers diff. En ugyldig dump kan aldri gi PASS-linje.
- Rå dumper: dump-stderr forkastes, diff-linjer skrives ikke ut (bare antall avvikende linjer); `QA_SHOW_DIFF=1` er lokal opt-in og brukes aldri i CI. Orkestreringens L2-vurdering slipper dessuten bare allowlistede linjer gjennom.

### Før/etter (EMULERT; `reviews/CI-001-fix1/for-…` og `etter-schema-dump-feilinnsetting.txt`)
Øvrige kontroller lykkes i alle løp (45–50 PASS). Skriptet med pg_dump-feil «fra kall N til M»:
| Scenario | FØR (9baba31): skript exit / L2-vurdering | ETTER: skript exit / L2-vurdering |
|---|---|---|
| normal | 0 / PASS (50 PASS) | 0 / PASS (50 PASS) |
| tom dump, exit≠0 (alle dumper) | **0 / PASS** | 11 / FAIL |
| delvis stdout + exit≠0 (alle) | **0 / PASS** | 11 / FAIL |
| tom dump, exit 0 (alle) | **0 / PASS** | 11 / FAIL |
| avkortet dump, exit 0 (alle) | **0 / PASS** | 11 / FAIL |
| bare referansedumpen tom | 5 / FAIL (tilfeldig, via diff) | 6 / FAIL |
| bare én oppgradert dump delvis | 1 / FAIL (tilfeldig, via diff) | 2 / FAIL |
Etter-løpene verifiserer i tillegg: ingen «ALLE KONTROLLER BESTÅTT», minst én FAIL-linje om schema-dumpen, og at ingen rå dump-linje (sentinel `partial_dump_sentinel`, `CREATE TABLE/POLICY/FUNCTION`, `SET statement_timeout`) finnes i utskriften. Det alvorlige hullet var altså at alle dumper feiler likt (PASS på før-siden).
- **Statisk:** `tests/ci-qa-script.test.ts` (4): ingen `dump > $OUT…`, 6× `dump_to`, 5× `same_schema`, `diff` bare i hjelpefunksjonen, status-/tom-/fullstendighetskontroll finnes, diff-opt-in. Mutasjonskontroll: gjeninnføring av `dump > …` og fjerning av tom-sjekken fanges begge.

## Øvrige kontroller (utvikler, ikke review)
- `npx vitest run`: **77 filer / 1 727 tester** (10 nye), `tsc --noEmit` og `eslint .` uten feil.
- Emulert orkestrering (`scripts/test-ci-orchestrator-offline.sh`, ekte `npm run build`) etter retting: 8/8 kontroller; L1/L2/L7 BESTÅTT og L3 FEILET (Auth/PostgREST finnes ikke i emuleringen), samlet IKKE FULLT BESTÅTT, ingen falske nøkler i utskrift/sammendrag.
- Ikke kjørt: workflowen, ekte `supabase start`/CLI, Docker, ekte GoTrue/PostgREST, ekte pg_dump-feil i container.

## Begrensninger
1. Fullstendighetssjekken forutsetter at pg_dump skriver avslutningslinjen (alle plain-format-versjoner gjør det); ekte container-pg_dump er ikke prøvd.
2. Første ekte kjøring kan avdekke andre forskjeller mellom emulering og ekte CLI.
3. L3: seks kjente hoppede tester er fortsatt åpne og regnes ikke som bestått ⇒ samlet PASS er ikke mulig før de er løst eller eksplisitt akseptert (egen beslutning).
4. Aktiveringsstegene er uendret (`reviews/CI-001-leveranse.md`): review → Christians kontroll av Actions-innstillinger → workflowfil på `main` → manuell start.

## Endrede filer
`scripts/ci/evaluate.mjs`, `scripts/qa-upgrade-check.sh`, `scripts/test-qa-migrations-offline.sh`, `scripts/test-qa-migrations-faults-offline.sh` (ny), `tests/ci/emulated-cli/docker`, `tests/ci-independent-regressions.test.ts` (reviewer + supplement), `tests/ci-qa-script.test.ts` (ny), `reviews/CI-001-review-9baba31.md`, `reviews/CI-001-fix1/*` (før/etter-utskrifter og `diff.patch`). Ingen workflow-, app-, domene- eller migrasjonsendring.
