# ECON-005 — implementeringsplan (gjennomgått 20.10.2026; presisert)

> **Status 20.10.2026: 005a levert (REVIEW) — `reviews/ECON-005a-leveranse.md`; 005b–d ikke startet.** Avvik: mapperen ligger i `src/domain/search-economics/` (ikke `src/domain/economics/`) fordi arkitekturtesten i `economics-core.test.ts` begrenser importene i økonomimappen; rettigheter kommer inn som booleans til 005b. E7/E8 utsatt.


**Status 20.10.2026: plan, ikke implementering; revidert etter din gjennomgang (§ 0b–0c).** ECON-005 står på BACKLOG. Ingen kode, migrasjon eller runtime er endret. Planen forutsetter at ECON-004 avsluttes som estimat-/scenariomotor (`reviews/ECON-004-avslutning-estimatmotor.md`, B1–B3), at alle økonomiflagg er `false`, og at ingen gate svekkes. Gjenbruker: ECON-001 (§§ 3, 8.1, 11–15, D1–D8), DEC-030/031/034/036, `classifyBudget`/`CostAssessment` (SEARCH-002), rettighetsprofilen (DATA-002A/B/C), ECON-004-kjernen.

## 0. Mål og avgrensning
**Mål:** koble søkeresultat til en kostnadsvurdering som viser *estimat, scenarier, nedre grense eller «ikke beregnet»* — sammenhengende fra søk til kandidat — uten at noe av det kan gi positiv budsjettstatus.
**Ikke i omfang:** `validated`/parametergodkjenning; positive varsler; forklarings-UI (ECON-006); vekt-/homologeringsberikelse (ECON-007); FX-tjeneste (ECON-008); markedsbenchmark (ECON-009); EconomicTarget `maxLandedCostNok`/headroom (utsatt, se beslutning E8); live leverandør; scraping; endring av avgiftsmotor, avrundingspolicy eller `classifyBudget`-terskler.

## 0b. Fastlagt produktretning (20.10.2026, din beslutning)
1. Estimater og nedre grenser kan vises, tydelig merket og **rettighetsstyrt**. **Ingen positive budsjettutfall eller varsler.** (Besvarer E2.)
2. Tekniske avgiftsinput oppgis av **forhandler med grunnlag**; **annonsepåstander oppgraderes aldri** til dokumenterte fakta. (Besvarer E3.)
3. **Forhandleroppgitte kurser med kilde og dato** kan brukes som estimater. (Besvarer E4.)
4. **Mva.-håndtering og fradragsstatus har standard `unknown`** (forhandlerprofil kan sette dem eksplisitt). (Besvarer E5.)
5. **Ingen lagring av avledede beregningsresultater** i første versjon. (Besvarer E9.)
Gjenstår fra § 7: E1 (B3), E6 (presisert i P1 under), E7 og E8 (kan avgjøres underveis; anbefaling uendret).

