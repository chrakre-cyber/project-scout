# ECON-002 — norsk avgiftsruntime for personbil 2026 (oppdatert 18.10.2026, runde 5: §15)

**Status: REVIEW.** **Runde 8 (§18, 18.10.2026): tre kalkulatorkjøringer mottatt og registrert som `explicit_inputs`; motoren stemmer på sluttbeløp; klasse 1 registrert for PHEV, EV og diesel (runde 9–10, §19–§20); ingen parameter godkjent.** **Runde 5 (§15: kontroll av commit `3db380d`) og runde 4 (§14) overstyrer alle utsagn om U-010/U-011, avrunding, gyldighet og godkjenningsmatrise i §1–§13** (tilleggspakke med endelig stortingsvedtak og avrundingskilder lest; U-010 og U-011 lukket med forbehold). Runde 3 (§13): kilde- og valideringshull kartlagt; **ingen regel-, sats- eller parameterendring**, fordi endelig stortingsvedtak fortsatt ikke er tilgjengelig (nettverk blokkert, ingen ny fil). Ikke DONE; ECON-003 er ikke startet. TAX-foundation er fortsatt **REVIEW** (0 godkjente parametere, 0 klasse 1-referanser). Ingen parameter er godkjent av Claude; oversikten i §9 viser bare hva som er klart for *din* godkjenning.

**Fire nivåer holdes adskilt gjennom dokumentet:**
- **Kildebelagt** = regelen står i en lest kildefil (E1/E1P i `docs/tax`).
- **Implementert** = regelen finnes i `src/domain/tax`.
- **Testet** = en test i `tests/tax-engine.test.ts` prøver den (kjørt, §10).
- **Godkjent** = eksplisitt `parameterApproval` fra Christian. **Ingen er godkjent.**

Faktamerking: *[KILDE]* lest i fil i `docs/tax/primarkilder/`. *[TOLKNING]* Claudes slutning fra kilde. *[VALIDERING]* observasjon mot de gyldne casene (aldri regelkilde). *[ÅPEN]* ikke belagt.

## 1. Statusmatrise
| Område | Kildebelagt | Implementert | Testet | Godkjent |
|---|---|---|---|---|
| Generell vekt 12,71 kr/kg > 500 kg | ja (T40 s. 3, T41 § 2) — E1P | ja | ja | nei |
| ICE-tillegg 260 kr/kg > 1 200 kg | ja (T40 s. 3, T41 § 3 a 1) — E1P | ja | ja | nei |
| CO₂ marginale bånd | ja (T40 s. 3 «første/neste/resten») — E1P | ja | ja (grenser 100/101/150/151/225/226) | nei |
| CO₂-felt og metode (§ 3-1) | ja (T05, konsolidert forskrift) | ja (NEDC/fallback blokkert) | ja | nei |
| EV: bare generell vekt | ja (T03 6.12, T40, T41) | ja | ja | nei |
| PHEV | delvis: kjede i §7, **ikke eksplisitt** | ja | ja | nei |
| NOx fjernet | ja (T03 3.2.4) — E1 | ja (ingen komponent) | ja (ingen NOx i komponentene) | nei |
| Bruksfradragstabell (41 trinn) | ja (T05 § 3-3 = T42 = T07) | ja | ja | nei |
| Alder: første registrering, dato til dato, 20-årsregel | ja (T05 § 3-3, T42, T03 4.2) | ja | ja | nei |
| Månedstrinn / dag 29–31 | **nei** (U-009) | blokkerer i vinduet | ja | nei |
| Rekkefølge (avgift → fradrag → vrakpant) | ja, E1P (T05 § 3-3/§ 5-2, T03 4.3, T41 § 4) | ja | ja | nei |
| Vrakpant 2 400, ikke redusert | beløp: ja (T03 3.4, T41 § 5); «ikke redusert»: svakt (§ 7) | ja | ja | nei |
| **Avrunding** | **nei (U-010)** | ingen policy valgt; eksakt desimal + grenser | ja (policy bare på uttrykkelig forespørsel) | nei |
| Gyldighet: dokumentert start | ja (T41 § 1, T03 13.1) | ja | ja | nei |
| Gyldighet: dokumentert slutt | **ingen oppgitt** | `null` | ja | — |
| Intern sikkerhetssperre 2026-12-31 | — (intern, ikke kilde) | ja, egen feilkode | ja | — |
| Endelig stortingsvedtak (U-011) | **nei** (T40 + forslag T41) | — | — | nei |

## 2. Kilder (lest av Claude; SHA-256 fra faktiske filbytes, lik manifestet)
| ID | Fil | Dokument | Dato | Nivå |
|---|---|---|---|---|
| T40 | `01_Avgiftssatser_2026_Regjeringen.pdf` | Finansdepartementet, Avgiftssatser 2026 | «Dato: 01.05.2026» | E1 |
| T41 | `02_Prop_1_LS_2025-2026_Engangsavgift.pdf` | Prop. 1 LS (2025–2026), **forslag** til stortingsvedtak | § 1: fra 1.1.2026 | E1 (forslag; aldri alene) |
| T05 | `03_Forskrift_engangsavgift_FOR-2001-03-19-268.pdf` | Forskrift (Lovdata) | sist endret FOR-2026-01-13-29 | E1 |
| T42 | `04_Bruksfradragstabellen_Skatteetaten.pdf` | Skatteetaten, bruksfradragstabellen | uten dato | E1 |
| T03 | `05_Arsrundskriv_engangsavgift_2026_Skattedirektoratet.pdf` | Årsrundskriv 2026 | 1.1.2026 | E1 |
T40, T41, T05 og T42 mangler tekstlag og er lest visuelt (T05: alle 17 sider gjennomgått). `check-docs.mjs` verifiserer hash av filene i repoet.

## 3. U-010 — avrunding og beregningsrekkefølge
**Søkt (alle fem filer):** T03 tekstsøk («avrund», «rundes», «avrundes», «hele kroner», «nedad», «oppad», «desimal», «eksempel» m.fl.); T05 alle sider 1–17 (inkl. § 3-1 til 3-4, § 5-2, § 7-2, § 4-6, § 9-3); T40 alle sider; T41 alle sider; T42 begge sider.
**Funn:**
- Ingen bestemmelse om avrunding av engangsavgiften, komponenter, mellomsummer, CO₂-grunnlag eller prosentfradrag. «Del av måned regnes som hel måned» (T05 § 4-6) gjelder forholdsmessig avgift ved tidsbegrenset fritak, ikke bruksfradrag. «Små avvik kan skyldes avrundinger av satsene» (T40 s. 1) gjelder at *satsene* er avrundet (12,44 × 1,022 = 12,71), ikke avgiftsbeløpet.
- **Rekkefølge er belagt (E1P):** avgiften regnes ut («utregnede avgiften», T03 4.3; «i avgiften», T05 § 3-3; «i utregnet avgift», T05 § 5-2) → prosentfradrag → vrakpantavgift er en egen post (T41 § 5, T03 3.4). Forslaget § 4 sier at fradraget gjelder «den avgift som beregnes etter §§ 2 og 3».
**Beslutning (runde 1, historisk; overstyrt av §14.4 og §15):** avrunding var uavklart og ingen avrunding ble innført. Feltene `totalIntegerBounds`/`rounded` som omtales her finnes ikke lenger; i dag gjelder `finalClaim` (R-OTA-014).
**Hva som trengs:** tekst om avrunding i stortingsvedtaket, forskriften, rundskrivet eller Skatteetatens beregningsregler. Skatteetatens kalkulatorbeskrivelse kan bare brukes som regelkilde hvis du uttrykkelig godkjenner det.
*[VALIDERING, ikke regel]:* de tre casene gir 529 069,738 / 16 748,9545 / 333 723,972; heltallsdelen er det offisielle beløpet i alle tre. Det er ikke adoptert.

## 4. U-011 — endelig stortingsvedtak
Prop. 1 LS er et forslag; satsene er verifisert mot Finansdepartementets oversikt (T40, 2026-05-01), ikke mot vedtaket. **Kryssjekk av paragrafnummer mot rundskrivet (T03, januar 2026):**
- Samsvarer med forslaget: §§ 1, 2, 3 (a–j), 5 og 8 andre ledd (vrakpant), 6 (refusjon), 8 første ledd a–p (fritak), 11 (dispensasjon).
- Samsvarer *ikke*: «§ 9 første ledd d til p» (3.4) og «§ 12» (3.3.3.5); i forslaget er § 9 en forskriftshjemmel og § 11 dispensasjon. Rundskrivet er internt inkonsistent (3.4 mot 6.1).
- Rundskrivet siterer **aldri § 4 (bruksfradrag)**. Forslagets § 4, som er grunnlag for «vrakpant reduseres ikke», er derfor ikke bekreftet av vedtaket.
**Dokument som trengs:** *Stortingets vedtak om engangsavgift på motorvogner mv. for 2026* (Stortinget vedtak 220; Lovdata FOR-2025-12-18-2755) i endelig, konsolidert tekst, med **§ 1** (ikrafttredelse), **§ 2** (12,71 kr/kg over 500 kg), **§ 3 første ledd a** (260 kr/kg over 1 200 kg og CO₂-tabell; plus ordlyden «stempeldrevet forbrenningsmotor»), **§ 4** (bruksfradrag), **§ 5** (vrakpantavgift 2 400), **§ 8** (fritak; vrakpant for a–c), **§§ 11–12** (dispensasjon) og eventuell overgangsbestemmelse; i tillegg **endringsvedtak i 2026** (revidert nasjonalbudsjett, vedtak 1131/1132 og lov 19.6.2026, jf. U-001) for å avgjøre om gruppe a-satsene er endret etter 2026-05-01. Uten dette forblir U-011 åpen; ingen parameter som hviler på § 2/§ 3/§ 4/§ 5 kan løftes til ren E1.

## 5. U-009 — dag 29–31: grenseeksempler (alle kjørt i testene)
**Kildebelagt:** et trinn nås på dagen kjøretøyet «fyller» alderen (T42; rundskriv 4.2: første registrering 15. januar → ett-års fradrag 15. januar året etter). For dag 1–28 finnes dagen i alle måneder, så oppførselen er kildebelagt.
**Ikke belagt:** hva som skjer når dagen ikke finnes i målmåneden. To kandidater: siste dag i måneden («clamped») eller 1. i neste måned («rolled»). Motoren regner begge og **blokkerer bare når norsk registreringsdato ligger i vinduet [clamped, rolled)**; før vinduet er trinnet ikke nådd i noen tolkning, etter er det nådd i begge.

| Første registrering | Trinn | Norsk registrering | Utfall | Belegg |
|---|---|---|---|---|
| 2025-01-31 | 1 måned | 2025-02-27 | 0 % | begge kandidater (02-28 / 03-01) ligger etter |
| 2025-01-31 | 1 måned | **2025-02-28** | **blokkert** `age_step_boundary_ambiguous` (vindu 02-28 – 03-01) | ikke belagt |
| 2025-01-31 | 1 måned | 2025-03-01 | 2 % | begge nådd |
| 2025-03-31 | 1 måned | 2025-04-29 / **04-30** / 05-01 | 0 % / **blokkert** / 2 % | 30-dagersmåned: bare 30. er uavklart |
| 2023-05-30 | 9 måneder (skuddår 2024) | 2024-02-28 / **02-29** / 03-01 | 15 % / **blokkert** / 16 % | 02-30 finnes ikke |
| 2023-05-29 | 9 måneder | 2024-02-29 | 16 % | dagen finnes i skuddåret |
| 2024-02-29 | 1 år | 2025-02-27 / **02-28** / 03-01 | 18 % / **blokkert** / 19 % | 2025-02-29 finnes ikke |
| 2024-02-29 | 4 år | 2028-02-29 | ingen overflyt | dagen finnes |
| 2025-01-28 | 1 måned | 2025-02-27 / 02-28 | 0 % / 2 % | dag ≤ 28: kildebelagt |
| 2025-01 (bare måned) | 1 måned | **2025-02-28** | **blokkert** via alternativet «siste dag i måneden» (2025-01-31) | måned-presisjon kan skjule dag 31 |
| 2025-01 (bare måned) | 1 måned | 2025-02-27 | beregnes (arbeidsdato 01-01: 2 %), `monthSensitivity` viser 0 % for 01-31 | – |
Feilen har `detail` (`stepMonths`, `clampedDate`, `rolledDate`, `viaMonthPrecisionAlternative`). Motoren velger aldri en dato i vinduet og gir aldri et avgiftsbeløp der. 20-årsregelen (1. januar) er ikke dag-følsom. *Merk:* testene bruker en kopi av profilen med tidligere `validFrom` for 2025-datoer (profilen dekker ellers bare 2026).

## 6. Gyldighetsperiode: dokumentert vs intern sperre
| Felt | Verdi | Status |
|---|---|---|
| `validFrom` | 2026-01-01 | **kildedokumentert** (T41 § 1; T03 13.1) |
| `documentedValidTo` | `null` | kildene oppgir ingen opphørsdato |
| `internalSafetyLimit` | 2026-12-31, `kind: "internal_guard"` | **intern sperre, ikke kildedokumentert opphør**; hindrer at 2026-satser stilltiende brukes for 2027 |
Feilkoder skiller: `no_profile_for_date` (før dokumentert start), `profile_not_valid_for_date` (etter *dokumentert* slutt; brukes når `documentedValidTo` er satt), `profile_internal_limit_exceeded` (etter intern sperre; teksten sier «ikke en kildedokumentert opphørsdato»). `rules.json`: `to: null` og `internalSafetyLimit` på datedParameters. Tidligere tekst («gyldig til og med 2026-12-31») er rettet.

