# ECON-004 — landed-cost-kjerne (status: REVIEW, ikke DONE)

Startpunkt: ECON-003 DONE ved `9ad2cbd`. Avgiftsmotoren (ECON-002) og ECON-003-fixturene er uendret. Ingen regel eller parameter er godkjent i denne oppgaven.

## 1. Gapvurdering (skrevet før implementasjon)

Nettverkstilgang til toll.no / lovdata.no / skatteetaten.no er blokkert i utviklingsmiljøet (HTTP 000, testet på nytt 19.10.2026). Vurderingen bygger derfor på allerede registrerte og leste kilder (`docs/tax/rules.json`, `sources.json`). Ingen ny primærkilde er lest i denne oppgaven.

Skillet: **K** = kildebelagt regel (nivå i registeret), **P** = produktbeslutning (tas av Christian/produkt, ikke av kilde), **F** = fixturekonvensjon (ECON-001/003, ikke produksjonsregel).

| Punkt | Hva er kildebelagt (K) | Produktbeslutning (P) | Fixturekonvensjon (F) | Konsekvens i kjernen |
|---|---|---|---|---|
| **U-003** MVA-kildenes årgang/anvendelse | R-IMP-VAT-001: 25 % av tollverdi (E1P/E1X, T33). Mva.-håndbok 2025-utgave (T22, T35) og 2023-utgave (T36) er lest delvis; hvilken årgang som gjelder for en gitt registreringsdato er ikke avgjort. | Hvilken kilde som er autoritativ per beregningsdato. | — | `vatRulesApproved=false` i registeret ⇒ `vat_rules_unapproved` på alle resultater; `validated` er uoppnåelig. Satsen står som navngitt konstant med regel-ID. |
| **U-008** tollkurs, kursdato, syklus | R-IMP-FX-001 (E2): tollverdi i NOK = valuta × Tolletatens kurs; betalingskurs er en egen kostnad. Hvilken dato/syklus som velger kursen er ikke lest (T23, T24). | Hvilken dato som styrer (deklarasjon, ankomst, registrering) og om kursen hentes av oss eller oppgis av forhandler. | Samme kurs 10,6709 for begge roller i de offisielle casene; syntetisk tollkurs 10,7000. | To adskilte roller (`acquisition`/`customs`) med kilde, `effectiveAt`, `quotedAt`, `validUntil`. Ingen standardkurs. Fixture-kurs avvises uten testflagg. Manglende tollkurs ⇒ ufullstendig; fallback til anskaffelseskurs kun som uttrykkelig valg ⇒ estimat. `customs_fx_rule_unconfirmed` til U-008 er avgjort. |
| **U-013** MVA-avrunding | Ingen lest kilde angir hvordan import-mva. avrundes (rules.json note). Skattebetalingsforskriften § 10-4-4 (ned til hel krone) gjelder avgiftssluttkravet (R-OTA-014, E1), ikke automatisk mva. | Avrundingsmetode (half-up / half-even / ned) og om kjøpesum og tollverdi avrundes hver for seg. | «Nærmeste hele krone, halvt opp», kjøpesum og tollverdi avrundet hver for seg, så mva. av avrundet grunnlag (ECON-001 §4.3). Valideringsverdiene 16 665,75→16 666 og 102 872,75→102 873 er ikke nedrundet, men er oppgitt, ikke kildebelagt. | Eksplisitt `RoundingPolicy` med status `unconfirmed_convention`. Likhet (x,5) avgjøres **ikke** av policyen: verdien blir nedre grense, begge kandidater vises, resultatet er `incomplete`. |
| **R-IMP-VAT-002** tollverdi/mva.-grunnlag, transport, forsikring | Tollverdi = kjøpspris + frakt + forsikring til norsk grense (E1P; T08, T10, T21, T34); frakt etter grensen og engangsavgift inngår ikke. Sjablongfrakt (T10) er ikke lest i detalj. | Standard transport (8 000 `assumed-default`, ECON-001 §4.4), om forsikring skal ha en standard (ingen), og transaksjonsgebyr/toll i grunnlaget. | Forsikring = 0 som uttrykkelig scenarioantakelse i fixturene. | Transport og forsikring føres **én gang** i kostnadssummen og inngår i tollverdien (merket E1P via `vat_rules_unapproved`). Transport uten oppgave og uten konfigurert standard ⇒ ukjent. Forsikring ukjent (standard) ⇒ nedre grense; 0 kreves som uttrykkelig `scenario_assumption` (⇒ estimatårsak). Tollavgift > 0 ⇒ uavklart mva.-grunnlag (`customs_duty_vat_base_unresolved`). |
| **R-IMP-VAT-003** elbilfritak | 300 000 kr fra 2026-01-01; 25 % over grensen (E1X, T35). Kalkulatorobservasjoner: 350 000 → 12 500, 300 000 → 0. «Kvalifiserende», anvendelse ved innførsel og hvilket beløp grensen måles mot er ikke avgjort. T14 (lovvedtak) ikke lest til bunns. | Om fritaket gjelder forhandlerimport og mot hvilket beløp (tollverdi, vederlag). | CASE-002 B-scenarioer antar fritak mot tollverdi. | Fritak er et scenario: `evExemption` `applies`/`not_applicable`/`unknown` (standard `unknown` ⇒ to merkede mva.-/kontantscenarier, ingen enkeltverdi). Beløp over grensen avkortes ved 0. `applies` ⇒ estimatårsak `ev_exemption_assumed`. Gjelder bare BEV (fra avgiftsmotorens drivlinjeklassifisering). |
| **R-DED-001** fradragsrett, oppgitt status | Fradrag for innførselsmva. på personbil til videresalg følger mval. § 8-4 første ledd bokstav a (E1P; T22, T36, T12). Innførselsmva., varebil og bindingsregler ikke lest. | Hvem som kan oppgi statusen og med hvilken dokumentasjon. | Tre tilstander (`recoverable`/`non_recoverable`/`unknown`) som scenarier i ECON-003. | Standard `unknown`. Bare `dealer_entered`/`dealer_profile` godtas; `listing_claim`/`assumed` ignoreres med advarsel. Fradragsstatus påvirker bare økonomisk kost, aldri import-mva.-beløpet eller kontantbehovet. `deduction_rule_unapproved` til regelen er godkjent. |

