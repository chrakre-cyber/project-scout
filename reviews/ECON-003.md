# ECON-003 — gyldne økonomifixturer og aritmetikktester

**Status: REVIEW.** Startpunkt: commit `57eee19fbe073a4ca62d70fcc12928782bed1abb` (ECON-002 DONE innen avtalt omfang; TAX-fundamentet REVIEW). Kun fixturer, teststruktur og aritmetikktester. Ikke implementert: landed-cost-kjerne (ECON-004), UI, DB, auth, providere. Ikke endret: avgiftsmotor, satser, omfang, klasse 1-definisjon, godkjenninger, blokkeringer. U-003, U-008 og U-013 er ikke løst.

## 1. Gapvurdering (før implementering)
**Backlogg-rad:** «Gyldne fixturer (3 caser: offisiell reproduksjon + Merovo-utvidelse med transport) og aritmetikktester»; avhengigheter: ECON-001, «D5/kurs bekreftet». **Spesifikasjon:** ECON-001 §4.2–4.3, §6, §7 (A/B), §12, §16 (D1–D8).
| Hva finnes | Hva mangler | Uavklarte forutsetninger |
|---|---|---|
| `GOLDEN_CASES` (ECON-001-tall, EUR-priser, oppgitte offisielle kjøpesum/mva./total) og `OBSERVED_RUNS` (dokumenterte observasjoner, prisversjoner, brukerbekreftet dato, skjermbildekoblinger); tre klasse 1-referanser; avgiftsmotor (ECON-002) | Økonomifixturer som kobler casene (A og B), observerte sum-/mva.-verdier per prisversjon (sum var ikke i fixturen), uavhengig aritmetikkorakel, B-scenarioer (transport, mva.-tilstander, kurs-roller), `docs/econ/` (nevnt i ECON-001 §14, fantes ikke) | **U-013** mva.-avrunding uten kilde; **R-IMP-VAT-003** elbilfritakets anvendelse; **R-IMP-VAT-002 / R-DED-001** E1P; **U-003/U-008** (ECON-004); de historiske EUR-casenes offisielle kjøpesum/mva./total er **oppgitt uten skjermbilder** |
**Avhengighetene «D5/kurs bekreftet»:** D5 (vrakpant inkludert) er bekreftet av ECON-001 og ses i de dokumenterte kalkulatornedbrytningene (vrakpant 2 400 + engangsavgift = total, uten øre); kurs 10,6709 er bekreftet som **fixture-input** (D6), ikke som offisiell kurs. **Ingen blokkering av ECON-003-arbeidet**; de uavklarte punktene er merket i fixturene (`OPEN_ITEMS`) i stedet for å løses.
**To A-lag, ikke én sannhet:** de dokumenterte observasjonene bruker NOK-priser som ikke er de historiske EUR-casenes kjøpesum, mens de historiske caset-verdiene mangler skjermbilder. Derfor er A delt i *A-observert* (dokumentert) og *A-oppgitt* (`stated_not_documented`). Avgiftstotalene (529 069 / 16 748 / 333 723) er felles; de to lagene sammenlignes ikke på mva./total.

## 2. Levert
- `tests/fixtures/econ-golden.ts` (ny): `ECON_CASES` kobler CASE-001/002/003 til `GOLDEN_CASES` og `OBSERVED_RUNS` (samme objekter, ikke kopier); `OFFICIAL_STATED_LOCK` (låst); `MEROVO_DEFAULT_EXPECTED` (B, transport 8 000); `FX_ROLES_SCENARIO`; `FIXTURE_FX`; `OPEN_ITEMS`.
- `tests/fixtures/econ-arithmetic.ts` (ny): eksakt orakel (bigint-rasjonale tall), kun for test.
- `tests/fixtures/tax-calculator-observations.ts` (utvidet): `sum` per prisversjon (observert «Sum»/«Totalpris»).
- `tests/econ-golden-fixtures.test.ts` (ny, 20 tester) og `docs/econ/golden-fixtures.md`.

## 3. Hva testene dekker
**A:** lås av oppgitte offisielle verdier (feiler hvis de endres); ingen verified-status på kjøretøydata; A1-aritmetikk (kjøpesum = EUR × 10,6709, mva. = 25 % av grunnlag, EV minus 300 000, total); råverdier og at andre avrundingskonvensjoner (ned/opp) ikke stemmer med de oppgitte verdiene — uten likhetstilfeller (U-013 forblir åpent); avgiftsmotoren (uendret) gir de oppgitte avgiftstotalene og delingen, med **estimatstatus** (udokumentert forhandlervekt); observerte prisversjoner holdt adskilt; observert sumidentitet og mva.-regularitet uten avrunding; antakelser (CO₂-metode, elbil uten observert CO₂) bevart.
**B:** transport 8 000 (`assumed-default`) og alle seks forventninger per case mot orakelet; kontantbehov uavhengig av mva.-tilstand; `recoverable`/`non_recoverable`/`unknown` (unknown ⇒ `valueNok: null` og to merkede scenarier, ingen oppdiktet kost); A → B-delta (+10 000 kontantbehov; +8 000 / +10 000 økonomisk kost); transport 0 reproduserer offisiell total; B endrer ikke A; dealer-overstyrt transport; CASE-002 er betinget av elbilfritaket (effekten synlig: 18 666 mot 93 666); kurs-roller (syntetisk tollkurs, adskilt fra anskaffelseskurs); åpne punkter eksplisitt.

## 4. Merknader og begrensninger
- B-forventningene er aritmetikk utledet fra A-verdier og ECON-001-regler (E1P/E1X der angitt) — **ikke nye offisielle referanser**.
- Mva.-avrunding: «nærmeste hele krone, halvt opp» er en fixture-konvensjon. Alternativene «ned» og «opp» er utelukket av de oppgitte verdiene, men half-up mot half-even er ikke avgjort (ingen likhet) — U-013 overtas av ECON-004.
- Transport er antatt å inngå i tollverdien; forsikring er 0 (ikke oppgitt). Tollkurs (U-008) er ikke avklart; fixturene bruker samme fixturekurs for begge roller, bortsett fra det syntetiske rolle-scenarioet.
- Orakelet er uavhengig av fremtidig domenekode: ECON-004 skal sammenlignes mot fixturenes *literale forventninger*, ikke mot orakelet.

## 5. Kontroller
`npx vitest run` — 35 filer, 801 tester bestått (781 + 20 nye); `npm run typecheck` rent; lint rent for de endrede/nye filene; `node docs/tax/check-docs.mjs` OK. Uavhengig kryssjekk av råverdier med Python `Decimal` (2 689 248,2053; 366 662,7949; 411 491,2458; mva. 16 665,75 / 102 872,75). Ikke kjørt: build, e2e, DB.

## 6. Blokkeringer
Ingen som hindrer REVIEW. Åpent for ECON-004: U-013, U-003, U-008, R-IMP-VAT-003 (anvendelse), R-IMP-VAT-002/R-DED-001 (E1P).

**Sluttstatus: REVIEW.** ECON-004 er ikke startet.