## 7. PHEV: definisjon → bestemmelse → rundskriv
| Ledd | Innhold | Belegg |
|---|---|---|
| Definisjon | «Ladbar hybridbil» er **ikke definert** i T03, T05 (alle sider) eller T41. Kriteriet i avgiftsvedtaket er «stempeldrevet forbrenningsmotor» (T41 § 3; T03 6.12). Motoren klassifiserer teknisk: stempeldrevet motor = ja og ekstern lading = ja, med dokumentert bevis. | E1 (kriterium) / inputmodell |
| Anvendelig bestemmelse | Vedtakets § 3: tilleggsvekt 260 og CO₂-bånd (T41 § 3 a; T40 rad «med forbrenningsmotor»). Forskrift § 3-1 (T05 s. 5) sier hvilket CO₂-felt PHEV bruker («vektet kombinert»), som forutsetter at PHEV har en CO₂-komponent. T40 har ingen egen rad/sats/fradrag for ladbar hybrid. | E1 / E1P |
| Rundskriv | 3.3.11: «Vektfradraget for ladbare hybridbiler er opphevet … 1. januar 2024»; 6.12: § 3 ilegges «motorvogner med stempeldrevet forbrenningsmotor». | E1 |
| **Gap** | Ingen lest tekst sier uttrykkelig at ladbar hybrid svarer *tilleggsvekten* (260 kr/kg). Konklusjonen er utledet fra kriteriet og fra at PHEV behandles innenfor forbrenningsmotorkomponentene. Endelig vedtakstekst ikke lest (U-011). | **E1P / tolkning** |
Kjeden er registrert i `rules.json` R-OTA-005 (`chain`, e1Findings fra T03, T05, T40, T41) og testet. PHEV beholdes som «klar med forbehold».

## 8. Golden cases: dokumentasjon som mangler
**18.10.2026 er fastsatt testdato (`TEST_DATE`), ikke dokumentasjon på den opprinnelige kalkulatorkjøringen.** Fixturen merker nå hvert punkt `missing`/`partial`/`provided` (`tests/fixtures/tax-golden.ts`); ingen case har alle punkter, og `references.json` har fortsatt ingen klasse 1.
Levér for **hvert** case (CASE-001, -002, -003):
| # | Punkt | Status nå | Konkret leveranse |
|---|---|---|---|
| 1 | Kjøretøy | delvis (modellnavn) | merke, modell, variant, motor/drivlinje (ikke VIN) |
| 2 | Første registreringsdato | delvis (bare måned) | full dato (dd.mm.åååå) fra annonse/vognkort |
| 3 | Norsk registreringsdato brukt i kalkulatoren | **mangler** | datoen som ble tastet inn |
| 4 | Kalkulatorens kjøredato (+ klokkeslett) | **mangler** | faktisk dato for kjøringen; ikke 2026-10-18 med mindre det er riktig |
| 5 | Kalkulator: side/URL/versjon/tidspunkt | **mangler** | synlig i utskrift/skjermbilde |
| 6 | Avgiftsvekt og definisjon | delvis (verdi «ref.») | kg + hvilken vekt (minimumsvekt fra typegodkjenning?) og kilde |
| 7 | CO₂ og felt | delvis (g/km, WLTP) | verdi + felt («kombinert»/«vektet kombinert») fra CoC |
| 8 | Drivlinjebevis | **mangler** | stempeldrevet motor? ladbar? (typegodkjenning/kjøretøykort) |
| 9 | Skjermbilde av input | **mangler** | alle felt |
| 10 | Skjermbilde av resultat | **mangler** | inkl. delposter om vist |
| 11 | Nedbrytning | **mangler** | avgift, vrakpant, bruksfradrag-prosent slik kalkulatoren viser dem |
Case-spesifikt: **CASE-001** (første reg. 2026-09, PHEV): dag og kjøredato er avgjørende (2 % bare ved kjøring 2026-10-01…10-31 hvis dag 1; ellers 0 %/4 %); bekreft «vektet kombinert» 140 g/km. **CASE-002** (BEV, 2023-08): dag mindre kritisk; bekreft vekt 2 185 kg og at kalkulatoren ikke ga CO₂-ledd. **CASE-003** (2023-11): 30 % gjelder kjøring 2026-05-01…10-31 (hvis dag 1); 33 % fra 2026-11-01; bekreft 1 976 kg og 179 g/km WLTP «kombinert». Fradragstrinnene i de tre casene er samtidig stabile for kjøring i oktober 2026 (hvis dag 1).

## 9. Parametere klare for godkjenning (Claude godkjenner ikke)
«Klar» betyr kildesiden; formelle krav i `check-docs.mjs` gjelder uansett: regelen må være **E1** (R-OTA-001/002/005/007/010 er E1P), bare E1-kilder, `governingEvent`, `validity.from` og en **klasse 1-referanse** (0 finnes).
| Parameter | Verdi | Kildebelegg | Forbehold | Vurdering |
|---|---|---|---|---|
| Generell vekt (DP-WEIGHT-GEN-A-2026) | 12,71 kr/kg over 500 kg, alle personbiler | T40 s. 3; T41 § 2; rundskriv siterer § 2/§ 3 | U-011; satsoversikt 2026-05-01; senere endringer ikke kontrollert | **Klar med forbehold** |
| ICE-tillegg (DP-WEIGHT-A-2026) | 260 kr/kg over 1 200 kg, stempeldrevet forbrenningsmotor | T40 s. 3; T41 § 3 a 1 | U-011; PHEV-anvendelse utledet (§7) | **Klar med forbehold** |
| CO₂-bånd (DP-CO2-A-2026) | 800/1 600/3 200/5 000 kr per g/km; første 100/neste 50/neste 75/resten (marginalt) | T40 s. 3; T41 § 3 a 2 (tabell alene tvetydig) | U-011; marginal-lesning hviler på T40-ordlyden | **Klar med forbehold** |
| CO₂-felt/metode, NEDC-faktor | kombinert / vektet kombinert (PHEV); ×1,24 (a); WLTP-skjæring 2018-09-01 | T05 § 3-1 (konsolidert) | NEDC og egenvekt/10 ikke støttet (avrunding) | **Klar** for WLTP-delen |
| EV-behandling | bare generell vekt | T03 6.12; T40; T41 | U-011 | **Klar med forbehold** |
| NOx | ingen komponent fra 2026 | T03 3.2.4, 13.1.2 | – | **Klar** |
| Bruksfradragstabell | 41 trinn, 2 %…100 % | T05 § 3-3; T42; T07 (identiske) | månedstrinn/dag 29–31 (U-009, blokkert i vinduet); minimumsavgift ved ≥ 20 år ikke utledet | **Klar med forbehold** |
| Aldersdefinisjon | første gangs registrering, dato til dato; 20 år = 1. jan | T05 § 3-3; T42; T03 4.2 | U-009 | **Klar med forbehold** |
| Beregningsrekkefølge | avgift → % fradrag; vrakpant separat | T05 § 3-3/§ 5-2; T03 4.3; T41 § 4–5 | forslag § 4; U-011 | **Klar med forbehold** |
| Vrakpant | 2 400 kr personbil | T03 3.4; T41 § 5; T20 | at den *ikke* reduseres er bare støttet av forslag og svak refusjonskontekst | beløp **klar**; «ikke redusert» **ikke klar** |
| Styrende hendelse | første gangs registrering i Norge | T05 § 1-2 nr. 1 | forventet dato er forutsetning | **Klar** |
| Gyldighet | start 2026-01-01; ingen dokumentert slutt | T41 § 1; T03 13.1 | intern sperre 2026-12-31 er ikke kilde | **Klar** (start); sluttdato **ikke tilgjengelig** |
| **Avrunding** | – | ingen | U-010 | **Ikke klar** |

## 10. Implementert, endret og testet (denne oppfølgingen)
Endringer (ingen DB/UI/auth/provider/deployment/landed cost):
- `profile-no-2026-a.ts`: `documentedValidTo` (null) og `internalSafetyLimit` (internal_guard) i stedet for `validTo`; `types.ts`: `profile_internal_limit_exceeded`, `Blocker.detail`, `ProfileRef` utvidet; `age-deduction.ts`: `ambiguity`; `calculate.ts`: `checkProfileDate`, tydelig U-009-blokkering.
- `docs/tax/rules.json` (R-OTA-001/002 `to: null` + `internalSafetyLimit`; R-OTA-005 `chain` + 3 nye e1Findings; R-IMP-OTH-001 og R-OTA-010 nye e1Findings; U-009/U-010/U-011-tekster), `sources.json` (T05 readSections/limitations).
- `tests/tax-engine.test.ts` (61 tester; nye: gyldighet, U-009-grenser, PHEV-kjede, dokumentasjonsmangler), `tests/fixtures/tax-golden.ts` (sjekkliste, `TEST_DATE`).
**Kjørt:** `npx tsc --noEmit` OK; `npx eslint .` OK; `npx vitest run` — **30 filer, 696 tester bestått**; `node docs/tax/check-docs.mjs` OK. **Ikke kjørt:** `npm run build`, e2e, DB-suiter (ingen app-/DB-endring).

## 11. Gyldne caser (uendret mot forrige leveranse)
| | CASE-001 | CASE-002 | CASE-003 |
|---|---|---|---|
| Eksakt total (testdato 2026-10-18) | 529 069,738 | 16 748,9545 | 333 723,972 |
| Heltallsgrenser | [529 069, 529 070] | [16 748, 16 749] | [333 723, 333 724] |
| Offisielt | 529 069 | 16 748 | 333 723 |
Status `calculated_unverified`. Reproduksjon er **ikke validert** så lenge avrunding (U-010) er uavklart.

## 12. Gjenstående
1. **U-010 avrunding** — ingen kilde.
2. **U-011 endelig vedtak** — dokument og bestemmelser i §4.
3. **U-009** — motoren blokkerer i vinduet (§5).
4. **PHEV** — ikke eksplisitt (§7).
5. **Dokumentasjon per golden case** (§8) og **klasse 1-referanser**.
6. **Parametergodkjenning** (din beslutning; §9) og regel-evidens E1P → E1.
7. Sluttdato for 2026-satsene (ikke oppgitt) — den interne sperren er ikke en erstatning.
8. Utenfor: NEDC/fallback-CO₂, andre avgiftsgrupper, alternativ beregning (§ 3-4), vekt-beriking (ECON-007).
**Sluttstatus: REVIEW.** Ikke start ECON-003 før U-010/U-011 og godkjenningsspørsmålet er avklart.

## 13. Runde 3 — kilde- og valideringshull (18.10.2026)
**Utfall:** ingen nye kilder kunne leses; **ingen regel, sats, parameter, avrunding eller godkjenning er endret**. Eneste kodeendring er at implementasjonskonklusjoner nå er et eget, merket felt (§13.6). Kontrollert på nytt 2026-10-18: `lovdata.no`, `www.stortinget.no`, `www.regjeringen.no`, `www.skatteetaten.no` → CONNECT 403 (policy; ikke omgått). Ingen ny opplasting i økten.

### 13.1 Dokumentidentitet — endelig stortingsvedtak (ikke verifisert)
| Kandidat | Hva som er kjent | Kilde til identifikatoren | Status |
|---|---|---|---|
| «Stortingets vedtak om engangsavgift på motorvogner mv. for 2026», Lovdata **FOR-2025-12-18-2755** | tittel og ID | T04: E2 søkesammendrag (TAX-001A/C), ikke lest | **Ikke verifisert** |
| Stortinget **vedtak 220** («Engangsavgift på motorvogner mv. for 2026») | tittel og vedtaksnummer | T30: E1X (Christian/Codex), ikke lest | **Ikke verifisert** |
| Rundskrivet T03 | omtaler «stortingsvedtaket» bare som forkortelse (s. 7) og siterer paragrafer; oppgir **ingen** dato/ID | T03 (lest) | bekrefter *at* et vedtak finnes og paragrafhenvisninger, ikke identitet |
| Endringsvedtak 2026: «Revidert 2026, vedtak 1131/1132» | påstått endring av engangsavgiften (gruppe b fra 2026-09-01) | T31: E1X, ikke lest | **Ikke verifisert** |
| Forskriftsendringer FOR-2025-12-19-2787 og FOR-2026-01-13-29 | står i forskriftens endringsliste (T05, lest) | T05 | gjelder **forskriften**, ikke stortingsvedtaket |
Identiteten (dato, nummer, kunngjøring, «sist endret», endringshistorikk) kan bare fastslås fra dokumentets egen tittelside/metadata. T40 (Finansdepartementet, 2026-05-01) har en kolonne «Fra 1. september» med endring for gruppe b, som viser at minst ett endringsvedtak med virkning før beregningsdatoen finnes; teksten er ikke lest, og det er derfor ikke avgjort om det rører gruppe a. **Registrering som E1 er ikke gjort.**

### 13.2 Presis dokumentliste (levér som filer i `docs/tax/primarkilder/`, eller åpne tilgang til vertene)
| # | Dokumenttittel | Offisiell URL (fra registeret; ikke verifisert) | Nødvendige bestemmelser / hva som må leses |
|---|---|---|---|
| 1 | Stortingets vedtak om engangsavgift på motorvogner mv. for 2026 (endelig, konsolidert) | Lovdata: `https://lovdata.no/dokument/STV/forskrift/2025-12-18-2755` (T04) · Stortinget: `https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Vedtak/Sak/?did=40035798&p=104911` (T30) | Tittelside/metadata (dato, nr., kunngjort, sist endret, endringsliste); **§ 1** (ikrafttredelse og avgiftsplikt), **§ 2** (generell vekt), **§ 3 første ledd a, b og j** (tilleggsvekt, CO₂-tabell, «stempeldrevet forbrenningsmotor»), **§ 4** (bruksfradrag), **§ 5** (vrakpant), **§ 7** (tekniske data/forskriftshjemmel), **§ 8** (fritak, vrakpant for a–c), **§§ 9–12**, overgangs-/ikrafttredelsesbestemmelser |
| 2 | Endringsvedtak til engangsavgiften i 2026: Revidert nasjonalbudsjett 2026, vedtak 1131 og 1132 (full tekst) + Lovdatas endringshistorikk for vedtaket | `https://www.stortinget.no/no/Saker-og-publikasjoner/Vedtak/Vedtak/Sak/?p=200313` (T31) | Hvilke paragrafer som endres; **om gruppe a (§ 2, § 3 a) endres**; ikrafttredelse og overgang; alt med virkning ≤ beregningsdato (testdato 2026-10-18) |
| 3 | Innst. 3 S (2025–2026) Skatter og avgifter 2026 (valgfritt, forklarende) | `https://www.stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Innstillinger/Stortinget/2025-2026/inns-202526-003s/?all=true` (T27) | Ikke rettskilde; kan forklare satsstruktur og eventuell avrundingspraksis |
| 4 | Avrunding — kandidater å lese (ikke påvist å inneholde regelen): (a) lov 19. juni 1959 nr. 2 om avgifter vedrørende motorkjøretøyer og båter (hjemmelslov) · (b) Skatteetatens beskrivelse av engangsavgiftskalkulatoren («regn ut») | (a) Lovdata LOV-1959-06-19-2 · (b) `https://www.skatteetaten.no/person/avgifter/bil/importere/regn-ut/` (S07) | Enhver bestemmelse om avrunding av avgiftsbeløp, mellomregning eller prosentfradrag; skal ikke leses som regel hvis den bare er kalkulatorens oppførsel uten kildetekst |
Hvis én av filene 1–2 leveres, kan alle punktene i §13.3 gjøres uten antakelser.

