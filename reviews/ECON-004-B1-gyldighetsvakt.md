# ECON-004 B1 — gyldighetsvakt for akseptdato (20.10.2026)

**Status: REVIEW; ikke godkjenning.** Økonomiflaggene er `false`; ECON-002 (`src/domain/tax`), ECON-003-fixturer og avrundingspolicy er uendret; ECON-005 er ikke startet. Utviklerens kontroller (ikke uavhengig review): se nederst.

## Hva som er endret
- **Ny `src/domain/economics/validity.ts`** (ren): `DOCUMENTED_RULE_PERIOD` = 2026-01-01…2026-12-31 (inklusive), `isWithinDocumentedPeriod(dateIso)`. Dokumentert grunnlag: mva.-vedtaket «Budsjettåret 2026» (T76/T77/T80), elbilgrensen fra 1.1.2026 (T71/T63; 2027 er bare et varsel, T75), Tolltariffen 2026 (T83).
- **`landed-cost.ts`:** akseptdato (`actual_acceptance`/`expected_scenario`) utenfor perioden ⇒ `customs_acceptance_date_outside_documented_period` i `incompleteReasons` ⇒ `status = incomplete`. Vakten settes før kursgrenene og er derfor uavhengig av valuta (NOK/EUR), kursfallback og eksplisitt toll (ingen, ikke aktuell, 0, > 0).
- **Ikke-beregnet-kontrakten (eksisterende) for berørte beløp:** `importVat` = `not_calculated` (ingen verdi, ingen scenarier, årsak oppgitt), `importVatSettlement` = `not_calculated`, `importCashRequirement` og `estimatedLandedCost` = `{ kind: "not_calculated", reasons }`, `importVatBaseNok` = `null`. De vises altså ikke som estimat eller som «nedre grense» for et år de ikke er dokumentert for. Kontrakten dekket tilfellet; ingen ny type var nødvendig. Tollverdi, kjøpesum og avgiftsmotorens linje er uendret.
- **Uendret:** ukjent akseptdato (`customs_acceptance_date_unknown`), alle støttede 2026-tilfeller (testet: samme beløp, status og totaler på 2026-01-01, midt i året og 2026-12-31).
- **Tollkursregimet før 3.9.2026 er ikke godkjent og er et eget, uttrykkelig restpunkt (U-008):** for akseptdato i 2026 før 2026-09-03 og valuta ≠ NOK legger kjernen til et varsel (`warnings`); ingen statusendring. Registrert i `rules.json` (U-008-notat) og `docs/econ/landed-cost-core.md`.

## Tester (`tests/economics-b1-validity-guard.test.ts`, 18 tester)
Begge årsgrenser (2025-12-31 ute, 2026-01-01 inne, 2026-12-31 inne, 2027-01-01 ute); utenfor perioden: `incomplete`, årsak, `not_calculated` for mva./oppgjør/totaler/grunnlag — også med godkjent syntetisk profil; forventet dato likt; uavhengig av eksplisitt toll (4 varianter) og av valuta/kursgren (NOK, EUR direkte tollkurs, EUR fallback, EUR uten tollkurs); støttede 2026-tilfeller uendret (tollverdi 108 000, mva. 27 000, `validated` bare med syntetisk godkjent profil); varsel for regimet før 3.9. Mutasjonskontroll (midlertidig): vakten fjernet ⇒ 10 av 18 feiler; vakt bare for dato < 2026 ⇒ 7 feiler; original ⇒ 18 består. Avvik fra tidligere test: raden «akseptdato 2027 ⇒ tollavgift ukjent» i `economics-round34-implementation` er flyttet hit, fordi 2027 nå gir `not_calculated` i stedet for nedre grenser.

## Probe før retting (20.10.2026, kjørt og ikke committet)
Eksplisitt toll, akseptdato 2027-02-01 og 2025-06-01: `estimate`, mva. 27 000 på 108 000. Nå: `incomplete`, `not_calculated`.

## Utviklerens kontroller (ikke uavhengig review)
`npx vitest run` 43 filer / 970 tester; `npx tsc --noEmit`; `npx eslint .`; `node docs/tax/check-docs.mjs` — se pakkens `developer-checks/`. B1 er ikke uavhengig reviewet; den inngår i den konsoliderte reviewpakken (B2).
