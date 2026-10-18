# ECON-001 — spesifikasjon av Merovos innkjøpsøkonomimotor (18.10.2026)

**Status: REVIEW** (spesifikasjon/arkitektur; ingen kode, ingen runtimelogikk, ingen DB-endring, ingen leverandør, ingen credentials, ingen scraping, ingen VEND/FINN). Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `52e31d6`, rent arbeidstre. Den offentlige taglinen er uendret. Intern arbeidsmaksime: *«Sell the car first. Find it afterwards.»*

**Faktamerking.** *[REPO]* = står i repoets dokumenter/kode. *[OPPGITT]* = oppgitt av Christian i oppdraget (de tre gyldne casene; kjørt manuelt i Skatteetatens kalkulator, ikke sett av Claude). *[ANALYSE]* = Claudes utledning. *[UKJENT]* = ikke avklart og behandles som ikke tilgjengelig (ingen fabrikkering).

## 0. Sammendrag
1. Motoren besvarer: **«Kan dette kjøretøyet anskaffes og leveres i Norge innenfor forhandlerens økonomiske mål?»** — ikke «regn ut avgiften på denne bilen». Avgift er én komponent.
2. Den **gjenbruker** eksisterende kontrakter: `CostAssessment`/`BudgetSpec`/`classifyBudget` (`src/domain/search-v2`), `IMPORT_ENGINE_SPEC.md` (v0.1, DEC-030) og hele TAX-001A–E-grunnlaget (`docs/tax/`). Ingen parallell regelmodell.
3. **De tre gyldne casene** er aritmetisk konsistente og utgjør potensielle klasse 1-referanser (TAX), men **avgiften kan ikke reproduseres av motoren i dag** (se §8): ingen godkjente parametere, EV-/PHEV-satser og flere inputs mangler. De kan automatiseres trygt som *offisielle forventede verdier* + uavhengig aritmetikk (mva., sum, kurs), ikke som motorreproduksjon av avgiften.
4. Landed cost **skal ikke vises i den eksterne partnerdemoen** før portene i §15.7 er oppfylt.

## 1. Produktspørsmålet og avgrensning
`Forhandlerbehov → europeisk tilbud → kandidatmatching → norsk landed-cost-estimat → vurdering mot forhandlerens/kundens økonomi → forklaring på hvorfor bilen er kommersielt relevant.`
Merovo er en **virtuell lagerhylle**: forhandleren finner en passende bil før den importeres eller lagres. Merovo er ikke transaksjons-, auksjons-, betalings- eller logistikkplattform, og forhandleren forhandler, bekrefter og kjøper utenfor Merovo (§10). Motoren er **valgfri per søk**: et søk uten økonomi fungerer som i dag (oppdagelse/matching).

## 2. Nødvendige utdata per kandidat
`CandidateEconomics` (konseptuelt; penger = heltall i minste enhet, `bigint`, som resten av domenet):

| Gruppe | Felt | Merknad |
|---|---|---|
| Annonsepris | `advertisedGross`, `advertisedNet` (hvis oppgitt), `sourceCurrency`, `priceBasis` (gross/net/unknown), `sourceVat{rate, status, evidence}` | alt uendret fra annonsen; ukjent forblir ukjent |
| Kurs | `fx{rate, scale, source, kind, asOf, quotedAt}` | `kind`: `customs` (Tolletatens), `market`, `dealer_entered`, `validation_fixed` |
| Anskaffelse | `acquisitionAdvertisedNok`, `acquisitionExpectedNok` (dealer-justert, valgfri), `acquisitionUsedNok` | opprinnelig pris overskrives aldri; den brukte velges eksplisitt |
| Transport | `transportDefaultNok` (8 000), `transportAdjustedNok` (dealer), `transportUsedNok` | alltid merket forutsetning/standard |
| Tolverdi / mva.-grunnlag | `customsValueNok` | kjøpesum + transport + forsikring til norsk innførselssted (R-IMP-VAT-002, E1P) |
| Skatter | `importVatNok`, `oneOffTaxNok`, `scrappageDepositNok` (vrakpantavgift), `otherKnownChargesNok[]`, `unknownCharges[]` | hver linje har `confidence` og `ruleRef` |
| Totaler | `estimatedLandedCostNok`, `importCashRequirementNok` | to adskilte summer (§12); begge kan være `lower_bound` |
| Mål | `target`, `headroomNok`, `targetStatus` | se §3 |
| Tillit | `confidence` (samlet + per linje), `warnings[]`, `breakdown[]`, `inputProvenance` | §11, §12 |