## 0c. Presiseringer som må være på plass før 005a
**P1 — transportlinje (og forsikringslinje) tolkes ikke automatisk.** `CostLine.kind = "transport"` i søkemodellen (DEC-031) har ikke omfang: den kan ha betydd hele transporten (til og etter innførselsstedet). Regel: en eksisterende linje mappes **aldri** automatisk til `transportToBorder`. Omfang bekreftes av forhandler per linje (forhandlerinput, ikke ny spec-versjon): `to_border` | `after_border` | `split` (to beløp) | **`unconfirmed` (standard for alle eksisterende linjer)**. Ved `unconfirmed`: `transportToBorder` og `transportAfterBorder` blir `unknown` (nedre grense/`incomplete`, aldri 0), men linjens beløp forsvinner ikke: det telles som kostnad av ukjent omfang (kontant-nedre grense; ikke i tollverdien) og vises som «transport (omfang ikke bekreftet)». Samme prinsipp for `insurance` (til innførselsstedet eller annen forsikring). `transportDefaultNok` (8 000) brukes ikke som erstatning for en eksisterende, ubekreftet linje.
**P2 — forhandlerinput bindes til firma, kandidat og revisjon.** Nøkkel: `(dealershipId, searchId, candidateId, candidateVersion, inputSchemaVersion)`; hver verdi bærer `{value, basis (dealer_entered | vehicle_register | type_approval — aldri listing_claim for avgiftsinput), evidenceRef, confirmedBy, confirmedAt}`. Firmanivå-standarder (`vatHandling`, fradragsstatus, `transportDefaultNok`) er egne, firmabundne `dealer_profile`-verdier og endrer aldri en bekreftet kandidatoverstyring. **Krever ny bekreftelse (input markeres `stale_needs_reconfirmation` og brukes ikke):** ny kandidatrevisjon (`candidateVersion` — dekker endret pris, valuta, mva.-utsagn, drivstoff, vekt, CO₂, registreringsdato, merke/modell/variant); endret `costBasisOf(spec)` (kostnadslinjer endret); endret planlagt registreringsscenario; endret `inputSchemaVersion`; endret rettighetsprofilversjon/-digest som påvirker avledede felt; utløpt kurs-/gyldighetsperiode på forhandleroppgitt kurs; endret akseptdato-type (forventet → faktisk er en ny verdi, ikke en bekreftelse). **Krever ikke ny bekreftelse (resultatet beregnes på nytt):** endret budsjett/avvik, visningstekster, avgifts- eller økonomiprofilversjon (nye regler gir nytt resultat fra samme input; reglene kan i tillegg påvirke estimatårsaker). Bekreftelser kan ikke bæres mellom firma; en annen forhandlers bekreftelse gjelder aldri.
**P3 — `validUntil` er minimum av alle gyldighetsgrenser, ikke bare `now + 24 t`:** (a) `now + 24 t` (teknisk tak); (b) rettighetsprofilens `validUntil` (eksklusiv) og kildedataenes utløp (`retrievedAt + cacheSeconds/retentionSeconds`, DEC-034/035); (c) beregningsprofilens dokumenterte periode (`DOCUMENTED_RULE_PERIOD`: eksklusiv slutt 2027-01-01T00:00:00Z) og avgiftsprofilens `documentedValidTo`/intern sikkerhetssperre; (d) tollkursens `validTo` (+1 dag, eksklusiv) og anskaffelseskursens `validUntil`; (e) forhandlerbekreftelsenes utløp (kurs). Er minimum ≤ `now` ⇒ ingen vurdering (`not_calculated`/`stale`); aldri et lengre `validUntil` enn noen enkelt grense.
**P4 — ukjente og ikke støttede kostnadslinjer forsvinner ikke og blir ikke 0.** Hver `includedInBudget`-linje får en eksplisitt behandling i mappingen, og mappingen returnerer en liste `costLines[]` (id, kind, beløp|null, behandling) i tillegg til totalen:
| Linje | Behandling |
|---|---|
| `transport`/`insurance` med bekreftet omfang | mappes til riktig økonomiinput (telles én gang) |
| `transport`/`insurance` ubekreftet | `unmapped_unknown_scope`: beløpet telles som kostnad, ikke i tollverdi; resultat `incomplete` |
| `travel`, `preparation`, `conversion`, `approval`, `custom` | `added_to_total` som valgt kostnad (DEC-030), vist adskilt; aldri i tollverdi/mva.-grunnlag |
| `amountMinor = null` (ukjent) | `unknown_amount`: totalen er nedre grense, linjen listes i `missing`; aldri 0 (jf. `included_cost_unknown`) |
| valuta ≠ NOK eller `vatBasis = null` | `unsupported`: ikke omregnet/ikke antatt; resultat `incomplete` med linje-id i årsaken |
| `includedInBudget = false` | utenfor total, men synlig som «ikke inkludert» (ikke slettet) |
Invariant (testes): antall linjer inn = antall linjer ut; ingen linje får 0 uten at den er uttrykkelig oppgitt 0; sum av behandlede linjer + økonomikomponenter = totalen; ingen linje telles to ganger.

