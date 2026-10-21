# Testplan og pilotport

03.10.2026. Ingen tester er utført ved levering av denne dokumentpakken. Testbevis legges til når kode og referansecaser finnes. Kontrollør kjører samme relevante kontroller på den faktiske leveransen, ikke bare leser utviklerens rapport.

## Testmatrise

| Område | Minstekontroll | Aksept / belegg |
|---|---|---|
| Agentflyt | Opprett, hent, rediger, pause, ugyldig input, maks 10 og samtidige aktiveringer | Tilstand og serverkontroll korrekte; G1 |
| Firmatilgang | Firma A/B med vanlige sesjoner; les/skriv, ID-manipulasjon, membership og serverjobb | Ingen cross-tenant tilgang; direkte DB/RLS og serverruter kontrollert |
| Marketplace | Gjentatt/samme annonse, endret pris/tekst, sider, >2 000 treff, 404, auth, kvote, timeout | Ingen stille truncation, duplikat eller checkpoint-tap |
| Kritiske felt | Ukjent prisgrunnlag, dato med bare år/måned, CO2-metode, miles/km, valuta, manglende vekt | Ukjent forblir ukjent; feil profile/felt kan ikke gi marginvarsel |
| Kost/avgifter | Minst 50 beregningstilfeller inkl. relevante alders-/satsgrenser og drivlinjer | Uavhengig fasit for alle pilotprofiler; ingen uforklarte avvik |
| Mva./bidrag | Retail inkl./eks. mva., importfradrag, salgsgrunnlag, utenlandsk netto/brutto, utlegg og reserve | Ingen dobbeltelling; ukjent fradrag/salgsprofil blokkerer bidrag |
| Regler og kurs | Versjoner, virkningsdato, foreldet kurs/regelsett, tollkurs vs handel | Resultat kan reproduseres fra snapshot; utløpt regelsett blokkerer |
| Score | Grenser, hardfilter, T=0, negativ/ukjent margin, manglende km | 0–100, forklarbare delpoeng, varselport uavhengig av score |
| LLM | Minst 30 fasittekster, negasjon, motstrid, injection, ugyldig JSON og belegg | Ingen oppdiktede kritiske claims; alle kritiske innlagte claims flagget |
| Varsler | Retry, dobbeltjobber, crash før/etter ekstern send, pause og feil mottaker | Unik outbox; ingen kjente duplikater; ukjent levering avstemmes |
| Drift | Jobblås, retry-budsjett, kvoter, failed run og én ødelagt annonse | Synlige feil, normal data bevart, gjenstart gir ingen tap |
| Gjenoppretting | Backup/restore eller dokumentert leverandørmekanisme; replay i testmiljø | Faktisk prøvd gjenoppretting for konfigurasjonen som skal brukes |
| UI | Tre skjermer, demo-banner, estimat/unknown, dato/kilde, mobil/desktop | Forhandler kan forstå prisgrunnlag og åpne originalannonse |

## Tre datasett med forskjellig bevisverdi

1. Syntetisk mock: minst 100 interne annonser og 10 ulike agentoppsett. Tester flyt, dedup, rangering og grenser. Beviser ikke mobile.de-format eller avgiftsfasit.
2. Adapter-fixturer/testkonto: representative dokumenterte responser, deretter godkjente live-annonser. Tester mapping, dekning og feilbilder.
3. Avgifts-/mva.-referanser: input, dato, kilder og uavhengig forventet output. Skatteetatens kalkulator er referanse for avgiftsdelen; salgsmva., fradrag og bidrag krever egne dokumenterte referanser.

## Feilnivåer

- P0 kritisk: firmalekkasje, secrets-eksponering, vesentlig feil mva./margin, uautoriserte data eller systematisk feil varsling. Stopper reell pilot/berørt funksjon.
- P1 alvorlig: manglende annonser, uklare kalkyleforutsetninger, checkpoint-feil eller ikke håndtert truncation. Må rettes før relevant pilotflyt.
- P2 mindre: kosmetikk som ikke endrer forståelsen. Kan stå med eier/dato etter pilotport.

## Gate B — må dokumenteres

QA-001–QA-003 består. QA-004 kontrollerer full flyt mot godkjent live-kilde, støttede profiler, bekreftede pilotmottakere og faktisk deploy. Ingen åpne P0/P1 for pilotens flyt. Retensjon/datarettigheter er avklart, driftsstatus er synlig, og pause/gjenoppretting er kontrollert. Christians sign-off gjelder pilotomfang, ikke en påstand om juridisk sertifisert avgiftsmotor.

## Rapportmal

Commit / miljø / dato / utfører / dataset / kommando eller kontrollmetode / forventet / faktisk / avvik / severity / retting / retest / gatebeslutning.

Test uavhengige invariants og offisielle grenser; ikke bare kopier samme formel i både implementering og test. Featurearbeid stopper i siste QA-sprint til kritiske feil er lukket.


## SEARCH-005 — kontroller

