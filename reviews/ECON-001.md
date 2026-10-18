# ECON-001 — spesifikasjon av Merovos innkjøpsøkonomimotor (18.10.2026)

**Status: REVIEW** — revidert i ECON-001-FIX 18.10.2026 (D1–D8 avklart, landed-cost-/mva.-/kursmodell korrigert; se §18). Spesifikasjon/arkitektur; ingen kode, ingen runtimelogikk, ingen DB-endring, ingen leverandør, ingen credentials, ingen scraping, ingen VEND/FINN). Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `52e31d6`, rent arbeidstre. Den offentlige taglinen er uendret. Intern arbeidsmaksime: *«Sell the car first. Find it afterwards.»*

**Faktamerking.** *[REPO]* = står i repoets dokumenter/kode. *[OPPGITT]* = oppgitt av Christian i oppdraget (de tre gyldne casene; kjørt manuelt i Skatteetatens kalkulator, ikke sett av Claude). *[ANALYSE]* = Claudes utledning. *[UKJENT]* = ikke avklart og behandles som ikke tilgjengelig (ingen fabrikkering).

## 0. Sammendrag
1. Motoren besvarer: **«Kan dette kjøretøyet anskaffes og leveres i Norge innenfor forhandlerens økonomiske mål?»** — ikke «regn ut avgiften på denne bilen». Avgift er én komponent.
2. Den **gjenbruker** eksisterende kontrakter: `CostAssessment`/`BudgetSpec`/`classifyBudget` (`src/domain/search-v2`), `IMPORT_ENGINE_SPEC.md` (v0.1, DEC-030) og hele TAX-001A–E-grunnlaget (`docs/tax/`). Ingen parallell regelmodell.
3. **De tre gyldne casene** er aritmetisk konsistente og utgjør potensielle klasse 1-referanser (TAX), men **avgiften kan ikke reproduseres av motoren i dag** (se §8): ingen godkjente parametere, EV-/PHEV-satser og flere inputs mangler. De kan automatiseres trygt som *offisielle forventede verdier* + uavhengig aritmetikk (mva., sum, kurs), ikke som motorreproduksjon av avgiften.
4. **ECON-001-FIX:** (a) transport på NOK 8 000 øker *ikke* automatisk permanent landed cost med 10 000: kontantbehovet øker med 10 000, men landed cost øker med 8 000 (mva. fradragsberettiget), 10 000 (ikke fradragsberettiget) eller er uavgjort (ukjent; standard); (b) mva.-fradragstilstanden er `unknown` til den er oppgitt; (c) kurs er to roller (`acquisition_fx_rate` / `customs_fx_rate`), ikke én; (d) bare-år-registrering gir ikke arbeidsdato; (e) avledede økonomitall har egne rettigheter (bruk / visning), default nei; (f) gyldne caser er delt i A (offisiell reproduksjon) og B (Merovo-scenario).
5. Landed cost **skal ikke vises i den eksterne partnerdemoen** før portene i §15.7 er oppfylt.

## 1. Produktspørsmålet og avgrensning
`Forhandlerbehov → europeisk tilbud → kandidatmatching → norsk landed-cost-estimat → vurdering mot forhandlerens/kundens økonomi → forklaring på hvorfor bilen er kommersielt relevant.`
Merovo er en **virtuell lagerhylle**: forhandleren finner en passende bil før den importeres eller lagres. Merovo er ikke transaksjons-, auksjons-, betalings- eller logistikkplattform, og forhandleren forhandler, bekrefter og kjøper utenfor Merovo (§10). Motoren er **valgfri per søk**: et søk uten økonomi fungerer som i dag (oppdagelse/matching).

## 2. Nødvendige utdata per kandidat
`CandidateEconomics` (konseptuelt; penger = heltall i minste enhet, `bigint`, som resten av domenet):

| Gruppe | Felt | Merknad |
|---|---|---|
| Annonsepris | `advertisedGross`, `advertisedNet` (hvis oppgitt), `sourceCurrency`, `priceBasis` (gross/net/unknown), `sourceVat{rate, status, evidence}` | alt uendret fra annonsen; ukjent forblir ukjent |
| Kurs | `acquisitionFx` og `customsFx` (hver `FxQuote{rate, scale, source, basis, effectiveAt, quotedAt, confidence, fixtureOnly}`) | to roller, §4.2 |
| Registrering | `registration{source{value, precision}, workingDate, expectedNorwegianRegistrationDate, actualNorwegianRegistrationDate?}` | §4.1 |
| Anskaffelse | `acquisitionAdvertisedNok`, `acquisitionExpectedNok` (dealer-justert, valgfri), `acquisitionUsedNok` | opprinnelig pris overskrives aldri; den brukte velges eksplisitt |
| Transport | `transportDefaultNok` (8 000), `transportAdjustedNok` (dealer), `transportUsedNok` | alltid merket forutsetning/standard |
| Tolverdi / mva.-grunnlag | `customsValueNok` | kjøpesum + transport + forsikring til norsk innførselssted (R-IMP-VAT-002, E1P) |
| Skatter | `importVatNok`, `oneOffTaxNok` (`one_off_tax`), `scrappageDepositNok` (`scrappage_deposit`, vrakpantavgift), `totalRegistrationTaxesNok` (`total_registration_taxes` = sum av de to), `otherKnownChargesNok[]`, `unknownCharges[]` | hver linje har `confidence` og `ruleRef` |
| Mva.-tilstand | `importVatRecoverability`: `recoverable \| non_recoverable \| unknown` (standard `unknown`) | §6 |
| Totaler | `importCashRequirementNok`; `estimatedLandedCost{status, valueNok \| null, scenarios?}` | to adskilte summer (§12); begge kan være `lower_bound`; landed cost er `null` med to merkede scenarier når fradragstilstand er `unknown` |
| Mål | `target`, `headroomNok`, `targetStatus` | se §3 |
| Tillit | `confidence` (samlet + per linje), `warnings[]`, `breakdown[]`, `inputProvenance` | §11, §12 |

**Produktutdata (gruppert):**
- *Anskaffelse:* advertised gross, advertised net, dealer-adjusted purchase price (`acquisitionExpected`), `acquisition_fx_rate`.
- *Import:* transport, `customs_fx_rate` (der aktuelt), import-mva.-grunnlag, import-mva., `one_off_tax`, `scrappage_deposit`, `total_registration_taxes`, andre kjente avgifter, ukjente avgifter.
- *Økonomi:* `import_cash_requirement`, `estimated_landed_cost` (hvis avgjørbar), mva.-fradragstilstand, target headroom, market spread / spread %, confidence og forutsetninger.

**Navn:** *market spread*, *economic headroom*, *target headroom*, *estimated landed cost*. **Aldri** «profit»/«fortjeneste». «Bidrag» (IMPORT_ENGINE_SPEC) forblir et senere, separat lag som krever salgsprofil og mva.-status og er ikke en del av ECON-oppgaven.