## 1. Dataflyt
```
runSearchPipeline → PreviewItem {listing: NormalizedListing, candidate: CandidateV2, assessment}
   │  (eksisterende, uendret: classifyBudget(spec, cand, null) ⇒ not_calculated)
   ▼
[005c] ServerEconomics.assess(item, spec, dealerInputs, rights, now)
   1. rights = rightsForSource(source, now)  → allow_derived_economics? (felt: price, registration, specs, …)  ellers ⇒ unavailable(rights_not_granted)
   2. toEconomicsInput(listing, spec, dealerInputs)   [adapter, ren]  → EconomicsInput | notCalculated(reason)
   3. calculateEconomics(input, {rounding: UNCONFIRMED_HALF_UP, profile: REGISTRY_ECONOMICS_PROFILE})   [ECON-004, uendret]
   4. toCostAssessment(result, spec, candidate, now)   [005a, ren]  → CostAssessment | null
   5. classifyBudget(spec, cand, costAssessment, now)  [uendret]   ⇒ aldri positiv uten complete_validated
   6. toEconomicsDisplay(result, rights, policy)       [005d]       ⇒ visningsmodell (kun hvis display_derived_economics)
   ▼
DisplayItem {listing, assessment (budsjett: not_calculated), economics: EconomicsDisplay}
```
Lagdeling: domenet (`src/domain/economics/to-cost-assessment.ts`, `…/display-status.ts`) er rent; adapter (`src/adapters/search-economics/`, parallelt med `search-candidate`) kjenner `NormalizedListing`/`SearchSpec`; server (`src/server/search-economics.ts`) orkestrerer og kjenner rettigheter og forhandlerinput; UI får bare `EconomicsDisplay` via `search-display`-grensen (aldri `EconomicsResult` eller proveniens).

## 2. Nødvendige input (kilde, rett, ukjent-oppførsel)
| `EconomicsInput`-felt | Kommer fra | Rett/gate | Ukjent ⇒ |
|---|---|---|---|
| `price` (beløp, valuta) | annonse (`ListingPrice.stated/amount`) | `allow_derived_economics`:price; visning av pris separat | `incomplete` (`purchase_basis_unknown`) |
| `priceBasis` net/gross | bare ved `ListingPrice.basis` + `basisEvidence`; ellers `unknown` | som over | gross/unknown ⇒ ikke løst grunnlag (`purchase_basis_*`) |
| `price.foreignVat` | **aldri fra annonse**; forhandler (`invoice_or_contract`/`dealer_entered`) | forhandlerinput | uten ⇒ tollverdi nedre grense (`foreign_vat_exclusion_undocumented`) |
| `taxInput.propulsion` | forhandler/typegodkjenning; **annonsens drivstoff er `listing_claim` ⇒ avgiftsmotoren blokkerer** | `allow_derived_economics`:specs | `blocked` ⇒ «ikke beregnet» |
| `taxInput.norwegianTaxWeight` | forhandler med dokumentert grunnlag (typegodkjenning/register) | forhandlerinput | annonsens `curbWeightKg` er `reference_listing` ⇒ estimat; ukjent ⇒ blokkert |
| `taxInput.co2` (+metode) | forhandler/typegodkjenning | `allow_derived_economics`:specs | blokkert/estimat etter motoren |
| `taxInput.firstRegistration` | annonse (`FirstRegistration` precision) | `allow_derived_economics`:registration | år/ukjent ⇒ blokkert (ECON-001 D2) |
| `taxInput.norwegianRegistration` | forhandler (forventet/faktisk) eller standard = beregningsdato (`defaulted`) | forhandlerinput | standard ⇒ estimat |
| `customsDate` (akseptdato) | forhandler (`expected_scenario`/`actual_acceptance`) | forhandlerinput | `unknown` ⇒ `incomplete` |
| `fx.acquisition` / `fx.customs` | forhandler (kilde+dato) i pilot; ECON-008 senere | forhandlerinput (E4) | NOK: ikke nødvendig; ellers `incomplete` |
| `transportToBorder`, `insurance`, `loadingHandling`, `transportAfterBorder` | forhandlerinput; en eksisterende `transport`/`insurance`-linje i søket mappes **bare etter bekreftet omfang** (P1); `transportDefaultNok` (8 000, `assumed-default`, ECON-001) bare som merket produktantakelse og aldri for en eksisterende ubekreftet linje | forhandlerinput | ukjent/ubekreftet omfang ⇒ nedre grense, aldri 0 |
| `commission`, `paymentCosts`, `importLevies`, `climateGas*`, `charges.*` | forhandler | forhandlerinput | uklassifisert ⇒ ukjent/nedre grense |
| `vatHandling`, `deduction` | **forhandlerprofil** (`dealer_profile`) eller per-kandidat-overstyring; aldri av annonse/«forhandler»-ordet | forhandlerinput (E5) | ukjent ⇒ scenarier |
| `evQualification` | forhandler/typegodkjenning (fire kriterier) | forhandlerinput | uavklart ⇒ to mva.-scenarier |
| `asOf` | server (`now`, injisert) | – | – |
**Regler:** ingen verdi utledes av annonsetekst (CLAUDE.md pkt. 10); felt uten matching-/derivasjonsrett er *ukjent* (`restrictForMatching`), aldri oppdiktet; varebil (`registrationScenario = van`) og alle profiler utenfor PB-DIE/PB-BEV/PB-PHEV ⇒ `not_calculated` med grunn.

