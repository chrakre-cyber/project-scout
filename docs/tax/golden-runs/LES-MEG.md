# LES-MEG — tre kalkulatorkjøringer (ECON-002, status REVIEW)

Pakken inneholder ingen repo-kode og ingen hemmeligheter. Ingen kjøring er utført. Ingen parametere er godkjent.

## Testinput (taster disse; de er testverdier, ikke verifiserte kjøretøydata)

| | PHEV (`GR-PENDING-PHEV`) | EV (`GR-PENDING-EV`) | Diesel (`GR-PENDING-DIESEL`) |
|---|---|---|---|
| Kjøretøy (etikett) | Lamborghini Urus | BMW iX3 | Mercedes-Benz E 400 d 4MATIC Estate |
| Type / avgiftsgruppe | personbil, gruppe a | personbil, gruppe a | personbil, gruppe a |
| Drivlinje | ladbar hybrid | ren elektrisk | diesel |
| Første registrering i utlandet | 01.09.2026 | 01.08.2023 | 01.11.2023 |
| Egenvekt | 2 610 kg | 2 185 kg | 1 976 kg |
| CO₂ | 140 g/km | 0 g/km | 179 g/km |
| Effekt / slagvolum (kun hvis spurt) | 588 kW / 3 996 cc | 210 kW | 243 kW / 2 925 cc |
| Bruksfradrag | standard (tabell) | standard (tabell) | standard (tabell) |
| Norsk registreringsdato | du velger, i 2026, ≥ første registrering; noter den | samme | samme |
| Kjøpesum/valuta (kun hvis påkrevd) | du velger; noter | samme | samme |

## Slik bruker du den
1. Ta én kjøring per kolonne i den offisielle kalkulatoren, etter `GUIDE-…md`. Tekniske kjøretøydokumenter trengs **ikke**.
2. Ta skjermbildene i `SJEKKLISTE.md` §B uten redigering. Noter kjøredato, klokkeslett, hvem som kjørte og norsk registreringsdato.
3. Send skjermbilder og melding. Jeg beregner SHA-256, registrerer proveniens og sammenligner med motoren.

## Hva kjøringene er — og ikke er
- De er beregningskontroller med eksplisitte testinput (`referenceScope = explicit_inputs`). De viser hva kalkulatoren gir for *disse* inputene. De dokumenterer **ikke** de konkrete bilene.
- Et avvik mellom kalkulator og motor registreres som **uavklart** til årsaken er undersøkt. Kjøredato, norsk registreringsdato og motorens regelprofil (`NO-OTA-2026-A-PB`) holdes adskilt. Det klassifiseres ikke automatisk som «endring etter testdatoen».
- Godkjenning krever alle tre: E1-evidens for regelen, klasse 1-validering og din uttrykkelige godkjenning. Klasse 1 alene gjør ikke parametre godkjenningsklare mens anvendte regler er E1P (R-OTA-002, -010, -014).
