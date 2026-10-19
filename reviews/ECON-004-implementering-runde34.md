# ECON-004 — implementeringsrunde 34 (endringsrapport)

**Status: REVIEW. Dette er ikke parametergodkjenning.** Økonomiflaggene (`vatRulesApproved`, `roundingApproved`, `customsFxRuleApproved`, `deductionRuleApproved`) er `false`; `validated` er ikke nåbart med registerprofilen. Ingen nye produktgrenser (3.9.–31.12.2026 forblir et forslag). Avrundingspolicyen (`UNCONFIRMED_HALF_UP`, tie ⇒ nedre grense) og ECON-003-fixturene (`tests/fixtures/*`, uendret: `git diff` tom) er uendret. ECON-002 (`src/domain/tax`) er uendret. ECON-005 er ikke startet. Kildegrunnlag: `reviews/ECON-004-kildevurdering-6.md` (T81, T83, T87, T88, T60, T63).

## Endrede filer
- `src/domain/economics/landed-cost.ts`, `types.ts` (endret); `customs-tariff.ts` (ny, ren funksjon). `rational.ts` uendret.
- Tester: `tests/economics-round34-implementation.test.ts` (ny, 31 tester); tilpasset: `economics-core`, `economics-review-regressions`, `economics-source-driven`, `economics-src1-review-regressions` (se «Avvik»).
- Docs: `docs/econ/landed-cost-core.md`, `docs/tax/rules.json` + `TAX-001A-rules.md` (monitoring-notater), `DECISIONS.md` (Runde 34), `MVP_BACKLOG.md`, `reviews/ECON-004.md`.

## 1. Elbilgrensens målegrunnlag
- `EvThresholdBasis = "customs_value" | "undocumented_import_type"`; standard `customs_value`. `vehicle_price_only` og scenarioet `with_exemption__basis_vehicle_price` er fjernet; den gamle verdien avvises som ugyldig (blokkering på `evThresholdBasis`), ikke valgt stille. Estimatårsaken `ev_threshold_basis_assumed` er fjernet.
- Mva. = 25 % × (grunnlag − min(300 000, tollverdi)), grunnlag = tollverdi + tollavgift + avgifter ved innførsel. Eksempel: 295 000 + 8 000 = 303 000 → 750; 297 000 + 8 000 = 305 000 → 1 250 (Tolletatens eksempel, ikke offisiell kalkulatorreferanse).
- **Merket usikkerhet:** `ev_threshold_components_unconfirmed` (estimat) når lasting/håndtering eller salgsprovisjon > 0 (veiledningssetningen nevner bare pris, frakt og forsikring); varsel om at målegrunnlaget kommer fra privatpersonveiledning sammenstilt med § 4-11 for registrert importør; `undocumented_import_type` ⇒ nedre grense og `incomplete`.

## 2. Ordinær tollsats 0 (T83) — bare med dekning
`customs-tariff.ts`: sats 0 brukes bare når `vehicleClass = passenger_car_m1`, drivlinjeklassifisering er kjent og akseptdatoen er kjent og i 2026 (tariffutgaven). Alt annet ⇒ tollavgift ukjent (aldri 0): `charges.customsDuty` i `missing`, mva. og totaler er nedre grenser. Derivert 0 gir estimatårsak `customs_duty_ordinary_rate_unapproved` til `vatRulesApproved` settes (ingen nytt flagg). Eksplisitt `unknown` forblir ukjent; eksplisitt beløp > 0 inngår i **mva.-grunnlaget** (mval. § 4-11) og i kostnaden én gang (tidligere `customs_duty_vat_base_unresolved` og ignorert i grunnlaget). Avvik fra ordinær sats varsles. Ikke lest og derfor ikke dekket: tolltariffendringer etter 1.1.2026 (T86), varebil (87.04), sanksjoner/særtiltak.

## 3. Avgifter ved innførsel (§ 4-11)
Engangsavgift forblir utenfor grunnlaget (testet: grunnlag 108 000 uansett avgift 333 723/16 748). Klimagassavgift er **ikke** låst utenfor: `climateGasVatBase` (`in_base | outside_base | unknown`, standard unknown; > 0 uten klassifisering ⇒ nedre grense). Nytt `importLevies[]` for andre avgifter som oppstår ved innførsel, med obligatorisk `vatBase`. Registreringsgebyr (`registrationFee`) er Statens vegvesens gebyr og er skilt fra importavgifter: kostnad, aldri i grunnlaget. `otherKnown` er kostnader som ikke er importavgifter.

