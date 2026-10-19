# ECON-004 — satsvedtak, meldingsformat og registerrettelser (19.10.2026)

**Status: kildevurdering og registerrettelser. Ingen kodeendring, ingen fixture-endring, ingen parametergodkjenning, ingen økonomiflagg (alle `false`).** ECON-004 forblir REVIEW; ECON-002 og ECON-003 er uendret; ECON-005 er ikke startet. U-013 forblir åpen. Evidensnivå i registeret følger lest tekst og er skilt fra parametergodkjenning (ingen regel har `parameterApproval`).

## 1. Pakke og identitet
- `MANIFEST.json`: **10 av 10 filer** stemmer på byte og SHA-256; `acquisition.json` (4 oppføringer): URL = endelig URL, hentet 2026-10-19 14:12 UTC. Arkivert i `docs/tax/primarkilder/econ004c/`.
- **Dokumentidentitet:** Stortingets «Vedtak 217 — Vedtak om merverdiavgift for 2026» (sak «Skatte- og avgiftsinntekter 2026», Prop. 1 S (2025–2026), Innst. 3 S) og Norsk Lovtidend **FOR-2025-12-18-2752** «Stortingsvedtak om merverdiavgift for 2026» er **samme vedtak**: §§ 1–5 har identisk ordlyd (kontrollert ved normalisert tekstsammenligning, 1 254 tegn, ingen avvik). Lovtidend: vedtatt 18.12.2025, kunngjort 22.12.2025 kl. 11.30, ikrafttredelse «Budsjettåret 2026», hjemmel Grunnloven § 75 a, jf. mval.
- **Registrert (sources.json):** T76 (Stortinget vedtak 217), T77 (FOR-2025-12-18-2752), T78 (Skatteetatens informasjonsmodell-side), T79 (XSD v1.0), alle E1 med `supportedClaims` og `limitations`. Sammenheng T76 = T77 er notert på begge.

## 2. Hva kildene dekker
**Satsen (R-IMP-VAT-001):** § 2: «Merverdiavgift beregnes med 25 pst. av avgiftspliktig omsetning, uttak og innførsel når ikke redusert sats skal anvendes»; § 1: gjelder fra 1.1.2026. Dekker: 25 % også ved innførsel for varer med alminnelig sats. Dekker ikke: beregningsgrunnlaget (mval. § 4-11, T63), tollsats, og **fravær av senere endringsvedtak** (begge dokumenter er originalversjon; Lovdata viser «Gå til ajourført versjon», ikke fulgt). Alle redusert-sats-paragrafer (§§ 3–5) er irrelevante for personbil.
**Meldingsformat (U-013 del C), XSD v1.0 (T79) + dokumentasjon (T78):** `grunnlag` (valgfri), `merverdiavgift` («Bokført beløp») og `fastsattMerverdiavgift` («sum fastsatt merverdiavgift for perioden»; dokumentasjon: «Sum to pay / sum to be refunded») har type `Beloep` → `Desimaltall` → `xsd:decimal`, **uten** `fractionDigits`/`totalDigits`. Dermed: *skjemaet godtar desimaltall* for grunnlag, linjens mva. og periodens fastsatte mva. Skjemaet sier **ikke** om beløp skal være avrundet, med hvilken metode, per linje/sum, eller når; det sier heller ikke noe om servervalidering (T73: toleranse ±1 kr × linjer er en valideringstoleranse, ikke regel). v1.0 er generert 2022-11-28 og hentet fra en bevegelig master-gren; nyere skjemaversjon er ikke undersøkt (endringsloggen på T78 slutter 2022.12.08, hvilket ikke beviser at ingen nyere finnes).

