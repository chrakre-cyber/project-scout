# TAX-001E — status etter lukking av eksternt verifiserte konflikter (16.10.2026)

**TAX-grunnlaget er fortsatt REVIEW, ikke DONE.** Ingen ny websøking, ingen beregningskode. Kalkulatoren er ikke kjørt (klasse 1 = 0). Ingen implementasjonsparameter er godkjent (0). Alle nye fakta er **E1X** (eksternt verifisert av Christian/Codex, ikke lest av Claude, ingen kildefil/hash) og er ikke løftet til E1.

## Evidenstall
- **Regler (31):** E1 = 4, E1P = 13, **E1X = 6**, E2 = 8, E0 = 0.
- **Regler E1X:** R-IMP-VAT-003, R-OTA-012, R-IMP-OTH-002 (ny: klimagass), R-FOR-001, R-FOR-002, R-FOR-005. R-OTA-001/002/008 forblir E1P med E1X-funn og datoerte parametere.
- **Kilder (42):** E1 = 6, E1X = 14 (T05, T15, T17, T25, T30–T39; T05/T25 oppgradert fra E2), E2 = 19, E0 = 1, E3 = 2. T07 og T20 er E1 med `externalVerification`.
- **Referanser (108):** klasse 1 = **0**, klasse 2 = 10, klasse 3 = 42, klasse 4 = 56.

## Avgiftsgruppe a mot b (aldri blandes)
| Serie | Gyldig | Vekt over 1 200 kg | CO₂ (kr per g/km) |
|---|---|---|---|
| Gruppe a `DP-WEIGHT-A-2026`, `DP-CO2-A-2026` | fra 2026-01-01, åpen | 260/kg | 0–100: 800; 101–150: 1 600; 151–225: 3 200; >225: 5 000 |
| Gruppe b `DP-WEIGHT-B-2026-01-01`, `DP-CO2-B-2026-01-01` | 2026-01-01 til og med 2026-08-31 | 30/kg | 0–100: 300; 101–150: 600; >150: 1 200 |
| Gruppe b `DP-CO2-B-2026-09-01` | fra 2026-09-01 | **UKJENT** (ikke anta 30) | 0–100: 450; 101–150: 600; >150: 1 200 |

Datoer før 2026-01-01 er ukjente → `not_calculated`. Alle er datoerte parametere som aldri kan godkjennes (`datedParameters`).

## Øvrige E1X-fakta lagt inn
- **§ 3-1 CO₂-grunnlag:** WLTP bruker relevant kombinert CO₂; ladbar hybrid bruker vektet kombinert CO₂; NEDC-omregning 1,24 (gruppe a/j) og 1,22 (gruppe b); der CO₂-grunnlag mangler brukes egenvekt/10. Ikke generalisert.
- **Import:** mva. 25 %; tolleverdi/mva.-verdi = kjøpesum + transport og forsikring til norsk innførselssted; senere norske avgifter inngår ikke automatisk i innførsels-mva.-grunnlaget; vrakpantavgift 2 400 kr (T20, E1 + ekstern verifisering); klimagassavgift HFK-134a 2 130,70 kr/kg eks. mva.

## Konflikter
| ID | Status | Begrunnelse |
|---|---|---|
| U-001 | **Lukket så langt dokumentert** | Gruppe b-endring virkning 2026-09-01 dokumentert (CO₂ 300→450 i første bånd). Gruppe b vektsats fra 09-01 og eventuelle andre endringer er ukjente (ikke utledet). |
| U-004 | **Lukket** | Gruppe a og b skilt; satser og datosplitt registrert. |
| U-006 | **Lukket** | 2 130,70 kr/kg HFK-134a eks. mva.; 1,639 forklares som sats per GWP-enhet (ikke bekreftet kilde). Mengde/gass per bil ukjent. |
| U-007 | Lukket (TAX-001D) | 300 000 kr. |
| U-005 | **Åpen (innsnevret)** | «Vektet kombinert» og ×1,24 besvart. Motsigelsen om 10 % vektfradrag for ladbar hybrid (rundskriv E1: opphevet 2024; E2-sammendrag: inntil 10 %) er ikke adressert. |
| U-002, U-003, U-008 | Åpne | Forskrift § 3-3, dekning 2026, tollkurssyklus ikke lest. |

## Gjenstår før DONE
Kildefiler med hash (E1) for T30–T39 og satsene; Stortingsvedtak for å bekrefte; Skatteetatens kalkulator kjørt (klasse 1) for hver profil; lukking av U-002/U-003/U-005/U-008; vektsats gruppe b fra 2026-09-01; eksplisitt godkjenning (`parameterApproval`).
