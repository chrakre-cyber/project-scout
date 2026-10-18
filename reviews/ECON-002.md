# ECON-002 — norsk avgiftsruntime for personbil 2026 (18.10.2026)

**Status: REVIEW.** Kildepakken (fem PDF-er, SHA-256 avstemt mot manifest) er lest og registrert i eksisterende TAX-evidensmodell. En deterministisk avgiftsmotor for **avgiftsgruppe a, personbil, 2026** er implementert og testet. Resultatet er `calculated_unverified`: reglene er E1-belagt, men **ingen parameter er godkjent** (ingen eksplisitt `parameterApproval`, 0 klasse 1-referanser) og **avrundingsregelen finnes ikke i noen kilde** (U-010). TAX-foundation er fortsatt **REVIEW** (0 godkjente parametere, 0 klasse 1-referanser). Ikke DONE; ECON-003 er ikke startet.

Faktamerking: *[KILDE]* lest i fil i `docs/tax/primarkilder/`. *[TOLKNING]* Claudes slutning fra kilde. *[VALIDERING]* observasjon mot de gyldne casene (aldri regelkilde). *[ÅPEN]* ikke belagt.

## 1. Kilder (lest av Claude; SHA-256 beregnet fra filbytes og lik manifestet)
| ID | Fil | Dokument | Dato / versjon | Nivå |
|---|---|---|---|---|
| T40 | `01_Avgiftssatser_2026_Regjeringen.pdf` (11 s.) | Finansdepartementet, Avgiftssatser 2026 | «Dato: 01.05.2026»; viser vedtatte satser 2025 og 2026 («Enighet 2026») | E1 |
| T41 | `02_Prop_1_LS_2025-2026_Engangsavgift.pdf` (8 s.) | Prop. 1 LS (2025–2026), **forslag** til stortingsvedtak | § 1: fra 1. januar 2026; publiseringsdato ukjent | E1 (forslag; aldri alene) |
| T05 | `03_Forskrift_engangsavgift_FOR-2001-03-19-268.pdf` (17 s.) | Forskrift om engangsavgift (Lovdata) | sist endret FOR-2026-01-13-29; § 3-1 endret FOR-2025-12-19-2787 (i kraft 1.1.2026) | **E1** (var E1X) |
| T42 | `04_Bruksfradragstabellen_Skatteetaten.pdf` (2 s.) | Skatteetaten, bruksfradragstabellen (norsk) | uten publiseringsdato | E1 |
| T03 | `05_Arsrundskriv_engangsavgift_2026_Skattedirektoratet.pdf` (57 s.) | Årsrundskriv 2026 | 1. januar 2026 | E1 (uendret; hash identisk med TAX-001B) |
Hash er registrert i `docs/tax/sources.json` (`repoFile`, `packageSha256`); `docs/tax/check-docs.mjs` verifiserer nå filene i repoet ved hver kjøring. Merknad: T40, T41, T05 og T42 er utskrifter uten maskinlesbart tekstlag og er **lest visuelt**; bare T03 har tekstlag. MANIFEST.md er kopiert uendret. Den utelatte Lovdata-varianten (`_1`) er ikke lest.