## 3. U-013 etter dette (fortsatt åpen; delene holdes atskilt)
| Del | Status |
|---|---|
| **A. Samlet avgiftskrav** | Tekstlig støtte for nedrunding til hele krone (T46 § 10-4-4 + § 10-4-1 (1) b + T49 § 1-1 (2) g/j + T50). Åpent: hvilken enhet som avrundes (deklarasjon for ikke registrert; periodens krav for registrert, jf. `fastsattMerverdiavgift` = periodesum). Ikke godkjent |
| **B. Beregningsmetode per importberegning** (tollverdi, omregning, mva. per deklarasjon/varepost) | Ingen regel funnet (T72, T56). Åpent |
| **C. Rapporteringsformat** | **Format dokumentert:** desimaltall godtas i XSD. **Metode ikke dokumentert** |
ECON-003-literalene, `UNCONFIRMED_HALF_UP` og tie-regelen er uendret; ingen floor per import.

## 4. Registerendringer gjort (rules.json, sources.json, TAX-001A-rules.md)
| Post | Endring | Nivå |
|---|---|---|
| **R-IMP-VAT-001** | sats 25 % med E1-funn (T76/T77 §§ 1–2); grunnlag (T63 § 4-11, § 3-29 (2)); veiledning T56/T72; gyldig fra 2026-01-01; åpne spørsmål omskrevet (tollsats, engangsavgift i innførselsgrunnlag, statistisk verdi, senere endringsvedtak, U-013/U-008); lead T08 merket overflødig for satsen; overvåkingsnotat | E1P (uendret nivå, bredere E1-dekning) |
| **R-IMP-VAT-002** | funn: vareførselsloven § 6-10 (transport/forsikring til innførselsstedet, lasting/håndtering, objektive tillegg), forskrift § 6-10-4, sjablong (bare egne hjul, tre land), deklarasjonsrubrikk 12/45/46; åpne spørsmål omskrevet (sjablong ikke lenger «ikke gitt») | E1P |
| **R-IMP-VAT-003** | **E1X → E1P**: funn T71 (300 000 fra 1.1.2026; overgang bare leasing), T63 §§ 6-8/7-1, T62, T35 (hydrogen avviklet 2024), T57, T75 (11.2.2/11.2.5), T76; **lov 19.6.2026 nr. 41 fjernet** fra lead/åpne spørsmål (ikke relevant, T70); 2027-varsel notert som ikke vedtatt | E1P |
| **R-IMP-VAT-004 (ny)** | utskilt: «hva 300 000 måles mot ved innførsel»; ingen kilde avgjør; kandidater (vederlag/tollverdi/mva.-grunnlag) som lead, ingen valgt | E0 (uavklart) |
| **R-DED-001** | funn: mval. §§ 8-1, 8-4 (1) a, håndbok 8-4.3 (= 2023, ordrett), importveiledning (samme regler; kode 81/82); åpne spørsmål omskrevet | E1P |
| **R-IMP-FX-001** | **E2 → E1P**: regelkjede lest (T65/T69 § 6-12-1, T68 § 2-2, T67 §§ 3-3/3-4, T24, T55/T23); validity fra 2026-09-03; kildekonflikten (ukentlig vs annenhver tirsdag) forklart som regimeskifte; spenning «fri rådighet» (T72) vs «aksept» registrert | E1P |
| **R-OTA-014** | **bare overvåkingsnotat** (lov nr. 41: § 1-1 (2) i→h, motorkjøretøyloven oppheves ved ikrafttredelse; § 10-4-4 ikke nevnt). ECON-002-godkjenning og runtime uendret | uendret |
| **U-013** | delt i A/B/C med kilder og status (se pkt. 3); `sourceReview` oppdatert; forblir åpen | — |
| **U-007** | faktarettelse: lov nr. 41 er særavgiftsloven og ikke relevant; innførsel dekket i prinsippet; målegrunnlag → R-IMP-VAT-004 | lukket (E1) |
| **U-008** | notat (R-IMP-FX-001 løftet; restpunkter) | åpen |
Eldre oversikter har fått «Oppdatert»-merknad øverst uten at historikk er slettet (`ECON-004-gjenstaende-behov.md`, `-kildeavklaring-2.md`, `-kildevurdering-3.md`); `TAX-001A-rules.md` er oppdatert for de berørte reglene (kap. 3 kildefortegnelse er ikke regenerert; se `sources.json`).
**Ikke løftet:** ingen regel er E1 eller godkjent; R-IMP-VAT-001 er ikke delt i sats/grunnlag fordi «fravær av senere endringsvedtak» ikke er kontrollert; R-IMP-VAT-004 er E0.