## 3. Forhandlerens økonomiske mål (alt valgfritt)
`EconomicTarget` kan ligge på søket (utvider `BudgetSpec`; bakoverkompatibelt): `maxLandedCostNok`, `maxTotalAcquisitionNok` (= kjøpesum + transport + forhandlerlagt tilleggskost, **før** norske avgifter), `targetResalePrice` (med eksplisitt mva.-/avgiftsgrunnlag, jf. IMPORT_ENGINE_SPEC «Inputs»), `minHeadroomNok`, `minSpreadPercent`. Ingen er påkrevd; manglende mål gir `targetStatus = "no_target"` og motoren viser bare kostnadskomponentene. Merovo antar aldri at forhandleren vil ha utsalgspris regnet.
Eksisterende `BudgetSpec.maxTotalNokMinor` + `deviationBasisPoints` beholdes **uendret** med DEC-030-semantikk (budsjettsum, inkl. beregnet import-mva. og engangsavgift; se §8.1). `maxLandedCostNok` er et *separat*, valgfritt felt som bare sammenlignes mot en avgjørbar `estimated_landed_cost`; de to grensene konverteres aldri til hverandre.
**Målstatus (tre-verdi, aldri gjetning):** `inside` (estimert kost ≤ øvre grense og alle kostnadslinjer kjent), `outside_certain` (selv kjente delsummer overstiger grensen), `indeterminate` (ukjente linjer eller uavgjort mva.-tilstand kan avgjøre) og `no_target`. Ved `importVatRecoverability = unknown` vurderes `maxLandedCostNok` mot begge scenarier: `inside` bare hvis det *høyeste* scenarioet (ikke fradragsberettiget) er innenfor, `outside_certain` hvis det *laveste* (fradragsberettiget) overstiger grensen, ellers `indeterminate`. Ufullstendig kost er en **nedre grense** (`completeness: "lower_bound"`): er nedre grense allerede over målet, er bilen sikkert utenfor; ellers aldri «inne».
**D1 — avklart i §8.1:** DEC-030/DEC-031/DEC-032 forblir styrende for budsjettsum og budsjettgrense; ECON-001 *supplerer* med `import_cash_requirement`, `estimated_landed_cost` og et separat landed-cost-mål. Ingen overskriving og ingen parallell regelmodell.

## 4. Standarder og overstyringer
### 4.1 Registreringsdatoer (D2, D3)
Tre adskilte datoer bevares aldri sammenblandet:
1. **`source_first_registration`** — fra annonsen, med `precision ∈ {day, month, year, unknown}`.
   - `day`: brukes som oppgitt.
   - `month`: deterministisk **arbeidsdato = første dag i måneden** (`09/2026 → 2026-09-01`). Både `source{value, precision}` og `working{date, derived: true}` lagres; en avledet dag presenteres aldri som oppgitt (confidence `derived`). *Skjevhet:* første dag gir høyest alder ⇒ høyest bruksfradrag ⇒ laveste avgift (optimistisk). Når et bruksfradragstrinn eller regelskifte kan påvirke utfallet, beregnes også siste dag i måneden og motoren gir `date_sensitivity`-advarsel med intervall.
   - **`year` (D2): ingen arbeidsdato.** Motoren antar **ikke** 1. januar og oppfinner ikke måned/dag. Input er *utilstrekkelig for eksakt aldersbasert engangsavgift*: `registration_precision = "year"`, `workingDate = null`, `exactAgeCalculable = false`, og avgiften er `taxEstimateStatus = "blocked_exact"` (aldri et punktbeløp, aldri «eksakt»). Senere alternativer, ikke besluttet her: (a) *beregningsintervall* (min/maks over årets grenser, vist som intervall og merket «utilstrekkelig presisjon»); (b) forhandleren oppgir måned (`dealer-entered`, overstyrer presisjonen og lagres adskilt fra kilden). Landed cost og kontantbehov får da `lower_bound`/`not_calculated` for avgiftslinjen.
   - `unknown`: som `year`.
2. **`expected_norwegian_registration_date`** (D3) — datoen som er relevant for norsk registrering/import i avgiftsberegningen (styrer bruksfradrag og satsversjon, `docs/tax/event-dates.md`). **Standard = beregningsdato**, confidence `assumed-default`, overstyrbar av forhandleren (f.eks. senere forventet registrering). Alder i bruksfradraget = (norsk registreringsdato) − (kildens første registrering/arbeidsdato).
3. **`actual_norwegian_registration_date`** — `null` til den er kjent; når den settes, brukes den i stedet for forventet dato, og tidligere estimater merkes foreldet.

Resultatet lagrer hvilken dato som ble brukt (`dateBasis: expected | actual`). Endelig betalbar avgift kan avvike fra innkjøpsestimatet hvis registrering skjer senere (bruksfradrag og regelversjon endres); dette vises som advarsel («estimat per beregningsdato»). Grensen 2026-09-01 (gruppe b) gir `rate_boundary`-advarsel når forventet dato krysser den. *Hvilken hendelse som styrer bruksfradraget juridisk* (U-002/§ 3-3) er fortsatt TAX-spørsmål som ECON-002 avgjør fra E1-kilde; ECON-001 fastsetter bare at de tre datoene lagres adskilt.

### 4.2 Valutakurs (D6) — to roller, ikke én universalkurs
`FxQuote { pair, rate (desimalstreng), scale, basis, source: SourceRef, effectiveAt, quotedAt, validUntil?, confidence (Sourced-tilstand), fixtureOnly }`.
- **`acquisition_fx_rate`** — anslår forhandlerens kommersielle NOK-anskaffelseskost (det som faktisk betales selger). Mulig kilde: bank-/forhandlerkurs; også `dealer_entered`. Brukes til `acquisitionUsedNok`.
- **`customs_fx_rate`** — kursen som er relevant for norsk tollverdi/import-mva. der prosessen krever det. Kan avvike fra bank-/forhandlerkursen. Brukes til `customsValueNok` og dermed mva.-grunnlaget. Åpen TAX-konflikt U-008 (tollkurs) forblir i ECON-002 og avgjør *hvilken* kurs og *når* den gjelder; ECON-001 definerer bare at grensesnittet kan bære to ulike kurser.
- **Fixturekurs:** `10,6709` NOK/EUR er et **fast TESTINPUT** for de tre gyldne casene (`basis = "fixture"`, `fixtureOnly = true`, `validation_fixed`). Den er ikke en universell eller gjeldende produksjonskurs, og i fixturene brukes samme verdi for begge roller (forutsetning: kalkulatorkjøringene brukte én kurs).
- **Manglende `customs_fx_rate`:** aldri stille lik anskaffelseskursen. Tillatt reserve: bruk `acquisition_fx_rate` med eksplisitt `assumed-default`, advarsel «tollkurs ikke satt — mva.-grunnlag anslått med anskaffelseskurs» og nedgradert confidence; ellers `not_calculated`. Aldri i «offisiell reproduksjon» (A).
- Manglende `acquisition_fx_rate` for ikke-NOK-annonse ⇒ anskaffelseskost `unknown`/`not_calculated`.
- Ingen leverandør (DNB e.l.) er valgt eller hardkodet; produksjonskilde, oppdateringsfrekvens og lagring besluttes senere (ECON-008, U-008). `FxService` (server) leverer `FxQuote`; domenet tar `FxQuote` som input og kaller ikke nettverk.