## 2. Regel for regel (side/paragraf/tabellrad)
| Regel | Belegg | Nivå |
|---|---|---|
| **Generell vekt** | T40 s. 3 «Personbiler mv. Avgiftsgruppe a / Alle personbiler / Egenvekt»: første 500 kg 0, resten **12,71 kr/kg** (2025: 12,44). T41 s. 1 § 2: «12,71 kroner per kg for den delen av egenvekten som overstiger 500 kg. Avgiften kommer i tillegg til … § 3». | E1 |
| **ICE-tillegg** | T40 s. 3 «Personbiler mv. med forbrenningsmotor / Egenvekt»: første 1 200 kg 0, resten **260 kr/kg**. T41 s. 1–2 § 3 a 1: «For motorvogner med stempeldrevet forbrenningsmotor … 260 kroner per kg … over 1 200 kg». | E1 |
| **CO₂** | T40 s. 3: første 100 g/km 800; **neste 50** 1 600; **neste 75** 3 200; **resten** 5 000 kr per g/km ⇒ **marginale/progressive bånd**. T41 s. 2 § 3 a 2 viser samme tall som 0–100/101–150/151–225/over 225 (tabellen alene er tvetydig; T40 avgjør). | E1 |
| **EV** | T03 6.12: elbil i gruppe a betaler engangsavgift etter § 2; avgiften etter § 3 ilegges «kun motorvogner med stempeldrevet forbrenningsmotor». T40 s. 3 og T41 § 2/§ 3. ⇒ EV får bare generell vekt, ikke 260-leddet og ikke CO₂. | E1 |
| **PHEV** | T05 § 3-1 (PDF s. 5): ladbar hybrid bruker CO₂ fra feltet «vektet kombinert» (WLTP og NEDC). T03 3.3.11: vektfradraget for ladbare hybrider **opphevet 1.1.2024**; ingen vektfradrag i T41 §§ 2–3 eller T05 § 3-1. PHEV har stempeldrevet forbrenningsmotor ⇒ § 3-komponentene gjelder *[TOLKNING; PHEV er ikke eksplisitt nevnt]*. | E1 / E1P |
| **NOx** | T03 3.2.4: «NOx-komponenten er fjernet med virkning fra 1. januar 2026»; T05 § 3-1 er endret grunnet bortfall; ingen NOx i T40/T41. | E1 |
| **Egenvekt (definisjon)** | T03 3.2.2: fra europeisk typegodkjenning, «minimumsvekt». | E1 |
| **CO₂-grunnlag** | T05 § 3-1: WLTP «kombinert»; NEDC × 1,24 (a/j); ukjent metode: WLTP hvis første registrering i utlandet ≥ 1.9.2018 eller ikke tidligere registrert, ellers NEDC; EPA/NRCan som WLTP; ikke WLTP/NEDC: egenvekt/10. | E1 |
| **Bruksfradrag** | T05 § 3-3 (PDF s. 5–6): 41 trinn «Alder over 1 måned 2 pst … Alder over 18 år 98 pst, Alder 20 år eller eldre 100 pst» = T42 = T07. «Ved fastsettelse av alderen skal tidspunktet for **første gangs registrering** legges til grunn. En motorvogn anses å være 20 år 1. januar i det året det har gått 20 år.» T42: «neste steg … oppnås på dagen kjøretøyet "fyller år"». T03 4.2: dato til dato; 4.3: prosentvis fradrag i den utregnede avgiften. | E1 |
| **Rekkefølge** | T41 s. 5 § 4: bruksfradrag gjøres «i den avgift som beregnes etter §§ 2 og 3» (ikke § 5). T03 4.3. | E1 (forslag) / E1P |
| **Vrakpant** | T03 3.4 (s. 17) og T41 s. 6 § 5: **2 400 kr** for gruppe a, b, c, g, j; fast beløp ved første gangs registrering; ikke redusert av bruksfradrag *[TOLKNING fra § 4/§ 5-strukturen]*. Gjelder alle tre casene (personbil, gruppe a). | E1 / E1P |
| **Styrende hendelse** | T05 § 1-2 nr. 1: avgiftsplikt oppstår ved første gangs registrering i motorvognregisteret ⇒ forventet/faktisk norsk registreringsdato (ECON-001 D3). T40 s. 3 / T41 § 1: satser fra 2026-01-01. | E1 |
| **Avrunding** | **Ingen bestemmelse funnet** i T03 (tekstsøk «avrund», «rundes», «nærmeste»), T05 §§ 1-2, 1-3, 3-1 til 3-4, T40, T41, T42. | **ÅPEN (U-010)** |