## 5. Gjenstående spørsmål som blokkerer et avgrenset ECON-004-omfang
Omfang: akseptdato og norsk registrering i 2026 (fra 3.9.2026 for tollkurs), personbil avgiftsgruppe a, registrert forhandler, ingen likviditetsmodell. Bare det som fortsatt blokkerer, i prioritert rekkefølge (alle krever *nye* dokumenter eller en beslutning; ingenting av dette er forsøkt hentet tidligere utover det som står under «forsøkt»):

| # | Blokkerer | Presist spørsmål | Dokument som kan avgjøre | Forsøkt |
|---|---|---|---|---|
| 1 | `roundingApproved` (U-013 B og A-enhet) | Rundes hver importberegning (deklarasjon/varepost) eller bare periodens/deklarasjonens samlede krav, og med hvilken metode? | Tolletatens veiledning/spesifikasjon for innførselsdeklarasjon og beregning av avgifter (utover T72); Skatteetatens veiledning for rapportering av innførselsmva. i meldingen | T72, T56, T73, T79, T78 lest — ingen metode |
| 2 | `vatRulesApproved` for elbil | Hva sammenlignes med 300 000 ved innførsel (R-IMP-VAT-004)? | FMVA kap. 7 (forskrift etter mval. § 7-1 (4)); Innst. 4 L (2025–2026); uttalelse fra Skattedirektoratet/Tolletaten | T63, T62, T35, T57, T71, T75 pkt. 11.2 lest — ikke avgjort |
| 3 | `vatRulesApproved` (grunnlag) | Tollsats for personbil, og inngår engangsavgift i *innførsels*grunnlaget (mval. § 4-11)? | Tolltariffen (kap. 87); uttalelse/forskrift om § 4-11 | T60, T63, T68 lest — unntak uttrykkelig bare for omsetning (§ 4-2) |
| 4 | `vatRulesApproved` (sats, avgrensning) | Er satsvedtaket FOR-2025-12-18-2752 endret etter vedtakelsen? | Lovdata «ajourført versjon» av FOR-2025-12-18-2752 (lenke i T77); eventuelt endringsvedtak | T76/T77 original lest |
| 5 | `customsFxRuleApproved` | Hvordan fastsettes akseptøyeblikket for en konkret deklarasjon i praksis (tidlig levert, fremleggelse), og avviker «fri rådighet» (T72) fra «aksept»? Hvor publiseres suspensjon? | Tolletatens praksis/veiledning om aksept av deklarasjon og suspensjon; kurshistorikk før 3.9.2026 (bare for utvidet omfang) | T65, T67–T69, T72, T23, T55 lest |
| 6 | `deductionRuleApproved` | Dokumentasjon av «salgsvare», uttak/omdisponering (T28 aldri lest), forholdsmessig fradrag | Mva.-håndbok § 9-6 (T28); Skatteetatens veiledning for bilforhandlere | T59, T36, T63, T56 lest — vilkår og videresalg dekket |
| 7 | del C (valgfritt) | Finnes strengere servervalidering eller nyere skjemaversjon enn XSD v1.0? | Skatteetatens GitHub (valideringsregler, nyere XSD/endringslogg) | T78/T79 lest (v1.0; master-gren) |
Produktbeslutninger (akseptdato som input, transportstandard, `vehicle_price_only`, opplysningspolicy, avrundingskonvensjon dersom kilde mangler) er ikke kildesaker og er oppsummert i `ECON-004-gjenstaende-behov.md`; ingen er tatt her.
