# ECON-002 — norsk avgiftsruntime for personbil 2026 (oppdatert 18.10.2026, runde 3: §13)

**Status: REVIEW.** Runde 3 (§13): kilde- og valideringshull kartlagt; **ingen regel-, sats- eller parameterendring**, fordi endelig stortingsvedtak fortsatt ikke er tilgjengelig (nettverk blokkert, ingen ny fil). Ikke DONE; ECON-003 er ikke startet. TAX-foundation er fortsatt **REVIEW** (0 godkjente parametere, 0 klasse 1-referanser). Ingen parameter er godkjent av Claude; oversikten i §9 viser bare hva som er klart for *din* godkjenning.

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
**Beslutning:** avrunding forblir **uavklart (U-010)**. Det er ikke innført avrunding ned. Motoren returnerer eksakt desimal og `totalIntegerBounds` ([⌊x⌋, ⌈x⌉], merket «én sluttavrunding»); `rounded` er `null` med mindre kalleren oppgir en policy, og den er merket `none_in_sources`.
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
Gyldne cases er ikke brukt til å utlede noen regel. Motoren fortsetter med eksakt desimal og heltallsgrenser; `rounded` krever uttrykkelig policy og er merket uten kilde.

### 13.5 Månedsoverflyt (U-009): blokkering beholdt
Uendret blokkering når norsk registreringsdato ligger i vinduet [siste dag i målmåneden, første dag i neste måned) (§5). Utenfor vinduet er oppførselen en **implementasjonskonklusjon** (kilden beskriver ikke dag 29–31), og er nå merket i resultatet.

### 13.6 Implementasjonskonklusjoner (nytt felt `implementationConclusions`, `sourceStatus: "not_expressly_described"`)
| Kode | Hva motoren gjør | Kilde sier |
|---|---|---|
| `month_steps_same_anniversary_rule` | månedstrinn nås på dagen i måneden (inklusivt) | T42: «fyller år» for hele år; T03 4.2: eksempel med år; månedstrinn ikke beskrevet |
| `overflow_dates_outside_window_monotonic` | ved dag 29–31 brukes trinnet når begge kandidatdatoer gir samme trinn; blokkert i vinduet | dag 29–31 ikke beskrevet |
Disse listes aldri som kildebelagte regler. Øvrige antakelser står som før i `assumptions` (vrakpant ikke redusert osv.) og i §1/§9.

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