## 3. Rettighetskontroll (DB + domene)
- **Utvid `ProviderRightsProfile`** (`src/domain/provider-rights.ts`) og `private.provider_rights_profiles` med `allow_derived_economics` (per felt, samme form som `matching_fields`) og `display_derived_economics` (boolean; granularitet senere). Begge **default nei**, fail-closed. Ny versjonert migrasjon (ikke endring av eksisterende), guard-trigger-immutabilitet som for de øvrige rettighetskolonnene, differensialtest TS ↔ SQL, oppdatert syntetisk profil (E2: eksplisitt `true` kun for syntetisk demo; sandbox/live default nei).
- **Resolver:** `resolveRights` → `canDeriveEconomics(r, fields)` og `canDisplayEconomics(r)`. Kombinasjoner: avledet bruk tillatt/visning forbudt; avledet visning som avslører rå verdi (annonsepris) krever i tillegg gjeldende visningsrett for feltet; mangler rett ⇒ `economics: unavailable` med `rights_not_granted` (ikke 0, ikke skjult). Utløpt/revidert/ukjent profil ⇒ lukket (som i dag).
- **Lagring:** avledede tall lagres ikke i v1 (beregnes ved visning); forhandlerinput lagres som forhandlerens egne data, referert til kandidat-id + revisjon, ikke som leverandørdata. Følger `retentionSeconds`/`storable` for alt som stammer fra leverandør.
- **Varsler:** `usage.alerts` forblir styrende; ingen varsel fra estimat/nedre grense (se § 5).
- **Test med ordinær bruker (CLAUDE.md pkt. 7):** RLS på nye tabeller; ingen service-role i klient.

## 4. Resultatstatus og kontrakt
**`toCostAssessment(result, spec, candidate, now)`** (ren):
| `EconomicsResult` | `CostAssessment` | `classifyBudget` |
|---|---|---|
| `validated` og `importCashRequirement.kind = value` (uoppnåelig med registerprofilen) | `complete_validated`, `totalMinor` = (kontantbehov NOK + valgte kostnadslinjer som ikke dekkes av økonomi) × 100 | positiv/negativ status |
| `estimate` med entydig verdi | `unvalidated` | `not_calculated: assessment_not_validated` |
| `incomplete`, `lower_bound`, `scenarios` | `incomplete` (total = laveste kjente) eller `null` | `not_calculated: assessment_incomplete`/`no_assessment` |
| `blocked`, `not_calculated`, rettighet mangler, ikke støttet profil/scenario | `null` | `not_calculated: no_assessment` |
Andre felt: `currency = NOK`, `basis = BUDGET_BASIS`, `registrationScenario` fra søket (bare `passenger`), `profileRef` = avgiftsprofil-id@versjon + økonomiprofil-hash, `validUntil` = minimum av alle gyldighetsgrenser (P3), `candidateId/Version` fra kandidaten, `costBasis = costBasisOf(spec)`, `coveredCostLineIds` = alle inkluderte linjer.
**Ingen dobbelttelling og ingen forsvunnede linjer:** kostnadslinjer med bekreftet omfang mappes til økonomiinput og legges ikke til på nytt; øvrige inkluderte linjer legges til totalen; ukjente/ubekreftede/ikke støttede linjer behandles etter P4 (ECON-001 §8.1: budsjettsum = kontantbehov + valgte tillegg, DEC-030).
**Visningsstatus `EconomicsDisplay.status`:** `estimate` | `lower_bound` | `scenarios` | `not_calculated(reason)` | `unavailable(rights_not_granted)` | `validated` (uoppnåelig inntil godkjenning). Alle tekster er faste konstanter i `search-labels` («Estimat — ikke validert», «Minst X kr (ufullstendig)», «Ikke beregnet: …»); aldri «innenfor budsjett» fra økonomi.
**Mva.-fradrag ukjent ⇒** to merkede scenarier for økonomisk kost (ECON-001 §12); kontantbehov vises som brutto utlegg (`importCashRequirement`), aldri «kontant ved grensen».
**Positive utfall utelukket ved konstruksjon:** ukjent kostnad, nedre grense, scenarier, estimat og assumed-default gir aldri `within_budget`/`within_deviation`/`isFullHit`/varsel. (Valgfri informasjon «kjent kostnad overstiger allerede øvre grense» er et eget display-felt utenfor `classifyBudget`; se E7.)