**Navn:** *market spread*, *economic headroom*, *target headroom*, *estimated landed cost*. **Aldri** «profit»/«fortjeneste». «Bidrag» (IMPORT_ENGINE_SPEC) forblir et senere, separat lag som krever salgsprofil og mva.-status og er ikke en del av ECON-oppgaven.

## 3. Forhandlerens økonomiske mål (alt valgfritt)
`EconomicTarget` kan ligge på søket (utvider `BudgetSpec`; bakoverkompatibelt): `maxLandedCostNok`, `maxTotalAcquisitionNok` (= kjøpesum + transport + forhandlerlagt tilleggskost, **før** norske avgifter), `targetResalePrice` (med eksplisitt mva.-/avgiftsgrunnlag, jf. IMPORT_ENGINE_SPEC «Inputs»), `minHeadroomNok`, `minSpreadPercent`. Ingen er påkrevd; manglende mål gir `targetStatus = "no_target"` og motoren viser bare kostnadskomponentene. Merovo antar aldri at forhandleren vil ha utsalgspris regnet.
Eksisterende `BudgetSpec.maxTotalNokMinor` + `deviationBasisPoints` ≡ `maxLandedCost` med slingringsmonn og beholdes uendret.
**Målstatus (tre-verdi, aldri gjetning):** `inside` (estimert kost ≤ øvre grense og alle kostnadslinjer kjent), `outside_certain` (selv kjente delsummer overstiger grensen), `indeterminate` (ukjente linjer kan avgjøre) og `no_target`. Ufullstendig kost er en **nedre grense** (`completeness: "lower_bound"`): er nedre grense allerede over målet, er bilen sikkert utenfor; ellers aldri «inne».
**Beslutning D1 (Christian):** DEC-030 sier at budsjettsammenligningen *inkluderer* beregnet import-mva. og engangsavgift (kontantlignende). §12 viser at økonomisk kost for en mva.-registrert forhandler kan være uten fradragsberettiget import-mva. Foreslått: behold DEC-030 som standard (`vatBasis = "include_import_vat"`), og la dealer velge `exclude_recoverable_vat` når fradragsstatus er bekreftet (aldri antatt). Begge visninger rapporteres alltid i nedbrytningen.