## 4. Provisjon og betalingskostnader
`commission[]`: salgs-/meglerprovisjon betalt i tillegg ⇒ tollverdien (3 000 → tollverdi 111 000, mva. 27 750); innkjøpsprovisjon ⇒ kostnad utenfor tollverdi; ukjent rolle ⇒ kostnad tas med, tollverdi/mva. er nedre grense (`commission_role_unknown`); allerede i prisen ⇒ ingenting; ukjent om betalt i tillegg ⇒ ukjent. `paymentCosts[]`: `separate_payment_cost` ⇒ kostnad utenfor tollverdi (§ 6-10 (2) uttømmende), `included_in_goods_price` ⇒ ikke lagt til en gang til, `unknown` ⇒ ukjent. Ingen generell behandling av bank-/valutagebyr. Ikke modellert: fradrag av innkjøpsprovisjon som allerede er i prisen (§ 6-11 (1) e; varsel).

## 5. Utenlandsk mva. i prisen (T88)
`price.foreignVat`: uten `excluded_documented` med bevis som ikke er en annonsepåstand er tollverdiens pris en nedre grense (`foreign_vat_exclusion_undocumented`, `incomplete`; mva. og totaler `lower_bound`). `dealer_entered` ⇒ løst, men estimatårsak `foreign_vat_exclusion_dealer_stated`. Gjelder også forhandlerjustert pris. Refusjonsrett utledes ikke av annonsetekst eller oppgitt nettopris.

## Avvik fra tidligere beregninger — konkrete input og kildegrunnlag
| Input | Før | Nå | Kilde |
|---|---|---|---|
| BEV 295 000 NOK + transport 8 000, alle kriterier sanne, standard målegrunnlag | to scenarier 750 / 2 000, `incomplete` | 750, `calculated` | T81 (indeks 11047/11054), § 4-11, T87 |
| samme, `evThresholdBasis: "vehicle_price_only"` | 2 000 | blokkert (ugyldig verdi) | som over |
| 350 000 + 8 000 | scenarier 14 500 / 14 500 | 14 500 | som over |
| `customsDuty` utelatt, diesel, aksept 2026-10-20 (ECON-003 CASE-003-basert) | `missing: charges.customsDuty`, kontant nedre grense | tollavgift 0 (`ordinary_rate_tariff_2026`), estimatårsak; kontant eksakt hvis øvrige poster er kjent | T83 |
| `customsDuty` utelatt, aksept ukjent / 2027 / ikke personbil / ukjent drivlinje | `missing` | uendret: ukjent, nedre grenser | T83-avgrensning |
| `customsDuty` 2 000 (CASE-003) | `incomplete` + grunnlag uendret | grunnlag +2 000, mva. +500, kontant +2 500 | § 4-11 (T63) |
| net pris uten dokumentasjon av utenlandsk mva. (100 000 NOK, transport 8 000) | tollverdi 108 000, mva. 27 000 (estimat ved listing_claim) | samme tall, men `lower_bound`, `incomplete` | T88 |
| salgsprovisjon 3 000 (tidl. kun som `otherKnown` = utenfor tollverdi) | mva. 27 000 | mva. 27 750 | T87 (§ 6-10 (1) a nr. 1) |
| klimagassavgift 900 uten klassifisering | kostnad, stille utenfor grunnlaget | ukjent ⇒ nedre grense; `in_base` ⇒ mva. +225 | § 4-11, ikke dokumentert |

**ECON-003-regresjon:** fixtureinput og -forventninger er uendret bortsett fra at testinputens `price` nå uttrykkelig oppgir `foreignVat` (fixtureforutsetning: dokumentert mva.-fri nettopris; `FV` i testfilene). Alle ECON-001 §7-literaler (tollverdi, mva., kontant, landed) reproduseres.

## Kontroller kjørt
`node docs/tax/check-docs.mjs` OK; `npx vitest run`: 40 filer / 924 tester bestått (før: 39 / 893); `npx tsc --noEmit` og `npx eslint .` uten feil. Mutasjonskontroll (midlertidig, ikke committet): fire mutanter (tollavgift alltid 0, ukjent provisjon som salgsprovisjon, engangsavgift i grunnlaget, utenlandsk mva. ignorert) ble alle felt av testene; originalen er gjenopprettet.

## Beslutningspunkter for Christian (ikke tatt)
1. Derivert tollsats 0 er koblet til `vatRulesApproved` (ingen nytt flagg). Alternativ: eget flagg (ny parametergodkjenning, ikke gjort).
2. Standard for utelatt `foreignVat` er «ubekreftet»: vanlig annonsert nettopris gir dermed `incomplete` til dokumentasjon oppgis (produktpåvirkning i UI senere).
3. Utelatt `commission`/`paymentCosts` betyr «ingen oppgitt», ikke «0 antatt».
4. Klimagassavgiftens plass i § 4-11-grunnlaget er ikke dokumentert (standard ukjent).
