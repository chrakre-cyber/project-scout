# ECON-002 — avslutningsrapport

**Status: DONE innen avtalt omfang** (19.10.2026). **TAX-fundamentet forblir REVIEW.** Sluttcommit: se commit som inneholder denne filen (bygger på `5967fc2ba2c82fe026b31d94f7a637bfe1690025`; ingen runtime-endring etter den). ECON-003 og ECON-004 er ikke startet.

## Avtalt omfang (levert)
Norsk engangsavgift 2026, personbil i avgiftsgruppe a, for de tre validerte profilene **PB-DIE, PB-BEV og PB-PHEV**:
- Ren desimalmotor `src/domain/tax/` (`calculateNorwegianVehicleTax`), regelregister/kilder med hash i `docs/tax/` (E1-kilder T03–T52).
- **Sju regler uttrykkelig godkjent av Christian 2026-10-19** innen avgrenset omfang: R-OTA-001, R-OTA-002 (WLTP, hele g/km), R-OTA-005, R-OTA-007, R-OTA-010 (trinndato finnes, under 20 år), R-IMP-OTH-001, R-OTA-014 (sluttkravet).
- **Tre klasse 1-referanser** (C1-GR-20261018-01…03; `explicit_inputs`, kjøredato og norsk registreringsdato brukerbekreftet); klasse 1-dekning kontrolleres per kjøretøyprofil.
- Resultat `approved`/`calculated` bare ved entydig, dokumentert input; **estimat** (aldri approved) ved forhandleroppgitt/referanse-/ukjent vekt og ved datofølsomt månedsbeløp (policy 2026-10-19).
- **Blokkert:** NEDC/desimal-CO₂ (R-OTA-015), dag 29–31 i tvetydighetsvinduet (R-OTA-016/U-009), 20 år eller eldre, bensin/ikke-ladbar hybrid/annet drivstoff/ukjent undertype, bare registreringsår, varebil og andre grupper.

## Review-belegg
Uavhengig review (Codex), oppgitt av Christian 2026-10-19: a42a30b — to P2-funn (referansevekt; datofølsomt punktbeløp), lukket i fcdb1a8; policy for `dealer_entered` besluttet og reviewet i cc738ef; godkjenningscommit fbf466c med validatorendring — reviewet uten nye funn; profilavgrensing 5967fc2 — siste P2-punkt lukket, ingen nye funn. Rapporten for 5967fc2 er lagt inn uendret som `reviews/ECON-002-profilreview-5967fc2.md` (SHA-256 `efe76d28321141cb8de1cf58198835604e6de32a532be0fe1e4349dd74f3090a`): ingen nye feil; alle tre P2-funn er lukket (de to første i tidligere rettingsreview, profilavgrensningen i denne); 440 selvstendige kontroller mot motoren bestod. Reviewerens forbehold: hele Vitest-suiten, typecheck, lint, build, e2e og DB er ikke kjørt av reviewer (781 tester er utviklerens resultat); dette er en avgrenset rettingsreview, ikke en ny full juridisk eller applikasjonsreview. De tidligere review-rapportene er levert av Christian utenfor repoet og er ikke lagt inn her.

## Akseptkrav
E1-kilder m/hash ✔ · godkjente parametere (sju) ✔ · EV-/PHEV-regler ✔ · marginal CO₂ og sluttavrunding innen omfang ✔ · U-002/U-005 lukket ✔ · tre gyldne caser som klasse 1 ✔ · U-003/U-008 uttrykkelig flyttet til ECON-004 ✔ · restomfang akseptert ✔ · uavhengig review uten åpne funn ✔ · kontroller grønne ✔ (nedenfor).

## PHEV-avgrensning (fra reviewen)
Modellen har én PB-PHEV (ikke separate bensin-/diesel-PHEV-profiler); R-OTA-005 er formulert ut fra stempeldrevet motor og ekstern lading. At én klasse 1-referanse (bensin-PHEV, `explicit_inputs`) dekker profilen betyr ikke at hver variant eller alle mulige input er individuelt testet; referansens faktiske omfang og inputantakelser (bl.a. «vektet kombinert» som motorantakelse) skal fortsatt fremgå, og fremtidige varianter med egne regler vurderes særskilt. Å splitte PB-PHEV etter drivstoff er ikke et krav her.

## Åpne restpunkter med tilhørighet (ingen er løst eller godkjent)
| Punkt | Tilhørighet |
|---|---|
| U-003 (MVA-kildenes årgang, R-DED-001), U-008 (tollkurs, R-IMP-FX-001), U-013 (MVA-avrunding) | **ECON-004** (ikke startet) |
| Mellomavrunding (U-012); NEDC/desimal-CO₂ (R-OTA-015); dag 29–31 (R-OTA-016/U-009); 20-årsminimum (R-OTA-011) — alle blokkert/åpne | **TAX-fundamentet** |
| Bensin (PB-BEN), ikke-ladbar hybrid (PB-HEV, R-OTA-006 E1P), varebiler (VB-*) uten klasse 1 og utenfor støttet omfang; diesel-PHEV uten egen referanse | **TAX-fundamentet** (DONE-porten krever klasse 1 for alle 10 profiler) |
| R-OTA-014: den vedtatte 2007-ordlyden ikke lest direkte; lov 19.6.2026 nr. 41 ikke lest; hjemmelsrekkevidde (rettsanvendelse) | **TAX-fundamentet** |
| Øvrige E1P/E1X/E2-regler og U-001/U-004/U-006/U-007 (dokumentert tidligere) | **TAX-fundamentet** |

## Leveranse
- **Endrede filer (hovedtrekk):** `src/domain/tax/*`, `docs/tax/{rules,sources,references,profiles}.json`, `docs/tax/check-docs.mjs`, `docs/tax/primarkilder/*`, `docs/tax/golden-runs/*`, `tests/tax-*.test.ts`, `tests/econ-002-review-regressions.test.ts`, `tests/fixtures/tax-*.ts`, `reviews/ECON-002*.md`, `DECISIONS.md` (DEC-036), `MVP_BACKLOG.md`.
- **Brukerutfall:** forhandleren får en deterministisk, kildebelagt engangsavgift for PB-DIE/PB-BEV/PB-PHEV, tydelig merket som godkjent eller estimat, og et eksplisitt «ikke beregnet» utenfor omfanget.
- **Begrensninger:** se tabellen over. Ingen live-kalkulatorkjøring av Claude; kalkulatorreferansene er brukerlevert.
- **Kontroller (kjørt ved avslutning):** `node docs/tax/check-docs.mjs` OK; `npx vitest run` 34 filer / 781 tester bestått; `npm run typecheck` og lint rene. Ikke kjørt: build, e2e, DB.
- **Neste oppgave:** ECON-003 (fixturer) og deretter ECON-004 (landed cost; overtar U-003/U-008/U-013) — ikke startet; start etter din beskjed.