## 4. Standarder og overstyringer
**Registreringsdato.** Annonse med bare måned/år ⇒ arbeidsdato = første dag i måneden (`09/2026 → 2026-09-01`); full dato brukes som den er. Begge bevares: `source{value, precision}` og `working{date, derived: true|false}`; en avledet dag presenteres aldri som oppgitt (confidence `derived`). *Bare år* har ingen avtalt regel ⇒ ukjent arbeidsdato (ikke avledet) inntil dealer oppgir den (**D2**). *Skjevhet å vise:* første dag gir høyest alder ⇒ høyest bruksfradrag ⇒ laveste avgift (optimistisk). Derfor beregnes også siste dag i måneden når bruksfradragstrinn/regelskifte kan påvirke utfallet, og motoren gir `date_sensitivity`-advarsel med intervall hvis resultatet endres. **Norsk registreringsdato** (som styrer bruksfradrag og satsversjon, `docs/tax/event-dates.md`) er en separat input; standard = beregningsdato (`assumed-default`), overstyrbar (**D3**). Grensen 2026-09-01 (gruppe b) gir `rate_boundary`-advarsel.
**Transport.** Standard NOK 8 000 til norsk grense; konfigurerbar (system) og overstyrbar (dealer); alltid vist som forutsetning, `assumed-default`. Inngår i tollverdien/mva.-grunnlaget (transport til innførselssted, R-IMP-VAT-002) og fordeles ikke dobbelt (IMPORT_ENGINE_SPEC).
**Eksportvilkår.** Merovo krever **ikke** bekreftelse på at selger kan selge netto/uten mva. til eksport før vurdering. Forhandling, eksportvilkår og endelig kjøpesum er forhandlerens ansvar; Merovo vurderer tilgjengelighet ut fra oppgitt annonse. Advarsel «eksportvilkår ikke bekreftet» vises som informasjon, ikke som blokkering.
**Forhandlet pris.** `acquisitionAdvertisedNok` (fra annonsen, aldri overskrevet) og `acquisitionExpectedNok` (dealer-justert, med tidspunkt/bruker) lagres adskilt; `acquisitionUsedNok` angir hva beregningen bruker, og forklaringen sier hvilken.

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
3. **Forhandlerens regnskap:** `importVatDeductible: "yes" | "no" | "unknown"` (R-DED-001, E1P: fradrag for personkjøretøy anskaffet for videresalg). Aldri antatt. Styrer bare *økonomisk* kost og likviditet, ikke selve import-mva.-beløpet.
Ett tall for «mva.» er forbudt: motoren skiller `advertisedGross/Net`, kilde-sats/-status, norsk import-mva., fradragsstatus, kontantbehov og økonomisk landed cost.

## 7. Gyldne testcaser (regresjonsfixturer)
Gitt av Christian, kjørt i Skatteetatens kalkulator [OPPGITT]. **Forventede offisielle verdier endres aldri.**

| | CASE-001 Lamborghini Urus PHEV | CASE-002 BMW iX3 EV | CASE-003 Mercedes E 400 d 4MATIC Estate |
|---|---|---|---|
| Annonse netto (EUR) | 252 017 | 34 361 | 38 562 |
| Første reg. (arbeidsdato) | 2026-09-01 | 2023-08-01 | 2023-11-01 |
| km | 2 978 | 43 300 | 34 353 |
| Effekt / motor | 588 kW, 3 996 cc | 210 kW | 243 kW, 2 925 cc |
| CO₂ (WLTP) | 140 g/km | 0 (rekkevidde 458 km) | 179 g/km |
| Norsk avgiftsvekt (ref.) | 2 610 kg | 2 185 kg | 1 976 kg |
| **Offisiell avgift** | **529 069** (inkl. vrakpant, oppgitt) | **16 748** | **333 723** |
| Offisiell kjøpesum (NOK) | 2 689 248 | 366 663 | 411 491 |
| Offisiell mva. | 672 312 | 16 666 | 102 873 |
| **Offisiell total** | **3 890 629** | **400 077** | **848 087** |

**Arbeidsregler (verifisert aritmetikk, [ANALYSE]):**
- *Kurs.* `10,6709` NOK/EUR gir kjøpesummene 2 689 248, 366 663 og 411 491 når produktet rundes til hele kroner (halvt opp: 2 689 248,21; 366 662,79; 411 491,25). De tre casene er altså kjørt med samme manuelle kurs (utledet, ikke dokumentert — **bekreft med Christian**). Transport på NOK 8 000 er **ikke** med i noen av de offisielle kjøpesummene (også ikke i CASE-001).
- *Mva.* CASE-001 og -003: 25 % × kjøpesum (672 312,00 og 102 872,75 → 102 873 ved halvt opp). CASE-002: 25 % × (kjøpesum − 300 000) = 16 665,75 → 16 666. Mva.-grunnlaget inkluderer **ikke** engangsavgiften i noen av dem.
- *Sum.* total = kjøpesum + avgift + mva. i alle tre (3 890 629 / 400 077 / 848 087 ✓).
- *Vrakpant.* 2 400 kr (R-IMP-OTH-001, E1) er oppgitt som inkludert i avgiften for CASE-001; **for CASE-002/-003 er det ikke oppgitt om «Avgift» inkluderer vrakpant (D5)** — må bekreftes fra kalkulatorbildene.

