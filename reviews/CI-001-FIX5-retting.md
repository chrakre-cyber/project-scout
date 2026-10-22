# CI-001-FIX5 — L4-sjekkidentitet uten HOPP-begrunnelse (re-review av 2541031, ett P2; til uavhengig review, 21.10.2026)

**CI-001 forblir REVIEW.** Stoppet før aktivering: ingen Actions-kjøring, ingen endring på `main`, ingen GitHub-innstillinger, ingen hosted migrasjon/deploy. L3c utsatt, økonomiflagg `false`, E7 utsatt, E8 åpent. Ingenting er kjørt mot ekte Supabase eller nettleser i denne runden.

## Funnet (`reviews/CI-001-TRINN3-review-2541031.md`, registrert)
`scripts/ci/e2e-plan.json` hadde for L4-sjekken om gjenbruk av gammel sesjon etter utlogging et navn med emulatorens HOPP-begrunnelse som suffiks (` — emulatoren validerer bare JWT-signatur/utløp …`). Planen var generert fra emulatorutskriften. Produsenten skriver det korte navnet i ekte modus ⇒ et helt vellykket ekte L4-løp ga MANGLER + UVENTET ⇒ FAIL.

## Retting (avgrenset)
- **Én tekstendring i `scripts/ci/e2e-plan.json`:** suffikset fjernet; identiteten er skriptets stabile navn. Begrunnelsen er fortsatt separat: `parseE2E` splitter HOPP-/FEIL-linjer på kjent navn + ` — `, og årsaken kommer ikke i identiteten. Evaluatoren er **ikke endret**; ingen prefiksmatching og ingen aksept av ukjente navn (nøyaktig én forekomst, reell modus og J3 ⇒ DELVIS er uendret).
- **Kontroll av alle tre planer mot produsentene (ikke bare L4):** ny `tests/ci/e2e-producers.ts` leser alle `check(…)`/`skip(…)`-kall (bokstavelige strenger og malliteraler; `${…}` ⇒ jokertegn) direkte fra `tests/e2e/{l4-browser,econ006,econ006d}.e2e.mjs`. Resultat: l4 13 kall, econ006 88, econ006d 19. **Eneste avvik var L4-navnet**; alle øvrige planlagte identiteter (inkl. valgfritt variantpar og J3) dekkes av et produsentkall, og alle produsentkall dekkes av planen.
- **Nye tester:** reviewerens `tests/ci-trinn3-independent-regressions.test.ts` (2; kun `!` lagt til for strikt `tsc`) og `tests/ci-e2e-producers.test.ts` (17): plan↔produsent i begge retninger for hver nøkkel; ingen duplikater; ingen begrunnelse i identitet; ekte L4 med skriptets egne navn ⇒ PASS; emulator ⇒ FAIL; HOPP på revokeringssjekken ⇒ SKIPPED; navn med tilføyd suffiks eller avkortet navn ⇒ FAIL (ingen prefiksmatching); J3-HOPP ⇒ PARTIAL, J3-navn lik produsentens.

## Før / etter
| | Før (2541031) | Etter |
|---|---|---|
| Reviewerens to regresjoner + nye produsenttester (19) | **8 feilet**, 11 bestått | 19 bestått |
| `npx vitest run` | (1 901 bestått, men uten produsentkontrakt) | **86 filer / 1 920 tester bestått** |
| `tsc --noEmit`, `eslint` | 0 / 0 | 0 / 0 |
| `qa-secret-scan.sh` | INGEN FUNN | INGEN FUNN |
| `scripts/test-ci-orchestrator-offline.sh` (emulert) | alle bestått | alle bestått |

## Begrensninger
Ikke kjørt: ekte Supabase, nettleserløp i ekte modus, Actions. Emulatorløpene er ikke gjentatt (ingen endring i skriptene). Sjekkplanen er nå kontrollert mot **kildekoden** til produsentene, ikke mot en faktisk ekte-modus-utskrift; først et ekte løp bekrefter det. Reviewers merknad om at skjermbilder skrives midlertidig under kjøringen (ingen varig lagring/opplasting) er riktig og gjelder uendret.

## Neste oppgave
Re-review av FIX5. Deretter (egen godkjenning) PR med bare workflowfila/skriptene og én manuell kjøring.