`npx vitest run` (540 ikke-DB-tester), `bash scripts/test-db-isolated.sh tests/db/search-drafts.test.ts tests/db/qa-catalog.test.ts` (isolert klynge, uten Docker/Supabase), `bash scripts/test-db-mutations.sh` (seks bevisste feil må oppdages), `bash scripts/test-e2e-search005.sh` (nettleserflyt med Auth/PostgREST-emulator mot isolert PostgreSQL). `npm run test:db` mot lokal Supabase kjører `tests/db/search-drafts.test.ts` sammen med de øvrige DB-testene (IKKE kjørt av Claude: ingen Docker).

## Syntetiske demodata: epoke og fornyelse (ECON-006e)
- `tests/synthetic-epoch.test.ts`: epoke ≤ nå uten toleranse (eksakt nåtid ok, +1 s avvist), format, gulv (profil/datasett), vindu 0–48 t, monoton avbildning, uendret innhold/`modifiedAt`, uendret kandidat-id/revisjon mot baseline (`tests/fixtures/synthetic-identity-baseline.json`), uendret retensjon (utløp i [epoke+5 d, epoke+7 d]), fail-lukket ved ugyldig/fremtidig epoke, ingen rullering (ulik klokke, statisk skann).
- Nettleser (`scripts/test-e2e-econ006.sh`, `…006d.sh`): den uendrede appen med `SCOUT_SYNTHETIC_EPOCH`; negative løp: utløpt epoke, fremtidig epoke, ugyldig format, uten variabel (forventning utledet fra standardepoken). Emulator ≠ Supabase.

## CI for lokal Supabase (CI-001)
- `tests/ci-workflow.test.ts` (rammer: kun `workflow_dispatch`, `contents: read`, ingen secrets/actions/artefakter/hosted, ingen lekkasjekommandoer), `tests/ci-sanitize.test.ts`, `tests/ci-evaluate.test.ts` (feil/hoppet over/ikke kjørt ≠ bestått; ingen hemmeligheter i rapport).
- Emulerte tørrkjøringer uten Docker: `bash scripts/test-qa-migrations-offline.sh` (L2-logikk), `bash scripts/test-ci-orchestrator-offline.sh` (orkestrering). De er IKKE L1–L3/L7 mot ekte Supabase.
- CI-001-FIX2 (L3b): `tests/ci-l3b.test.ts` (statisk vurderingslogikk), `bash scripts/test-l3b-faults-offline.sh` (ekte midlertidig PostgreSQL-klynge, IKKE Supabase), `bash scripts/test-ci-orchestrator-offline.sh` (emulert orkestrering). Ekte Supabase-/Actions-kjøring: ikke utført.
- CI-001 trinn 1: `tests/db/auth-gotrue.test.ts` (L4a) og `tests/db/rest-isolation.test.ts` (L6) kjøres i L3a mot ekte stakk; offline mot ekte PostgREST-binær (IKKE Supabase): `POSTGREST_BIN=… bash scripts/test-rest-isolation-offline.sh` og `…-mutations-offline.sh`. Ekte Supabase-kjøring: ikke utført.
- CI-001 trinn 2: nettleserløp med `playwright-core` + forhåndsinstallert Chrome. Emulator (IKKE Supabase): `scripts/test-e2e-econ006*.sh` (PW-sti) eller `E2E_SUPABASE_MODE` uten `real`. Ekte lokal Supabase (ikke kjørt ennå): `bash scripts/test-e2e-real-supabase.sh <l4|econ006|econ006d>`; exit 3 = IKKE KJØRT, 4 = delvis (HOPP).
- CI-001 trinn 3: `scripts/ci-supabase-local.sh` kjører `l4`, `econ006d`, `econ006` etter L7 og vurderer dem som L4b/L5a/L5b/L5 (`scripts/ci/e2e-plan.json`, `evaluate.mjs`). Offline: `npx vitest run tests/ci-e2e-integration.test.ts` og `bash scripts/test-ci-orchestrator-offline.sh` (emulert, uten nettleser ⇒ IKKE KJØRT). Ikke kjørt i Actions eller mot ekte Supabase; J3 holder L5 delvis.
- CI-001 **DONE innen avgrenset omfang** (21.10.2026): kjøring 39629190050 (commit `c2dd683`), samlet PASS for L1–L7 etter L3a/L3b-modell på lokal Supabase i GitHub-runner. Ikke hosted (H1–H4 = HOST-001), L3c utsatt. Observatørproxyen brukes bare i econ006/L5a. Se `reviews/CI-001-avslutning.md`.
- HOST-001 (forberedelse, ikke kjørt mot hosted): `npx vitest run tests/hosted-*.test.ts` (målvalidering, gate, rapport, CLI med falske avhengigheter, statiske sperrer) og `bash scripts/test-hosted-offline.sh` (inspeksjon/DATA-002D/opprydding mot isolert PostgreSQL, IKKE Supabase). Kjøreinstruks: `docs/econ/hosted-kjoreinstruks.md`.