**To adskilte sjekker per case (fixture-struktur):**
1. *Reproduksjon av offisiell kalkulator:* input = kalkulatorens (kjøpesum uten transport) → forventet avgift/mva./total = tabellen over.
2. *Merovo landed cost (med transport):* kjøpesum + 8 000 → tollverdi → mva. → kontantbehov; avgift uendret (transport påvirker ikke avgiften). Utledet (kurs 10,6709, avgift = offisiell, mva. av tollverdi, hele kroner halvt opp):

| | kjøpesum + transport | import-mva. | avgift | **kontantbehov** | **landed cost, mva. fradragsberettiget** | landed cost, mva. ikke fradragsberettiget |
|---|---|---|---|---|---|---|
| CASE-001 | 2 697 248 | 674 312 | 529 069 | **3 900 629** | 3 226 317 | 3 900 629 |
| CASE-002 | 374 663 | 18 666 (av 374 663 − 300 000) | 16 748 | **410 077** | 391 411 | 410 077 |
| CASE-003 | 419 491 | 104 873 | 333 723 | **858 087** | 753 214 | 858 087 |
(Differanse mot offisiell total = +8 000 transport + 25 % × 8 000 = +10 000 i hvert tilfelle.) Avgiftsdelen er *offisiell input*, ikke motorresultat (se under). Mva.-regelen for CASE-002 ved forhandlerimport er uavklart (R-IMP-VAT-003, åpent) og landed cost for CASE-002 er derfor *betinget*.

**Kan casene automatiseres trygt nå?** Ja som **fixturer med offisielle forventede verdier** + uavhengig aritmetikk (kurs, avrunding, mva., sum, kontantbehov, landed cost under begge fradragstilstander), med test som feiler hvis forventede offisielle verdier endres. **Nei** som *motorreproduksjon av avgiften* — se probe under.

**Probe (ikke validering):** en naiv anvendelse av parametrene som finnes i TAX-grunnlaget (gruppe a 2026, E1X: vekt 260 kr/kg over 1 200 kg; CO₂ 800/1 600/3 200/5 000 per g/km i bånd, anvendt marginalt) gir for CASE-003 før bruksfradrag 201 760 (vekt) + 252 800 (CO₂) = 454 560 kr, mens offisiell avgift 333 723 impliserer 26,6–27,1 % bruksfradrag (tabell T07 gir 26 % for 24–29 måneder). For CASE-001 gir samme metode 510 600 kr mot offisielle 526 669 kr (uten vrakpant): +3,1 % — manglende/avvikende komponent. For CASE-002 gir ICE-satsen 256 100 kr på vekt mot offisielle 14 348 kr (uten vrakpant): EV-/vektkomponenten har andre satser som ikke er lest. **Konklusjon:** avgiftsmotoren kan ikke reproduseres fra dagens E1X-parametere; marginal/trinnvis beregning, EV-satser, PHEV-regel (vektet CO₂, ev. fradrag; U-005), avrunding og norsk registreringsdato (bruksfradrag) mangler. Dette er presis det TAX-gapet ECON-002 må lukke.

