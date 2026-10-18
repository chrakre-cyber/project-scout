# ECON-002 — norsk avgiftsruntime: vurdering av gapet (18.10.2026)

**Status: BLOCKED (mangler kildefiler i `docs/tax/primarkilder/`; valg A er gjort).** Oppdatert 18.10.2026 med «source pack» (§11–§13). Dette er en vurdering. Ingen kode, parametere, regler, DB, UI eller TAX-filer er endret. Ingen tester er kjørt (ingenting å teste uten parametere). TAX-foundation er uendret **REVIEW** (0 godkjente parametere, 0 klasse 1-referanser). Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `b9ff75b`.

Faktamerking: *[REPO]* står i repoet. *[OPPGITT]* oppgitt av Christian. *[DIAGNOSE]* Claudes utregning for å lokalisere gapet; **ikke regelbevis** og ikke kalibrering.

## 1. Hvorfor oppgaven stopper her
1. **Offisielle kilder er ikke tilgjengelige for meg.** Miljøets nettverkspolicy avviser `www.skatteetaten.no`, `lovdata.no`, `www.regjeringen.no`, `www.stortinget.no`, `www.toll.no` og `www.norges-bank.no` (proxyen svarer 403 på CONNECT; forsøkt én gang per vert, ikke gjentatt). Repoet inneholder ingen kildefiler: `docs/tax/` har bare transkripsjoner/metadata med hash (f.eks. `bruksfradrag-tabell-T07.json` → `primarkilder/bruksfradragstabell.html`, som ikke ligger i repoet), og review-ZIPene (TAX-001A/B) inneholder heller ingen kildefiler.
2. **Det finnes ingen lest kilde (E1) for de parameterne som mangler** (se §3). Alle gruppe a-satser er E1X (ekstern verifisering, ikke lest av Claude).
3. Å la de tre gyldne casene bestemme satsene ville være kalibrering og er forbudt (oppdraget pkt. 1–2 og 6, CLAUDE.md pkt. 5). Jeg har derfor **ikke** forsøkt å finne parametere som treffer 529 069 / 16 748 / 333 723.

Svar på §10 (kort): se §9.

## 2. Hva som er gjenbrukt og hva som ikke er endret
Alt i `docs/tax/` (31 regler, 42 kilder, 108 referanser, T07 med hash, `TaxInputV1`, `event-dates.md`, `purchase-basis.md`), DEC-030/031/032 og ECON-001/-FIX er uendret. Ingen parallell regelmodell er opprettet.