### 4.3 Desimalregning og avrunding (D4)
- Intern aritmetikk er deterministisk desimal (heltallsskalert `bigint`/desimalstreng); **ingen binær float** i økonomi- eller avgiftsberegning. Penger i minste enhet (som `CostAssessment`).
- **Ingen unødvendig mellomavrunding.** Hver komponent lagrer `raw` (desimal) der den ikke er et heltall, og `nok` (betalt/vist heltall).
- **Avrundingsgrenser som reproduserer de offisielle resultatene (verifisert aritmetikk, [ANALYSE]):**
  1. *Kjøpesum:* beløp × kurs avrundes til nærmeste hele krone én gang: 2 689 248,2053 → 2 689 248; 366 662,79 → 366 663; 411 491,25 → 411 491. (366 662,79 utelukker «rund ned», 411 491,25 utelukker «rund opp ⇒ nærmeste».) Ingen likhetstilfelle (x,5) forekommer i de tre casene; **half-up** er valgt som konvensjon og må bekreftes.
  2. *Import-mva.:* 25 % av det **avrundede hele-krone-grunnlaget**, deretter nærmeste hele krone: 102 872,75 → 102 873; 16 665,75 → 16 666; 672 312,00.
  3. *Engangsavgift:* full desimalpresisjon gjennom vekt-, CO₂- og bruksfradragstrinn; avrundes **én gang** til hele kroner til slutt. *Kalkulatorens egen avrunding (mellomtrinn vs sluttsum) er ikke verifisert*: ECON-002 dokumenterer grensen fra E1-kilde/kalkulatorkjøring og viser at motoren gir 529 069 / 16 748 / 333 723 (inkl. vrakpant). Mismatch på 1 kr gir dokumentert avrundingsgrense, **aldri justering av satser**.
  4. *Vrakpantavgift:* heltall (2 400, R-IMP-OTH-001, E1). *Summer* er summer av hele kroner.
- Fixture-krav: forventede offisielle heltall er faste; testen feiler hvis de endres eller hvis noen bruker `number`-float i økonomikoden (arkitekturvakt i ECON-004).

### 4.4 Øvrige standarder
**Transport.** Standard NOK 8 000 til norsk grense; konfigurerbar (system) og overstyrbar (dealer); alltid vist som forutsetning, `assumed-default`. Inngår i tollverdien/mva.-grunnlaget (transport til innførselssted, R-IMP-VAT-002) og fordeles ikke dobbelt (IMPORT_ENGINE_SPEC). Effekt på totaler: se §12.
**Eksportvilkår.** Merovo krever **ikke** bekreftelse på at selger kan selge netto/uten mva. til eksport før vurdering. Forhandling, eksportvilkår og endelig kjøpesum er forhandlerens ansvar; Merovo vurderer tilgjengelighet ut fra oppgitt annonse. Advarsel «eksportvilkår ikke bekreftet» vises som informasjon, ikke som blokkering.
**Forhandlet pris.** `acquisitionAdvertisedNok` (fra annonsen, aldri overskrevet) og `acquisitionExpectedNok` (dealer-justert, med tidspunkt/bruker) lagres adskilt; `acquisitionUsedNok` angir hva beregningen bruker, og forklaringen sier hvilken. Opprinnelig proveniens overskrives aldri.

## 5. Kjøretøyets vekt og typegodkjenningsdata
Et generisk `weight`-felt er forbudt. Modell (per kandidat):
- `source_weight` {`kg`} og `source_weight_definition` (`unknown | provider_stated_unspecified | eu_type_approval_min | eu_type_approval_max | mass_in_running_order | …`; ukjent hvis leverandøren ikke sier det);
- `norwegian_tax_weight` {`kg`} — **den** vekten norsk avgift skal bruke; `null` (ikke beregnet) til den er kjent;
- `weight_source` (`homologation_db | oem_coc | provider_listing | reference_listing | dealer_entered`) og `weight_confidence` (§11).
Norsk avgiftsvekt: avgiften beregnes på «egenvekt» (R-OTA-001, E1P), og for utenlandsk bil viser rundskriv 3.2.2 til *minimumsvekt fra europeisk typegodkjenning* (R-OTA-004, åpent punkt: forskrift § 3-1 er ikke lest). Eksakt norsk definisjon og forskjell mot leverandørens vektdefinisjon **må avklares fra E1-kilde før motoren tillates å bruke annonsevekt**. `NormalizedListing.curbWeightKg` («vekttype uklar», `docs/tax/profiles.md`) kan **ikke** brukes direkte som `norwegian_tax_weight`; den mappes til `source_weight` med definisjon `unknown` inntil leverandørmappingen sier noe annet. `TaxInputV1.kerbWeightKg` (profiles.md) = `norwegian_tax_weight` (ingen parallell vektmodell).
**FINN-sammenlignbare annonser** kan brukes som midlertidig test-/referansebevis (`reference_listing`, confidence «reference-only») og kan **aldri** være autoritativ produksjonskilde.
**Behov for ekstern kjøretøydata (kategorier, ingen leverandør valgt, ingen evidens innhentet i denne oppgaven):** (a) typegodkjennings-/samsvarsdata (CoC, typegodkjenningsnummer + variant/versjon) fra OEM eller offisielt register med målt/typegodkjent masse og CO2/WLTP-verdier; (b) kommersiell kjøretøyspesifikasjonsdatabase (merke/modell/variant/motorkode/år) med homologert masse; (c) offisielt norsk kjøretøyregister som *referanse* for norsk-registrerte tvillinger. Oppslag må kunne gjøres uten VIN (type-/variantnøkkel), siden VIN ikke kan antas tilgjengelig eller lagringsbar (DATA-001 §6). Valg av leverandør krever egen evaluering og avtale; rettighetsprofilen (DATA-002B) gjelder også kjøretøydata-leverandører.