## 8. Avgiftsgrensen
```
kandidatøkonomi → normaliserte avgiftsinput (TaxInputV1) → avgiftsmotor → avgiftsnedbrytning → landed-cost-motor
```
Motoren **konsumerer** en deterministisk norsk avgiftskalkulator som én komponent: `calculateNorwegianTax(input: TaxInputV1, ruleSet: RuleSetRef): TaxResult` der `TaxResult` er `{status: "calculated", components[], ruleSetRef, confidence}` eller `{status: "not_calculated", reasons[]}`. Ingen egen regeltabell i økonomi­laget; ingen parallell regelmodell.
**Gjenbrukbart [REPO]:** `docs/tax/rules.json` (31 regler med evidensnivå, datoerte parametere for gruppe a/b), `sources.json` (E1/E1P/E1X/E2), `references.json` (108 referansetilfeller i fire klasser; klasse 3 regnes på nytt av `check-docs.mjs`), `bruksfradrag-tabell-T07.json` (41 trinn, E1 med hash), `event-dates.md` (hendelsesdatoer), `purchase-basis.md` (tre adskilte summer), `profiles.md` (10 profiler + `TaxInputV1`), valideringen med DONE-sperre, samt `IMPORT_ENGINE_SPEC.md`. TAX-fundamentet er **REVIEW**: 0 godkjente parametere, 0 klasse 1-referanser, åpne konflikter U-002 (bruksfradrag § 3-3), U-003 (dekning 2026), U-005 (ladbar hybrid), U-008 (tollkurs); T30–T39 er E1X uten kildefil/hash.
**Gjenstår før runtime er trygt (TAX/ECON-002):** (1) E1-kildefiler med hash for stortingsvedtak og forskrift (§§ 2-3, 3-1, 3-3); (2) godkjente parametere per profil; (3) **klasse 1-referanser** — de tre gyldne casene *kan bli klasse 1* når kalkulatorkjøringene dokumenteres (inputs inkl. norsk registreringsdato, kjøredato, skjermbilde/utskrift) — de dekker PHEV-personbil, EV-personbil og diesel-personbil, men ikke varebil/andre profiler; (4) EV-vektkomponent og PHEV-regler; (5) trinnvis/marginal beregning og avrunding; (6) tollkurs-/FX-regel (U-008); (7) klimagass (mengde), registreringsgebyr og eventuell toll ukjent ⇒ `unknownCharges`; (8) styrende hendelsesdato.
**TAX-foundation skal ikke merkes DONE** av denne oppgaven; sperren i `check-docs.mjs` (godkjente parametere > 0 og klasse 1 per profil) er ikke oppfylt.

## 9. Valgfritt lokalt markedsbenchmark (fremtidig lag; ikke implementert)
Valgfritt per forhandler/søk; motoren fungerer uten. Mulig kilde: VEND/FINN **hvis** kontraktsmessig tilgang gis (ingen antakelse; ingen tilgang finnes). Modell `MarketBenchmark`: antall sammenlignbare norske annonser, laveste relevante utbudspris, median, prisintervall, forhandler vs privat, alder på data, kriterier som ble brukt (samme `SearchSpec`), kandidatens landed cost, **market spread** = `referansepris − landed cost`, **spread %** = `spread / referansepris` (referanse = valgt: laveste relevante, median). «Utbudspris» (asking price), aldri «salgspris»/«profitt». Leverandørens rettighetsprofil (DATA-002B) styrer visning/matching/lagring av benchmarkdata; avledede tall krever avklart avledet-data-rett. Sammenligningen krever kompatibelt mva.-/avgiftsgrunnlag (norske utbudspriser er sluttkundepriser inkl. mva./avgifter) — ellers `not_comparable`.

## 10. Forhåndssolgt anskaffelsesflyt
`Kunde-/forhandlerkrav → Merovo-søk → europeiske kandidater → kandidatpasning → landed cost → (valgfritt) norsk markedsbenchmark → forhandleren velger kandidat → bekrefter/forhandler/kjøper utenfor Merovo.` Nytten: forhandleren kan selge eller love en bil *før* import/lagerføring fordi Merovo viser hva som finnes og hva den ca. koster inn i Norge; det reduserer behovet for spekulativt lager. Merovo foretar ingen transaksjon, auksjon, betaling eller logistikk (krever egen godkjenning).