## 3. Evidensmatrise: hva som kreves for å reprodusere casene
| Regel | Dagens evidens [REPO] | Nivå | Gap | Kilde som må leses (kategori) |
|---|---|---|---|---|
| **Generell vektkomponent** (alle drivlinjer inkl. elbil) | R-OTA-001: «260 kr/kg over 1 200 kg» (gruppe a, E1X). Rundskriv (E1, 6.12): elbil i gruppe a betaler engangsavgift etter stortingsvedtaket § 2 | E1P/E1X | Det er **ikke** dokumentert om 260 er den generelle komponenten, en forbrenningsspesifikk komponent eller summen; terskel(er), trinn og sats for elbil er ukjent | Stortingets avgiftsvedtak om engangsavgift 2026 (§ 2 og § 3), E1 med hash |
| **ICE-spesifikk vektkomponent** | Rundskriv/T02-sammendrag: «bil med forbrenningsmotor: ny vektkomponent + generell engangsavgift; elbil: bare vektkomponent» (E2) | E2 | Finnes det to vektkomponenter? Satser, terskler, om de kumuleres | samme vedtak + forskrift |
| **CO₂-bånd** | R-OTA-002: 800/1 600/3 200/5 000 kr per g/km for 0–100/101–150/151–225/>225 (E1X) | E1X | Marginal eller flat sats per bånd er **ikke gitt** («Om bånd regnes trinnvis … IKKE gitt»); avrunding av CO₂-grunnlag | vedtaket + forskrift § 3-1 |
| **EV-behandling** | R-OTA-007: «kun vektkomponent», satser mangler (E1P) | E1P | Se generell vektkomponent. PB-BEV peker i dag på R-OTA-001 uten egen EV-sats | vedtaket |
| **PHEV** | R-OTA-005: vektet kombinert CO₂ (E1X); vektfradrag opphevet 2024 (rundskriv 3.3.11, E1) mot «inntil 10 %» (E2-sammendrag) | E1P | U-005 åpen; elektrisk rekkevidde-regel ukjent; om det finnes andre PHEV-spesifikke elementer i 2026 | rundskriv (E1, allerede lest) + forskrift § 3-1 + vedtaket |
| **NOx** | R-OTA-003: fjernet fra 1.1.2026 (rundskriv 3.2.4, E1) | **E1** | Ingen — kan implementeres som «ingen komponent» (T02-avstemming gjenstår) | — |
| **Bruksfradrag** | T07 (41 trinn, E1, hash); rundskriv 4.2–4.3 (E1): dato til dato, prosent av utregnet avgift | E1 (tabell) / E1P | Forskrift § 3-3 ikke lest (U-002); «Age over …» (strengt over eller fra?) og månedstrinn dato-til-dato er uavklart; **om vrakpant reduseres av fradrag er uavklart** (R-IMP-OTH-001 åpent spørsmål) | forskrift § 3-3 |
| **Vrakpantavgift** | R-IMP-OTH-001: 2 400 kr, personbil gruppe a/b/c/g/j/k, fra 2026-01-01, heltall (rundskriv 3.4 og T20, E1) | **E1** | Gjelder 2 400 for alle tre casene? Ja etter regelteksten (personbil, gruppe a) — men bruksfradrag × vrakpant er uavklart | forskrift/rundskriv |
| **Avrunding** | «IKKE KONTROLLERT» for alle komponenter | — | Ingen kilde for mellomtrinn vs sluttsum | forskrift/rundskriv; kalkulatorens dokumenterte oppførsel |
| **Ikrafttredelse** | Gruppe a fra 2026-01-01 uten sluttdato (E1X); gruppe b-endring 2026-09-01 (E1X) | E1X | «Åpen sluttdato» er ikke «bekreftet ut året»; styrende hendelsesdato (U-002/event-dates) | vedtaket (vedtak 220, 1131/1132) |

**Ingen av kildene i kolonnen til høyre er lest av Claude.** Jeg angir bevisst bare kategorier og ikke paragrafnummer eller URL jeg ikke har verifisert.

## 4. Rotårsaker (første vurdering — **delvis overstyrt av §11**)
*Før source pack. Der §4 og §11 er uenige, gjelder §11. Hypotesene i §4.1 og §4.3 om «manglende komponent» er bekreftet av source pack (§11); §4.3s påstand om 30 % fradrag er bekreftet.*

### 4.1 CASE-001 (Lamborghini Urus PHEV)
*[DIAGNOSE]* Med de E1X-satsene som finnes (marginale CO₂-bånd, 260 kr/kg over 1 200 kg, vekt 2 610 kg, CO₂ 140 g/km) blir avgiften før bruksfradrag 366 600 + 144 000 = **510 600**. Offisiell «Avgift» minus 2 400 er **526 669** (forutsetter at vrakpanten ikke reduseres av fradraget og er 2 400, begge uverifisert). For første registrering 2026-09-01 og en kjøring etter denne datoen gir T07 høyst 2 % fradrag, så avgift før fradrag må være ≥ 526 669, altså **minst 16 069 (3,1 %) høyere** enn modellen gir.
**Rotårsak (sannsynlig, ikke bevist):** manglende eller feil komponent i modellen — enten en ekstra vektkomponent (se «generell vs ICE-spesifikk»), en annen CO₂-beregning (flat sats per bånd, annet CO₂-grunnlag for PHEV, avrunding av vektet CO₂) eller en annen vekt i kalkulatoren enn 2 610 kg. Kan ikke avgjøres uten kilde og dokumentert kalkulatorkjøring.