## 6. Mva.-modell (tre adskilte lag)
1. **Kilde/annonse:** `advertisedGross`, `advertisedNet`, `sourceVat.rate`, `sourceVat.status` (`stated | claimed_reclaimable | unknown`), belegg. **Ingen antakelse om utenlandsk eksportbehandling**; refusjon av utenlandsk mva. er en sak mellom kjøper og selger (R-IMP-REF-001). Bruker Merovo en netto annonsepris, er det annonsens påstand (`provider-supplied`), ikke bekreftet kjøpsgrunnlag. Brutto uten dokumentert netto ⇒ kjøpsgrunnlaget er `unknown`/`gross_only` (docs/tax/purchase-basis.md).
2. **Norsk import-mva.:** 25 % av tollverdi (kjøpesum + transport + forsikring til norsk innførselssted); senere norske avgifter (engangsavgift) inngår ikke bare fordi de oppstår senere (R-IMP-VAT-002, E1P; E1X-bekreftet). **Elbil:** E1X-regel om 300 000 kr-fritak (R-IMP-VAT-003) — anvendelse ved forhandlerimport er uavklart (åpent punkt).
3. **Forhandlerens regnskap (D8):** `importVatRecoverability: "recoverable" | "non_recoverable" | "unknown"` (R-DED-001, E1P: fradrag for personkjøretøy anskaffet for videresalg). **Standard `unknown`.** Utledes aldri av at brukeren er forhandler; settes bare eksplisitt (forhandlerprofil eller per søk) med kilde, bruker og tidspunkt. Styrer bare *permanent økonomisk kost* (`estimated_landed_cost`), aldri selve import-mva.-beløpet og aldri kontantbehovet.
   - `unknown` ⇒ UI/spec viser **verken** import-mva. som permanent kost **eller** som fullt refunderbar: kontantbehov beholdes, mva.-beløpet vises separat, landed cost er «uavgjort» eller vises som to tydelig merkede scenarier (§12).
Ett tall for «mva.» er forbudt: motoren skiller `advertisedGross/Net`, kilde-sats/-status, norsk import-mva., fradragsstatus, kontantbehov og økonomisk landed cost.

## 7. Gyldne testcaser (regresjonsfixturer)
Gitt av Christian, kjørt i Skatteetatens kalkulator [OPPGITT]. **Forventede offisielle verdier endres aldri.** Hver case har to adskilte deler: **A. offisiell kalkulatorreproduksjon** (ingen transport, ingen Merovo-standarder) og **B. Merovo sourcing-økonomiscenario** (transport og tilstander). Transport og andre standarder forurenser aldri A.

| | CASE-001 Lamborghini Urus PHEV | CASE-002 BMW iX3 EV | CASE-003 Mercedes E 400 d 4MATIC Estate |
|---|---|---|---|
| Annonse netto (EUR) | 252 017 | 34 361 | 38 562 |
| Første reg. (arbeidsdato) | 2026-09-01 | 2023-08-01 | 2023-11-01 |
| km | 2 978 | 43 300 | 34 353 |
| Effekt / motor | 588 kW, 3 996 cc | 210 kW | 243 kW, 2 925 cc |
| CO₂ (WLTP) | 140 g/km | 0 (rekkevidde 458 km) | 179 g/km |
| Norsk avgiftsvekt (ref.) | 2 610 kg | 2 185 kg | 1 976 kg |
| **Offisiell «Avgift»** (= `total_registration_taxes`, **inkl. vrakpant**) | **529 069** | **16 748** | **333 723** |
| Offisiell kjøpesum (NOK) | 2 689 248 | 366 663 | 411 491 |
| Offisiell mva. | 672 312 | 16 666 | 102 873 |
| **Offisiell total** | **3 890 629** | **400 077** | **848 087** |

### 7.A Offisiell kalkulatorreproduksjon
Input: EUR-pris, fixturekurs 10,6709 (begge roller, `fixtureOnly`), **transport = 0 (eksplisitt)**, mva.-tilstand ikke relevant (offisiell total er en betalbar sum, ikke en landed cost), registrerings-/kjøredato som i kalkulatorkjøringen (**skal dokumenteres**, D5).
- *A1 aritmetikk (kan automatiseres nå):* kjøpesum = rund(EUR × 10,6709); mva. = 25 % × kjøpesum (CASE-002: 25 % × (kjøpesum − 300 000)); total = kjøpesum + avgift + mva. Alle avrundinger iht. §4.3. Forventet: tabellen over, eksakt.
- *A2 avgift (kan IKKE automatiseres som motorreproduksjon nå):* forventet `total_registration_taxes` = offisiell «Avgift». Inntil ECON-002 er avgiften *offisiell input*, ikke motorresultat (probe under).
- *Komponentoppdeling (D5, avklart):* offisiell «Avgift» **inkluderer vrakpant** i alle tre (skjermbilder/manuell validering, oppgitt av Christian). Domenet beholder tre separate felt: `one_off_tax`, `scrappage_deposit` (2 400, R-IMP-OTH-001, E1) og `total_registration_taxes`. Forventet oppdeling: CASE-001 526 669 + 2 400; CASE-002 14 348 + 2 400; CASE-003 331 323 + 2 400. Delingen er *utledet aritmetikk* (Avgift − 2 400), gyldig forutsatt at vrakpanten er 2 400 i kalkulatorkjøringen; ECON-002 verifiserer mot skjermbildene. Vrakpanten ligger utenfor mva.-grunnlaget i alle tre (verifisert aritmetikk).
- *Verifisert aritmetikk, kurs:* 10,6709 reproduserer 2 689 248 / 366 663 / 411 491. Mva.-grunnlaget er kjøpesum uten avgift (CASE-002 minus 300 000-fritak).

### 7.B Merovo sourcing-økonomiscenario (transport 8 000, `assumed-default`)
Kjøpesum + transport = tollverdi (fixturekurs som `customs_fx_rate`); mva. 25 % av tollverdi (CASE-002: 25 % av tollverdi − 300 000); `total_registration_taxes` uendret (transport påvirker ikke avgiften); alt heltall iht. §4.3.

| | kjøpesum + transport | import-mva. | `total_registration_taxes` | **`import_cash_requirement`** | landed cost, `recoverable` | landed cost, `non_recoverable` | landed cost, `unknown` |
|---|---|---|---|---|---|---|---|
| CASE-001 | 2 697 248 | 674 312 | 529 069 | **3 900 629** | **3 226 317** | **3 900 629** | uavgjort (3 226 317 – 3 900 629, to merkede scenarier) |
| CASE-002 | 374 663 | 18 666 (25 % av 374 663 − 300 000) | 16 748 | **410 077** | **391 411** | **410 077** | uavgjort (391 411 – 410 077) |
| CASE-003 | 419 491 | 104 873 | 333 723 | **858 087** | **753 214** | **858 087** | uavgjort (753 214 – 858 087) |

**Korrigert avstemming mot offisiell total (A → B):** 8 000 kr transport gir 2 000 kr ekstra import-mva. (25 %; CASE-002 ligger over 300 000-fritaket, så hele tilleggs-mva. gjelder).
- `import_cash_requirement`: **+10 000** (offisiell total + 8 000 + 2 000).
- Landed cost `recoverable`: **+8 000** i forhold til offisiell total *uten* import-mva. (offisiell total − offisiell mva. + 8 000: 3 890 629 − 672 312 + 8 000 = 3 226 317; 400 077 − 16 666 + 8 000 = 391 411; 848 087 − 102 873 + 8 000 = 753 214).
- Landed cost `non_recoverable`: **+10 000** (= kontantbehovet).
- Landed cost `unknown`: ingen enkelttall; kontantbehov og mva.-beløp vises, landed cost som uavgjort / to merkede scenarier.
(Tidligere formulering i ECON-001 om «+10 000 i alle tilfeller» gjaldt bare kontantbehov og ikke-fradragsberettiget mva. og er rettet.) Mva.-regelen for CASE-002 ved forhandlerimport (R-IMP-VAT-003, åpent) gjør landed cost for CASE-002 *betinget*. B-forventningene er utledet av Claude fra offisielle A-verdier og regler, ikke offisielt validert.