### Dokumenter og offisielle URL-er som trengs for å lukke punktene (nettverk blokkert)
- U-008: T23 https://www.toll.no/no/verktoy/valutakurser; T24 https://www.toll.no/no/verktoy/regelverk/handboker/vareforselshandboken/6-12; T10 https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport/betaling-av-avgifter
- U-003 / R-IMP-VAT-001/-002: T11 https://www.skatteetaten.no/globalassets/bedrift-og-organisasjon/avgifter/merverdiavgift/import-mva/beregning-og-bokforing-innforselsmva.pdf; T08 https://www.skatteetaten.no/person/avgifter/bil/importere/andre-avgifter/; T34 https://www.toll.no/no/bedrift/import/deklarering-av-varer/incoterms-2010; T21/T33 https://www.toll.no/no/varer/bil-og-andre-kjoretoy/bilimport
- R-IMP-VAT-003: T35 https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-6; T14 https://stortinget.no/no/saker-og-publikasjoner/vedtak/beslutninger/lovvedtak/2025-2026/vedtak-202526-014/
- R-DED-001: T12/T22 https://www.skatteetaten.no/en/rettskilder/type/handboker/merverdiavgiftshandboken/gjeldende/M-8/M-8-4/M-8-4.3/; T28 .../M-9/M-9-6/M-9-6.2/; T36 (2023-utgave) for årgangssammenligning (U-003)
- U-013: skattebetalingsforskriften § 10-4-4 og merverdiavgiftsloven/-forskriften på https://lovdata.no, samt Tolletatens deklarasjonsregler for avrunding av beregnet mva.

## 2. Leveranse

Ny ren domenekode `src/domain/economics/` (`rational.ts`, `types.ts`, `landed-cost.ts`, `index.ts`). Ingen UI, DB, auth, provider eller ECON-005. Avgiftsmotoren er uendret og brukes via `calculateNorwegianVehicleTax`.

Kontrakt (`calculateEconomics(input, config) → EconomicsResult`):
- **Status**: `blocked` (ugyldig input, ingen totaler) · `incomplete` (delsummer/scenarier, merket) · `estimate` (alt regnbart, men ikke godkjent) · `validated` (kun mulig når *alle* økonomi-flagg er godkjent **og** avgiftsmotoren ga `calculated` **og** ingen estimatårsaker — ikke tilfelle i dag).
- **Totaler** er `value | lower_bound{missing} | scenarios | not_calculated`; en nedre grense kalles aldri full landed cost.
- **Kontantbehov** = kjøpesum (anskaffelseskurs) + transport + forsikring + import-mva. + sum registreringsavgifter + øvrige kjente poster. **Økonomisk kost** = samme, men import-mva. bare ved `non_recoverable`; `unknown` ⇒ scenarioene `if_recoverable`/`if_non_recoverable`.
- **Kjøpsgrunnlag**: annonsert brutto/netto, forhandlerjustert og brukt pris lagres adskilt. Brutto/ukjent annonsegrunnlag gir ikke kjøpesum. Netto eksportpris og fradragsrett utledes aldri fra annonsetekst.
- **Avgiftsmotorens usikkerhet** videreføres: estimat ⇒ `tax_estimate` (+ motorens estimatårsaker i `tax.estimateReasons`), ikke-godkjent profil ⇒ `tax_profile_not_approved`, blokkert ⇒ ingen avgift i summen og `tax_blocked`.
- **Aritmetikk**: bigint/rasjonale tall, ingen float. Beløp: ikke-negative desimalstrenger (≤ 15 heltallssiffer, ≤ 8 desimaler, ≤ 1 000 000 000), kurs 0,000001–1 000 000; alt annet blokkeres. Tekniske skranker er ikke skatteregler.