### 13.3 Hva vedtaket skal brukes til (revurdering, ikke utført)
| Tema | Sjekk mot vedtaket | Nåværende status |
|---|---|---|
| Satsstruktur | § 2 og § 3 første ledd a: 12,71 / 500 kg, 260 / 1 200 kg, CO₂-tabell; er bånd marginale (T40 sier ja; tabellen i T41 er tvetydig)? | E1P (T40 + forslag) |
| PHEV | om ordlyden i § 3 («stempeldrevet forbrenningsmotor») eksplisitt dekker ladbar hybrid; enhver definisjon eller særregel | tolkning (§7) |
| Bruksfradrag | § 4 og forskriftshjemmel; at fradraget gjelder «avgift etter §§ 2 og 3» | forslag (T41 § 4) |
| Beregningsrekkefølge | § 4/§ 5: fradrag før vrakpant | E1P |
| Vrakpant utenfor prosentfradraget | § 4 sier hva fradraget gjelder; § 5 sier om vrakpant er en separat, fast avgift | ikke klar |
| Gyldighet og endringer | § 1 + endringsvedtak ≤ beregningsdato | ukjent slutt; intern sperre |

### 13.4 Avrunding: satser, mellomregninger og sluttbeløp (U-010)
| Nivå | Dokumentert grunnlag funnet | Status |
|---|---|---|
| **Satser** | T40 s. 1: «Alle særavgiftene er i utgangspunktet oppjustert med 2,2 prosent … Små avvik kan skyldes avrundinger av satsene.» De oppgitte satsene (12,71 osv.) er sluttverdier og brukes som de står. Aritmetikk (12,44 × 1,022 = 12,7137 → 12,71) er konsistent, men er ikke kilde for noen metode. | **Dokumentert at satser er avrundet; ingen videre handling** |
| **Mellomregninger** (kg × sats; CO₂-bånd; sum før fradrag; prosentfradrag; CO₂-grunnlag) | ingen i T03, T05 (alle sider), T40, T41, T42 | **Uavklart** |
| **Sluttbeløp** (engangsavgift; sum med vrakpant) | ingen | **Uavklart** |
Gyldne cases er ikke brukt til å utlede noen regel. (Runde 3, historisk: `rounded`/heltallsgrenser er erstattet av `finalClaim` i runde 4 — se §14.4/§15.)

### 13.5 Månedsoverflyt (U-009): blokkering beholdt
Uendret blokkering når norsk registreringsdato ligger i vinduet [siste dag i målmåneden, første dag i neste måned) (§5). Utenfor vinduet er oppførselen en **implementasjonskonklusjon** (kilden beskriver ikke dag 29–31), og er nå merket i resultatet.

### 13.6 Implementasjonskonklusjoner (nytt felt `implementationConclusions`, `sourceStatus: "not_expressly_described"`)
| Kode | Hva motoren gjør | Kilde sier |
|---|---|---|
| `month_steps_same_anniversary_rule` | månedstrinn nås på dagen i måneden (inklusivt) | T42: «fyller år» for hele år; T03 4.2: eksempel med år; månedstrinn ikke beskrevet |
| `overflow_dates_outside_window_monotonic` | ved dag 29–31 brukes trinnet når begge kandidatdatoer gir samme trinn; blokkert i vinduet | dag 29–31 ikke beskrevet |
Disse listes aldri som kildebelagte regler. Feltet `assumptions` er fjernet (runde 5); vrakpant utenfor fradraget er kildebelagt (§14.3).

### 13.7 Golden cases: samlet eksisterende dokumentasjon (ordrett fra ECON-001-oppdraget, Christian, 2026-10-18 15:25 UTC)
| | CASE-001 Lamborghini Urus PHEV | CASE-002 BMW iX3 EV | CASE-003 Mercedes E 400 d |
|---|---|---|---|
| Annonse netto (EUR) | 252 017 | 34 361 | 38 562 |
| «first registration working date» | 01.09.2026 | 01.08.2023 | 01.11.2023 |
| Kilometer | 2 978 | 43 300 | 34 353 |
| Motor / effekt | 3 996 cc / 588 kW | — / 210 kW (rekkevidde 458 km) | 2 925 cc / 243 kW |
| CO₂ (oppgitt) | WLTP 140 g/km | 0 | WLTP 179 g/km |
| «reference Norwegian tax weight» | 2 610 kg | 2 185 kg | 1 976 kg |
| Kalkulatorresultat | Avgift 529 069; kjøpesum 2 689 248; mva. 672 312; total 3 890 629 | Avgift 16 748; 366 663; 16 666; 400 077 | Avgift 333 723; 411 491; 102 873; 848 087 |
| Øvrig notat | kjøpesummen brukte en kurs «entered manually in that validation session» (verdi ikke oppgitt i case-teksten) | kjøring uten transport 8 000 | – |
**Manglende felt (kun det som ikke er oppgitt; ingenting er rekonstruert):** for alle tre: faktisk første registreringsdag (bare «working date»), **norsk registreringsdato brukt i kalkulatoren**, **kalkulatorens kjøredato**, kalkulatorside/versjon/tidspunkt, **definisjonen av «reference tax weight»** (kg er oppgitt, hva slags vekt og kilde er ikke), **CO₂-felt** («kombinert»/«vektet kombinert»; for PHEV avgjørende), **drivlinjebevis** (stempeldrevet motor? ladbar? – case-teksten har bare «PHEV»/«EV»/«diesel»), **skjermbilde av input**, **skjermbilde av resultat** og **nedbrytning** (avgift/vrakpant/fradrag-prosent slik kalkulatoren viste dem). 18.10.2026 er fastsatt testdato og står i fixturen som `TEST_DATE`; den er ikke registrert som kjøredato. Kursen 10,6709 (fra ECON-001-FIX) er fixture-input for kjøpesummer og påvirker ikke avgiften.

### 13.8 Godkjenningsmatrise etter kildekontroll (uendret; kravene er ikke svekket)
| Parameter | Etter runde 3 | Hva som må til |
|---|---|---|
| Generell vekt, ICE-tillegg, CO₂-bånd | Klar med forbehold (uendret) | vedtaket (§13.2 nr. 1–2) leses og stemmer; regelen løftes E1P → E1 |
| CO₂-felt/metode (§ 3-1) | Klar (WLTP) | – |
| EV-behandling, NOx | Klar med forbehold / Klar | vedtaket for EV |
| Bruksfradragstabell og aldersdefinisjon | Klar med forbehold | vedtakets § 4; U-009 (månedstrinn/dag 29–31) |
| Beregningsrekkefølge | Klar med forbehold | vedtakets § 4/§ 5 |
| Vrakpant 2 400 / «ikke redusert» | beløp klar; «ikke redusert» **ikke klar** | vedtakets § 4 + § 5 |
| Avrunding | **Ikke klar** | kilde (§13.4) |
| Gyldighet (slutt) | ikke tilgjengelig | vedtak/endringsvedtak |
| Dokumentidentitet, endelig vedtak | **Ikke verifisert** | fil eller tilgang (§13.2) |
**Formelle krav er uendret:** regelen må være E1 (R-OTA-001/002/005/007/010 er E1P), bare E1-kilder, `governingEvent`, `validity.from` og en **klasse 1-referanse** (0 finnes; casene mangler dokumentasjon, §13.7). Ingenting er godkjent, og kravene er ikke svekket for å få noe til å passere.

### 13.9 Kontroller kjørt i runde 3
`npx tsc --noEmit` OK; `npx eslint .` OK; `npx vitest run` — **30 filer, 701 tester bestått** (`tests/tax-engine.test.ts`: 66); `node docs/tax/check-docs.mjs` OK. Ikke kjørt: `npm run build`, e2e, DB-suiter. **Sluttstatus: REVIEW (blokkert av kildetilgang for U-010/U-011).**

## 14. Runde 4 — tilleggskilder: endelig stortingsvedtak og avrunding (18.10.2026)
Skillet mellom nivåene gjelder fortsatt: **kildebelagt** (lest, E1/E1P), **implementert** (i `src/domain/tax`), **testet** (kjørt) og **godkjent** (ingen). Golden cases er valideringsreferanser, ikke regelkilde; 18.10.2026 er fastsatt testdato.

### 14.1 Pakke og hash
Syv HTML-originaler (T43–T49) + manifest (`docs/tax/primarkilder/MANIFEST-tilleggspakke.md`); SHA-256 avstemt mot manifestet (alle OK) og registrert i `sources.json` med `repoFile` (verifiseres av `check-docs.mjs` og av `tests/tax-engine.test.ts`). Den avledede TXT-kopien (lesestøtte) er ikke lagt i repoet; alle sitater er i tillegg kontrollert i HTML-originalene (testet). T04, T30 og T31 (E2/E1X) er merket `supersededBy` T47, T43, T44; nivåene deres er ikke endret.
| ID | Fil | Dokument | Nivå |
|---|---|---|---|
| T43 | `06_Stortinget_Vedtak_220_2026.html` | Stortinget, Vedtak 220 (opprinnelig, 18.12.2025) | E1 |
| T44 | `07_Stortinget_RNB_2026_vedtak.html` | Stortinget, S-delen (Prop. 95 LS / Innst. 450 S): vedtak 1131–1132 (bare disse lest) | E1 |
| T45 | `08_Skattebetalingshandboken_10-4.html` | Skattedirektoratet, håndbok kap. 10 § 10-4 / «Avrunding» (publisert 24.06.2026) | E1 (veiledning) |
| T46 | `09_Skattebetalingsforskriften.html` | Skattebetalingsforskriften FOR-2007-12-21-1766 (sist endret FOR-2026-06-26-1385); bare § 10-4-1…10-4-4 og § 1-1 lest | E1 |
| T47 | `10_Lovdata_Engangsavgift_2026.html` | **Stortingsvedtak FOR-2025-12-18-2755, konsolidert** | E1 |
| T48 | `11_Endringsvedtak_2026-06-19-1246.html` | Endringsvedtak FOR-2026-06-19-1246 | E1 |
| T49 | `12_Skattebetalingsloven.html` | Skattebetalingsloven LOV-2005-06-17-67; bare §§ 1-1, 10-4, 10-40 lest | E1 |

### 14.2 U-011 — endelig stortingsvedtak: **lukket (E1)**, med forbehold
**Identitet verifisert.** Lovdata FOR-2025-12-18-2755 (Stortinget; «Budsjettåret 2026»; kunngjort 22.12.2025 kl. 11.30; sist endret FOR-2026-06-19-1246 fra 01.09.2026; hjemmel Grl. § 75 a og LOV-1959-06-19-2) har §§ 1–11 ordrett lik Stortingets «Vedtak 220» (T43) bortsett fra § 3 første ledd b nr 2. Vedtak 1131–1132 (T44) kaller det «stortingsvedtak 18. desember 2025 nr. 220», og endringsvedtaket (T48) kaller det «nr. 2755». Samme dokument, to nummersystemer.
**Endringer som dekker beregningsdato 2026-10-18:** bare FOR-2026-06-19-1246 (vedtatt 19.06.2026, ikrafttredelse 01.09.2026). **Det endrer uttrykkelig bare «§ 3 første ledd bokstav b nr 2»** (CO₂-tabellen for avgiftsgruppe b: 300 → 450 i første bånd). Jeg har ikke antatt at endringen rører bokstav a: endringsvedtakets tekst gjør det ikke, og konsolidert tekst viser uendret bokstav a. Vedtak 1131/1132 (T44) og T48 er avstemt: samme tabell, «tek til å gjelde 1. september 2026». Merknaden «Endret ved vedtak 19 juni 2026 nr. 1246» henger på § 3 som helhet i konsolidert tekst; innholdet er likevel avgrenset av endringsvedtaket.
**Paragrafer og anvendelse på gruppe a (personbil):**
| § | Innhold (konsolidert, T47) | Anvendelse |
|---|---|---|
| 1 | «Fra 1. januar 2026 …» avgift ved første gangs registrering | styrende hendelse og startdato 2026-01-01 |
| 2 | 12,71 kr per kg av egenvekt over 500 kg, «i tillegg til … § 3» | generell vektkomponent, alle personbiler (også elbil) |
| 3 innl. | «For motorvogner med stempeldrevet forbrenningsmotor» | vilkår for 3 a (ICE, HEV, PHEV) |
| 3 a nr 1 | 260 kr per kg over 1 200 kg | tillegg for forbrenningsmotor |
| 3 a nr 2 | CO₂ per g/km: 0–100: 800; 101–150: 1 600; 151–225: 3 200; over 225: 5 000 | CO₂-komponent (marginal lesning: T40) |
| 4 | «fradrag i den avgift som beregnes etter §§ 2 og 3 basert på motorvognens alder (bruksfradrag)» | prosentfradrag på §§ 2+3-avgiften; tabell i forskrift § 3-3 |
| 5 | vrakpant gruppe a, b, c, g, j: 2 400 | eget, fast beløp |
| 7 | tekniske data fra godkjenningen | vekt/CO₂-grunnlag |
| 8 andre ledd | fritak a–c også for vrakpant | ikke relevant for støttet profil |
**Rundskrivets paragrafhenvisninger:** henvisningene § 1, 2, 3, 5, 6, 8 første ledd a–p, 8 andre ledd og 11 stemmer med vedtaket. «§ 9 første ledd bokstav d til p» (3.4) og «§ 12» (3.3.3.5) finnes ikke i vedtaket (11 paragrafer; fritak = § 8, dispensasjon = § 11) og behandles som rundskrivfeil. Rundskrivet siterer aldri § 4, men vedtaket har § 4.
**Forbehold:** endringer vedtatt etter hentedato 2026-10-18 er ikke kontrollert (`ratesVerifiedAsOf = 2026-10-18`; senere norsk registreringsdato gir advarsel); lov 19. juni 2026 nr. 41 (endrer bl.a. skattebetalingsloven § 1-1 og §§ 10-30/10-40/10-41; «i kraft fra den tid Kongen bestemmer») er ikke lest.

