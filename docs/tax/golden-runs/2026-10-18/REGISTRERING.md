# Registrering: kalkulatorobservasjoner 18.10.2026 (GR-20261018-01 PHEV, -02 EV, -03 diesel)

**Status: REVIEW. Ingen parametere er godkjent. Klasse 1 er registrert for PHEV (`C1-GR-20261018-01`), EV (`-02`) og diesel (`-03`) etter eksisterende definisjon (§4).** `referenceScope = explicit_inputs`: bildene dokumenterer hva kalkulatoren viste for disse inputene, ikke de konkrete bilene (kjøretøynavn er testetiketter; VIN, variant og teknisk dokumentasjon finnes ikke). Dette er nye referanser og er ikke dokumentasjon av CASE-001/002/003. Maskinlesbar registrering: `docs/tax/references.json` → `calculatorObservations`. Test: `tests/tax-calculator-observations.test.ts`.

## 1. Proveniens (hva som er observert, brukerbekreftet og ukjent)
| Opplysning | Status | Merknad |
|---|---|---|
| Ni originale PNG, uendret | **verifisert av Claude** | SHA-256 og bytes stemmer med `MANIFEST.json` (kontrollert 18.10.2026; automatisert i testen) |
| Transkripsjonen `OBSERVASJONER.md` | **avstemt mot bildene** | alle tall og valg lest på originalbildene; ingen avvik funnet |
| Operatør | oppgitt (Christian) | ingen separat identitetskontroll |
| Steg 11 «Alternativ beregning» tomt i PHEV-kjøringen (pris 600 000) | **brukerbekreftet** 18.10.2026 (ikke synlig i bildene) | |
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

## 4. Klasse 1 etter eksisterende styrende dokumenter (runde 9)

### 4.1 Den autoritative definisjonen — og hva som ikke er den
| Lag | Kilde (fil, sted) | Innhold | Rolle |
|---|---|---|---|
| **Evidensmodellen (definisjonen)** | `DECISIONS.md` DEC-032 pkt. (2) (overskriften sier «FORSLAG», men `reviews/ECON-001.md` D1 (linje 46) og praksis i TAX-001A–E og ECON-002 behandler den som styrende); `docs/tax/references.json` `classes["1"]` = «uavhengig kontrollert referanse» og `note` («uavhengig offisiell referanse/kalkulator»; håndregning er klasse 2, ikke 1) | klasse 1 = uavhengig offisiell kalkulator-/vedtaksreferanse | **definerer klassen** |
| **Krav til bruk i godkjenning** | `docs/tax/rules.json` `approvalRequirements` (4. punkt) og `docs/tax/TAX-001A-rules.md` linje 21: «minst ett uavhengig klasse 1-referansetilfelle (offisiell kalkulator/vedtak)» | klasse 1 er ett av flere godkjenningskrav (E1-regel, E1-kilder, `validity.from`/`governingEvent`, uttrykkelig `parameterApproval`) | skiller klasse fra godkjenning |
| **Dokumentasjonsform** | `references.json` `requiredToUpgrade` (36 tilfeller): «Kjør Skatteetatens importkalkulator (S07) med eksakte input; lagre **input, dato, resultat og skjermbilde** uten persondata»; `IMPORT_ENGINE_SPEC.md` linje 77 og 79 («uavhengige referanser»; «behold **input/dato/kilde, output og avvik**»); `reviews/TAX-001B.md` linje 88 («lagret input/dato/output»); `reviews/ECON-001.md` linje 151 (inputs inkl. norsk registreringsdato, kjøredato, skjermbilde/utskrift) | hva som må lagres | **minstekrav til belegg** |
| Minimumskontroll | `docs/tax/check-docs.mjs` linje 175: `independentReference` med `tool`, `runDate`, `output`; for klasse ≤ 2 også E1-kilder (regelkildene) | mekanisk sperre | **validator, ikke definisjon** |
| Senere tillegg | `docs/tax/golden-run-template.md`, `SJEKKLISTE.md`, `GUIDE-*.md` (utarbeidet av Claude i runde 6–7; ikke besluttet av Christian) | URL/versjon, klokkeslett, bruksfradragsprosent, kjøretøyidentifikasjon, drivlinjebevis, vektdefinisjon | **anbefalt dokumentasjonssett**; omdefinerer ikke klassen |