Konfigurasjon som må avgjøres før `validated` kan nås (alle er i dag `false`/ubekreftet): `vatRulesApproved`, `roundingApproved` (+ `RoundingPolicy.status="approved"`), `customsFxRuleApproved`, `deductionRuleApproved`.

## 3. Kontroller (faktisk kjørt)
- `npx vitest run`: 36 filer, **845 tester bestått** (801 fra før + 44 nye i `tests/economics-core.test.ts`).
- `npm run typecheck`, `npx eslint .`, `docs/tax/check-docs.mjs`: rene.
- Ikke kjørt: build, e2e, DB (ikke berørt av en ren domenemodul). Ingen uavhengig review er gjort.
- Merk: én testforventning (`tax_profile_not_approved` for den godkjente 2026-profilen) var feil og ble rettet i testen; koden var riktig. Ingen ECON-003-forventning er endret. Hånd-/Python-Decimal-kontrollerte literaler: 468 723, 441 723, 379 248, 0,25/0,5/0,75 over 300 000.

## 3b. Rettingsrunde etter uavhengig review av f12d44a (fire P2, status fortsatt REVIEW)
Review: `ECON-004-Codex-review-f12d44a` (konklusjon: behold REVIEW). Alle fire funn ble reprodusert som regresjoner (9 røde mot f12d44a, grønne etter retting; ingen forventning tilpasset koden).
1. **Falsk nedre grense ved ukjent drivlinje**: ukjent drivlinje beholder nå fritaksusikkerheten (`no_exemption` + `with_exemption`, `evExemption` følger input, ikke `not_applicable_vehicle`); nedre grense bygger på laveste mulige mva. (350 000 NOK: 362 500 ≤ 379 248). Uttrykkelig `not_applicable` gir fortsatt full mva. som oppgitt. Egenskapstest: nedre grense ≤ minste verdi blant utfyllinger av ukjent drivlinje/fritak, forsikring, transport, øvrige avgifter og fradrag.
2. **Sen avrundingslikhet i totalen**: likhet i øvrige kostnader (f.eks. 2,5 kr) avgjør nå totalenes entydighet (`rounding_tie_unresolved` i `missing`; totalene blir `lower_bound` med laveste kandidat, kandidatene vises).
3. **`assumed_default`-beløp**: alle `AmountInput` (transport, forsikring, øvrige poster) med basis `assumed_default` gir estimatårsaken `assumed_default_amount`, uavhengig av om verdien kommer fra config eller direkte input.
4. **Fixture-proveniens**: `source.kind = "fixture"` krever `allowFixtureFxQuotes` også uten `fixtureOnly`; manglende/ugyldig `source` avvises; `fixtureOnly` kontrolleres som før.
Ingen endring i avgiftsmotoren, godkjenninger eller åpne kildepunkter. Kontroller: se avslutningsrapport (fullt repo: 37 filer, 856 tester, typecheck, eslint og check-docs rene).

### Rettingsreview (FIX1)
Uavhengig rettingsreview av `cefe290`: `reviews/ECON-004-FIX1-review-cefe290.md`. Alle fire P2-funn lukket, ingen nye blokkerende funn; ECON-004 beholdes som REVIEW fordi produksjonsreglene er uavklarte. Kildebestilling: `docs/tax/ECON-004-kildebestilling.md`.

### Kildejustering etter primærkildepakken
Se `reviews/ECON-004-kildejustering.md` (endringsrapport) og `docs/econ/landed-cost-core.md` (feltenes betydning). Kildepakken er arkivert i `docs/tax/primarkilder/econ004/` (T53–T69; T23, T24, T35, T36 gjenbrukt). Alle økonomiflagg er fortsatt `false`; U-013 er åpen.

### SRC1-retting
Se `reviews/ECON-004-SRC1-retting.md` (to P2: akseptdato uavhengig av kursgren; mva-kanaler forenlige med akseptert fradragsstatus).

