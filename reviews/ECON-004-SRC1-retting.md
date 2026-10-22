# ECON-004 — rettingsrapport etter SRC1-review av 76200ff (status: REVIEW, ikke DONE)

Review: `ECON-004-SRC1-Codex-review-76200ff` (to P2). **Økonomiflaggene er fortsatt `false`, ingen regel/parameter er godkjent, avgiftsmotoren og ECON-003-fixturene er uendret, U-013 er åpen, ECON-005 er ikke startet.**

## P2-1 Akseptdatoens status var knyttet til tollkursgrenen
**Årsak:** `customs_acceptance_date_unknown` og `customs_acceptance_date_expected` ble satt inne i `checkQuote` (tollkursvalideringen), som ikke kjøres for NOK eller kursfallback.
**Retting:** statusen registreres nå i hovedflyten rett etter at `customsDate` er tolket, uavhengig av valuta og kursgren (`landed-cost.ts`). `checkQuote` kontrollerer bare perioden (utenfor periode ⇒ blokkert; manglende periode ⇒ `customs_fx_period_missing`). Årsakene registreres én gang (testet). Faktisk oppgitt dato består i alle grener.
**Konsekvens:** NOK-kall og fallback-kall uten akseptdato er nå `incomplete` (tidligere feilaktig `estimate`/`validated` med approved profil); forventet dato gir `estimate` også uten kursperiode. Datoen gjelder tidfesting av tollavgiftssats og mva.-regler (mval. § 3-29 (2), tollavgiftsloven § 2-2), ikke bare kurs.

## P2-2 Ukjent håndtering ga scenario som motsier akseptert fradragsrett
**Retting:** ved ukjent `vatHandling` filtreres «ikke registrert» bort når akseptert fradragsstatus er `recoverable` (mval. § 8-1: fradragsrett forutsetter registrert avgiftssubjekt). Håndteringen forblir `unknown`, `accepted: false`, `vat_handling_unknown` og status `scenarios` (selv med én rad) — registrering anses ikke bekreftet. Nytt felt `importVatSettlement.excludedScenarios` oppgir hva som er utelatt og hvorfor. Ved `non_recoverable` eller ukjent fradragsrett vises begge kanaler som før. Eksplisitt selvmotsigelse blokkeres fortsatt (`inconsistent_vat_status`).

## Tester
- `tests/economics-src1-review-regressions.test.ts`: reviewerens 4 tester (uendret) + 4 utvidelser (alle grener × faktisk/forventet/ukjent dato, ingen duplikater, scenariofiltrering per fradragsstatus, eksplisitt håndtering upåvirket).
- To egne tester er justert fordi de beskrev den feilaktige atferden eller manglet et nødvendig input: (a) i `economics-source-driven` forventet «kun fradrag oppgitt» to kanaler ved `recoverable` — nå én rad + `excludedScenarios` (non_recoverable gir fortsatt to rader, testet); (b) `base` i `economics-review-regressions` fikk `customsDate` (actual) slik at kontrolltilfellet «validated» fortsatt er uten dato-årsak. Ingen beløpsforventning og ingen ECON-003-forventning er endret.
- Kontroller: se avslutningsrapport (fullt repo vitest, typecheck, eslint, check-docs).