### 14.3 Revurdering av tidligere E1P-konklusjoner
| Tema | Før (bare forslag + T40) | Nå (endelig vedtak lest) | Regelnivå |
|---|---|---|---|
| Satsstruktur gruppe a | E1P | **bekreftet i vedtaket** (§ 2, § 3 a). CO₂ «marginalt» står fortsatt bare i T40 («første/neste/resten»); vedtaksteksten har kun intervallene | R-OTA-001 **E1P → E1**; R-OTA-002 forblir E1P (NEDC/fallback-mellomledd, marginal via T40) |
| EV | E1P | § 2 uten § 3-vilkår (ingen stempeldrevet motor) | R-OTA-007 **E1P → E1** |
| PHEV | E1P, utledet | uendret karakter: vedtaket har det tekniske vilkåret «stempeldrevet forbrenningsmotor» (E1); ladbar hybrid er ikke nevnt eller definert i vedtak, forskrift eller rundskriv | R-OTA-005 forblir **E1P** (§14.6) |
| Bruksfradrag | forslag § 4 | **vedtak § 4** bekrefter ordlyden; tabell og aldersregler i forskrift § 3-3 (T05) | R-OTA-010 forblir E1P (U-009 månedstrinn/dag 29–31) |
| Rekkefølge | E1P | § 4 og § 5 i vedtaket: fradrag i avgift etter §§ 2+3; vrakpant egen post | belagt (E1) |
| **Vrakpant utenfor prosentfradraget** | ikke klar (bare forslag) | **belagt (E1):** vedtak § 4 avgrenser fradraget til avgiften etter §§ 2 og 3; § 5 er egen, fast avgift | R-IMP-OTH-001 (E1) oppdatert |
| Gyldighet | start belagt, slutt ikke | Lovdata: «Budsjettåret 2026»; ingen eksplisitt sluttdato i teksten | uendret: `documentedValidTo = null`; intern sperre 2026-12-31 (nå med bedre begrunnelse) |
| Gruppe b (utenfor motoren) | vekt fra 2026-09-01 ukjent | vekt 30 kr/kg uendret (§ 3 b nr 1; kun nr 2 endret); CO₂ 450/600/1 200 fra 2026-09-01 | R-OTA-008 e1Findings og DP-WEIGHT-B-2026-09-01 lagt til |

### 14.4 U-010 — avrunding: **lukket for sluttkravet (E1P)**; mellomledd åpent (U-012)
**Hjemmelskjede (alt lest):** vedtaket gjelder avgift «i henhold til lov 19. juni 1959 nr. 2» (T47 § 1) → skattebetalingsloven § 1-1 (2) bokstav i: «særavgifter omfattet av lov 19. juni 1959 nr. 2 …» er «skatte- og avgiftskrav» (T49) → § 10-40 (1) c regulerer forfall for «engangsavgiften for registrerte virksomheter» (T49) → § 10-4: departementet kan gi forskrift «til utfylling og gjennomføring av bestemmelsene i dette kapitlet» (kapittel 10 Forfall) → **skattebetalingsforskriften § 10-4-4: «Ved beregning av skatte- og avgiftskrav avrundes beløpet ned til nærmeste hele krone.»** (T46) og § 10-4-1 d nevner «engangsavgift på motorvogner» (200 kr) i samme regelfamilie. Håndboken (T45): «… skatte- og avgiftsregnskapene ikke vil inneholde ørebeløp.»
**Vurdering:**
| Spørsmål | Funn | Nivå |
|---|---|---|
| Virkeområde: gjelder regelen engangsavgift? | engangsavgift er et avgiftskrav (§ 1-1 (2) i) og nevnes i § 10-4-1 d og § 10-40; § 10-4-4 nevner den ikke selv. Kapittel 10-hjemmelen gjelder «dette kapitlet» (forfall) — om «ved beregning» er uttrykkelig omfattet er ikke avklart | **E1P** |
| Retning og enhet | ned til nærmeste hele krone | E1 (regeltekst) |
| Nivå: sluttkrav eller mellomledd? | regelen gjelder «beløpet» av «skatte- og avgiftskrav» (det samlede kravet). Ingen kilde avrunder kg × sats, CO₂-bånd, sum før fradrag eller prosentfradrag | sluttkrav: E1P; **mellomledd: ingen belegg (U-012)** |
| Vrakpant | del av engangsavgiften (rundskriv 3.4; T20); heltall ⇒ floor(avgift + 2 400) = floor(avgift) + 2 400 | ingen effekt på avrundingen |
**Valgt rekkefølge (implementasjon):** komponenter eksakte → sum eksakt → × (100 − prosent)/100 eksakt → + vrakpant → **ned til hele kroner (én gang)**. Mellomledd avrundes ikke; det er en merket implementasjonskonklusjon (`no_intermediate_rounding`).
**Gjenværende usikkerhet:** (a) § 10-4-4 anvendes på beregningen av engangsavgift via virkeområdet (E1P); (b) om Skatteetatens egen beregning avrunder komponenter eller prosentfradrag (kan gi noen kroner avvik) kan ikke avgjøres fra kildene; (c) lov 19. juni 2026 nr. 41 (ikke i kraft, innhold ikke lest). Avrunding til nærmeste krone og andre policyer er fjernet fra motoren. *[VALIDERING]* Sluttkravet gir de offisielle beløpene i alle tre casene (§14.7); regelen er hentet fra kildene, ikke fra casene (testet).

### 14.5 Gyldighet (uendret prinsipp, nye fakta)
`validFrom` 2026-01-01 (kildedokumentert, § 1). `documentedValidTo = null` (ingen sluttdato i vedtaksteksten); `documentedPeriodLabel = «Budsjettåret 2026»` (Lovdata-metadata, **ikke** en datert opphørsdato). `internalSafetyLimit` 2026-12-31 (`internal_guard`; eget feilkodenavn). `ratesVerifiedAsOf` = 2026-10-18 (hentedato for konsolidert tekst; gammel verdi 2026-05-01 gjaldt T40).

### 14.6 PHEV (kjede, ajourført)
Definisjon: «ladbar hybridbil» finnes ikke i vedtaket, forskriften eller rundskrivet; vilkåret i vedtaket § 3 er teknisk («stempeldrevet forbrenningsmotor»). Bestemmelse: § 3 a nr 1–2 (260 kr/kg og CO₂-bånd); forskrift § 3-1 gir CO₂-feltet «vektet kombinert». Rundskriv: 3.3.11 (vektfradrag opphevet) og 6.12. **Gap:** ingen tekst sier uttrykkelig at ladbar hybrid svarer § 3; det følger av at vilkåret er oppfylt (teknisk egenskap, må dokumenteres) og av behandlingen i § 3-1/rundskriv. Konklusjonen er nå bedre forankret (vedtaksteksten selv er lest) men forblir juridisk slutning (E1P).

### 14.7 Golden cases (validering; ikke regelkilde)
| | CASE-001 | CASE-002 | CASE-003 |
|---|---|---|---|
| Eksakt total (testdato 2026-10-18) | 529 069,738 | 16 748,9545 | 333 723,972 |
| `finalClaim` (nedrundet sluttkrav, R-OTA-014) | **529 069** | **16 748** | **333 723** |
| Offisielt validert | 529 069 | 16 748 | 333 723 |
| `one_off_tax` + `scrappage_deposit` | 526 669 + 2 400 | 14 348 + 2 400 | 331 323 + 2 400 |
Alle tre samsvarer med de validerte verdiene med regler fra kildene (vedtak, forskrift, rundskriv, avrundingskjeden). Dette er validering, **ikke klasse 1**: kjøredato, norsk registreringsdato brukt, input-definisjoner og skjermbilder mangler fortsatt (se §13.7; pakken har ikke supplert dem og ingenting er rekonstruert). Status er fortsatt `calculated_unverified`.

### 14.8 Implementert (kun avgiftsmotoren)
`src/domain/tax`: `finalClaim` (nedrunding av sluttkrav; `totalIntegerBounds`, `rounded`, `RoundingPolicy` og `options.rounding` fjernet); profilen har `rounding` (R-OTA-014), `documentedPeriodLabel`, `ratesVerifiedAsOf = 2026-10-18`, oppdaterte kilder og åpne punkter; `implementationConclusions` har ny kode `no_intermediate_rounding`; `alternativeTotalRegistrationTaxesNok`. Docs: `rules.json` (ny R-OTA-014; R-OTA-001/007 → E1; e1Findings for 001/002/005/007/008/010/IMP-OTH-001; U-010 og U-011 lukket, U-012 ny; U-009 notat), `sources.json` (T43–T49; supersededBy), `profiles.json` (R-OTA-014 på profilene), `TAX-001A-rules.md`. Ingen UI-, DB-, auth- eller provider-endring; ingen landed-cost-logikk.

### 14.9 Statusmatrise (erstatter §1)
| Område | Kildebelagt | Implementert | Testet | Godkjent |
|---|---|---|---|---|
| Satser gruppe a (§ 2, § 3 a nr 1) | ja, E1 (vedtak + T40) | ja | ja (tall = vedtakstekst) | nei |
| CO₂-bånd marginalt | vedtak (intervaller) + T40 (marginal) — E1P | ja | ja (grenser) | nei |
| EV: bare § 2 | ja, E1 | ja | ja | nei |
| PHEV: § 3 + «vektet kombinert» | E1P (tolkning av teknisk vilkår) | ja | ja | nei |
| NOx fjernet | ja, E1 | ja | ja | nei |
| Bruksfradrag: tabell, alder, rekkefølge, vrakpant utenfor | ja (vedtak § 4, forskrift § 3-3, T42) — E1 | ja | ja | nei |
| Månedstrinn / dag 29–31 | **nei** (U-009) | blokkerer i vinduet; konklusjon merket | ja | nei |
| Avrunding: sluttkrav ned til hele kroner | ja, **E1P** (T46/T45/T49) | ja (`finalClaim`) | ja | nei |
| Avrunding: mellomledd | **nei** (U-012) | ikke avrundet (konklusjon) | ja | nei |
| Gyldighet start / slutt | start E1; slutt ikke oppgitt | `documentedValidTo = null` | ja | — |
| Intern sperre 2026-12-31 | — (intern) | ja | ja | — |
| Identitet/endringer vedtak | ja, E1 (U-011 lukket) | `ratesVerifiedAsOf` | ja (hash + tekst) | — |

### 14.10 Godkjenningsmatrise (oppdatert; ingen parameter er godkjent)
Formelt krav (`check-docs.mjs`, uendret): regelen må være **E1**, bare E1-kilder, `governingEvent`, `validity.from` og en **klasse 1-referanse** (eller godkjent klasse 2). Ingen klasse 1 finnes (casene mangler dokumentasjon). Kravene er ikke svekket.
| Parameter / regel | Kildebelegg | Regelnivå nå | Klar for godkjenning? | Hva gjenstår |
|---|---|---|---|---|
| Generell vekt 12,71 kr/kg > 500 kg (R-OTA-001) | T47 § 2; T43; T40 | **E1** | **ja (kildesiden)** | klasse 1; din godkjenning |
| ICE-tillegg 260 kr/kg > 1 200 kg (R-OTA-001) | T47 § 3 a nr 1; T43; T40 | **E1** | **ja (kildesiden)** | klasse 1; din godkjenning |
| EV: bare § 2 (R-OTA-007) | T47 § 2/§ 3; T03 6.12 | **E1** | **ja (kildesiden)** | klasse 1; godkjenning |
| CO₂-bånd (R-OTA-002) | T47 § 3 a nr 2 (intervaller); T40 (marginal) | E1P | **med forbehold** | marginal lesning kun via T40; NEDC/fallback utenfor (U-012) → løft til E1 krever din vurdering |
| CO₂-felt/metode (§ 3-1) | T05 | (i R-OTA-002) | ja for WLTP | – |
| PHEV (R-OTA-005) | vilkår i T47 § 3; T05 § 3-1; T03 3.3.11/6.12 | E1P | **med forbehold** | ingen uttrykkelig tekst; juridisk vurdering |
| NOx fjernet (R-OTA-003) | T03 3.2.4 | E1 | ja | klasse 1 |
| Bruksfradrag-tabell (R-OTA-010) | T05 § 3-3; T42; vedtak § 4 | E1P | **med forbehold** | U-009 (månedstrinn/dag 29–31) |
| Beregningsrekkefølge | T47 § 4–5; T05 § 3-3; T03 4.3 | (i R-OTA-010) | ja | – |
| Vrakpant 2 400 og utenfor prosentfradraget (R-IMP-OTH-001) | T47 § 4, § 5; T03 3.4 | **E1** | **ja (kildesiden)** | klasse 1; godkjenning |
| Avrunding sluttkrav (R-OTA-014) | T46 § 10-4-4; T45; T49 § 1-1, § 10-40; T46 § 10-4-1 d | E1P | **med forbehold** | anvendelse via virkeområde (kapittel 10-hjemmel); løft til E1 krever din vurdering |
| Avrunding mellomledd | ingen | – | **nei** | U-012 |
| Gyldighet (slutt) | ingen eksplisitt | – | **ikke tilgjengelig** | vedtak/intern sperre |
«Ja (kildesiden)» betyr bare at kildebeleggene er komplette for regelen; ingen parameter blir godkjent før du eksplisitt gjør det og klasse 1-referanse finnes.

