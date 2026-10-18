# Registrering: kalkulatorobservasjoner 18.10.2026 (GR-20261018-01 PHEV, -02 EV, -03 diesel)

**Status: REVIEW. Ingen parametere er godkjent. Ingen klasse 1 er registrert.** `referenceScope = explicit_inputs`: bildene dokumenterer hva kalkulatoren viste for disse inputene, ikke de konkrete bilene (kjøretøynavn er testetiketter; VIN, variant og teknisk dokumentasjon finnes ikke). Dette er nye referanser og er ikke dokumentasjon av CASE-001/002/003. Maskinlesbar registrering: `docs/tax/references.json` → `calculatorObservations`. Test: `tests/tax-calculator-observations.test.ts`.

## 1. Proveniens (hva som er observert, brukerbekreftet og ukjent)
| Opplysning | Status | Merknad |
|---|---|---|
| Ni originale PNG, uendret | **verifisert av Claude** | SHA-256 og bytes stemmer med `MANIFEST.json` (kontrollert 18.10.2026; automatisert i testen) |
| Transkripsjonen `OBSERVASJONER.md` | **avstemt mot bildene** | alle tall og valg lest på originalbildene; ingen avvik funnet |
| Operatør | oppgitt (Christian) | ingen separat identitetskontroll |
| Kjøredato 18.10.2026 | **brukerbekreftet**, ikke synlig i bildene | |
| Norsk registreringsdato brukt = 18.10.2026 | **brukerbekreftet** (kalkulatoren bruker dagens dato automatisk; feltet kan ikke velges), ikke synlig i bildene | samme proveniens som kjøredato |
| Klokkeslett | **ukjent** | |
| URL / kalkulatorversjon | **ukjent** | tittelen «Regn ut hva det koster å importere bil til Norge» er synlig bare i EV-inputbildet |
| Bruksfradragsprosent, satser, «Engangsavgiften består av» | **ikke synlig** (lenken er ikke åpnet) | |

Kjøredato 18.10.2026 sammenfaller med testdatoen 18.10.2026 i de eldre fixturene; det er en tilfeldighet i kalenderen og endrer ikke at de eldre casene ikke er rekonstruert.

## 2. Prisversjoner (ikke slått sammen)
| Kjøring | Bilde | Pris | Viser | Fullt inputbilde? | Avgift | Mva. |
|---|---|---:|---|---|---:|---:|
| 01 PHEV | `01_resultat_pris_600000`, `02_input_pris_600000` | 600 000 | input (steg 1–10) + resultat | **nei** — inputbildet slutter ved egenvekt; steg 11 (alternativ beregning) ikke synlig | 529 069,00 | 150 000,00 |
| 01 PHEV | `03_nedbrytning_pris_2600000` | 2 600 000 | resultat + nedbrytning | **nei** — eget inputbilde finnes ikke | 529 069,00 | 650 000,00 |
| 02 EV | `01_resultat_pris_350000`, `02_input_pris_350000` | 350 000 | input (steg 1–7) + resultat | **ja** (alternativ beregning uten verdi) | 16 748,00 | 12 500,00 |
| 02 EV | `03_nedbrytning_pris_300000` | 300 000 | resultat + nedbrytning | **nei** — eget inputbilde finnes ikke | 16 748,00 | 0,00 |
| 03 diesel | alle tre, pris 350 000 | 350 000 | input + resultat + nedbrytning | **ja** (steg 1–10 + steg 11 uten verdi) | 333 723,00 | 87 500,00 |

Det er ikke antatt at bare prisen ble endret mellom versjonene. At avgiften er lik i begge prisversjoner for PHEV og EV er observert, men er ikke brukt som belegg for at pris ikke påvirker avgiften.

## 3. Input per felt: observert / utledet / testantakelse
| | PHEV | EV | Diesel | Status |
|---|---|---|---|---|
| Kjøretøy | Personbil | Personbil | Personbil | observert |
| Personbiltype | Ladbar hybridbil | Elbil - personbil | Bensin/dieselbil | observert |
| Brukt | Ja | Ja | Ja | observert |
| Registrert i utlandet (dag) | 01.09.2026 | 01.08.2023 | 01.11.2023 | observert (testinput; ikke bilens verifiserte dato) |
| CO₂ oppgitt / verdi / metode | Ja / 140 g/km / WLTP | **ikke vist** | Ja / 179 g/km / WLTP | observert; EV: **CO₂ 0 er ikke observert** |
| Drivstoff | Bensin | ikke vist | Diesel | observert |
| Innkjøpspris | 600 000 | 350 000 | 350 000 | observert (se §2 for øvrige versjoner) |
| Egenvekt | 2 610 kg | 2 185 kg | 1 976 kg | observert; **definisjon ukjent** |
| Alternativ beregning | ikke synlig | uten verdi | uten verdi | observert |
| Stempeldrevet motor / ladbar | ja / ja | nei / ja | ja / nei | **utledet** fra valg i kalkulatoren (`evidence = dealer_entered`), ikke teknisk bevis |
| CO₂-målemetode i motoren | `wltp_weighted_combined` | – | `wltp_combined` | **testantakelse**: «WLTP» er observert, etikettene «vektet kombinert»/«kombinert» er ikke synlige. Motoren blokkerer `wltp_combined` for PHEV |
| Norsk registreringsdato | 2026-10-18 | 2026-10-18 | 2026-10-18 | brukerbekreftet |

