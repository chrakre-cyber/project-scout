# Gyldne økonomifixturer (ECON-003)

Fixturer og testaritmetikk for de tre casene (PHEV, EV, diesel). **Ingen parallelle sannheter:** fixturene refererer `tests/fixtures/tax-golden.ts` (ECON-001 §7-tall) og `tests/fixtures/tax-calculator-observations.ts` (dokumenterte kalkulatorobservasjoner 18.10.2026, klasse 1-referansene i `docs/tax/references.json`).

| Fil | Innhold |
|---|---|
| `tests/fixtures/econ-golden.ts` | `ECON_CASES` (kobling CASE-00x ↔ GR-20261018-0x), låste oppgitte offisielle verdier (`OFFICIAL_STATED_LOCK`), B-forventninger (`MEROVO_DEFAULT_EXPECTED`), kurs-rolle-scenario (`FX_ROLES_SCENARIO`), fixturekurs (`FIXTURE_FX`) og åpne punkter (`OPEN_ITEMS`) |
| `tests/fixtures/econ-arithmetic.ts` | Uavhengig, eksakt testorakel (rasjonale tall med bigint). **Ikke produksjonskode og ikke landed-cost-kjernen (ECON-004).** |
| `tests/econ-golden-fixtures.test.ts` | 20 tester: lås, A1-aritmetikk, avrundingsdokumentasjon, motor-kryssjekk, observert sumidentitet, B-scenarioer, kurs-roller, åpne punkter |

## A. Offisiell beregningsreferanse (transport 0)
- **A-observert** (dokumentert): PHEV 600 000/2 600 000, EV 350 000/300 000, diesel 350 000 NOK; kjøredato og norsk registreringsdato 18.10.2026 brukerbekreftet; skjermbildekoblinger (SHA-256 i `docs/tax/golden-runs/2026-10-18/MANIFEST.json`); inputantakelser (bl.a. CO₂-metode for PHEV) bevart. Observert sumidentitet: avgift + pris + mva. = sum.
- **A-oppgitt** (`stated_not_documented`): historiske EUR-casers kjøpesum/mva./total (ECON-001 §7) — oppgitt av Christian, **uten skjermbilder**; låst.
- Ingen kjøretøydata har verified-status (`unverified_test_input`); avgiftsmotoren (ECON-002, uendret) gir estimat fordi vekten er udokumentert forhandleroppgitt testinput.

## B. Merovo-scenario (egne forventninger, ikke offisielle referanser)
Transport 8 000 (`assumed-default`), kontantbehov uavhengig av mva.-tilstand, økonomisk kost for `recoverable` / `non_recoverable`, og `unknown` = ingen enkeltkost (to merkede scenarier). Kurs-roller: `acquisition_fx_rate` og `customs_fx_rate` er adskilte; 10,6709 er fixture-input, tollkursen 10,7000 i rolle-scenarioet er syntetisk.

## Åpne punkter (ikke løst her)
U-013 (mva.-avrunding; «nærmeste hele krone, halvt opp» er en fixture-konvensjon, ingen likhetstilfeller testet), U-003 og U-008 (flyttet til ECON-004), R-IMP-VAT-003 (elbilens 300 000-fritak; CASE-002 er betinget), R-IMP-VAT-002 / R-DED-001 (E1P).
