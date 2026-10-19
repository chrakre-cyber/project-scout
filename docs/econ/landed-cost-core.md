# Landed-cost-kjernen (ECON-004): betydning av feltene

Status: REVIEW. Ingen regel er godkjent; alle økonomiflagg (`vatRulesApproved`, `roundingApproved`, `customsFxRuleApproved`, `deductionRuleApproved`) er `false` i registeret. Kildebelegg: `reviews/ECON-004-kildevurdering.md`, `docs/tax/sources.json` (T23, T24, T35, T36, T53–T69).

## Totaler
- **`importCashRequirement` = BRUTTO utlegg.** Kjøpesum (anskaffelseskurs) + transport til og etter innførselsstedet + forsikring + lasting/håndtering + import-mva. + sum registreringsavgifter + øvrige kjente poster. Uavhengig av fradragsrett, betalingskanal og betalingstidspunkt. Det er **ikke** «kontant ved grensen», og heller ikke «alt minus mva.»: kjøpesum, transport, mva. og registreringsavgifter har ulike betalingstidspunkter. Det finnes ingen likviditetsmodell, og ingen terminer/frister er modellert. Navnet beholdes (ECON-003-forventningene er brutto).
- **`estimatedLandedCost`** = samme poster, men import-mva. bare ved `non_recoverable`. `unknown` (standard) gir to merkede scenarier, ingen enkeltverdi.
- **`importVatSettlement`** viser *bare mva.-beløpet* fordelt på kanal: `paidToCustomsAtImportNok` (ikke registrert; T56) eller `reportedInVatReturnNok` (registrert, rapporteres i mva-meldingen). Ukjent håndtering (standard) forblir ukjent (`vat_handling_unknown`, status `scenarios`) og gir rader for de kanalene som er forenlige med akseptert fradragsstatus: `recoverable` forutsetter registrering, så «ikke registrert» filtreres bort og listes i `excludedScenarios` — uten at registrering anses bekreftet. Ved `non_recoverable`/ukjent fradragsrett vises begge kanaler.

## Tre uavhengige spørsmål om mva.
1. **Beløp** (grunnlag, sats, elbilfritak) → `importVat`.
2. **Betalingskanal** → `vatHandling` (`registered_reports_in_vat_return` | `not_registered_pays_at_import` | `unknown`; kilde `dealer_entered`/`dealer_profile`, aldri annonse/«forhandler»).
3. **Fradragsrett** → `deduction` (`recoverable` | `non_recoverable` | `unknown`; samme kildekrav). `recoverable` uten registrering er selvmotsigende (mval. § 8-1) og blokkeres.

## Datoer (tre, adskilte)
`asOf` = beregningsdato. `customsDate` = akseptdato for tolldeklarasjonen (tollavgiftsloven § 2-2 via vareførselsforskriften § 6-12-1 (3); `actual_acceptance` | `expected_scenario` | `unknown`) og styrer ordinær tollkurs. Norsk registreringsdato (`taxInput.norwegianRegistration`) styrer bare avgiftsmotoren. Ingen av dem er verifisert av kjernen; ukjent akseptdato gir `customs_acceptance_date_unknown`, forventet dato gir estimatårsaken `customs_acceptance_date_expected`. Statusen registreres uavhengig av valuta og kursgren (NOK, direkte tollkurs, kursfallback); kursperioden kontrolleres bare i tollkursgrenen.

## Kurser
- To roller: `acquisition` (betalingskurs, kjøpesum) og `customs` (tollverdi, mva.-grunnlag). Fixture-kurs (`source.kind = fixture` eller `fixtureOnly`) avvises uten testflagg.
- `rate` = NOK per 1 enhet (normalisert); alternativt `raw` = `{ rate, unit: 1|100 }` slik Tolletaten publiserer. Råkurs deles på enheten nøyaktig én gang; råverdien beholdes i `fx.*.raw`. Oppgis begge må de stemme.
- Tollkurs: `validFrom`/`validTo` (Tolletatens f.o.m./t.o.m.) kontrolleres mot akseptdatoen; forhåndspubliserte fremtidige perioder er tillatt. `suspension` (`unknown` er standard) er ikke kontrollert ⇒ estimatårsak; `suspended` ⇒ kursen brukes ikke (Norges Banks daglige kurs trengs, ikke i kjernen).

## Transport
`transportToBorder` (til innførselsstedet; inngår i tollverdi og mva.-grunnlag), `transportAfterBorder` (bare kostnad), `insurance` og `loadingHandling` (begge i tollverdien). Hver post telles én gang. Manglende beløp er ukjent (nedre grense), aldri 0. `config.transportDefaultNok` (8 000) er en uttrykkelig produktantakelse for transport *til* grensen, merket `assumed_default`; den er ikke Tolletatens sjablong (500/1 500/2 500 for egne hjul) og gjelder ikke transport etter grensen.

## Elbilfritak
`evQualification` (fire kriterier fra mval. § 6-8/T62/T57; `null` = ukjent) er skilt fra avgiftsmotorens drivlinjeklassifisering (`ev.engineClassification`). Motoren kan bare utelukke (stempelmotor); `bev` betyr ikke kvalifisert (f.eks. brenselcelle). Målegrunnlaget for 300 000 er uavklart: `evThresholdBasis` er `unresolved` som standard og gir scenarier `with_exemption__basis_customs_value` / `with_exemption__basis_vehicle_price` (scenarioaritmetikk: fritatt del = min(300 000, målt beløp); mva. = 25 % av tollverdi minus fritatt del). Kjernen velger ikke grunnlag.

## Avrunding (U-013)
Uendret åpen. `UNCONFIRMED_HALF_UP` er en fixturekonvensjon. Likhet (x,5) gir nedre grense og kandidater.