### 14.11 Kontroller kjørt (runde 4)
`npx tsc --noEmit` OK; `npx eslint .` OK; `npx vitest run` — **30 filer, 711 tester bestått** (`tests/tax-engine.test.ts`: 76, bl.a. hash av alle 11 kildefiler, sitater i HTML-originalene, endringsvedtak avgrenset til § 3 b nr 2, avrundingskjeden, finalClaim); `node docs/tax/check-docs.mjs` OK (32 regler, 52 kilder). Ikke kjørt: `npm run build`, e2e, DB-suiter.

### 14.12 Gjenstående
1. **Dokumentasjon per golden case / klasse 1** (§13.7) — uendret manglende felt.
2. **Parametergodkjenning** — din beslutning; krever E1-regel og klasse 1.
3. **U-009** (månedstrinn og dag 29–31) — motoren blokkerer i vinduet.
4. **U-012** (mellomledd) og anvendelsesforbehold for R-OTA-014; lov 19. juni 2026 nr. 41 og endringer etter 2026-10-18.
5. **PHEV** uttrykkelig tekst; **CO₂ marginalt** kun via T40.
6. Sluttdato for 2026-satsene (kun «Budsjettåret 2026»; intern sperre).
7. Utenfor: NEDC/egenvekt/10-CO₂, andre avgiftsgrupper, alternativ beregning, vektberikelse.
**Sluttstatus: REVIEW.** ECON-003 er ikke startet.

## 15. Runde 5 — kontroll av leveransen i commit `3db380d` (18.10.2026)
Skillet gjelder fortsatt: **kildebelagt** (lest, E1/E1P), **implementert** (`src/domain/tax`), **testet** (kjørt), **godkjent** (ingen). Ingen parameter er godkjent; kravene til E1 og klasse 1 er ikke svekket; ingen UI-, DB-, auth- eller provider-endring; ECON-004 er ikke startet.

### 15.1 Funn og rettinger
| # | Funn i `3db380d` | Alvorlighet | Retting |
|---|---|---|---|
| F1 | `finalClaim` hadde bare `evidence: "E1P"`; valideringsstatus lå ikke på selve beløpet. En konsument som leser bare `finalClaim.totalRegistrationTaxesNok` fikk ingen markering om at beløpet er et ikke-godkjent estimat | høy | `finalClaim.validation` (og identisk `validation` på toppnivå): `status`, `profileApproved`, `class1References`, `weakestRuleEvidence`, `appliedRules`. `status` er `estimate_not_approved` med mindre profil godkjent **og** klasse 1 > 0 **og** alle anvendte regler E1; først da blir resultatstatus `calculated` (ikke mulig i registeret i dag) |
| F2 | `evidence.parameterEvidenceLevel` var hardkodet «E1», selv om R-OTA-002, R-OTA-010 og R-OTA-014 er E1P — overstated | middels | svakeste nivå blant **anvendte** regler (BEV: R-OTA-007 i stedet for 002/005; ny motorvogn uten R-OTA-010); blokkerte resultater bruker profilens svakeste nivå. Profilen har `ruleEvidence`; en test holder den lik `rules.json` |
| F3 | Advarselen `rates_verified_as_of` omtalte fortsatt «Finansdepartementets oversikt» etter at grunnlaget er konsolidert vedtakstekst | lav | tekst rettet |
| F4 | `assumptions` var et dødt felt (alltid tomt etter runde 4) som antydet kildebelagte antakelser | lav | felt fjernet; implementasjonskonklusjoner står i `implementationConclusions` |
| F5 | Utdaterte referanser i `reviews/ECON-002.md` (`totalIntegerBounds`, `rounded`, `assumptions`, «ikke bruk `rounded`») | lav | markert historiske/rettet (§3, §7); ingen kode, test eller annen dokumentasjon utenfor modulen refererer til de fjernede feltene (grep) |
| F6 | Ingen eksterne konsumenter av `calculateNorwegianVehicleTax` (bare `tests/`) — API-endringen til `finalClaim` har ingen skadevirkning utenfor ECON-002 | info | – |
**Kontrollert uten funn (kode lest og testet):** eksakt BigInt-desimal uten float (arkitekturtest forbyr Math.round/toFixed/parseFloat i `calculate`/`decimal`); prosentfaktor `(100 − p)/100` eksakt (scale 2); komponentrekkefølge generell vekt → ICE-tillegg → CO₂ (marginale bånd 0/100/101/150/151/225/226 testet) → sum → prosentfradrag → + vrakpant (ikke redusert) → **én** nedrunding av sluttkravet; `floor(avgift + 2 400) = floor(avgift) + 2 400` (testet); komponenter og `oneOffTaxExact` forblir uavrundet; alderstrinn dato-til-dato inklusive (grenser 30/36 mnd, 1 mnd, 15. jan, 20-årsregelen, dag 29–31); blokkering ved manglende/ugyldig vekt, CO₂, drivlinje (annonsepåstand), registreringspresisjon (bare år), datoer, profil (før start, intern sperre, dokumentert slutt), NEDC/fallback; blokkerte resultater har `finalClaim = null` og `validation = null` (aldri 0).

### 15.2 U-012: hva kan konkret påvirke sluttbeløpet? (manglende bestemmelse ≠ regelkonflikt)
**Status:** *manglende uttrykkelig bestemmelse*, **ikke påvist regelkonflikt.** Ingen lest kilde (vedtak, forskrift, rundskriv, håndbok) avrunder komponenter, og ingen motsier at mellomledd holdes eksakte. Motoren beholder derfor eksakte mellomregninger og avrunder bare sluttkravet (R-OTA-014).
**Mellomregningspunkter som kan påvirke sluttbeløpet** (verifisert i test over vekt 400–3 500 kg og CO₂ 0–300 g/km):
| Ledd | Brøk? | Mulig mellomavrunding | Maks. utslag på sluttbeløpet |
|---|---|---|---|
| Generell vekt (kg × 12,71) | **ja, opptil to desimaler** | per komponent (ned/nærmeste/opp) | inntil 1 kr (før fradrag; dempet av fradragsfaktoren) |
| Tilleggsvekt (kg × 260) | nei (heltall) | – | 0 |
| CO₂-bånd (heltall g/km × heltallssatser) | nei | – | 0 |
| Sum før fradrag | bare via generell vekt | sum avrundes | (samme brøk som over) |
| Prosentfradrag (avgift × (100 − p)/100, inntil fire desimaler) | ja | nettobeløp eller fradragsbeløp (avgift × p/100) avrundes før subtraksjon | inntil 1 kr |
| Vrakpant | nei | – | 0 |
| NEDC × 1,24 / egenvekt ÷ 10 (CO₂) | ja (desimal-CO₂) | CO₂-grunnlaget | opptil flere hundre kr per g/km-brøk × sats ⇒ **støttes ikke** (blokkert) |
*(Rettet i runde 6, §16.3: «inntil 2 kr» er ikke en generell garanti — den gjelder bare det definerte variantsettet og inputområdet.)* Sensitivitetsanalysen gir for de tre valideringscasene høyst **+1 kr** avvik; det er informasjon om usikkerhetens størrelse, **ikke** et valg av regel, og motoren velger ingen variant.
**Separat observasjon (ikke kilde, ikke konflikt):** i kalkulatorresultatene for import-MVA er 16 665,75 og 102 872,75 vist som 16 666 og 102 873 (ikke nedrundet). Skattebetalingsforskriften § 10-4-4 gjelder i teksten alle «skatte- og avgiftskrav», også merverdiavgift (§ 1-1 (2) g). Det er et valideringssignal om at § 10-4-4 ikke uten videre kan generaliseres til MVA-linjen i landed cost (ECON-004: egen kilde kreves for MVA-avrunding). Det endrer ikke engangsavgiften.

### 15.3 PHEV revurdert: E1 på regelnivå
**Begrunnelse (uten krav om ordet «PHEV» i teksten):**
1. *Teknisk vilkår:* vedtaket § 3 innledning gjelder «motorvogner med stempeldrevet forbrenningsmotor» (E1). Vilkåret er en egenskap ved kjøretøyet, ikke et navn; en PHEV med dokumentert stempeldrevet motor oppfyller det.
2. *Samme vilkår for begge komponenter:* § 3 a nr 1 (260 kr/kg) og nr 2 (CO₂) står under samme innledning og er ikke delt etter drivlinje.
3. *Forskriften bekrefter:* § 3-1 (T05) angir CO₂-feltet «vektet kombinert» for ladbare hybridbiler — det forutsetter at CO₂-komponenten etter § 3 gjelder dem.
4. *Ingen unntak:* hele vedtaket (§§ 1–11) og forskriften §§ 3-1…3-4 er lest; ingen PHEV-særregel, vektfradrag eller fritak finnes; rundskriv 3.3.11 sier at vektfradraget er opphevet, 6.12 gjentar vilkåret.
**Vurdering:** tilstrekkelig belegg for **R-OTA-005 E1P → E1** (registrert i `rules.json`, `profile.ruleEvidence`, test). Det som gjenstår er et **faktisk inputkrav per kjøretøy** (dokumentert stempeldrevet motor, ekstern lading, «vektet kombinert»-verdi, minimumsvekt fra typegodkjenning/CoC) — ikke regelusikkerhet. NEDC-PHEV støttes ikke (U-012). Svakeste anvendte nivå er likevel **E1P** (R-OTA-002 marginal via T40 + R-OTA-010 U-009 + R-OTA-014 anvendelse), så ingen resultat er «E1».

### 15.4 Registreringsmal for nye golden-kjøringer
`docs/tax/golden-run-template.md`: én kort tabell med felt-ID-er som er identiske med `DOCUMENTATION_CHECKLIST` i fixturen (kjøredato, kalkulator-URL/versjon, alle input, datopresisjon, teknisk dokumentasjon, resultat/nedbrytning, skjermbilder med hash) pluss referanse-ID `GR-<dato>-<nn>`, erklæring om at kjøringen er **ny** (ikke rekonstruksjon av CASE-001/002/003) og krav om at kjøredato ≠ testdato med mindre det faktisk er samme dag. En test sjekker at malen dekker alle sjekklistepunktene.

### 15.5 Statusmatrise (oppdatering av §14.9)
| Område | Kildebelagt | Implementert | Testet | Godkjent |
|---|---|---|---|---|
| Valideringsstatus på beløpet (`validation`) | – (designkrav) | ja | ja (gating-tester) | – |
| PHEV | **E1** (teknisk vilkår + § 3-1 + fravær av unntak) | ja | ja | nei |
| Sluttkrav nedrundet (`finalClaim`) | E1P (R-OTA-014) | ja | ja | nei |
| Mellomledd eksakte | ingen bestemmelse (U-012; ikke konflikt) | ja | ja (sensitivitet avgrenset, se §16.3) | nei |
| Øvrige rader | uendret fra §14.9 | | | |

### 15.6 Godkjenningsmatrise — endring
R-OTA-005 (PHEV): «med forbehold» → **klar (kildesiden)**; inputkrav per kjøretøy gjelder. Alt annet uendret (§14.10). Formelt krav: regelen **E1**, bare E1-kilder, `governingEvent`, `validity.from` og klasse 1-referanse; ingen klasse 1 finnes. R-OTA-001/005/007, R-IMP-OTH-001 og R-OTA-003 er E1; R-OTA-002, R-OTA-010 og R-OTA-014 er E1P.

### 15.7 Kontroller kjørt (runde 5)
`npx tsc --noEmit` OK; `npx eslint .` OK; `npx vitest run` — **30 filer, 721 tester bestått** (`tests/tax-engine.test.ts`: 86); `node docs/tax/check-docs.mjs` OK (32 regler, 52 kilder). Ikke kjørt: `npm run build`, e2e, DB-suiter.

### 15.8 Gjenstående blokkeringer
1. Nye golden-kjøringer (mal §15.4) og klasse 1-referanser — **ingen finnes**.
2. Din godkjenning av parametere (krever E1-regel + klasse 1).
3. U-009 (månedstrinn/dag 29–31; motoren blokkerer i vinduet); R-OTA-010 forblir E1P.
4. R-OTA-014 anvendelse via kapittel 10-hjemmel (E1P); U-012 (mellomledd) uten bestemmelse; MVA-avrunding trenger egen kilde i ECON-004.
5. R-OTA-002 marginal lesning kun via T40; NEDC/fallback-CO₂ støttes ikke.
6. Endringer etter 2026-10-18 og lov 19. juni 2026 nr. 41 er ikke kontrollert; ingen eksplisitt sluttdato (intern sperre).
**Sluttstatus: REVIEW.**

## 16. Runde 6 — valideringsgrunnlag: nye golden-kjøringer, R-OTA-014, sensitivitetens grenser (18.10.2026)
Ingen parameter er godkjent; ECON-003 og ECON-004 er ikke startet; eksakte mellomregninger og blokkeringen for U-009 er uendret. Skillet kildebelagt / implementert / testet / godkjent gjelder fortsatt.