## 4. Klassevurdering (eksisterende definisjon, ingen oppgradering)
- **Formelt minimum i `check-docs.mjs`** (`independentReference` med tool, runDate, output): tool er oppgitt av bruker, runDate er brukerbekreftet (bare dato), output er de hashede bildene. Det er oppfylt i form, men støttet av brukerbekreftelse og ikke av bildene.
- **Registreringsmalen** (`docs/tax/golden-run-template.md`) og `SJEKKLISTE.md` ber i tillegg om kalkulatorens URL/versjon og klokkeslett (S00), og om nedbrytning med bruksfradragsprosent (S-res2). **Ingen av dem er levert.** For PHEV og EV mangler dessuten fullt inputbilde for nedbrytningsversjonen.
- **Vurdering:** jeg har ikke registrert noen av kjøringene som klasse 1 (`evidenceClass = null`, `class1References = 0`). Å godta minimumsdefinisjonen alene, uten malens punkter, ville svekke klasse 1; det er en beslutning for Christian, ikke for meg. Manglende dokumentasjon som hindrer klasse 1 etter malen: URL/versjon, klokkeslett, bruksfradragsprosent/«Engangsavgiften består av», og (PHEV, EV) fullt input for nedbrytningsbildet.
- Selv med klasse 1 er R-OTA-002, R-OTA-010 og R-OTA-014 E1P og dermed ikke godkjenningsklare. Ingen godkjenning er gitt.

## 5. Motoren mot observasjonene (18.10.2026, profil `NO-OTA-2026-A-PB`, ingen kalibrering)
| | PHEV | EV | Diesel |
|---|---|---|---|
| Bruksfradrag (motor) | 2 % (1 mnd) | 33 % (38 mnd, «3 år») | 30 % (35 mnd, «2 år og 6 måneder») |
| Avgift før fradrag (eksakt) | 537 418,10 | 21 416,35 | 473 319,96 |
| Engangsavgift (eksakt) | 526 669,738 | 14 348,9545 | 331 323,972 |
| Observert engangsavgift (to desimaler) | 526 669,74 | 14 348,95 | 331 323,97 |
| Sluttkrav (motor, ned til hele kroner) inkl. vrakpant 2 400 | **529 069** | **16 748** | **333 723** |
| Observert total i avgifter | 529 069,00 | 16 748,00 | 333 723,00 |
| Samsvar | ja | ja | ja |

- Motorstatus er fortsatt `calculated_unverified` / `estimate_not_approved`; ingen blokkering (dag 1 ligger utenfor U-009-vinduet).
- Bruksfradragsprosentene er motorens egne; de er **ikke observert** i bildene.
- Samsvar på sluttbeløp og to-desimalsvisning er validering av motoren for disse inputene. Det lukker ikke U-012 og løfter ikke R-OTA-014 fra E1P: visningsverdiene med to desimaler er ikke belegg for intern mellomavrunding (alle komponentene er allerede hele øre, så avrunding av mellomledd kan ikke skilles ut).
- Observasjon (ikke regelbelegg): delpostene vist (engangsavgift + vrakpant) summerer til 529 069,74 / 16 748,95 / 333 723,97, mens kalkulatoren viser «Total i avgifter» uten øre (…,00). Det er forenlig med avkorting til hele kroner (R-OTA-014, E1P), men kan ikke skilles fra avkorting av en sum av avrundede delposter.
- Ikke observert: om kalkulatoren selv bruker CO₂ for elbil. Motoren gir samme resultat med CO₂ 0 og med ukjent CO₂.

## 6. Mva. (observasjoner for ECON-004; ikke implementert)
PHEV 25 % av innkjøpspris (150 000 av 600 000; 650 000 av 2 600 000), diesel 87 500 av 350 000, EV 12 500 av 350 000 og 0 av 300 000. Grunnlaget (om avgift inngår, EV-terskel) er ikke utledet her. Avrunding av mva. (U-013) og alt annet mva.-arbeid ligger i ECON-004, som ikke er startet.

## 7. Hva som mangler for gjeldende gate
Se §4. Konkret, per kjøring, bare hvis du vil ha klasse 1 etter malen: (a) ett bilde av adresselinje + kalkulatorside, og klokkeslett; (b) «Engangsavgiften består av» åpnet (viser bruksfradragsprosent); (c) PHEV og EV: samme kjøring uten prisendring, slik at input og nedbrytning hører sammen. Alternativt kan du uttrykkelig beslutte at minimumsdefinisjonen er nok. Jeg har ikke tatt den beslutningen.