## 5. Tester
1. **Mapping-matrise** (`to-cost-assessment`): hver statuskombinasjon ⇒ forventet `CostAssessment`/`null`; med registerprofilen finnes ingen input som gir `complete_validated` (property over genererte input); med syntetisk godkjent profil (kun test) og uendret kandidat/revisjon/costBasis ⇒ `complete_validated`.
2. **Ingen positiv fra usikkerhet:** for lower_bound/scenarios/estimate/ukjent kostnad/assumed-default — også når tallet ≤ budsjett — er `classifyBudget` `not_calculated`, `isFullHit` false, og ingen positiv visningstekst (streng-/snapshottest mot `search-labels`).
3. **Dobbelttelling:** transport-/forsikringslinjer teller én gang; endret `costBasis`, kandidatrevisjon, scenario, valuta eller utløpt `validUntil` ⇒ `not_calculated` (gjenbruker eksisterende `classifyBudget`-tester).
4. **Adapter:** `listing_claim`-drivlinje ⇒ avgiftsmotoren blokkerer ⇒ «ikke beregnet»; annonsens brutto/ukjent pris ⇒ ikke løst grunnlag; `foreignVat` aldri fra annonse; manglende felt forblir ukjent (ikke 0); varebil/ikke-støttet profil ⇒ `not_calculated`; ingen `Math`/float (arkitekturtest utvides).
5. **Rettigheter:** matrise `allow_derived_economics` × `display_derived_economics` × visningsrett for pris; utløpt/revidert/ukjent/utkast-profil lukker; avledet visning som avslører pris uten prisvisningsrett nektes; DB: nye kolonner default nei, guard-trigger, differensialtest, RLS med ordinær bruker (ikke service-role), ingen lekkasje mellom firma.
6. **Varsler:** `usage.alerts=false` og `not_calculated` ⇒ ingen varsel; et nedre grense under budsjett utløser ingen varsel (test mot eventuell varselmodul når den finnes).
7. **Vakter fra ECON-004 (B1):** akseptdato utenfor dokumentert vindu ⇒ `incomplete` videreføres til visning.
8. **E2E (syntetisk):** søk → kandidat → forhandlerinput → kostnadsvurdering → visning for tre profiler + ukjent profil + manglende rett; ingen nettverk; demo merket (CLAUDE.md pkt. 3).
9. **Regresjon:** hele ECON-003/004-settet og `classifyBudget`-testene uendret.

## 6. Leveranse i skiver (hver med review og stopp)
| Skive | Innhold | DB | UI |
|---|---|---|---|
| **005a** | `to-cost-assessment.ts` + visningsstatuslogikk (rene), tester 1–3, 7 | nei | nei |
| **005b** | rettighetsutvidelse (domene + migrasjon + tester § 5.5) | **ja** | nei |
| **005c** | adapter + server-orkestrering + forhandlerinput (skjema-validering, ev. tabell med RLS) | ev. ja | liten |
| **005d** | `EconomicsDisplay` via display-grensen + faste labels; tester 2, 6, 8 | nei | minimal (labels) |
ECON-006 (forklarings-UI) er egen oppgave. Ingen skive endrer flagg, `classifyBudget` eller avrundingspolicy.