Verken validatoren eller sjekklisten definerer klassen. Det som kreves for klasse 1 er derfor: (i) uavhengig offisiell kalkulator som kilde, (ii) eksakte input lagret, (iii) dato lagret, (iv) resultat lagret, (v) skjermbilde uten persondata, (vi) ingen avledning fra motoren eller forventet verdi. Klokkeslett, URL/versjon, bruksfradragsprosent, kjøretøyidentifikasjon og teknisk dokumentasjon kreves ikke av definisjonen (de gjelder malen, eller `vehicle_specific`). Dette er en forklaring av eksisterende krav, ikke en svekkelse: klassen er uendret, og reglenes E1/E1P-nivå og parametergodkjenning behandles separat.

### 4.2 Dato (punkt 3)
Kjøredato 18.10.2026 og at kalkulatoren automatisk bruker dagens dato som norsk registreringsdato er **uttrykkelig brukerbekreftet** og registrert slik (`runDateProvenance = user_confirmed`). Ingen styrende kilde krever at datoen er synlig i skjermbildet; kravet er at datoen **lagres** (IMPORT_ENGINE_SPEC linje 79; `requiredToUpgrade`; `check-docs.mjs` `runDate`). Datoen er derfor ikke ukjent. Klokkeslett kreves ikke av noe styrende dokument.

### 4.3 Konklusjon per referanse (input- og resultatbildene ved oppgitt pris)
| Referanse | Bilder | Konklusjon | Begrunnelse |
|---|---|---|---|
| **GR-20261018-02 EV, pris 350 000** | `02_input_pris_350000`, `01_resultat_pris_350000` | **Oppfyller eksisterende klasse 1-krav.** Registrert som `C1-GR-20261018-02` | alle sju inputsteg vises (steg 7 alternativ beregning uten verdi); resultat 16 748,00 vises; skjermbilder hashet, uten persondata; kilde = Skatteetatens kalkulator (oppgitt, tittel synlig); dato brukerbekreftet; uavhengig av motoren (motoren ble kjørt etterpå). CO₂ vises ikke for elbil og er ikke registrert som observert |
| **GR-20261018-03 diesel, pris 350 000** | alle tre (samme pris) | **Oppfyller eksisterende klasse 1-krav.** Registrert som `C1-GR-20261018-03` | steg 1–10 i inputbildet, steg 11 (uten verdi) i resultatbildet; resultat og nedbrytning 333 723,00 (331 323,97 + 2 400,00); samme øvrige begrunnelse som EV |
| **GR-20261018-01 PHEV, pris 600 000** | `02_input_pris_600000`, `01_resultat_pris_600000` | **Oppfyller eksisterende klasse 1-krav** etter brukerbekreftelse av steg 11 (18.10.2026: «Alternativ beregning» sto tomt). Registrert som `C1-GR-20261018-01` | steg 1–10 vises i inputbildet, steg 11 er brukerbekreftet tomt (samme proveniens som kjøredato; ikke synlig i bildene); resultat 529 069,00 vises; skjermbilder hashet, uten persondata; kilde og dato som for EV/diesel. CO₂-metoden «vektet kombinert» er fortsatt motorantakelse, ikke observert input |

Nedbrytningsbildene med andre priser (PHEV 2 600 000, EV 300 000) er **separate observasjoner** (`calculatorObservations`) og inngår ikke i klasse 1-tilfellene; at de mangler inputkobling diskvalifiserer ikke input-/resultatsettene ved 600 000 og 350 000.

### 4.4 PHEV: CO₂-antakelsen (punkt 4)
Observert input er CO₂ 140 g/km og målemetode «WLTP». «Vektet kombinert» er en **motorantakelse** (testintensjon) som trengs fordi motoren blokkerer `wltp_combined` for PHEV; den er ikke observert og blir ikke observert av at totalen stemmer. Antakelsen påvirker ikke hva kalkulatorreferansen dokumenterer (kalkulatorens egne input), men den må stå ved enhver bruk av referansen til å validere motorens PHEV-regel (R-OTA-005/-002). Den er beholdt i `co2MethodAssumption` og i testen.

### 4.5 Det klasse 1 ikke betyr
Klasse 1 er ikke godkjenning. R-OTA-002, R-OTA-010 og R-OTA-014 er fortsatt E1P og er ikke godkjenningsklare. Ingen parameter er godkjent. EV/diesel-referansene dekker bare de reglene motoren anvendte for disse inputene (`ruleIds`); de beviser ikke enkeltregler isolert (kalkulatoren viser ikke delregler her).

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
Ingenting mer kreves av den styrende definisjonen for de tre referansene. For godkjenning av parametere kreves fortsatt E1-regler (R-OTA-002/-010/-014 er E1P) og din uttrykkelige godkjenning; ingen er gitt.