### 4.2 CASE-002 (BMW iX3 EV)
Modellen i repoet har **ingen EV-sats**; PB-BEV peker på R-OTA-001 (260 kr/kg), som ga 256 100 kr på vekt mot en offisiell avgift på størrelsesorden 14 000. **Rotårsak (sikker, strukturell):** R-OTA-001 er registrert som én sats for «alle drivlinjer», men rundskrivet (E1) og T02 (E2) sier at forbrenningsbiler har en tilleggskomponent elbiler ikke har. 260 kr/kg kan derfor ikke brukes på elbil. Dette er ikke en avrundings- eller aldersfeil. Riktig EV-sats/terskel finnes ikke i evidensen.

### 4.3 CASE-003 (Mercedes E 400 d)
ECON-001 §7-proben konkluderte med at offisiell avgift impliserte «26,6–27,1 % bruksfradrag mot 26 % i tabellen». **Den konklusjonen var ikke holdbar:** 26 % gjelder 24–29 måneders alder, men alderen ble antatt, ikke utledet fra en dokumentert kjøredato. Første registrering 2023-11-01 og kjøring etter 2026-09-01 (CASE-001 forutsetter det) gir 34–35 måneder ⇒ T07: **30 %** (over 30 mnd; 33 % først fra 36 mnd). Med 30 % må avgift før fradrag være ≈ **473 319**, mot 454 560 fra modellen: **+18 759 (+4,1 %)**. Retningen er den samme som i CASE-001 (modellen er for lav). Per kg over 1 200 tilsvarer gapene 24 kr/kg (CASE-003) og 19 kr/kg (CASE-001) — ikke en felles lineær term under de antatte aldrene, så ett enkelt «manglende kr/kg» forklarer ikke begge. **Rotårsak (delvis):** (1) ECON-001-proben bygde på en udokumentert alder; kjøredato må registreres per case. (2) Residualet peker på manglende komponenter/regler, ikke på bruksfradragstabellen alene. ECON-001 §7-proben skal leses som *ikke bevis*; rettes i ECON-001-teksten ved neste endring.