### 7.C Automatisering
Kan automatiseres nå: A1, B (aritmetikk, begge fradragstilstander og `unknown`-oppførsel), lås av offisielle verdier (testen feiler hvis forventede verdier endres), og at B ikke endrer A. Kan ikke automatiseres nå: A2 som motorreproduksjon (se probe).

**Probe (ikke validering):** en naiv anvendelse av parametrene som finnes i TAX-grunnlaget (gruppe a 2026, E1X: vekt 260 kr/kg over 1 200 kg; CO₂ 800/1 600/3 200/5 000 per g/km i bånd, anvendt marginalt) gir for CASE-003 før bruksfradrag 201 760 (vekt) + 252 800 (CO₂) = 454 560 kr, mens offisiell avgift 333 723 impliserer 26,6–27,1 % bruksfradrag (tabell T07 gir 26 % for 24–29 måneder). For CASE-001 gir samme metode 510 600 kr mot offisielle 526 669 kr (uten vrakpant): +3,1 % — manglende/avvikende komponent. For CASE-002 gir ICE-satsen 256 100 kr på vekt mot offisielle 14 348 kr (uten vrakpant): EV-/vektkomponenten har andre satser som ikke er lest. **Konklusjon:** avgiftsmotoren kan ikke reproduseres fra dagens E1X-parametere; marginal/trinnvis beregning, EV-satser, PHEV-regel (vektet CO₂, ev. fradrag; U-005), avrunding og norsk registreringsdato (bruksfradrag) mangler. Dette er presis det TAX-gapet ECON-002 må lukke.

## 8. Avgiftsgrensen
```
kandidatøkonomi → normaliserte avgiftsinput (TaxInputV1) → avgiftsmotor → avgiftsnedbrytning → landed-cost-motor
```
Motoren **konsumerer** en deterministisk norsk avgiftskalkulator som én komponent: `calculateNorwegianTax(input: TaxInputV1, ruleSet: RuleSetRef): TaxResult` der `TaxResult` er `{status: "calculated", components[], ruleSetRef, confidence}` eller `{status: "not_calculated", reasons[]}`. Ingen egen regeltabell i økonomi­laget; ingen parallell regelmodell.
**Gjenbrukbart [REPO]:** `docs/tax/rules.json` (31 regler med evidensnivå, datoerte parametere for gruppe a/b), `sources.json` (E1/E1P/E1X/E2), `references.json` (108 referansetilfeller i fire klasser; klasse 3 regnes på nytt av `check-docs.mjs`), `bruksfradrag-tabell-T07.json` (41 trinn, E1 med hash), `event-dates.md` (hendelsesdatoer), `purchase-basis.md` (tre adskilte summer), `profiles.md` (10 profiler + `TaxInputV1`), valideringen med DONE-sperre, samt `IMPORT_ENGINE_SPEC.md`. TAX-fundamentet er **REVIEW**: 0 godkjente parametere, 0 klasse 1-referanser, åpne konflikter U-002 (bruksfradrag § 3-3), U-003 (dekning 2026), U-005 (ladbar hybrid), U-008 (tollkurs); T30–T39 er E1X uten kildefil/hash.
**Gjenstår før runtime er trygt (TAX/ECON-002):** (1) E1-kildefiler med hash for stortingsvedtak og forskrift (§§ 2-3, 3-1, 3-3); (2) godkjente parametere per profil; (3) **klasse 1-referanser** — de tre gyldne casene *kan bli klasse 1* når kalkulatorkjøringene dokumenteres (inputs inkl. norsk registreringsdato, kjøredato, skjermbilde/utskrift) — de dekker PHEV-personbil, EV-personbil og diesel-personbil, men ikke varebil/andre profiler; (4) EV-vektkomponent og PHEV-regler; (5) trinnvis/marginal beregning og avrunding; (6) tollkurs-/FX-regel (U-008); (7) klimagass (mengde), registreringsgebyr og eventuell toll ukjent ⇒ `unknownCharges`; (8) styrende hendelsesdato.
### 8.1 Forhold til DEC-030 og TAX-001A–E (D1)
ECON-001 overskriver eller erstatter hverken DEC-030, DEC-031, DEC-032 eller TAX-001A–E, og innfører ingen parallell avgiftsregelmodell.

| Tema | Styrende dokument | ECON-001 |
|---|---|---|
| Budsjettsemantikk: `BudgetSpec`, budsjettsum inkl. beregnede norske avgifter (inkl. import-mva.) og valgte kostnader, slingringsmonn, `classifyBudget` | DEC-030, DEC-031 (`src/domain/search-v2`) | **gjenbruker uendret** |
| De tre summene (budsjettsum / økonomisk kost / betalings-/kapitalbehov) fra ett komponentgrunnlag | DEC-032, `docs/tax/purchase-basis.md` §6 | **gjenbruker**: `import_cash_requirement` ≈ kapitalbehov ved innførsel; `estimated_landed_cost` ≈ økonomisk kost; budsjettsummen forblir DEC-030-summen og er numerisk lik kontantbehov + valgte tilleggskostnader (ikke slått sammen, ikke avledet fra hverandre) |
| Avgiftsregler, evidensnivå, parametere, referanseklasser, hendelsesdatoer, `TaxInputV1`, kjøpsgrunnlag L0–L4 | DEC-032, `docs/tax/` | **gjenbruker**; ingen regeltabell i økonomilaget. `norwegian_tax_weight` ≡ `TaxInputV1.kerbWeightKg`; de tre registreringsdatoene (§4.1) mapper til hendelsesdatoene i `event-dates.md` |
| Beregningsflyt, confidence HIGH/MEDIUM/LOW, transport, retail/bidrag | `IMPORT_ENGINE_SPEC.md` | **supplerer**: definerer `import_cash_requirement`/`estimated_landed_cost`, headroom, mva.-fradragstilstand; retail/bidrag forblir senere lag |
| `CostAssessment`-kontrakten | `src/domain/search-v2` | økonomi **mapper inn** i den (`to-cost-assessment`) |
| Vekt-, FX-, registreringsdato- og mva.-tilstandsmodell; golden A/B | **ECON-001** (ny, supplerende) | ny, men kun som input/tilstand til TAX og landed cost |
| Rettighetsnøkler for avledede tall | DEC-034/DATA-002B (utvides senere) | §13 |

**Konflikter:** tidligere utkast av denne spesifikasjonen foreslo en `vatBasis = exclude_recoverable_vat`-modus på budsjettet, og likestilte `BudgetSpec.maxTotalNokMinor` med «maks landed cost». Begge er **trukket**: det ville endret DEC-030-semantikken. Løsningen er to separate grenser (budsjett mot budsjettsum; valgfritt `maxLandedCostNok` mot `estimated_landed_cost`). **Ingen reell konflikt gjenstår.** Åpne punkter som ikke er konflikter og som ECON-002/005 avgjør: hvilken hendelse som styrer bruksfradrag (U-002), tollkursregel (U-008), og hvordan søke-UI navngir de to grensene (ECON-005).