## 3. Åpne punkter fra første vurdering: avklart eller fortsatt åpne
| Punkt | Utfall | Belegg / hva som mangler |
|---|---|---|
| Generell vs ICE-vekt | **Løst** | Se §2. R-OTA-001 var registrert som én sats (260) for alle drivlinjer; det er tilleggskomponenten. DP-WEIGHT-GEN-A-2026 (12,71 / 500 kg) er lagt til. |
| EV-behandling | **Løst** | Bare § 2 (T03 6.12, T40, T41). |
| CASE-002 | **Løst** | Feilen var at 260 kr/kg ble brukt på elbil. |
| CASE-003 | **Løst** | Feilen var manglende generell vektkomponent (18 759,96) og en antatt alder i ECON-001-proben. Riktig alder ved 2026-10-18 er 2 år 11 mnd ⇒ 30 %. |
| CASE-001 | **Løst** | Manglende generell vektkomponent (26 818,10); PHEV bruker § 3-komponentene uten vektfradrag. |
| CO₂ marginal/flat | **Løst** | Marginal (T40 «første/neste/resten»). |
| **U-002** | **Lukket** | Norsk rettstekst (T05 § 3-3, T42) sier første gangs registrering; «production» finnes bare i den engelske satssiden T07. Steg nås på dagen kjøretøyet «fyller år» (T42). |
| **U-005** | **Lukket** | T03 3.3.11 (E1) + fravær av vektfradrag i T41 og T05; «inntil 10 %» i E2-sammendraget var utdatert. Forbehold: endelig vedtakstekst ikke lest (U-011). |
| U-003 | Åpen | Mva.-håndbok; utenfor avgiftsberegningen (ECON-004). |
| U-008 | Åpen | Tollkursens syklus; ikke i pakken; gjelder `customs_fx_rate`, ikke avgiften. |
| **U-009 (ny)** | Åpen | Månedstrinn og dag 29–31: T42 sier «fyller år» (hele år). Motoren behandler månedstrinn likt (inklusivt) og **blokkerer** når dag-overflyt avgjør trinnet. |
| **U-010 (ny)** | Åpen | Avrunding: ingen kilde. Se §5. |
| **U-011 (ny)** | Åpen | Endelig stortingsvedtak (FOR-2025-12-18-2755 + revidert) er ikke lest; satser verifisert mot T40 (2026-05-01) og forslag T41. Gruppe a-endringer etter 2026-05-01 ikke kontrollert (kolonnene «Fra 1. april/1. mai» og «Fra 1. september» er tomme for gruppe a i T40). |
| Sluttdato for 2026-satser | Åpen | Ikke oppgitt; motoren bruker konservativt 2026-12-31 (utenfor ⇒ `no_profile_for_date`). |
| 20-årsregelen | Delvis | 100 % fradrag følger av § 3-3; hvilken avgift som ellers gjelder for ≥ 20 år er ikke utledet ⇒ advarsel (R-OTA-011). |

## 4. Implementert (kun avgiftsmotoren)
`src/domain/tax/` (ren domenekode: ingen I/O, valuta, FX, transport, provider, UI, LLM):
- `decimal.ts` eksakt BigInt-desimal (ingen binær float), `dates.ts` ISO-dato uten `Date`, `age-deduction.ts` dato-til-dato med to kandidater ved dag-overflyt, `profile-no-2026-a.ts` profil `NO-OTA-2026-A-PB` (parametere, T42-tabell, kilde-ID-er, åpne punkter, `approved: false`), `calculate.ts` `calculateNorwegianVehicleTax(input, profile?, options?)`, `types.ts`.
- **Input (normalisert):** kjøretøyklasse (bare personbil M1), drivlinje fra tekniske data (`pistonCombustionEngine` + `externallyChargeable` + bevis; `listing_claim` blokkerer), `norwegianTaxWeight`, CO₂ + metode, første registrering (presisjon day/month/year/none/unknown), norsk registreringsdato (forventet/faktisk).
- **Output:** profil/versjon, komponenter (generell vekt, ICE-vekt, CO₂) med eksakte beløp, bruksfradrag (prosent, alder, trinn, arbeidsdato, 20-årsregel), `one_off_tax`, `scrappage_deposit` (2 400, ikke redusert), `total_registration_taxes` (eksakt desimal + heltallsgrenser), `monthSensitivity`, `missingInputs`, `blocked[]` med kode, `warnings`, `assumptions`, `evidence` (E1, ikke godkjent, åpne punkter).
- **Blokkering (ikke 0, ikke gjetting):** ikke-støttet klasse, ukjent drivlinje/bevis, manglende/ugyldig vekt eller CO₂, PHEV uten «vektet kombinert», **NEDC og egenvekt/10-fallback** (omregnet CO₂ kan avrundes; ingen kilde), **bare år** (ingen 1. januar), manglende/ugyldige datoer, norsk registrering før første, **ukjent/utløpt profil**, og dag 29–31-overflyt som avgjør trinnet.
- **Avrunding:** motoren velger ingen. `rounded` er `null` med mindre kalleren uttrykkelig oppgir `floor_whole_nok` eller `half_up_whole_nok` (merket `none_in_sources`). `totalIntegerBounds` gir [⌊x⌋, ⌈x⌉] under forutsetning av én sluttavrunding (mellomavrunding er ikke utelukket).
- Docs: `docs/tax/rules.json` (R-OTA-001/002/004/005/007/010/011, R-IMP-OTH-001: nye e1Findings med side/paragraf; datedParameters DP-WEIGHT-GEN-A-2026 ny, DP-WEIGHT-A-2026 og DP-CO2-A-2026 → E1, `to` 2026-12-31; U-002/U-005 lukket; U-009–U-011 nye; foundationStatus uendret REVIEW 0/0), `docs/tax/sources.json` (T05 E1; T40, T41, T42 nye; `repoFile`), `docs/tax/check-docs.mjs` (hash av repo-filer), `docs/tax/primarkilder/` (fem PDF-er + MANIFEST.md).
Ingen endring i DB, UI, auth, RLS, providers, deployment eller landed-cost-motor.