### 4.4 U-002, U-003, U-005, U-008
| ID | Status | Rotårsak / hva som kreves | Berører casene? |
|---|---|---|---|
| **U-002** | Åpen | Engelsk satsside («date of the vehicle's production») mot rundskriv 4.2 (første registrering i utlandet, dato til dato). Forskrift § 3-3 er ikke lest; «Age over» (strengt/ikke) og månedstrinn ikke avklart. Påvirker alle brukte biler ved trinngrenser | Ja (alder), men ikke avgjørende for datoene i casene (ikke på trinngrense 18. okt.) |
| **U-003** | Åpen | Mva.-håndbok merket 2025; 2026-dekning ikke kontrollert. Gjelder fradragsrett (R-DED-001), ikke engangsavgift | Nei (avgift); ja for landed cost (ECON-004) |
| **U-005** | Åpen | PHEV-vektfradrag: rundskriv 3.3.11 (E1, opphevet 2024) mot E2-sammendrag («inntil 10 %»). Må avgjøres mot vedtak/forskrift § 3-1 og kalkulatorkjøring | **CASE-001** (PHEV) |
| **U-008** | Åpen | Tollkursens syklus (to uker/ukentlig); T23/T24 ikke lest | Nei (avgift); ja for mva.-grunnlag (`customs_fx_rate`, ECON-004/008) |
Ingen er lukket i denne oppgaven; ingen parameter er endret «stille».

## 5. Alder og bruksfradrag (design klart, ikke implementert)
`kilde første registrering` (presisjon day/month/year, ECON-001 §4.1) → `arbeidsdato` (måned ⇒ 1. i måneden; bare år ⇒ blokkert, aldri 1. januar) → `forventet norsk registreringsdato` (standard beregningsdato, overstyrbar, `assumed-default`) → **alder i hele måneder dato-til-dato** → trinn i T07 → prosent av utregnet engangsavgift. Åpne forutsetninger som må avgjøres før koden er «deterministisk riktig»: strengt «over» vs «fra» ved trinngrense (U-002), og om dato-til-dato også gjelder månedstrinn. Grensetester (skal skrives når regelen er avklart): dagen før/på/etter hver månedstrinngrense (f.eks. 30 mnd, 36 mnd), skuddår/månedsslutt (31. → kortere måned), 20-årsgrensen (rundskriv 6.21: 1. januar), bare-år ⇒ `blocked_exact`, mangler måned ⇒ ikke eksakt.

## 6. Kjøretøyklasse / drivlinje (normalisert avgiftsinput, forslag)
`taxVehicleClass ∈ {M1_personbil, N1_varebil_klasse1, N1_varebil_klasse2, unsupported}`; `taxPowertrain ∈ {bev, phev, ice_petrol, ice_diesel, hev_nonplugin, unsupported}` — utledet fra **dokumentert** drivlinje (typegodkjenning/SVV-felt), aldri fra markedsføringsnavn («e-tron», «Hybrid», «xDrive»). `hev_nonplugin` ⇒ `not_calculated` inntil behandlingen er dokumentert (R-OTA-006 har ingen regeltekst). Input: `norwegian_tax_weight_kg`, `co2_wltp_gkm` (PHEV: vektet kombinert) + `co2_method`, `electric_range_km?`, kilde-/forventet-/faktisk dato, `taxGroup` (a for M1). Ingen valuta, transport, FX, leverandør- eller UI-felt i input. Tilsvarer `TaxInputV1`; avvik må avgjøres sammen med profilene i `docs/tax/profiles.json` (ingen parallell modell).

## 7. Avrunding, vrakpant og grensesnitt
- **Avrunding:** desimalaritmetikk uten float; ingen mellomavrunding før kilden sier noe annet; sluttsum til hele kroner. Hvilken regel kalkulatoren faktisk følger er **ikke dokumentert** (§3). Ingen sats justeres for å kompensere.
- **Vrakpant:** 2 400 kr er E1 (rundskriv 3.4, T20) og gjelder personbil i gruppe a fra 2026-01-01, altså alle tre casene. Om den reduseres av bruksfradrag er uavklart; den påvirker fordelingen `one_off_tax` / `scrappage_deposit`, ikke totalen som er validert. Komponentene holdes adskilt.
- **Grensesnitt (ikke implementert):** `calculateNorwegianVehicleTax(input, profile): TaxResult` med `status: calculated | not_calculated | blocked`, `profileRef`+versjon, `components[]` (generell vekt, ICE-vekt, CO₂, `age_deduction`, `one_off_tax`, `scrappage_deposit`, `total_registration_taxes`), `missingInputs[]`, `blockedReasons[]`, `evidence{level, approved, classes}`. Utløpt/ukjent profil, ukjent drivlinje, manglende vekt eller bare-år-registrering ⇒ `blocked`/`not_calculated` — aldri 0.

## 8. Testplan (skrives når parametere er godkjent)
Gyldne caser som låste regresjonsfixturer (forventede 529 069 / 16 748 / 333 723 inkl. vrakpant, eksakt), EV vs ICE vekt, PHEV, CO₂-båndgrenser (100/101, 150/151, 225/226), aldersgrenser, manglende måned, manglende avgiftsvekt, utløpt profil, ukjent klasse, deterministisk avrunding, test som feiler hvis noen endrer de forventede verdiene. Testene skal feile for kalibrering: parametere kommer fra godkjente regelposter, ikke fra casene.

## 9. Svar på §10 i oppdraget
1. **Kan alle tre casene reproduseres eksakt nå?** Nei. Ingen implementert; evidensen er utilstrekkelig (§3).
2. **Hvilke TAX-blokkere er løst?** Ingen i denne oppgaven. Kartlagt: rotårsak CASE-002 (EV delte ICE-sats), CASE-003 (proben i ECON-001 brukte antatt alder), CASE-001/-003 (manglende komponent/regel); NOx (E1) og vrakpant 2 400 (E1) kan brukes.
3. **Hva gjenstår?** E1-kildefiler med hash for vedtak (§§ 2, 3) og forskrift (§§ 2-3, 3-1, 3-3); avklaring generell vs ICE-vektkomponent og EV-sats; marginal vs flat CO₂-trinn; PHEV (U-005); U-002; vrakpant × bruksfradrag; avrunding; ikrafttredelse; dokumenterte kalkulatorkjøringer (klasse 1) med kjøredato/norsk registreringsdato/inputs per case; godkjenning (`parameterApproval`).
4. **Er runtime tilstrekkelig trygg for ECON-004?** Nei, ikke for avgiften. ECON-004 kan bygges med avgiftsdelen som `not_calculated` (som i ECON-001 §14).
5. **Hindrer noe at avgiftsverdier vises i ekstern demo?** Ja: ingen validert avgiftsmotor, ingen godkjente parametere, ingen klasse 1-referanser (TAX-gate). Eksisterende syntetiske avgiftsverdier må ikke presenteres som reelle.

## 10. Hva som trengs for å fortsette (leveranse fra Christian)
**Valg A er gjort (18.10.2026): kildene leveres som filer. Eksakt filliste står i §12.** Opprinnelig tekst:
Velg én:
- **A (foretrukket):** legg kildefilene i repoet under `docs/tax/primarkilder/` (HTML/PDF som lest, med URL og lesedato): Stortingets avgiftsvedtak om engangsavgift 2026 (gruppe a og b), forskrift om engangsavgift §§ 2-3, 3-1, 3-3, rundskrivet (T03) og satssidene (T02/T20/T30–T39). Jeg beregner SHA-256, løfter til E1 og skriver parametere med kilde, dato, versjon og evidensklasse.
- **B:** åpne nettverksadgang for `www.skatteetaten.no`, `lovdata.no`, `www.regjeringen.no`, `www.stortinget.no` (Edit environment → Network access → Allowed domains) slik at jeg kan lese kildene selv.
I tillegg, for hver av de tre casene: kalkulatorens kjøredato, norsk registreringsdato brukt, alle inputs (vekt, CO₂, drivlinje, første registrering), og skjermbilde/utskrift (gjør dem til klasse 1). Uten dette kan ikke casene bli klasse 1-referanser.

Evidensuavhengige deler (T07-aldersfunksjon med grensetester, vrakpant, klassifisering, grensesnitt med `blocked`-tilstander) kan implementeres uten kildene, men gir ingen verdi for avgiftsberegning før parametrene er godkjent, og U-002 gjør aldersfunksjonen ikke fullt deterministisk ved trinngrenser. Jeg har ikke startet dem uten din bekreftelse.

## 11. Reassessment med source pack (18.10.2026)
**Kildestatus:** de fire kildene i pakken er *uavhengig verifisert av Christian/Codex*, men er foreløpig **bare meldingsfakta (E1X)**. De er ikke filer i repoet, ikke hashet og ikke lest av Claude. Jeg har ikke endret noen parameter, regel, kilde- eller evidensfil. Alt under er **diagnose (lokal regning) for å teste om pakken forklarer casene**; det er ikke regelbevis og ikke godkjenning.

**Regler fra pakken (E1X, uendret i repoet):** (1) alle personbiler: 12,71 kr/kg over 500 kg; (2) forbrenningsmotor: tillegg 260 kr/kg over 1 200 kg; (3) CO₂ 0–100: 800, 101–150: 1 600, 151–225: 3 200, >225: 5 000 kr per g/km — **marginale/progressive bånd**; (4) bruksfradrag etter T07-trinn (1 mnd 2 %, 2 år 26 %, 2 år 6 mnd 30 %, 3 år 33 % …); (5) vrakpant 2 400 kr personbil; (6) forskrift §§ 3-1 til 3-3 inkl. 2026-endringer.

**Forutsetninger i regningen (alle uverifiserte):** vekter og CO₂ som i ECON-001 §7 (2 610 / 2 185 / 1 976 kg; 140 / 0 / 179 g/km); PHEV regnes som «forbrenningsmotor» (får 260-leddet); CASE-002 (elbil) får **ikke** 260-leddet; kjøredato for kalkulatoren er ikke dokumentert og settes til 2026-10-18 for aldersberegning (se vindu under); desimalaritmetikk; vrakpant 2 400 legges til **uten** å reduseres av bruksfradrag.

| | CASE-001 PHEV | CASE-002 EV | CASE-003 diesel |
|---|---|---|---|
| Generell vekt (vekt − 500) × 12,71 | 2 110 × 12,71 = 26 818,10 | 1 685 × 12,71 = 21 416,35 | 1 476 × 12,71 = 18 759,96 |
| ICE-vekt (vekt − 1 200) × 260 | 1 410 × 260 = 366 600 | **0 (ikke ICE)** | 776 × 260 = 201 760 |
| CO₂ marginalt | 100×800 + 40×1 600 = 144 000 | 0 | 100×800 + 50×1 600 + 29×3 200 = 252 800 |
| Avgift før fradrag | 537 418,10 | 21 416,35 | 473 319,96 |
| Alder (første reg. → 2026-10-18) / T07 | 1 mnd 17 d → 2 % | 3 år 2 mnd 17 d → 33 % | 2 år 11 mnd 17 d → 30 % |
| Etter fradrag (eksakt desimal) | 526 669,738 | 14 348,9545 | 331 323,972 |
| + vrakpant 2 400, **avrundet ned** | **529 069** | **16 748** | **333 723** |
| Offisielt validert | 529 069 | 16 748 | 333 723 |
| Treff? | ✔ | ✔ | ✔ |
| Hvis avrundet til nærmeste krone | 529 070 ✘ | 16 749 ✘ | 333 724 ✘ |
| Hvis vrakpant også reduseres av fradrag | 529 021,74 ✘ | 15 956,95 ✘ | 333 003,97 ✘ |

**Funn:**
1. **CASE-002** skal ikke ha 260-leddet; da faller feilen fra §4.2 bort (256 100 → 0). Treffer 16 748.
2. **CASE-003** bruker riktig aldersgrunnlag (30 %, ikke 26 %); ECON-001-proben var feil (udokumentert alder), og det manglende leddet var den generelle vektkomponenten (18 760) som ikke var i repoet — ikke et avvikende bruksfradrag.
3. **CASE-001** treffer når PHEV får 260-leddet og ingen vektfradrag for ladbar hybrid (konsistent med rundskriv 3.3.11 «opphevet 2024», E1 — men *ikke* bevist av pakken). Det manglende leddet i §4.1 var igjen den generelle vektkomponenten (+26 818).
4. **CO₂-bånd er marginale** (brukt i alle tre; CASE-001 og -003 bruker bånd 2–3). 
5. Alle tre treffer eksakt med desimalregning og **avrunding ned (trunkering) av summen etter fradrag**, med vrakpant lagt til uten fradrag. Avrunding til nærmeste krone treffer ingen. Samme resultat om vekt/avgift før fradrag avrundes ned først (526 669,64 / 14 348,72 / 331 323,3 → ned).
6. **Aldersvindu:** de tre trinnene er samtidig gyldige for kalkulatorkjøring etter 2026-10-01 og til og med 2026-11-01 (CASE-001: >1 mnd og ≤2 mnd; CASE-002: >36 og ≤42 mnd; CASE-003: >30 og ≤36 mnd). Ingen av casene ligger på en trinngrense 2026-10-18. Faktisk kjøredato må likevel dokumenteres.

**Viktig begrensning (ærlig):** punkt 5 (avrundingsregel og at vrakpant ikke reduseres) er **utledet fra de gyldne casene**. Oppdraget forbyr å bruke casene som regelbevis. Jeg har derfor *ikke* skrevet dette som regel. Det kan bare adopteres hvis en kildefil (forskrift/rundskriv) sier det samme; casene brukes bare som uavhengig kontroll *etter* at regelen er kilde-belagt. Uten kildebelegg for avrundingen blir implementasjonen blokkert (`not_calculated`) på det punktet.

**Foreløpig status på tidligere blokkere (ikke endret i repoet):**
| Blokker | Status etter source pack |
|---|---|
| Generell vs ICE-vektkomponent | Forklart av pakken (E1X); venter på filbevis |
| EV-sats | Samme generelle komponent, uten 260; venter på filbevis |
| CO₂ marginal/flat | Marginal (E1X); venter på filbevis |
| CASE-001/-002/-003 avvik | Forklart (diagnose), ikke adoptert |
| U-002 (bruksfradragsgrenser) | Åpen: casene ligger ikke på trinngrenser; «over» vs «fra» og dato-til-dato for månedstrinn må leses fra § 3-3/rundskriv |
| U-005 (PHEV-vektfradrag) | Diagnosen treffer uten fradrag; kilde-lukking gjenstår |
| U-003, U-008 | Uendret (mva./kurs; ikke avgiften) |
| Avrunding | Utledet «ned», ikke belagt |

## 12. Påkrevd filliste i `docs/tax/primarkilder/` (valg A)
Filene skal være **slik de ble lest** (HTML «Lagre som», eller PDF), uendret, uten omskriving. For hver fil kreves et kort metadatafelt (i `docs/tax/primarkilder/MANIFEST.md` eller JSON): *URL*, *hentedato*, *publiseringsdato/«sist endret»/versjon* hvis siden viser det, hvem som hentet den. Jeg beregner SHA-256, registrerer i `sources.json` (E1: `directReadDate`, `fetchStatus`, `publishedVersion`, `packageFile`, `packageSha256`, `limitations`) og lar `docs/tax/check-docs.mjs` verifisere hash. Filer jeg ikke har lest forblir E1X.

| # | Fil (foreslått navn) | Innhold som må være med | Hvorfor | Eksisterende kilde-ID |
|---|---|---|---|---|
| 1 | `finansdepartementet-avgiftssatser-2026.html\|.pdf` | Finansdepartementet «Avgiftssatser 2026», **engangsavgift personbil**: vektkomponent (12,71 kr/kg > 500 kg), tillegg forbrenningsmotor (260 kr/kg > 1 200 kg), CO₂-tabell, evt. fotnoter om trinn/rekkefølge, **avgiftsgruppe a og b** | Sats- og datoevidens for alle gruppe a-parametere | ny (erstatter E1X for T30 sine gruppe a-satser) |
| 2 | `stortinget-vedtak-engangsavgift-2026.html\|.pdf` (Stortingets avgiftsvedtak, FOR-2025-12-18-2755, via Lovdata/Stortinget) **inkl. revidert 2026 (vedtak 1131/1132)** | §§ 2 (vekt, CO₂), 3, 8 (ladbar hybrid), 9 (fritak), ikrafttredelse | Rettskilden bak punkt 1; PHEV; gruppe a etter 2026-09-01 | T04, T30, T31 |
| 3 | `lovdata-forskrift-engangsavgift-konsolidert.html\|.pdf` (FOR-2001-03-19-268) | **Hele konsolidert versjon** med visning av «sist endret» og alle 2026-endringer: **§ 2-3, § 3-1 (egenvekt, CO₂-grunnlag, vektet CO₂ for ladbar hybrid), § 3-2, § 3-3 (bruksfradrag, inkl. tabell, «over»/dato-regel), eventuelle avrundings-/beregningsbestemmelser, § 3-x om hybrid/elektrisk** | U-002, U-005, avrunding, aldersregel, CO₂-grunnlag | T05 |
| 4 | `skatteetaten-bruksfradragstabell.html` | **Samme fil som allerede er registrert (T07)**; forventet SHA-256 `f91e8040d3443901a009abaa1320868c4f623be0622d6c71da7104edb575b8fd` | Verifiserer transkripsjonen i `bruksfradrag-tabell-T07.json` | T07 |
| 5 | `skatteetaten-bruksfradrag-no.html` (norsk side «Bruksfradrag») | Tekst om aldersberegning og trinn | U-002 (production vs første registrering) | T32 |
| 6 | `skatteetaten-vrakpantavgift.html` | Satsside for vrakpantavgift 2026 (2 400 kr personbil) | Vrakpant | T20 |
| 7 | `skatteetaten-rundskriv-engangsavgift-2026.pdf` | **Hele** årsrundskrivet (57 s., 1. januar 2026) — minst punkt 3.2.x (egenvekt, CO₂, WLTP), 3.3.11, 3.4, 4.1–4.3, 6.12, 6.21 og **avrundingsomtale** | Lest tidligere (E1) men filen ligger ikke i repoet; trengs for hash og avrunding | T03 |
| 8 | `skatteetaten-engangsavgift-hva-er.html` (valgfri) | T02-siden | Avstemming NOx og EV | T02 |
| 9 | `kalkulator/CASE-001.*`, `CASE-002.*`, `CASE-003.*` + `kalkulator/cases.json` | Per case: skjermbilde/utskrift av Skatteetatens kalkulator med **kjøredato**, **norsk registreringsdato brukt**, første registrering, vekt, CO₂ + metode, drivlinje, bruksfradrag, avgift, vrakpant, sum | Klasse 1-referanser; fastlegger alder og vekt | `references.json` |
| 10 | (valgfri) `norges-bank`/`toll` kilder | tollkurs-syklus | Kun U-008, ikke avgiften | T23/T24 |

Filene 1–3, 7 og 9 er nødvendig for å starte implementasjon. 4–6 verifiserer allerede registrerte kilder. Ingen hemmeligheter, ingen innloggede sider, ingen personopplysninger om kjøper.

## 13. Uløste spørsmål (må besvares av kildefilene eller av Christian)
1. **Avrunding:** hvilken regel (ned/nærmeste, hvilket trinn: etter fradrag eller per komponent) — kilde, ikke casene.
2. **Vrakpant og bruksfradrag:** reduseres vrakpanten (antatt nei)? Kilde.
3. **PHEV:** får ladbar hybrid 260-leddet, og finnes det i 2026 noe PHEV-fradrag i vektgrunnlaget (U-005)? Hvilken CO₂-verdi (vektet kombinert) og hvordan avrundes den?
4. **Generell vektkomponent:** kun «over 500 kg», eller også en øvre grense/trinn? Gjelder samme sats gruppe a og b? Er 12,71 et avrundet tall?
5. **Bruksfradrag (U-002):** «over» vs «fra» ved trinngrense; månedstrinn dato til dato eller kalendermåneder; «production» vs første registrering; hvilken dato som styrer (norsk registreringsdato vs innførsel); 20-årsgrensen.
6. **Gruppe a etter 2026-09-01 og revidert 2026:** er 12,71/260/CO₂-satsene endret fra 1. september 2026? CASE-001 har første registrering 2026-09-01.
7. **Vekt:** hvilken vektdefinisjon kalkulatoren bruker for utenlandskregistrert bil (rundskriv 3.2.2: minimumsvekt fra typegodkjenning) og om vektene i casene (2 610 / 2 185 / 1 976 kg) er det kalkulatoren faktisk brukte.
8. **Kalkulatorkjøringene:** kjøredato og norsk registreringsdato per case.
9. **Hybrid uten plugin** (R-OTA-006): ikke dokumentert; forblir `not_calculated`.
10. **Klasse 1-godkjenning:** hvem godkjenner parametere (`parameterApproval`) og referanser.

**Implementering startes ikke** før filene 1–3, 7 og 9 er levert, hashet og registrert. Når de er levert gjør jeg: (a) registrering/hash (E1), (b) lukking eller dokumentasjon av §13, (c) først deretter parametere, kode og tester (§5–§8).