**TAX-foundation skal ikke merkes DONE** av denne oppgaven; sperren i `check-docs.mjs` (godkjente parametere > 0 og klasse 1 per profil) er ikke oppfylt.

## 9. Valgfritt lokalt markedsbenchmark (fremtidig lag; ikke implementert)
Valgfritt per forhandler/søk; motoren fungerer uten. Mulig kilde: VEND/FINN **hvis** kontraktsmessig tilgang gis (ingen antakelse; ingen tilgang finnes). Modell `MarketBenchmark`: antall sammenlignbare norske annonser, laveste relevante utbudspris, median, prisintervall, forhandler vs privat, alder på data, kriterier som ble brukt (samme `SearchSpec`), kandidatens landed cost, **market spread** = `referansepris − landed cost`, **spread %** = `spread / referansepris` (referanse = valgt: laveste relevante, median). «Utbudspris» (asking price), aldri «salgspris»/«profitt». Spread beregnes mot en avgjørbar `estimated_landed_cost`; ved uavgjort mva.-tilstand vises spread per merket scenario (eller ikke), aldri mot ett antatt tall. Leverandørens rettighetsprofil (DATA-002B) styrer visning/matching/lagring av benchmarkdata; avledede tall krever avklart avledet-data-rett. Sammenligningen krever kompatibelt mva.-/avgiftsgrunnlag (norske utbudspriser er sluttkundepriser inkl. mva./avgifter) — ellers `not_comparable`.

## 10. Forhåndssolgt anskaffelsesflyt
`Kunde-/forhandlerkrav → Merovo-søk → europeiske kandidater → kandidatpasning → landed cost → (valgfritt) norsk markedsbenchmark → forhandleren velger kandidat → bekrefter/forhandler/kjøper utenfor Merovo.` Nytten: forhandleren kan selge eller love en bil *før* import/lagerføring fordi Merovo viser hva som finnes og hva den ca. koster inn i Norge; det reduserer behovet for spekulativt lager. Merovo foretar ingen transaksjon, auksjon, betaling eller logistikk (krever egen godkjenning).

## 11. Tillit og ukjente
`Sourced<T> = { value, confidence, source, asOf }` med tilstander: `verified`, `provider-supplied`, `enriched-reference` (typegodkjenning/homologering), `reference-only` (f.eks. sammenlignbar FINN-annonse), `derived`, `dealer-entered`, `assumed-default`, `unknown`.
Eksempler: transport 8 000 → `assumed-default`; vekt fra homologeringsdatabase → `enriched-reference` (verified hvis typegodkjenningsdata); vekt fra sammenlignbar FINN → `reference-only` (blokkerer «full» avgift); registreringsdag fra måned/år → `derived`; manuell kurs → `dealer-entered`; ukjent klimagassavgift → `unknown`.
**Regler:** ingen linje kan være sikrere enn svakeste kritiske input; `unknown` på en kritisk komponent ⇒ `completeness: lower_bound` og ingen «inne i mål» (`indeterminate`/`outside_certain`); samlet kalkyletillit følger IMPORT_ENGINE_SPEC (HIGH/MEDIUM/LOW som forklarte kvalitetsregler, ikke sannsynlighet); material forutsetninger listes i `warnings` og forklaringen; uvalidert/utløpt avgiftsprofil ⇒ ingen landed cost-påstand.

## 12. Nedbrytning: `import_cash_requirement` vs `estimated_landed_cost`
```
acquisition_used_nok (kjøpesum via acquisition_fx_rate)
 + transport (standard 8 000, assumed-default)  [+ forsikring/øvrig kjent til innførselssted]
 = customs value (via customs_fx_rate for utenlandsk valuta)   → import-mva.-grunnlag
import_vat       = 25 % av grunnlaget (R-IMP-VAT-002; EV: 300 000-regel åpen, R-IMP-VAT-003)
one_off_tax + scrappage_deposit = total_registration_taxes
other_known_charges ; unknown_charges (vises, summeres ikke)
```
### import_cash_requirement
`acquisition_used_nok + transport + øvrige kjente kontantposter + import_vat + total_registration_taxes + other_known_charges`.
- Betingelser: alle komponenter kjent; ellers `completeness: lower_bound`.
- **Uavhengig av mva.-fradragstilstand.** Det er det som må finansieres ved innførsel/registrering *før* eventuell senere mva.-fradrag; det er ikke en kostnad og ikke et resultat. Tidspunkt for mva.-oppgjør/refusjon modelleres ikke.
- Tilsvarer likviditets-/kapitalbehov (DEC-032) og, uten ekstra valgte kostnader, DEC-030-budsjettsummen.

### estimated_landed_cost (permanent økonomisk kost)
`acquisition_used_nok + transport + øvrige kjente kostnader + one_off_tax + scrappage_deposit + other_known_non_deductible_charges + (import_vat KUN hvis non_recoverable)`.
Vrakpantavgift (innbetaling) er kostnad; vrakpantutbetaling ved skroting er ikke en importkostnad og er utenfor (DEC-032).

| `importVatRecoverability` | `estimated_landed_cost` | Effekt av 8 000 transport |
|---|---|---|
| `recoverable` | uten import-mva. | landed **+8 000**; kontantbehov **+10 000** |
| `non_recoverable` | med import-mva. (= `import_cash_requirement` når ingen andre fradrag) | landed **+10 000**; kontantbehov **+10 000** |
| `unknown` (**standard**) | **`null`** — ingen enkelttall for permanent kost | landed uavgjort: +8 000 / +10 000 som merkede scenarier; kontantbehov **+10 000** |

(Gjelder når transport inngår i grunnlaget og grunnlaget ligger over evt. EV-fritak. Ligger grunnlaget under et fritak, endres mva.-deltaen tilsvarende; motoren beregner, antar ikke +25 %.)

### Ved `unknown`
- Behold `import_cash_requirement`; vis `import_vat` separat som egen linje.
- `estimatedLandedCost = { status: "unresolved_vat", valueNok: null, scenarios: { if_recoverable, if_non_recoverable } }`. UI viser enten «Permanent kost er ikke avgjort — avhenger av mva.-behandling» eller begge scenarier tydelig merket («Hvis mva. er fradragsberettiget: …» / «Hvis ikke: …»). Aldri ett tall, aldri import-mva. som stilltiende kost eller som stilltiende refunderbar.
- Mål og headroom: se §3 (begge scenarier); `no_target` / `indeterminate` følger tre-verdi-reglene.

Hver linje bærer `{label, amount, currency, confidence, ruleRef, assumption?}`; summer er presise (heltall) og UI avrunder bare visning (IMPORT_ENGINE_SPEC). Ufullstendig sum er `lower_bound` og kalles ikke full importkost.