## 5. Avrunding (U-010): hva som er og ikke er belagt
Ingen lest kilde sier noe om avrunding. Derfor leverer motoren **eksakt desimal**. *[VALIDERING]* De tre gyldne casene gir `529 069,738`, `16 748,9545` og `333 723,972`; offisielle beløp er heltallsdelen i alle tre (avrunding **ned**), mens «nærmeste krone» gir 529 070 / 16 749 / 333 724 (alle feil). Det er en observasjon, ikke en regel: den kan ikke adopteres uten kildebelegg (oppdraget: casene er aldri regelkilde). Testen `VALIDERINGSOBSERVASJON` dokumenterer dette uten at motoren velger policy.

## 6. Gyldne caser — eksakte utdata (beregningsdato = norsk registreringsdato 2026-10-18, oppdraget; ikke dokumentert fra kalkulatorkjøringene)
| | CASE-001 PHEV | CASE-002 EV | CASE-003 diesel |
|---|---|---|---|
| Generell vekt | (2 610−500)×12,71 = 26 818,1 | (2 185−500)×12,71 = 21 416,35 | (1 976−500)×12,71 = 18 759,96 |
| ICE-tillegg | (2 610−1 200)×260 = 366 600 | — | (1 976−1 200)×260 = 201 760 |
| CO₂ marginalt | 100×800+40×1 600 = 144 000 | — | 100×800+50×1 600+29×3 200 = 252 800 |
| Før fradrag | 537 418,1 | 21 416,35 | 473 319,96 |
| Fradrag | 2 % (1 mnd 17 d) | 33 % (3 år 2 mnd) | 30 % (2 år 11 mnd) |
| `one_off_tax` (eksakt) | 526 669,738 | 14 348,9545 | 331 323,972 |
| `scrappage_deposit` | 2 400 | 2 400 | 2 400 |
| **`total_registration_taxes` (eksakt)** | **529 069,738** | **16 748,9545** | **333 723,972** |
| Heltallsgrenser [⌊x⌋, ⌈x⌉] | [529 069, 529 070] | [16 748, 16 749] | [333 723, 333 724] |
| Offisielt validert | 529 069 | 16 748 | 333 723 |
| Heltallsdelen = offisielt? | ja | ja | ja |
Alle tre kjører som `calculated_unverified` med advarsler (`propulsion_dealer_entered`, `weight_basis_not_verified`, `norwegian_registration_defaulted`, `rates_verified_as_of`; CASE-001 også `month_precision_sensitivity`: med siste dag i september ville fradraget vært 0 % og total 539 818,1). Inputs er fra ECON-001 §7 (oppgitt av Christian); skjermbilder og kjøredato er ikke levert. Fradragstrinnene er stabile for kjøring i hele oktober 2026 (CASE-001: 2 % fra 2026-10-01 til 2026-10-31; CASE-003: 30 % til 2026-10-31, 33 % fra 2026-11-01).