### 16.1 Nye golden-kjøringer (PHEV, EV, diesel): forberedt, **ikke kjørt**
**Kalkulatoren er ikke tilgjengelig for meg** (`skatteetaten.no` → CONNECT 403, kontrollert igjen i dag), og nødvendig input finnes ikke. Ingen kjøring er utført; derfor finnes ingen kjøredato, URL, skjermbilder, hash, resultat eller nedbrytning. Levert: `docs/tax/golden-runs/GR-PENDING-PHEV.md`, `GR-PENDING-EV.md`, `GR-PENDING-DIESEL.md` (utfylt etter malen med bare det som er dokumentert, resten merket **MANGLER**) og `docs/tax/golden-runs/README.md` med tabellen under. Det forventede resultatet fra tidligere validering er bevisst ikke forhåndsutfylt. 18.10.2026 forblir historisk testdato for CASE-001/002/003 og er ikke brukt som kjøredato. Ny referanse-ID settes til `GR-<åååååmmdd>-<nn>` ved kjøring. En test (`tests/tax-golden-runs.test.ts`) sikrer at filene ikke inneholder gjettet kjøredato, URL, hash eller resultat, at dokumenterte verdier er ordrett de eksisterende, og at statusene stemmer med fixturens sjekkliste.
| Kjøretøy | Dokumentert fra før | Christian må fremskaffe |
|---|---|---|
| **PHEV** (Urus) | arbeidsdato 01.09.2026 (måned); 2 610 kg (ref.); WLTP 140 g/km | faktisk 1. reg.dag; variant; vektdefinisjon + dokument; CO₂-felt «vektet kombinert»; drivlinjebevis (stempeldrevet motor + ladbar); norsk reg.dato tastet; kjøredato/-tid; URL/versjon; alle input; skjermbilder (SHA-256); nedbrytning |
| **EV** (iX3) | arbeidsdato 01.08.2023; 2 185 kg (ref.); CO₂ 0 | faktisk 1. reg.dag; variant; vektdefinisjon + dokument; drivlinjebevis (ingen stempeldrevet motor); norsk reg.dato; kjøredato/-tid; URL/versjon; alle input; skjermbilder; nedbrytning |
| **Diesel** (E 400 d) | arbeidsdato 01.11.2023; 1 976 kg (ref.); WLTP 179 g/km | faktisk 1. reg.dag; variant; vektdefinisjon + dokument; CO₂-felt «kombinert»; drivlinjebevis; norsk reg.dato; kjøredato/-tid; URL/versjon; alle input; skjermbilder; nedbrytning |

### 16.2 R-OTA-014: hva som kreves for å gå fra E1P til E1
Prosjektets evidensmodell (`rules.json evidenceLevels`): **E1** = primærkilde lest direkte og påstandene i regelens e1Findings er dekket av lest tekst; **E1P** = avgrensede påstander er E1, resten uavklart (openQuestions). Registrert i regelen som `e1UpgradeRequirements`; **klassifiseringen er ikke endret**.
| Lag | Innhold | Status |
|---|---|---|
| **Dokumentert ordlyd** (E1, lest) | forskrift § 10-4-4 «Ved beregning av skatte- og avgiftskrav avrundes beløpet ned til nærmeste hele krone» (T46); håndbok T45; skattebetalingsloven § 1-1 (2) i (særavgifter etter lov 1959 nr. 2 = skatte- og avgiftskrav) og § 10-40 (1) c (engangsavgift) (T49); forskrift § 10-4-1 d (engangsavgift nevnt i § 10-4) (T46) | belagt |
| **Anvendelsesvurdering** (grunnen til E1P) | at § 10-4-4 gjelder når selve engangsavgiften *beregnes*: § 10-4-4 nevner ikke engangsavgift; hjemmelen (skattebetalingsloven § 10-4) gjelder «dette kapitlet» (kap. 10 Forfall); ingen tekst i engangsavgiftsregelverket (vedtak, forskrift, rundskriv) nevner avrunding | slutning fra virkeområdet, ikke uttrykkelig |
| **Manglende belegg** (én av) | (A) uttrykkelig tekst som anvender avrunding ned til hele kroner på engangsavgiftens beregning; (B) forarbeider/merknader til forskrift § 10-4-4 (endringsforskrift 25.3.2010 nr. 462 med høringsnotat/merknader) og til skattebetalingsloven § 10-4 (via håndbokens «Vis forskrifter og forarbeider») som viser at regelen gjelder beregningen av alle kapittel 10-krav inkl. engangsavgift; (A)/(B) er nye primærkildetekster. *(Tidligere punkt (C) «akseptert vurdering» er rettet i runde 7: en akseptert vurdering er en beslutning, ikke belegg, og endrer ikke evidensnivået — se §17.4.)* | mangler |
Utenfor R-OTA-014s påstand (og ikke krav for E1 av denne regelen): mellomledd (U-012) og MVA-avrunding (U-013). Klasse 1-referanse er et separat godkjenningskrav og løfter ikke evidensnivået.

### 16.3 Sensitivitetsanalysens forutsetninger (presisert; ikke en generell garanti)
| Dimensjon | Undersøkt |
|---|---|
| Alternative mellomavrundinger | generell vekt (kg × 12,71) eksakt/ned/nærmeste/opp, hver kombinert med enten (a) eksakt netto, (b) avrundet fradragsbeløp (ned/nærmeste/opp) eller (c) avrundet sum før fradrag (ned/nærmeste/opp); sluttkravet nedrundes alltid én gang (§ 10-4-4) |
| Inputområde | vekt 500–4 000 kg, alle heltall; alle 41 fradragstrinn + 0 %; ICE/PHEV med CO₂ 0/60/99/100/101/140/150/151/179/225/226/300/400 g/km (tillegg (kg − 1 200) × 260), og BEV; > 10 mill. punkter |
| Resultat | avvik fra motorens `finalClaim` **−1 … +2 kr** (verste punkt: 501 kg BEV, 6 %: generell vekt oppad + fradragsbeløp nedad). De tre valideringscasene: høyst +1 kr for seks manuelle varianter |
| **Ikke undersøkt** | avrunding av satser eller prosent; per-gram-avrunding; andre rekkefølger; andre CO₂-verdier enn listen; vekt utenfor 500–4 000 kg; NEDC- og egenvekt/10-CO₂ (blokkert); andre avgiftsgrupper; avrunding av MVA; at Skatteetaten kan bruke en rekkefølge utenfor settet |
**Konklusjon:** «inntil 2 kr» er en observert grense for dette variantsettet og inputområdet — ikke en garanti. Uttrykket i §15.2 er rettet. Analysen er informasjon om usikkerhetens størrelse; den velger ingen regel og motoren er uendret (eksakte mellomledd). Testen `SENSITIVITET (avgrenset)` låser området og kontrollerer rutenettformelen mot motoren på et utvalg.

### 16.4 MVA-avrunding: åpent punkt for ECON-004 (U-013), ikke implementert
Merverdiavgift er «skatte- og avgiftskrav» (§ 1-1 (2) g), men ingen lest kilde sier hvordan import-MVA beregnes og avrundes; kalkulatorresultatene (16 665,75 → 16 666; 102 872,75 → 102 873) er ikke nedrundet — valideringssignal, ikke kilde. Registrert som U-013 i `rules.json` og som avhengighet på ECON-004 i `MVP_BACKLOG.md`. Ingen MVA-logikk er innført.

### 16.5 Godkjenningsoversikt (ingenting er godkjent; kun til din vurdering)
| Kan vurderes godkjent (kildesiden komplett; krever likevel din godkjenning + klasse 1) | Mangler før godkjenning | Handling fra Christian |
|---|---|---|
| Generell vekt 12,71 kr/kg > 500 kg; ICE-tillegg 260 kr/kg > 1 200 kg; EV-behandling (bare § 2); PHEV (teknisk vilkår, E1); NOx fjernet; vrakpant 2 400 utenfor fradraget; styrende hendelse | **klasse 1-referanser** (ingen finnes); regelnivå E1 ✔; eksplisitt `parameterApproval` | utfør de tre nye kjøringene (README i `docs/tax/golden-runs/`) → klasse 1; godkjenn deretter regel for regel |
| (med forbehold) CO₂-bånd (marginal lesning via T40); bruksfradrag (U-009); sluttavrunding R-OTA-014 (E1P) | marginal-bekreftelse; månedstrinn/dag 29–31; E1-løft av R-OTA-014 (§16.2) | beslutt om T40 er tilstrekkelig for marginal; tilby (A) uttrykkelig tekst eller (B) forarbeider for R-OTA-014 (en akseptert vurdering løfter ikke evidensnivået, §17.4); ev. oppgi regel for dag 29–31 |
| – | mellomledd (U-012), MVA-avrunding (U-013), endringer etter 2026-10-18, sluttdato | ingen handling nå; U-013 ligger i ECON-004 |
Ikke godkjent: alle parametere (0 av 0 godkjent; 0 klasse 1).

### 16.6 Kontroller kjørt (runde 6)
`npx tsc --noEmit` OK; `npx eslint .` OK; `npx vitest run` — **31 filer, 731 tester bestått** (`tax-engine`: 86, `tax-golden-runs`: 10); `node docs/tax/check-docs.mjs` OK. Ikke kjørt: `npm run build`, e2e, DB-suiter; ingen kalkulatorkjøring.
**Sluttstatus: REVIEW.**

## 17. Runde 7 — gjør de tre manuelle kalkulatorkjøringene enkle (18.10.2026)
Dokumentasjon bare: ingen kodeendring, ingen nye tester (ingen konkret feil funnet i koden). Én rettelse i registerteksten (§17.4). Ingen parameter godkjent; ECON-003/-004 ikke startet. Kalkulatoren er fortsatt ikke tilgjengelig for meg.

### 17.1 Utfyllingsguider (én per kjøretøy)
`docs/tax/golden-runs/GUIDE-PHEV.md`, `GUIDE-EV.md`, `GUIDE-DIESEL.md`: felt F1–F9 (typen input motoren trenger) med tre tydelige statuser — **DOKUMENTERT i materialet** (oppgitt i case-teksten, ikke teknisk verifisert), **ARBEIDSVERDI** (arbeidsdatoen og referansevekten: foreløpige testinput, uttrykkelig *ikke* verifiserte kjøretøydata) og **MANGLER**. Kalkulatorens egen feltrekkefølge er ikke verifisert av meg; guiden sier at skjermens rekkefølge følges og at felt-ID-ene brukes til å merke skjermbildene.

### 17.2 Skjermbilder
Nøyaktig liste i `docs/tax/golden-runs/SJEKKLISTE.md` §B: S00 (start + URL + klokke), S01…Sn (hvert inputsteg utfylt), S-sum, S-res1, S-res2 (alle delposter utvidet), S-res3 (detalj/PDF); i tillegg i melding: kjøredato/klokkeslett, hvem som kjørte, norsk registreringsdato tastet; tekniske dokumenter (typegodkjenning/CoC, vognkort). **Christian leverer filene; jeg beregner SHA-256 og registrerer proveniens etter mottak** (SJEKKLISTE §E).

### 17.3 To typer validering mot eksisterende klasse 1 (uendret)
Klasse 1 = «uavhengig kontrollert referanse» (`references.json`; `check-docs.mjs`: E1-kilder + `independentReference` {tool, runDate, output}). Ikke endret eller svekket.
| Type | Dokumenterer | Dokumenterer ikke | Klasse 1? |
|---|---|---|---|
| **1. Kalkulatorkjøring med eksplisitte testinput** | at den offisielle kalkulatoren gir X for *disse* inputene (kontroll av motorens regler: satser, bruksfradragstrinn, vrakpant, avrunding av sluttbeløp) | at inputene er bilens egne tekniske data | kvalifiserer etter eksisterende definisjon (tool, runDate, output finnes) |
| **2. Kjøretøyspesifikk referanse** | type 1 + at avgiften gjelder *dette kjøretøyet* (vekt-/CO₂-/drivlinjedata dokumentert) | regelverk etter kjøredato, MVA | samme klasse; i tillegg `referenceScope = vehicle_specific` |
Uten teknisk dokumentasjon registreres kjøringen som type 1 (`referenceScope = explicit_inputs`); det er et metadatafelt på nye referanser, ikke en endring av klassen. **Tekniske kjøretøydokumenter er ikke et obligatorisk første steg** for `explicit_inputs`: de tre kontrollene kan gjøres med oppgitte testinput uten å hevde at de dokumenterer de konkrete bilene (arbeidsdato og referansevekt er testinput, ikke verifiserte data).

### 17.4 R-OTA-014 forblir E1P; evidensklassifisering ≠ godkjenningsbeslutning
- **Evidensklassifisering** (`evidenceLevel`) følger bare lest kildetekst. Løft til E1 krever ny primærkildetekst: (A) uttrykkelig tekst om avrunding av engangsavgiftens beregning, eller (B) forarbeider/merknader til forskrift § 10-4-4 og skattebetalingsloven § 10-4.
- **Godkjenningsbeslutning** (`parameterApproval`) er Christians og krever E1 + klasse 1.
- **Rettelse:** forrige tekst listet «(C) akseptert vurdering» som en vei til E1. Det var feil: en akseptert juridisk vurdering registreres som **beslutning** (hvem, dato, tekst; `DECISIONS.md`/godkjenningsbegrunnelse), aldri som e1Finding eller kilde, og endrer ikke evidensnivået. Å godkjenne R-OTA-014 mens den er E1P ville kreve en egen, eksplisitt beslutning om evidensmodellen/portene — utenfor ECON-002; kravet om E1 er ikke svekket. (`rules.json`: `acceptedAssessment`, `evidenceVsApproval`.)