## 11. Tillit og ukjente
`Sourced<T> = { value, confidence, source, asOf }` med tilstander: `verified`, `provider-supplied`, `enriched-reference` (typegodkjenning/homologering), `reference-only` (f.eks. sammenlignbar FINN-annonse), `derived`, `dealer-entered`, `assumed-default`, `unknown`.
Eksempler: transport 8 000 → `assumed-default`; vekt fra homologeringsdatabase → `enriched-reference` (verified hvis typegodkjenningsdata); vekt fra sammenlignbar FINN → `reference-only` (blokkerer «full» avgift); registreringsdag fra måned/år → `derived`; manuell kurs → `dealer-entered`; ukjent klimagassavgift → `unknown`.
**Regler:** ingen linje kan være sikrere enn svakeste kritiske input; `unknown` på en kritisk komponent ⇒ `completeness: lower_bound` og ingen «inne i mål» (`indeterminate`/`outside_certain`); samlet kalkyletillit følger IMPORT_ENGINE_SPEC (HIGH/MEDIUM/LOW som forklarte kvalitetsregler, ikke sannsynlighet); material forutsetninger listes i `warnings` og forklaringen; uvalidert/utløpt avgiftsprofil ⇒ ingen landed cost-påstand.

## 12. Nedbrytning (kontant vs økonomisk)
```
Kjøpesum (NOK, fra kurs)  + transport  [+ forsikring/øvrig kjent]  = tollverdi
 + norsk import-mva. (25 % av tollverdi)
 + engangsavgift
 + vrakpantavgift (2 400)
 + andre kjente avgifter
 + [ukjente/ikke beregnede linjer — vises, summeres ikke]
 = import cash requirement   (kontantbehov ved innførsel)

Kjøpesum + transport [+ kjent øvrig]
 + engangsavgift + vrakpant + andre kjente ikke-fradragsberettigede kostnader
 + import-mva. KUN hvis importVatDeductible = "no"
 (= "unknown" ⇒ vis begge tall og marker landed cost som «avhenger av mva.-status»)
 = estimated landed cost
```
Fradragsberettiget import-mva. legges **ikke** i permanent kost; den vises som kontantbehov/likviditet. Fradragsrett antas aldri universelt: `importVatDeductible` er en eksplisitt regnskapstilstand (`yes|no|unknown`, kilde: forhandlerprofil). Hver linje bærer `{label, amount, currency, confidence, ruleRef, assumption?}`; summer er presise (heltall) og UI avrunder bare visning (IMPORT_ENGINE_SPEC). To tall mot målet: kontantbehov (likviditet) og økonomisk kost; **D1** bestemmer hva «budsjett» sammenlignes mot.

## 13. Arkitektur
Rene, deterministiske funksjoner i `src/domain/economics/` (ingen I/O, ingen UI, ingen provider, ingen LLM, ingen nettverk); `bigint`/desimalstreng, eksplisitt avrunding per regel:
`types.ts` (Sourced, Money, Confidence) · `acquisition.ts` (brutto/netto/ukjent, forhandlet pris) · `fx.ts` (`FxQuote`, konvertering med avrunding) · `registration-date.ts` (arbeidsdato, presisjon, sensitivitet) · `transport.ts` (standard/overstyring) · `weight.ts` (`source_weight`/`norwegian_tax_weight`) · `tax-input.ts` (normalisering → `TaxInputV1`) · `norwegian-tax/` (grensesnitt + versjonerte regelsett; implementeres kun etter TAX-gate; leser `docs/tax`-konvensjonen) · `vat.ts` (import-mva., fradragstilstand) · `landed-cost.ts` (to summer, `lower_bound`) · `target.ts` (hodefrihet, tre-verdi-status) · `explain.ts` (nedbrytning/advarsler) · `to-cost-assessment.ts` (kobler til eksisterende `CostAssessment`: `complete_validated` bare når regelsett validert, ellers `incomplete`/`unvalidated` med `profileRef`, `validUntil`, `candidateId/Version`, `costBasisOf`).
Server (ikke domene): `FxService` (henter Tolletaten-/annen kurs, lagrer kilde/tid), `VehicleDataEnrichment`-grensesnitt (homologering/vekt/CO₂), økonomiorkestrering som kaller kandidatadapteren. Provider-spesifikk parsing ligger i adaptere (`NormalizedListing` er grensen). UI får bare *visningsmodell* via `search-display`-grensen: **økonomitall er avledede data og må gå gjennom visningsrettighetene (DATA-002A/B)**; foreslått ny rettighetsnøkkel `derived_economics` (default nei) og krav om `price`-visning for å vise kostnad som avslører annonseprisen. Resultat kan ikke vises hvis rettighetsprofilen ikke tillater avledede tall (DATA-001 §3).