## 7. Tester faktisk kjørt (lokalt, denne økten)
- `npx tsc --noEmit` — OK.
- `npx eslint .` — OK (0 feil).
- `npx vitest run` — **30 filer, 683 tester bestått** (inkl. `tests/tax-engine.test.ts`: 48 tester; arkitekturvakten `tests/architecture.test.ts` bestått).
- `node docs/tax/check-docs.mjs` — OK (31 regler, 45 kilder, hash av repo-filer verifisert).
- `sha256sum` av de fem PDF-ene mot MANIFEST.md — alle OK.
Dekning i `tax-engine.test.ts`: eksakt desimal; parametere = `rules.json`; T42-tabell = T07-JSON; kildefil-hash; drivlinjeklassifisering; EV vs ICE (ingen 260 for EV); vektterskler 500/501 og 1200/1201; CO₂-grenser 0/100/101/150/151/225/226; PHEV (vektet kombinert); NEDC/fallback blokkert; aldersgrenser (2 år 6 mnd, 3 år, 1 mnd, 15. januar, 20-årsregel, dag 29–31, skuddår); bare år / manglende måned / ugyldig dato; manglende vekt; utløpt og ukjent profil; ukjent/ikke-støttet klasse; determinisme; gyldne caser (låste forventninger, komponenter, alder, avrundingsobservasjon).
**Ikke kjørt:** `npm run build`, e2e/Playwright, DB-suiter (Supabase/PG), `qa:*`-skript (ingen app-, DB- eller UI-endring).

## 8. Gjenstående blokkeringer
1. **Avrunding (U-010):** ingen kilde. Trengs: kildetekst (forskrift/rundskriv/avgiftsvedtak) eller dokumentert kalkulatoroppførsel som egen regelkilde godkjent av Christian.
2. **Parameterapprovering:** eksplisitt `parameterApproval` (godkjenner/dato) per regel; foundation krever 0 → ≥ 1 godkjent og klasse 1 per profil.
3. **Klasse 1-referanser:** de tre casene mangler kalkulatorens kjøredato, norsk registreringsdato, inputs (vekt, CO₂, metode) og skjermbilder/utskrift.
4. **Endelig stortingsvedtak (U-011)** og endringer i gruppe a etter 2026-05-01; sluttdato for 2026-satsene.
5. **U-009:** månedstrinn/dag-overflyt (motoren blokkerer; ikke gjettet).
6. **PHEV eksplisitt:** ingen lest tekst nevner ladbar hybrid som omfattet av § 3-komponentene (utledet fra «stempeldrevet forbrenningsmotor»).
7. **Vekt:** `norwegian_tax_weight` fra typegodkjenning (minimumsvekt) må komme fra beriking (ECON-007); fixtures bruker forhandler-oppgitt vekt (advarsel).
8. NEDC-/fallback-CO₂ (avrunding), andre avgiftsgrupper (varebil, minibuss), alternativ beregning (§ 3-4) og 20-årsgrensen er ikke støttet.
9. U-003 og U-008 (mva./kurs) — ikke avgiften.

## 9. Svar på spørsmålene
1. **Kan alle tre casene reproduseres eksakt?** Motoren gir de eksakte desimalene i §6 fra kilde-belagte regler, og **heltallsdelen er det offisielle beløpet i alle tre**. Et avrundet heltall som *er* 529 069 / 16 748 / 333 723 krever avrunding ned, som ikke har kilde. Jeg påstår derfor ikke «reprodusert eksakt» som validert; motoren gir heltallsgrenser som inneholder de offisielle verdiene.
2. **Løste TAX-blokkere:** generell vs ICE-vekt, EV-behandling, marginale CO₂-bånd, PHEV-CO₂-felt og ingen vektfradrag (U-005), U-002 (første registrering, anniversary), vrakpant 2 400 (alle gruppe a), NOx borte, egenvekt-definisjon, styrende hendelse.
3. **Gjenstår:** §8.
4. **Trygg nok for ECON-004?** Ja som **ikke-godkjent estimat**: bruk `status`, `totalIntegerBounds` og `blocked`; behandle `calculated_unverified` som `incomplete`/`unvalidated` i `CostAssessment` (aldri `complete_validated`), og bruk grensene (maks 1 kr spenn under forutsetningen i §4). Ikke bruk `rounded`.
5. **Hindrer noe visning av avgift i ekstern demo?** Ja: ingen godkjent parameter, ingen klasse 1, åpen avrunding og U-011. Vis ikke avgift som validert; syntetisk/ikke-validert merking kreves.
**Sluttstatus: REVIEW.** TAX-foundation: REVIEW. Neste: Christians beslutning om avrundingskilde og parametergodkjenning, kalkulatordokumentasjon (klasse 1), deretter evt. ECON-003/-004 (ikke startet).