### 17.5 Gjenstående forhold: blokkerer dagens avgrensede motor eller senere arbeid?
| Forhold | Blokkerer motoren/valideringen per 18.10.2026? | Gjelder senere |
|---|---|---|
| Ingen klasse 1-referanser (kjøringene) | blokkerer **godkjenning**, ikke beregning | – |
| R-OTA-002 marginal kun via T40 (E1P) | blokkerer godkjenning av CO₂-regelen | – |
| R-OTA-010 E1P pga. U-009 (månedstrinn/dag 29–31) | blokkerer godkjenning; motoren **blokkerer** selv i vinduet (uendret) | – |
| R-OTA-014 E1P (anvendelsesvurdering) | blokkerer godkjenning av avrundingsregelen | – |
| U-012 mellomledd (eksakte mellomledd beholdt) | nei — målt usikkerhet er avgrenset (§16.3) | kan belyses av kjøringene hvis nedbrytning vises |
| Vognspesifikke tekniske data (type 2) | blokkerer bare kjøretøyspesifikk referanse | ECON-007 (berikelse) |
| Endringer etter 18.10.2026 / lov 2026 nr. 41 | **ikke avklart som årsak til avvik** — ingen dokumentert regelendring er identifisert; advarsel `rates_verified_as_of` for senere datoer | ny kildekontroll ved senere bruk |
| Ukjent sluttdato for 2026-satsene | **nei** — intern sperre 2026-12-31 beholdt (`internal_guard`, ikke kildedokumentert) | avklares når 2027-regelverk foreligger |
| MVA-avrunding og tollkurs (U-013, U-008) | **nei** — ikke del av engangsavgiften | ECON-004 |
| NEDC/fallback-CO₂, andre avgiftsgrupper | nei (blokkert/utenfor profil) | senere |
**Merk for kjøringene:** et avvik mellom kalkulator og motor registreres som **uavklart** til årsaken er undersøkt; det klassifiseres ikke automatisk som «endring etter testdatoen». Tre datoer/profiler holdes adskilt: (1) kjøredato, (2) norsk registreringsdato (velg innenfor 2026, ≥ første registrering), (3) motorens regelprofil (`NO-OTA-2026-A-PB`, `ratesVerifiedAsOf` 2026-10-18). Bare en dokumentert regelendring etter 2026-10-18 kan klassifisere et avvik som slik endring; ellers undersøkes også inputfeil, U-012 og U-009 (`SJEKKLISTE.md` §F).

### 17.6 Kort sjekkliste for Christian
1. Tekniske kjøretøydokumenter er **valgfrie** for `explicit_inputs` (`SJEKKLISTE.md` §C); de trengs bare for kjøretøyspesifikk referanse.
2. Kjør kalkulatoren per bil etter `GUIDE-…md`; velg standard bruksfradrag; noter kjøredato/-tid og norsk registreringsdato.
3. Ta skjermbildene S00–S-res3 (`SJEKKLISTE.md` §B), uten redigering.
4. Send filene og meldingen; jeg beregner SHA-256, registrerer proveniens og sammenligner med motoren.
5. Valgfritt (R-OTA-014): lever (A) tekst eller (B) forarbeider.
6. Godkjenning av en regel krever **alle tre**: E1-evidens for regelen, klasse 1-validering og din uttrykkelige godkjenning — det gjør ikke jeg. Klasse 1 alene er ikke nok mens anvendte regler er E1P (R-OTA-002, -010, -014).

### 17.7 Kontroller
`node docs/tax/check-docs.mjs` OK (R-OTA-014-tekst rettet); `npx vitest run` — **31 filer, 731 tester bestått** (uendret; ingen nye tester); ingen kodeendring. Ikke kjørt: `npm run build`, e2e, DB, kalkulator.

## 18. Runde 8 — kalkulatorkjøringene mottatt (18.10.2026)

Detaljer og tabeller: `docs/tax/golden-runs/2026-10-18/REGISTRERING.md`; maskinlesbart: `references.json` → `calculatorObservations`; test: `tests/tax-calculator-observations.test.ts`.

### 18.1 Kontroll av leveransen
Ni originalbilder: SHA-256 og størrelse stemmer med manifestet (kontrollert av meg; automatisert i testen). Transkripsjonen er avstemt mot bildene uten avvik. Nye referanse-ID-er `GR-20261018-01` (PHEV), `-02` (EV), `-03` (diesel); CASE-001/002/003 er urørt og fremstilles ikke som bildenes opprinnelige dokumentasjon.

### 18.2 Hva som er observert, brukerbekreftet og ukjent
- **Observert i bildene:** alle inputfelt som er vist, resultat, delposter (engangsavgift, vrakpant, total) og mva.
- **Brukerbekreftet, ikke synlig i bildene:** kjøredato 18.10.2026 og at norsk registreringsdato = kalkulatorens automatiske dagsdato 18.10.2026 (samme proveniens).
- **Ukjent:** klokkeslett, URL, kalkulatorversjon, bruksfradragsprosent (lenken «Engangsavgiften består av» er ikke åpnet).
- **Prisversjoner holdt adskilt:** PHEV 600 000 (input + resultat) og 2 600 000 (nedbrytning); EV 350 000 (input + resultat) og 300 000 (nedbrytning); diesel 350 000 (alle bilder). Nedbrytningsbildene for PHEV og EV har ikke eget inputbilde; det er ikke antatt at bare pris ble endret. PHEV-inputbildet slutter ved egenvekt.
- **Testantakelser (ikke observert):** CO₂-metode «vektet kombinert» (PHEV) og «kombinert» (diesel); drivlinjeflagg utledet fra valg i kalkulatoren; ingen CO₂-verdi for elbil (resultatet er uavhengig av den); egenvektdefinisjon ukjent.

### 18.3 Motoren mot observasjonene
Motoren (`NO-OTA-2026-A-PB`, dato 2026-10-18, dagpresisjon, uendret kode og regler) gir sluttkrav **529 069 / 16 748 / 333 723**, lik de viste totalene; engangsavgift (eksakt 526 669,738 / 14 348,9545 / 331 323,972) stemmer med viste 526 669,74 / 14 348,95 / 331 323,97. Ingen kalibrering. Status er fortsatt `calculated_unverified`. Samsvaret lukker ikke U-012 og løfter ikke R-OTA-014 (E1P); ørebeløp er visningsverdier. Bruksfradragsprosentene (2 / 33 / 30 %) er motorens egne, ikke observert.

### 18.4 Klasse 1 — se §19
Runde 8 behandlet klasse 1 for strengt (malens tilleggspunkter). **§19 overstyrer dette punktet.**

### 18.5 Mva. og åpne punkter
Mva.-beløpene er registrert som observasjoner for ECON-004 (ikke implementert; U-013 åpen). U-009, U-012, U-003, U-008 uendret.

### 18.6 Kontroller
Kjørt: `node docs/tax/check-docs.mjs`, `npx vitest run` — **32 filer, 743 tester bestått**; `npm run typecheck`, nye tester `tests/tax-calculator-observations.test.ts` (12) og justert README-sjekk i `tests/tax-golden-runs.test.ts`. Ikke kjørt: `npm run build`, e2e, DB, selve kalkulatoren (utilgjengelig for meg).

## 19. Runde 9 — klasse 1 etter eksisterende styrende dokumenter (18.10.2026)

Detaljer: `docs/tax/golden-runs/2026-10-18/REGISTRERING.md` §4.

### 19.1 Definisjonen og lagene
Klassen er definert av evidensmodellen (`DECISIONS.md` DEC-032 pkt. 2 — merket FORSLAG, men behandlet som styrende, jf. `reviews/ECON-001.md` D1 — og `references.json` `classes["1"]` + `note`: uavhengig offisiell kalkulator-/vedtaksreferanse, ikke håndregning). `rules.json` `approvalRequirements` skiller klasse 1 fra godkjenning. Dokumentasjonsformen følger `references.json` `requiredToUpgrade` («eksakte input; lagre input, dato, resultat og skjermbilde uten persondata») og `IMPORT_ENGINE_SPEC.md` linje 77/79 («input/dato/kilde, output og avvik»). `check-docs.mjs` er bare en minimumskontroll (`tool`, `runDate`, `output` + E1-regelkilder). `golden-run-template.md`/`SJEKKLISTE.md`/guidene er Claudes anbefalte dokumentasjonssett (runde 6–7) og omdefinerer ikke klassen; de er merket slik.

### 19.2 Konklusjon per referanse (input-/resultatbildene ved oppgitt pris)
- **EV (350 000): oppfyller.** Alle sju steg vises; resultat 16 748,00; skjermbilder hashet; dato brukerbekreftet. Registrert `C1-GR-20261018-02`.
- **Diesel (350 000): oppfyller.** Steg 1–11 dekket av bildene (steg 11 uten verdi); resultat 333 723,00. Registrert `C1-GR-20261018-03`.
- **PHEV (600 000): oppfyller ikke ennå.** Én mangel: steg 11 «Alternativ beregning» er ikke vist og ikke bekreftet. Alt annet er oppfylt. Ikke registrert.
Nedbrytningsbilder med andre priser er separate observasjoner og påvirker ikke disse konklusjonene.

### 19.3 Dato og CO₂-antakelse
Kjøredato og automatisk dagsdato 18.10.2026 er uttrykkelig brukerbekreftet og registrert med den proveniensen; definisjonen krever at datoen *lagres*, ikke at den er synlig i bildet. Klokkeslett kreves ikke. PHEV: observert input er 140 g/km + «WLTP»; «vektet kombinert» er en motorantakelse og er ikke observert.

### 19.4 Effekt
`class1References` = 2 (foundationStatus og profil `NO-OTA-2026-A-PB`); `validation.status` er fortsatt `estimate_not_approved` (profil ikke godkjent, R-OTA-002/-010/-014 E1P). Ingen parameter godkjent; R-OTA-014 og U-012 uendret; ECON-003/004 ikke startet. Klasse, regelnivå og godkjenning er behandlet separat.

### 19.5 Kontroller
`check-docs.mjs` OK (110 tilfeller, klasse 1 = 2); `npx vitest run` — 32 filer, 743 tester bestått (sentinelltestene for «0 klasse 1» er oppdatert til faktisk status); `npm run typecheck` rent. Ikke kjørt: build, e2e, DB, kalkulator.

## 20. Runde 10 — PHEV registrert som klasse 1 (18.10.2026)
Christian bekreftet uttrykkelig at «Alternativ beregning (valgfritt)» sto tomt i PHEV-kjøringen med innkjøpspris 600 000 kr den 18.10.2026. Det er registrert som **brukerbekreftet opplysning** (samme proveniens som kjøredato; ikke synlig i bildene) i `references.json` (`C1-GR-20261018-01`, `independentReference.userConfirmedInputs`). Dermed er den ene manglende opplysningen etter §19.2 dekket: steg 1–10 observert, steg 11 brukerbekreftet, resultat 529 069,00 observert. **PHEV (600 000) oppfyller eksisterende klasse 1-krav.** Nedbrytningsbildet ved 2 600 000 er fortsatt en separat observasjon uten inputkobling. CO₂-metoden «vektet kombinert» er fortsatt en motorantakelse, ikke observert input.

Effekt: `class1References` = 3 (foundationStatus og profil). Resultatet er fortsatt `estimate_not_approved`. Ingen parameter godkjent; R-OTA-002/-010/-014 E1P; U-012 og R-OTA-014 uendret; ECON-003/004 ikke startet. Kontroller: se commit (check-docs, vitest, typecheck).

## 21. Runde 11 — beslutningsgrunnlag for R-OTA-002, R-OTA-010 og R-OTA-014 (18.10.2026)

**Ingen endring i register, kode eller evidensnivå.** Dette er et grunnlag for Christians beslutning. De tre klasse 1-referansene (§19–§20) løfter ikke noen regel til E1 og er ikke brukt som regelkilde. Lest på nytt for dette punktet: T40 s. 3 (visuelt), konsolidert vedtak § 3 første ledd a (T47/T43) og regelregisteret.

### 21.1 Tabell
| Regel | Kildebelegg (E1, lest) | Manglende E1-påstand / gjenværende usikkerhet | Mulig godkjenningsomfang | Nødvendig neste handling |
|---|---|---|---|---|
| **R-OTA-002** CO₂, gruppe a | Intervallsatsene 800/1 600/3 200/5 000 (T47 § 3 a nr 2; T43; T41; T40). T40 s. 3 beskriver bånd uttrykkelig som «første 100 g/km / neste 50 / neste 75 / resten», kr per g/km. WLTP-feltene og NEDC-faktor 1,24 (T05 § 3-1; T03 3.2.5) | (1) Vedtaksteksten er en tabell uten ordet «marginal» (vekten sier derimot «den delen av vekten som overstiger»); marginal struktur står bare i T40. Etter modellen er påstanden dekket av lest primærtekst (T40 er E1), men den bindende teksten er taus. (2) NEDC-omregning og egenvekt/10 gir desimal-CO₂ uten kilde for avrunding (U-012). (3) `governingEvent` er ikke satt | Bare **WLTP, heltall g/km, gruppe a, stempeldrevet motor** (inkl. PHEV med «vektet kombinert»). NEDC, fallback og andre grupper utenfor og blokkert (motoren blokkerer dem allerede) | Beslutning om å dele regelen (§21.2). Fylle `governingEvent`. Valgfritt: avgjøre om T40 er tilstrekkelig for marginal struktur eller om du vil ha støtte i forarbeider |
| **R-OTA-010** bruksfradrag | Tabell med 41 trinn (T05 § 3-3; T07; T42, identiske), fradrag i avgiften etter §§ 2 og 3 og ikke i vrakpant (T47 § 4; T05), alder fra første gangs registrering til norsk registrering, 20-årsregelen 1. januar (T05 § 3-3 tredje ledd), trinn nås på dagen kjøretøyet «fyller år» (T42; T03 4.2, eksemplifisert for hele år) | (1) **U-009:** dag 29–31 når målmåneden er kortere — ikke omtalt i noen kilde. (2) At *månedstrinn* nås på samme dag i måneden (inklusivt) er en analogi fra år til måneder (E1P). (3) `validity.from` og `governingEvent` mangler (tabellens ikrafttredelse er ikke dokumentert i filene) | Datoer der utfallet er det samme under alle åpne lesninger: utenfor U-009-vinduet **og** ikke nøyaktig på en månedstrinndag. Resten blokkert | Beslutning om å dele regelen og om motoren skal blokkere også nøyaktig månedstrinndag (liten endring). Fylle `validity.from` og `governingEvent` med belegg |
| **R-OTA-014** avrunding | § 10-4-4: «Ved beregning av skatte- og avgiftskrav avrundes beløpet ned til nærmeste hele krone» (T46); T45; engangsavgift er avgiftskrav (skattebetalingsloven § 1-1 (2) i, T49); engangsavgift forfaller etter § 10-40 (1) c; § 10-4-1 d nevner engangsavgift (T46) | Påstanden «**engangsavgiftens beregning** avrundes ned» står ikke i noen tekst; den er en slutning (subsumsjon) fra generell regel + at engangsavgift er et avgiftskrav, og hjemmelen er utfylling av kap. 10 (Forfall). Mellomledd er ikke omtalt (U-012) og er ikke en del av påstanden. Lov 19.6.2026 nr. 41 (endrer § 1-1 og § 10-40) er ikke lest. `governingEvent` ikke satt | Ingen deling mulig: rest og kjerne er samme påstand. Sluttkrav for engangsavgift kan bare godkjennes etter nytt E1-belegg eller en uttrykkelig beslutning (§21.4) | Velg: (A) ny primærtekst om at avrunding gjelder engangsavgiftens beregning, (B) forarbeider/merknader til forskrift 25.3.2010 nr. 462 og skattebetalingsloven § 10-4, eller (C) en registrert beslutning (ikke evidens) |