## 14. Implementeringsplan
| Oppgave | Formål | Avhengighet | DB | UI | Leverandør-credentials | Kan starte nå? |
|---|---|---|---|---|---|---|
| **ECON-002** TAX-/runtime-gapslukking | E1-kilder m/hash for T30–T39, godkjenn parametere, EV-/PHEV-regler, marginal/trinn, avrunding, U-002/U-003/U-005/U-008, dokumenter kalkulatorkjøringene som klasse 1 | TAX-001E; Christians kilder/skjermbilder | nei | nei | nei (men trenger tilgang til offisielle kilder) | **Ja** (dokument/kilde; Christian må levere belegg) |
| **ECON-003** Gyldne fixturer | `docs/econ/` + `tests/fixtures`: de tre casene (offisiell reproduksjon + Merovo-utvidelse), aritmetikk-tester (kurs, avrunding, mva., sum, kontantbehov, landed cost), test som låser offisielle verdier | ECON-001; D5 (vrakpant) og kurs bekreftet | nei | nei | nei | **Ja** |
| **ECON-004** Landed-cost-kjerne | `acquisition`, `fx`, `registration-date`, `transport`, `weight`, `vat`, `landed-cost`, `target`, `explain` som rene funksjoner; avgiftsmotor bak grensesnitt (`not_calculated` til TAX er godkjent) | ECON-003 | nei | nei | nei | **Ja** (avgiftsdel stub «ikke beregnet») |
| **ECON-005** Søkeintegrasjon | `EconomicTarget` på søk (utvider `BudgetSpec`), `to-cost-assessment`, `classifyBudget` får ekte vurdering; rettighetsnøkkel `derived_economics` | ECON-004, TAX-gate, DATA-002B | **ja** (spec-JSON-skjema + profilkolonne) | liten | nei | Etter ECON-002/004 |
| **ECON-006** Forklarings-UI | nedbrytning, forutsetninger, tillit, to summer, «ikke beregnet» der det mangler; kun via `search-display`-grensen | ECON-005 | nei | **ja** | nei | Etter ECON-005 |
| **ECON-007** Vekt-/homologeringsberikelse | `VehicleDataEnrichment`-grensesnitt, leverandørevaluering (kategori i §5), `norwegian_tax_weight` med confidence | avtale/leverandørvalg | ev. cache-tabell | nei | **ja** (leverandør) | Grensesnitt: ja; leverandør: nei |
| **ECON-008** FX-tjeneste | `FxService` + kildevalg (U-008), lagring av kurs/tid | beslutning om kurskilde | ja (kurslager) | nei | nei (offentlig kilde, men nettverkstilgang kreves) | Grensesnitt: ja |
| **ECON-009** Valgfritt markedsbenchmark | `MarketBenchmark`-fundament (kun modell + syntetisk) | ECON-005; kontrakt for VEND/FINN | ja | liten | **ja** (VEND/FINN) | Modell: ja; data: nei |
Kritisk sti til partnerdemo med landed cost: **ECON-002 → 003 → 004 → 005 → 006** (007/008 for ekte data; 009 valgfritt).