## 13. Arkitektur
Rene, deterministiske funksjoner i `src/domain/economics/` (ingen I/O, ingen UI, ingen provider, ingen LLM, ingen nettverk); `bigint`/desimalstreng, eksplisitt avrunding per regel:
`types.ts` (Sourced, Money, Confidence) · `acquisition.ts` (brutto/netto/ukjent, forhandlet pris) · `fx.ts` (`FxQuote`, konvertering med avrunding) · `registration-date.ts` (arbeidsdato, presisjon, sensitivitet) · `transport.ts` (standard/overstyring) · `weight.ts` (`source_weight`/`norwegian_tax_weight`) · `tax-input.ts` (normalisering → `TaxInputV1`) · `norwegian-tax/` (grensesnitt + versjonerte regelsett; implementeres kun etter TAX-gate; leser `docs/tax`-konvensjonen) · `vat.ts` (import-mva., fradragstilstand) · `landed-cost.ts` (to summer, `lower_bound`) · `target.ts` (hodefrihet, tre-verdi-status) · `explain.ts` (nedbrytning/advarsler) · `to-cost-assessment.ts` (kobler til eksisterende `CostAssessment`: `complete_validated` bare når regelsett validert, ellers `incomplete`/`unvalidated` med `profileRef`, `validUntil`, `candidateId/Version`, `costBasisOf`).
Server (ikke domene): `FxService` (henter Tolletaten-/annen kurs, lagrer kilde/tid), `VehicleDataEnrichment`-grensesnitt (homologering/vekt/CO₂), økonomiorkestrering som kaller kandidatadapteren. Provider-spesifikk parsing ligger i adaptere (`NormalizedListing` er grensen). UI får bare *visningsmodell* via `search-display`-grensen: **økonomitall er avledede data og må gå gjennom visningsrettighetene (DATA-002A/B)**; rettighetene for avledede økonomitall er **to adskilte** (D7), begge default **nei**, begge fail-closed:
- **`allow_derived_economics`** — rett til å bruke leverandørdata internt som *input* til økonomiberegning, per felt (samme form som `matching_fields` i DATA-002B: pris, første registrering, km, effekt, CO₂, vekt, drivstoff …).
- **`display_derived_economics`** — rett til å *vise* det avledede resultatet (kontantbehov, landed cost, headroom, spread, nedbrytning). Kan senere få granularitet (kun totaler / full nedbrytning); ikke besluttet her.
Kombinasjoner: tillatt for matching men ikke for økonomi; tillatt for økonomi men ikke rå visning av feltet; avledet visning tillatt eller forbudt separat. Avledet resultat som avslører en rå verdi (f.eks. annonsepris) krever i tillegg gjeldende visningsrett for det feltet. Mangler rett ⇒ `economics: unavailable` med grunn `rights_not_granted` (ikke 0, ikke skjult). Lagring av avledede tall følger leverandørens cache-/retensjonsrett (DATA-002B). Ingen antakelse om at avledede tall er kontraktsmessig tillatt (DATA-001 §3).
**Oppfølging (ingen migrasjon i ECON-001-FIX):** ECON-005 utvider `private.provider_rights_profiles` (og `src/domain/provider-rights.ts`, `toDisplayPolicy`) med de to rettighetene, inkludert guard-trigger-immutabilitet, differensialtest og oppdatering av syntetisk profil (begge `false`/forbudt eller eksplisitt `true` kun for syntetisk demo).

## 14. Implementeringsplan
| Oppgave | Formål | Avhengighet | DB | UI | Leverandør-credentials | Kan starte nå? |
|---|---|---|---|---|---|---|
| **ECON-002** TAX-/runtime-gapslukking | E1-kilder m/hash for T30–T39, godkjenn parametere, EV-/PHEV-regler, marginal/trinn, avrunding, U-002/U-003/U-005/U-008, dokumenter kalkulatorkjøringene som klasse 1 | TAX-001E; Christians kilder/skjermbilder | nei | nei | nei (men trenger tilgang til offisielle kilder) | **Ja** (dokument/kilde; Christian må levere belegg) |
| **ECON-003** Gyldne fixturer | `docs/econ/` + `tests/fixtures`: de tre casene (offisiell reproduksjon + Merovo-utvidelse), aritmetikk-tester (kurs, avrunding, mva., sum, kontantbehov, landed cost), test som låser offisielle verdier | ECON-001; D5 (vrakpant) og kurs bekreftet | nei | nei | nei | **Ja** |
| **ECON-004** Landed-cost-kjerne | `acquisition`, `fx`, `registration-date`, `transport`, `weight`, `vat`, `landed-cost`, `target`, `explain` som rene funksjoner; avgiftsmotor bak grensesnitt (`not_calculated` til TAX er godkjent) | ECON-003 | nei | nei | nei | **Ja** (avgiftsdel stub «ikke beregnet») |
| **ECON-005** Søkeintegrasjon | `EconomicTarget` på søk (utvider `BudgetSpec`), `to-cost-assessment`, `classifyBudget` får ekte vurdering; rettigheter `allow_derived_economics` / `display_derived_economics` | ECON-004, TAX-gate, DATA-002B | **ja** (spec-JSON-skjema + to profilkolonner) | liten | nei | Etter ECON-002/004 |
| **ECON-006** Forklarings-UI | nedbrytning, forutsetninger, tillit, to summer, «ikke beregnet» der det mangler; kun via `search-display`-grensen | ECON-005 | nei | **ja** | nei | Etter ECON-005 |
| **ECON-007** Vekt-/homologeringsberikelse | `VehicleDataEnrichment`-grensesnitt, leverandørevaluering (kategori i §5), `norwegian_tax_weight` med confidence | avtale/leverandørvalg | ev. cache-tabell | nei | **ja** (leverandør) | Grensesnitt: ja; leverandør: nei |
| **ECON-008** FX-tjeneste | `FxService` + kildevalg (U-008), lagring av kurs/tid | beslutning om kurskilde | ja (kurslager) | nei | nei (offentlig kilde, men nettverkstilgang kreves) | Grensesnitt: ja |
| **ECON-009** Valgfritt markedsbenchmark | `MarketBenchmark`-fundament (kun modell + syntetisk) | ECON-005; kontrakt for VEND/FINN | ja | liten | **ja** (VEND/FINN) | Modell: ja; data: nei |
Kritisk sti til partnerdemo med landed cost: **ECON-002 → 003 → 004 → 005 → 006** (007/008 for ekte data; 009 valgfritt).