### 21.2 R-OTA-002: beskriver T40 marginale bånd? Er regelen for bred?
**Ja, T40 s. 3 beskriver marginale bånd** (visuelt lest; kolonnen «Enighet 2026»: «første 100 g/km 800 / neste 50 g/km 1 600 / neste 75 g/km 3 200 / resten 5 000»). Beløpene er identiske med intervallene i det konsoliderte vedtaket. Dette er allerede registrert som E1-funn (rules.json, T40). Etter modellens definisjon trengs det ikke ytterligere tekst for *den påstanden*; det som holder regelen på E1P som helhet er at den også omfatter NEDC-omregning og egenvekt/10 (desimaler uten avrundingskilde) og andre grupper, som motoren ikke støtter. Regelen er derfor **for bredt formulert**. En deling følger evidensmodellen (E1P = avgrensede påstander er E1, resten uavklart): kjerne «gruppe a, WLTP, heltall g/km, stempeldrevet motor» kan registreres som egen E1-regel, mens NEDC/fallback/andre grupper forblir E1P og blokkert. Det svekker ingen godkjenningskrav (`governingEvent`, klasse 1-referanse og uttrykkelig godkjenning kreves fortsatt). **Ikke gjort:** delingen endrer regel-id-er, profiler og motorens regelreferanser, og er din beslutning. Merk at en mulig flat lesning av CO₂-tabellen ville gi helt andre beløp, så avgjørelsen om T40 er tilstrekkelig for marginal struktur er reell og ligger hos deg.

### 21.3 R-OTA-010: må dag 29–31 blokkere godkjenning av andre datoer?
**Nei, ikke datoer utenfor tvetydighetsvinduet.** Motoren regner begge kandidatene (siste dag i måneden / 1. i neste måned) og blokkerer bare når norsk registreringsdato ligger i vinduet; utenfor vinduet er utfallet identisk under begge lesninger (jf. §5). Usikkerheten er derfor et blokkert grensetilfelle, ikke en usikkerhet i de øvrige datoene. Men dette alene gjør ikke regelen E1: den andre åpne påstanden (månedstrinn nås på samme dag) påvirker utfallet på selve trinndagen og er **ikke** dekket av vindusblokkeringen. For et E1-omfang må begge åpne lesninger være utenfor omfanget, dvs. blokkert: vinduet (finnes) og nøyaktig månedstrinndag (finnes ikke; liten motorendring). Deretter kan «dokumenterte datoer» være E1-kjernen. I tillegg mangler `validity.from` og `governingEvent` for R-OTA-010; det er godkjenningskrav, ikke evidenskrav.

### 21.4 R-OTA-014: hvorfor utilstrekkelig, og kilde versus vurdering
Modellens E1: påstanden må være dekket av lest tekst. Hver premiss er lest (E1), men konklusjonen «engangsavgiften avrundes ned til hele kroner» står ikke i noen lest tekst; § 10-4-4 omtaler ikke engangsavgift, og hjemmelen gjelder kapittel 10 (Forfall). Kjeden er derfor en **begrunnet anvendelsesvurdering**, ikke tekstdekning. Et **behov for ytterligere kilde** finnes bare om du vil ha tekstdekning (A eller B). En **begrunnet vurdering** (C) kan akseptere kjeden som beslutning, men den endrer ikke evidensnivået og løser ikke godkjenningsporten (krever E1) — det ville kreve en egen beslutning om modellen, utenfor ECON-002. Praktisk effekt: usikkerheten gjelder bare øret i sluttbeløpet (±1 kr), men den er ikke en grunn til å løfte nivået. At de viste kalkulatorbeløpene er uten øre brukes ikke som belegg.

### 21.5 Sidefunn (gate, ikke evidens)
`governingEvent` er ikke satt for R-OTA-002, -010, -014, og `validity.from` mangler for R-OTA-010. Samme felt ser ut til å mangle for R-OTA-005 (E1; `validity.from` «2022 (historisk lead)»), selv om den tidligere er omtalt som «klar (kildesiden)». Dette må rettes før en godkjenning kan prøves; det er ikke endret her.

### 21.6 Kontroller
Ingen kode- eller registerendring og ingen nye tester. Kontroll: T40 s. 3 og vedtakstekst lest på nytt; regelregisteret lest. Ikke kjørt: nye tester, build.

**Sluttstatus: REVIEW.** 0 godkjente parametere; klasse 1 = 3; R-OTA-002/-010/-014 uendret E1P; EC

## 22. Runde 12 — opprydding av R-OTA-002, -010, -005, -014 (18.10.2026)

Status **REVIEW**. Ingen parametere godkjent; ECON-003/004 ikke startet. Beregningsresultatene er uendret (ingen sats, regel eller formel endret; golden cases og klasse 1-referanser ble ikke brukt som regelkilde).

### 22.1 Hva som er gjort
1. **R-OTA-002** er avgrenset til *gruppe a, WLTP, hele g/km, stempeldrevet forbrenningsmotor* (inkl. ladbar hybrid med «vektet kombinert») og er **E1**. Belegg for marginal struktur innen omfanget: T40 s. 3 (uttrykkelig «første / neste / resten»), sammen med vedtakets satser (T47 § 3 a nr 2); Christians vurdering av tilstrekkelighet er registrert som `evidenceJudgement`. NEDC (× 1,24), egenvekt/10, desimal-CO₂ og andre grupper er flyttet uendret til ny **R-OTA-015 (E1P, blokkert)**; regel-ID 002 er gjenbrukt for kjernen, og `scope`/`splitFrom` gir sporbarhet. Innen omfanget gir heltall × heltallssats hele kroner, så avrundingsspørsmålet (U-012) berører ikke CO₂-komponenten der.
2. **R-OTA-010** er lest på nytt mot hele ordlyden (forskrift § 3-3 med tabell «Alder over …», fotnote om endring 1. jan 2024; rundskriv 4.2 «regnes fra dato til dato»; T42 «neste steg … oppnås på dagen kjøretøyet fyller år, med unntak for siste steg»). Kildene støtter: tabellen, fradrag i avgiften etter §§ 2 og 3 (ikke vrakpant), alder fra første registrering til registrering her, dato til dato, trinn på dagen, 20-årsregelen. «Dato til dato» er formulert generelt, og «neste steg» omfatter etter ordlyden alle steg med bare siste steg som unntak; månedstrinn behandles derfor likt, uten ny blokkering. Det finnes imidlertid **ikke noe eksplisitt månedseksempel**; dette er registrert som en lesing (`scopeDecision`). Uavklart og beholdt som uavklart: trinndato som ikke finnes i målmåneden (dag 29–31), flyttet til **R-OTA-016 (E1P)**; **U-009-blokkeringen er uendret**. R-OTA-010 er **E1** innen resten. 20 år eller eldre: 100 pst er belagt, men setningen om minimumsavgift i § 3-3 er ikke utledet (R-OTA-011; advarsel, ikke blokkering) og er oppført som utenfor omfang.
3. **governingEvent og validity.from** er fylt der de kan kildebelegges: R-OTA-002 (vedtak § 1; forskrift § 1-2 nr. 1; 2026-01-01), -003, -004, -005 (2026-01-01 etter vedtak § 1; gammel «2022 (historisk lead)» fjernet), -007 (2026-01-01), -010 (2024-01-01 = ikrafttredelse av gjeldende tabellversjon, forskrift 18.12.2023 nr. 2154 / T42; hendelse: første gangs registrering av brukte motorvogner, § 3-3), -014 (hendelse: «Ved beregning av skatte- og avgiftskrav», § 10-4-4; 2010-04-01 var allerede satt). Pakkedato og testdato er ikke brukt. For gate-konsistens er ikke-E1-kilder flyttet ut av `sources` for R-OTA-001/-005/-007/-010 (til `nonE1SourcesMoved`, uten endring i funn).
4. **R-OTA-014** er **fortsatt E1P**. Kildeundersøkelse: tekstsøk i T03, vedtaket (T47/T06), Lovdata-vedtaksfilen og endringsvedtaket gir ingen omtale av avrunding; forskriften om engangsavgift er lest visuelt tidligere, ikke tekstsøkt. Forarbeider og myndighetsforklaringer til skattebetalingsforskriften § 10-4-4 og lovens § 10-4 kunne **ikke hentes** (nettverk blokkert). Konkrete dokumenter som må leses (registrert i `rules.json` `e1UpgradeRequirements.sourceInvestigation`; ikke åpnet): Lovdata forskrift 25.3.2010 nr. 462 (`https://lovdata.no/forskrift/2010-03-25-462`; ID hentet fra lenker i T46, tittel ikke verifisert); skattebetalingsloven LOV-2005-06-17-67, fanen «Forarbeider» for § 10-4 (`https://lovdata.no/dokument/NL/lov/2005-06-17-67`, T49; proposisjonsnummer ikke verifisert); Skattebetalingshåndboken § 10-4 «Vis forskrifter og forarbeider» (T45-URL); høringsnotat/merknader til 2010-endringen (tittel og URL ikke verifisert).

### 22.2 Samlet oversikt etter oppryddingen
Evidensoppgradering er kildebasert og skilt fra **uttrykkelig parametergodkjenning** (ingen er gitt). Godkjenningskravene er uendret: E1-regel, bare E1-kilder, `validity.from`, `governingEvent`, klasse 1-referanse og uttrykkelig `parameterApproval`. Klasse 1 = 3 (PHEV, EV, diesel) dekker reglene motoren anvendte.
| Regel | Nivå | Avgrensning | Gyldighet (fra) | Styrende hendelse | Gjenværende godkjenningshindre |
|---|---|---|---|---|---|
| R-OTA-001 vekt | E1 | gruppe a personbil; § 2 + § 3 a 1 (forbrenningsmotor) | 2026-01-01 (ingen dokumentert slutt; intern sperre 2026-12-31) | første gangs registrering i Norge | uttrykkelig godkjenning |
| **R-OTA-002 CO₂** | **E1 (avgrenset)** | gruppe a, WLTP, hele g/km, forbrenningsmotor inkl. PHEV; marginale bånd | 2026-01-01 | som R-OTA-001 | uttrykkelig godkjenning; R-OTA-015 utenfor |
| R-OTA-005 PHEV | E1 | stempeldrevet motor + ekstern lading per kjøretøy; «vektet kombinert» | 2026-01-01 (ny; tidligere «2022 lead» fjernet) | som R-OTA-001 | uttrykkelig godkjenning; inputkrav per kjøretøy |
| R-OTA-007 elbil | E1 | gruppe a: bare § 2 | 2026-01-01 | som R-OTA-001 | uttrykkelig godkjenning |
| **R-OTA-010 bruksfradrag** | **E1 (avgrenset)** | tabell, dato til dato, månedstrinn lest etter generell ordlyd; trinndato finnes; < 20 år | 2024-01-01 (gjeldende tabellversjon) | første gangs registrering av brukte motorvogner (§ 3-3) | uttrykkelig godkjenning; R-OTA-016 og ≥ 20 år utenfor |
| R-IMP-OTH-001 vrakpant | E1 | 2 400 kr, utenfor fradraget | 2026-01-01 | første gangs registrering i Kjøretøyregisteret | uttrykkelig godkjenning |
| **R-OTA-014 avrunding** | **E1P** | sluttkrav ned til hele kroner; mellomledd ikke omtalt | 2010-04-01 | «ved beregning av skatte- og avgiftskrav» | **E1:** tekst om at engangsavgiftens beregning avrundes (A) eller forarbeider (B), ikke lest (nettverk); deretter godkjenning |
| R-OTA-015 NEDC/egenvekt-10 | E1P, blokkert | desimal-CO₂; andre grupper | ikke fastsatt | som R-OTA-001 | kilde for avrunding av desimal-CO₂ (U-012) |
| R-OTA-016 dag 29–31 | E1P, blokkert | trinndato som ikke finnes i målmåneden | ikke fastsatt | § 3-3 | kilde for datoregel (U-009) |
R-OTA-003/-004 er E1 (governingEvent fylt) men ikke anvendt av motoren og uten klasse 1-tilfelle; R-OTA-003 har T02 (E2) i `sources`. Samlet nivå for motorresultatet er fortsatt `estimate_not_approved` (R-OTA-014 E1P; profil ikke godkjent).

### 22.3 Kontroller
`check-docs.mjs` OK (34 regler; E1 9, E1P 11; klasse 1 = 3); `npx vitest run` — bestått (743 + 3 nye registertester); typecheck. Ikke kjørt: build, e2e, DB. Én liten kodeendring: profilens `ruleEvidence` for R-OTA-002/-010 (E1) og henvisninger i blokkeringsmeldinger; ingen beregning endret.

**Sluttstatus: REVIEW.**