## 15. Anbefaling
1. **Bygg først:** ECON-003 (fixturer) og ECON-002 (TAX-gap: kilder + klasse 1 av de tre casene) parallelt, deretter ECON-004 (kjerne med avgift bak grensesnitt). Ingen UI før disse.
2. **TAX som må gjenbrukes/fullføres:** hele `docs/tax/`-grunnlaget (se §8); fullfør E1-kilder, godkjente parametere, EV/PHEV, marginal/avrunding, U-002/U-003/U-005/U-008, og klasse 1-referanser (de tre casene er et godt utgangspunkt). Ikke bygg en parallell regelmodell.
3. **Kan de tre casene automatiseres trygt nå?** Ja som fixturer med offisielle verdier og uavhengig aritmetikk; nei som reproduksjon av avgiften (§7-probe). Bekreft først: kurs 10,6709, vrakpant-inklusjon for CASE-002/-003, kalkulatorens norske registreringsdato og kjøredato.
4. **Kategori for vekt-/homologeringsdata:** typegodkjennings-/CoC-data (type + variant + versjon) fra OEM/offisielt register og/eller en kommersiell kjøretøyspesifikasjonsdatabase med homologert masse; norsk register som referanse. Ingen leverandør valgt; ikke VIN-avhengig.
5. **Brukerkonfigurerbare forutsetninger:** transport (standard 8 000), forhandlet kjøpesum, norsk registreringsdato, kurs (innen godkjent kilde), mål (maks landed cost m.m.), sammenligningsbasis for mva. (D1), fradragsstatus for import-mva. (forhandlerprofil), tilleggskostnader (forsikring, klargjøring), valg av benchmarkreferanse.
6. **Aldri stille antatt:** vekt (norsk avgiftsvekt), CO₂-grunnlag/målemetode, fradragsrett, norsk registreringsdato utover eksplisitt standard, klimagass-/toll-/gebyrbeløp, eksportvilkår (informasjon, ikke blokkering), avgiftsgruppe/kjøretøyklasse, om «avgift» inkluderer vrakpant, FINN-referanse som sannhet, at en provider tillater visning av avledede tall.
7. **Før landed cost vises i den eksterne partnerdemoen (porter):** (a) avgiftsmotor validert for de viste profilene (E1-parametere godkjent + klasse 1-referanser) og TAX-gate oppfylt for disse; (b) FX-kilde og dato vist; (c) alle forutsetninger vist og merket (transport, registreringsdato, fradragsstatus); (d) ukjent/«ikke beregnet» for alle ikke støttede profiler; (e) kurs/avgift «estimat — ikke rådgivning»-merking og syntetisk-etikett; (f) rettighetskontroll for avledede tall (`derived_economics`) for hver kilde; (g) testet mot gyldne fixturer i CI; (h) Codex-review. Inntil da vises «Innkjøpskostnad til Norge er ikke beregnet» som i dag.

## 16. Beslutninger jeg trenger fra Christian
**D1** sammenligningsbasis mot målet (kontantlignende med import-mva. per DEC-030, eller økonomisk uten fradragsberettiget mva.). **D2** bare-år-registrering: ukjent arbeidsdato (anbefalt) eller regel. **D3** standard for norsk registreringsdato (beregningsdato, anbefalt). **D4** avrundingsregel (halvt opp til hele kroner per komponent, i tråd med casene) og om øre-presisjon holdes internt. **D5** inkluderer «Avgift» vrakpant i CASE-002/-003, og dokumentasjon av kalkulatorkjøringene (datoer, inputs, skjermbilder). **D6** kurskilde (Tolletatens/Norges Bank/dealer-oppgitt) og om 10,6709 er den manuelle kursen. **D7** `derived_economics` som egen rettighetsnøkkel (anbefalt). **D8** standard fradragsstatus (`unknown`, anbefalt).

## 17. Status
**ECON-001 = REVIEW.** Ingen kode, runtimelogikk, DB- eller UI-endring. TAX-foundation er uendret **REVIEW**. Ingen deploy, ingen leverandørtilkobling.