### SRC1-FIX1-review og gjenstående behov
Uavhengig review av `bd67c8d`: `reviews/ECON-004-SRC1-FIX1-review-bd67c8d.md` (begge P2 lukket, ingen nye blokkerende funn). Prioritert oversikt over gjenstående kilde- og godkjenningsbehov: `reviews/ECON-004-gjenstaende-behov.md`.

### Kildeavklaring runde 2
Se `reviews/ECON-004-kildeavklaring-2.md`: U-013 (selve innførselsmva.-kravet har tekstlig støtte i T46/T49/T50/T45, mellomledd og granularitet er åpne), elbilfritakets målegrunnlag (fortsatt uavklart; hydrogen avviklet 2024 besvart), omfangsgrenser, identitet og relevans for lov 19.6.2026 nr. 41 og kort innhentingsliste.

### Tilleggskilder runde 2
Se `reviews/ECON-004-kildevurdering-3.md`: lov 19.6.2026 nr. 41 = særavgiftsloven (ikke relevant for § 6-8/§ 4-11/§ 8-1/§ 8-4), lov 22.12.2025 nr. 121-overgangen gjelder bare leasing, Prop. 1 LS pkt. 11.2 besvarer ikke målegrunnlaget ved innførsel, U-013 skilt i tre nivåer (valideringstoleranse er ikke en regel), nytt gap: primærbelegg for selve 25 %-satsen. Kilder T70–T75 registrert.

### Satsvedtak og meldingsformat
Se `reviews/ECON-004-kildevurdering-4.md`: 25 % har primærbelegg (Stortingets vedtak 217 § 2 / FOR-2025-12-18-2752, T76/T77), XSD v1.0 godtar desimaltall (T79) uten avrundingsmetode; registerrettelser gjennomført (R-IMP-VAT-001/-002/-003/-004, R-DED-001, R-IMP-FX-001, U-007/U-013); alle flagg false.

## 4. Gjenværende blokkeringer
U-003, U-008, U-013, R-IMP-VAT-002, R-IMP-VAT-003 og R-DED-001 er åpne og ikke godkjent. Ingen produktstandard for transport er godkjent utover ECON-001 (8 000, `assumed-default`, må konfigureres av kalleren). ECON-005 er ikke startet.

Se `reviews/ECON-004-kildevurdering-5.md` (19.10.2026): ajourført vedtak (T80) viser per hentedato uendret 25 % (ordlyd lik T76/T77; ingen garanti for fremtid/2027); bilimportsidene (T81/T82) gjelder privatpersoner og dekker ikke tollsats, elbilgrense eller avrunding. Henvendelsesutkast (ikke sendt): `reviews/ECON-004-henvendelse-utkast.md`. Alle flagg false.

Se `reviews/ECON-004-kildevurdering-6.md` (runde 32): korrigering — Tolletatens bilimportside inneholder elbilregelen (bilpris + frakt + forsikring over 300 000, avgift bare av overskytende) i serialiserte sidedata; R-IMP-VAT-004 E0 → E1P (delvis); ordinær tollsats 0 (Tolltariffen 2026 s. 501–502); engangsavgift utenfor innførselsgrunnlaget (rettsanvendelse). Kodeendringer er foreslått, ikke gjort. Avrunding åpen; flagg false; henvendelsene sendes ikke.

Se `reviews/ECON-004-implementering-runde34.md` (runde 34): kodeendringer basert på kildevurdering 6 (elbilgrense mot tollverdi, ordinær tollsats 0 med dekningskrav, § 4-11-avgifter, provisjon, betalingskostnader, utenlandsk mva.). Ikke parametergodkjenning; flagg false; avrunding uendret.

Se `reviews/ECON-004-r34-FIX1-retting.md`: rettingsrunde etter uavhengig review av afdc9f0 (to P2). Ikke parametergodkjenning.

Se `reviews/ECON-004-r34-FIX2-retting.md` (rettingsrunde etter review av 33d2fb9) med sluttmatrise (ferdig / blokkerer godkjenning / kan utsettes).

FIX2-review (`reviews/ECON-004-r34-FIX2-review-7378368.md`) registrert: P2 lukket. Beslutningsgrunnlag for avslutning: `reviews/ECON-004-beslutningsgrunnlag.md`.

Se `reviews/ECON-004-avslutning-estimatmotor.md` (20.10.2026): akseptkrav, gjenstående endringer B1–B3, rettelse av «±1 kr» og port-analyse for ECON-005; plan: `docs/econ/ECON-005-implementeringsplan.md`.

B1 (gyldighetsvakt) levert: `reviews/ECON-004-B1-gyldighetsvakt.md`.

FIX3 (konsolidert review av dc97f04, ett P2): `reviews/ECON-004-r34-FIX3-retting.md`.
