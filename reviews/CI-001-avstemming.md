# CI-001 — avstemming mot akseptkravene (21.10.2026) — utkast til gjennomgang

**Ikke DONE.** Dette er en avstemming til gjennomgang; status settes ikke til DONE før den er gjennomgått og eventuelle gjenstående punkter er avgjort. CI-001 står som REVIEW. Kravene er hentet fra `docs/econ/forslag-supabase-actions.md` (§ 3–5, 7–8), `reviews/CI-001-leveranse.md` («Rammer») og de påfølgende planene/pålegg (L3b-løsning, L4–L6/Playwright-plan, J3-beslutninger). Det finnes ikke ett enkelt aksepttavle-avsnitt i backloggen; kildene er listet slik at du kan korrigere utvalget.

## A. Oppfylt (med belegg)
| Krav | Belegg |
|---|---|
| Manuell start, `contents: read`, ingen secrets/tredjeparts-actions/artefakter/betalt runner, ingen hosted | `tests/ci-workflow.test.ts` + `tests/ci-e2e-integration.test.ts` (statiske); kjøringene brukte `ubuntu-latest`, `workflow_dispatch` |
| Én sanert rapport er eneste utskrift; ingen nøkler/sesjonsdata/skjermbilder i logg eller opplasting | `scripts/ci/sanitize.mjs`/`evaluate.mjs` + tester (`tests/ci-sanitize.test.ts` m.fl.), L7 (21 PASS), observatør-sentineltester; 6 offentlige kjøringer uten funn i det sanerte sammendraget |
| Feil/hoppet/ikke kjørt/delvis aldri PASS; krav til identitet per test/sjekk | evaluator med fastlåste lister (L3b 6, L4a 11, L6 14, e2e-plan 12/93/26) + produsentkontrakttester |
| L1 (tom DB → 12 migrasjoner), L2 (oppgradering, 50 PASS) | kjøring 39629190050 |
| L3: L3a uten feil, de seks kjente hoppene dekket av L3b (ikke Supabase), rapportert hver for seg | samme kjøring; L3c utsatt etter beslutning (alt. B) |
| L4a/L4b innlogging (API og nettleser, ekte GoTrue) | 11/11 og 12/12 |
| L5 econ006/econ006d i nettleser mot ekte lokal Supabase | 94 OK og 26/26; J3 faktisk utført via observatør |
| L6 firmaskille via ekte PostgREST (`search_drafts`, `dealer_economics_inputs`, `dealer_economics_profiles`) | 14/14 med de reviewede forventningene |
| L7 hemmelighetsskann inkl. build-artefakter | 21 PASS |
| Tidsgrenser og innloggingsgrense håndtert uten å svekke tester | `login-budget`, jobbgrense 180 min, observert ca. 11,5 min |
| Uavhengig review av leveransen i alle trinn | trinn 1–3, FIX1–FIX7 og diagnostikk: ingen åpne blokkerende funn (se `reviews/CI-001-*-review-*.md`) |
| Samlet PASS med alle åtte kontroller på lokal Supabase i runner | kjøring 39629190050 (første for utvidet pakke; tidligere L1/L2/L3/L7-pakke også PASS) |

## B. Gjenstår innen CI-001 (forslag, ikke avgjort)
1. **Uavhengig gjennomgang av denne kjøringen** (reviewgrunnlag i `reviews/CI-001-forste-samlede-pass/`; reviewer må hente originalloggen).
2. **Workflow og skript er ikke på `main`:** filen på `main` er den gamle kopien fra PR #4; kjøringene har gått fra arbeidsgrenen. Om/hvordan CI skal kunne startes fra `main` (PR eller annen vei) er en beslutning som ikke er tatt — ingenting er merget.
3. **Opprydding av `partialInReal` for J3** (planen) — først etter review og din beslutning; påvirker ikke PASS.
4. **Dokumentstatus:** `forslag-supabase-actions.md` (planlagte artefakter/SHA-festede actions er erstattet av «ingen artefakter/ingen tredjeparts-actions»; avviket er begrunnet i leveransen), plan-docene og TEST_PLAN oppdateres til endelig tilstand når avstemmingen er godkjent.
5. **Stabilitet:** bare én vellykket kjøring av den utvidede pakken. En eventuell ekstra kjøring er en valgfri beslutning, ikke et formelt krav i kildene.
6. **Runner-avhengighet:** forhåndsinstallert Chrome og Docker/Supabase-images er antatt; ved endring gir løpene IKKE KJØRT/FEIL, ikke falsk PASS (ingen automatisk installasjon).

## C. Hører til hosted-kontrollene (Trinn H, H1–H4) eller andre oppgaver
- Hosted Supabase: konfigurasjon, nettverk, e-postleverandør, rate limits, region, migrasjon mot ekte prosjekt (ÅPEN, separat beslutning; ikke CI-001).
- L3c: de seks oppgraderingstestene mot stakkens egen Postgres (utsatt).
- Pilotklarhet, regel-/parametergodkjenning, avgiftsreferanser, E7 (utsatt), E8 (åpent), økonomiflagg (`false`).
- Årsaken til tidligere 400/21000-avvisning (ubekreftet; ikke et CI-krav).
- ECON-/DATA-/SEARCH-oppgavene som testene dekker, har egne statuser og avstemminger.

## D. Forslag til disposisjon
CI-001 kan vurderes DONE for omfanget «lokal Supabase i GitHub-runner (L1–L7)» når B1 (uavhengig gjennomgang av kjøringen) og B2–B4 er avgjort/utført; B5–B6 er valgfrie/dokumentasjon. Hosted (C) er utenfor. **Ingen status er endret her.**