## 15. Anbefaling
1. **Bygg først:** ECON-003 (fixturer) og ECON-002 (TAX-gap: kilder + klasse 1 av de tre casene) parallelt, deretter ECON-004 (kjerne med avgift bak grensesnitt). Ingen UI før disse.
2. **TAX som må gjenbrukes/fullføres:** hele `docs/tax/`-grunnlaget (se §8); fullfør E1-kilder, godkjente parametere, EV/PHEV, marginal/avrunding, U-002/U-003/U-005/U-008, og klasse 1-referanser (de tre casene er et godt utgangspunkt). Ikke bygg en parallell regelmodell.
3. **Kan de tre casene automatiseres trygt nå?** Ja som fixturer med offisielle verdier og uavhengig aritmetikk; nei som reproduksjon av avgiften (§7-probe). Kurs 10,6709 (fixture) og vrakpant-inklusjon er avklart (§4.2, §7.A). Gjenstår som *belegg* (ikke beslutning): dokumentasjon av kalkulatorkjøringene — norsk registreringsdato, kjøredato, skjermbilder.
4. **Kategori for vekt-/homologeringsdata:** typegodkjennings-/CoC-data (type + variant + versjon) fra OEM/offisielt register og/eller en kommersiell kjøretøyspesifikasjonsdatabase med homologert masse; norsk register som referanse. Ingen leverandør valgt; ikke VIN-avhengig.
5. **Brukerkonfigurerbare forutsetninger:** transport (standard 8 000), forhandlet kjøpesum, norsk registreringsdato, kurs (innen godkjent kilde), mål (maks landed cost m.m.), separat landed-cost-mål (D1), fradragsstatus for import-mva. (forhandlerprofil/søk; standard `unknown`), `acquisition_fx_rate`/`customs_fx_rate`, tilleggskostnader (forsikring, klargjøring), valg av benchmarkreferanse.
6. **Aldri stille antatt:** vekt (norsk avgiftsvekt), CO₂-grunnlag/målemetode, fradragsrett, norsk registreringsdato utover eksplisitt standard, klimagass-/toll-/gebyrbeløp, eksportvilkår (informasjon, ikke blokkering), avgiftsgruppe/kjøretøyklasse, om «avgift» inkluderer vrakpant, FINN-referanse som sannhet, at en provider tillater visning av avledede tall.
7. **Før landed cost vises i den eksterne partnerdemoen (porter):** (a) avgiftsmotor validert for de viste profilene (E1-parametere godkjent + klasse 1-referanser) og TAX-gate oppfylt for disse; (b) FX-kilde og dato vist for begge roller; (c) alle forutsetninger vist og merket (transport, forventet norsk registreringsdato, fradragsstatus `unknown` ⇒ ingen enkelt landed cost-tall); (d) ukjent/«ikke beregnet» for alle ikke støttede profiler; (e) kurs/avgift «estimat — ikke rådgivning»-merking og syntetisk-etikett; (f) rettighetskontroll for avledede tall (`allow_derived_economics` og `display_derived_economics`) for hver kilde; (g) testet mot gyldne fixturer i CI; (h) Codex-review. Inntil da vises «Innkjøpskostnad til Norge er ikke beregnet» som i dag.

## 16. Beslutninger D1–D8 (avklart i ECON-001-FIX)
| # | Beslutning | Hvor |
|---|---|---|
| D1 | DEC-030/031/032 og TAX-001A–E er styrende og uendret; ECON-001 gjenbruker og supplerer; to separate grenser (budsjett mot budsjettsum, valgfritt landed-cost-mål); ingen parallell regelmodell; ingen reell konflikt gjenstår | §3, §8.1 |
| D2 | Måned+år ⇒ 1. i måneden (avledet, presisjon bevart). Bare år ⇒ **ingen** arbeidsdato, `registration_precision = year`, eksakt engangsavgift blokkert/intervall senere | §4.1 |
| D3 | `expected_norwegian_registration_date` (standard beregningsdato, `assumed-default`, overstyrbar); kilde-, forventet og faktisk norsk dato lagres adskilt | §4.1 |
| D4 | Desimalaritmetikk, ingen float, ingen unødvendig mellomavrunding, `raw` + heltall; avrundingsgrenser dokumentert; ingen sats­tuning | §4.3 |
| D5 | Offisiell «Avgift» inkluderer vrakpant i alle tre; domenet har `one_off_tax`, `scrappage_deposit`, `total_registration_taxes` | §7.A |
| D6 | `acquisition_fx_rate` og `customs_fx_rate` adskilt; 10,6709 er bare fixture-input; ingen leverandør valgt | §4.2 |
| D7 | `allow_derived_economics` og `display_derived_economics`, begge default nei; ingen migrasjon nå | §13 |
| D8 | `importVatRecoverability` = `recoverable \| non_recoverable \| unknown`, standard `unknown`; ukjent ⇒ ingen enkelt landed cost | §6, §12 |

## 17. Status
**ECON-001 = REVIEW** (anbefalt for DONE ved Christians/Codex' aksept; se §18). Ingen kode, runtimelogikk, DB- eller UI-endring. TAX-foundation er uendret **REVIEW**. Ingen deploy, ingen leverandørtilkobling.

## 18. Sluttvurdering (ECON-001-FIX)
- **Er D1–D8 avklart?** Ja, som spesifikasjonsbeslutninger (§16). Ingen av dem er implementert eller validert i kode.
- **Blokkerer noe ECON-002?** Ingen uavklart *beslutning*. ECON-002 trenger *belegg* som Christian må levere: E1-kilder (stortingsvedtak, forskrift §§ 2-3, 3-1, 3-3) og dokumenterte kalkulatorkjøringer (norsk registreringsdato, kjøredato, skjermbilder) for å gjøre de tre casene til klasse 1. ECON-002 skal også avgjøre U-002 (bruksfradrag/styrende hendelse), U-003, U-005 og U-008 (tollkurs). Dette er ECON-002s innhold, ikke åpne ECON-001-valg.
- **Er landed-cost-modellen intern konsistent?** Ja. Kontantbehov er uavhengig av fradragstilstand; landed cost avhenger av den; 8 000 transport gir +10 000 kontantbehov og +8 000 / +10 000 / uavgjort i landed cost. Tallene i §7.B er avstemt aritmetisk mot de offisielle A-verdiene. B-verdiene er utledet av Claude, ikke offisielt validert.
- **Er offisiell avgiftsreproduksjon og Merovo-scenario adskilt?** Ja (§7.A / §7.B); A har transport 0 og ingen Merovo-standarder. A2 (motorreproduksjon av avgift) kan ikke kjøres før ECON-002.
- **Er FX-rollene adskilt?** Ja (§4.2): anskaffelseskurs og tollkurs er egne `FxQuote`; 10,6709 er fixture-input; produksjonskilde er senere beslutning.
- **Er mva.-fradrag håndtert trygt?** Ja: standard `unknown`, aldri utledet av forhandlerrolle, ingen enkelttall for landed cost ved `unknown`, kontantbehov og mva.-beløp vises separat.
- **Kan ECON-001 markeres DONE?** Spesifikasjonen er etter min vurdering komplett og intern konsistent. Per CLAUDE.md pkt. 15 settes DONE først når Christian/Codex har akseptert den; jeg beholder derfor **REVIEW** og anbefaler DONE ved aksept. Ikke validert av uavhengig review; ingen kode eller tester er kjørt (dokumentoppgave).