## 7. Produktbeslutninger som faktisk kreves (anbefaling; reuser eksisterende beslutninger)
| # | Beslutning | Kreves før | Anbefaling | Gjenbruker |
|---|---|---|---|---|
| **E1** | Start fra ECON-004 REVIEW-baseline (pinnet commit) eller først DONE innen avgrenset omfang? **B1 er gjort; B2-pakken er bygget; avventer din beslutning (B3).** | 005a | Gjør B1 og B2, sett avgrenset DONE, start deretter; ellers uttrykkelig tillatelse fra REVIEW | backlog-avhengighet; ECON-002/003-presedens |
| **E2 — BESLUTTET (§ 0b)** | Skal estimater/nedre grenser vises til pilotforhandlere (ikke bare internt)? Syntetisk profil `allow`/`display_derived_economics = true` bare for demo? | 005b/d | Ja, rettighetsstyrt og tydelig merket «estimat»; syntetisk demo eksplisitt `true`; sandbox/live default nei | DEC-030 (kontrollbehov), ECON-001 §15.7, PILOT_PLAN |
| **E3 — BESLUTTET (§ 0b)** | Hvem leverer tekniske avgiftsinput (drivlinje, vekt med grunnlag, CO₂, norsk registreringsdato)? | 005c | Forhandler per kandidat med oppgitt dokumentasjonsgrunnlag; aldri fra annonsen; ECON-007 senere | CLAUDE.md pkt. 10; ECON-002 vektpolicy |
| **E4 — BESLUTTET (§ 0b)** | Tollkurs/anskaffelseskurs i pilot: forhandleroppgitt (kilde+dato) eller vent på FX-tjeneste? | 005c (kun ikke-NOK) | Forhandleroppgitt med kilde/dato (estimat); ECON-008 senere | ECON-001 D6 |
| **E5 — BESLUTTET (§ 0b)** | Forhandlerprofil som `dealer_profile`: standard mva.-håndtering og fradragsstatus (ukjent hvis ikke satt) | 005c | Lagre per firma; standard `unknown`; kan overstyres per kandidat; aldri utledet av annonse eller «forhandler» | ECON-001 D8 |
| **E6 — PRESISERT (P1)** | Betydning av søkets kostnadslinjer | 005a/c | Ikke tolk automatisk; forhandler bekrefter omfang per linje, standard `unconfirmed`; 8 000 bare som merket produktantakelse for *manglende* linje | ECON-001 §4.4/§15.5 |
| **E7** | Informasjon «kjent kostnad overstiger allerede øvre grense» (nedre grense > grense) som display-felt, aldri filter/varsel? | 005d | Ja, kun informasjon, utenfor `classifyBudget`, aldri utelukkelse; kan også utsettes til ECON-006 | DEC-030/031 («pris opphever aldri kravbrudd») |
| **E8** | `EconomicTarget` (`maxLandedCostNok`, headroom) i v1? | – | Utsett; v1 = budsjettsum + komponentvisning | ECON-001 §3, D1 |
| **E9 — BESLUTTET (§ 0b)** | Lagring av avledede tall? | 005b/c | Ingen (beregn ved visning); lagre bare forhandlerinput | ECON-001 §13, DEC-034 |
**Ikke nødvendige for å starte (reservert `validated`):** ECON-004 D1–D9 (`reviews/ECON-004-beslutningsgrunnlag.md`) — de gjelder flaggene, ikke estimatvisning. Teknisk (ikke produkt): `validUntil`-regel, profilreferanse-format.

## 8. Stoppunkt
Planen er dokumentasjon. Ingen skive startes før du uttrykkelig har gitt startordre (E1/B3) etter å ha vurdert B2-pakken. Gjenstående åpne beslutninger: E1, E7, E8.
