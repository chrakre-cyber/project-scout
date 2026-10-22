# Utfyllingsguide — EV — BMW iX3 (`GR-PENDING-EV`)

**Hva dette er:** en beregningskontroll med **eksplisitte testinput** (`referenceScope = explicit_inputs`). Du trenger **ikke** tekniske kjøretøydokumenter for å gjennomføre den. Kjøringen dokumenterer at kalkulatoren gir et resultat for *disse inputene* — den dokumenterer **ikke** at de er bilens egne data. Arbeidsdatoen og referansevekten under er **foreløpige testverdier, ikke verifiserte kjøretøydata**.
Statuser: **TESTINPUT** = verdi du taster og noterer som testinput · **VELG** = du velger og noterer · **KREVES KUN FOR KJØRETØYSPESIFIKK REFERANSE** = trengs bare hvis kjøringen skal gjelde bilen selv (`vehicle_specific`). Rekkefølgen i kalkulatoren er ikke verifisert av meg: følg skjermen, og merk skjermbildene med F-ID. Skriv ned hver etikett slik den står.

| ID | Felt | Hva du taster | Status | Kreves bare for kjøretøyspesifikk referanse |
|---|---|---|---|---|
| F1 | Kjøretøytype / avgiftsgruppe | personbil, avgiftsgruppe a | VELG (testinput) | bekreftelse i typegodkjenning |
| F2 | Drivlinje/drivstoff (hvis valg finnes) | elbil (ren elektrisk) | VELG (testinput) | ingen stempeldrevet forbrenningsmotor (teknisk bevis) |
| F3 | Første registrering i utlandet | **01.08.2023** | TESTINPUT (arbeidsdato; ikke bilens verifiserte dato) | faktisk registreringsdag fra vognkort |
| F4 | Norsk registreringsdato | din valgte dato, innenfor 2026, ≥ F3; noter den | VELG | – |
| F5 | Egenvekt (kg) | **2 185 kg** | TESTINPUT (referansevekt; definisjon ukjent) | minimumsvekt fra typegodkjenning |
| F6 | CO₂ (g/km) | **0 g/km** (0 g/km (rekkevidde 458 km, ikke avgiftsinput)) | TESTINPUT (oppgitt i annonsegrunnlaget; ikke verifisert) | CO₂-felt og dokument (CoC) |
| F7 | Brukt/ny; alternativ beregning av bruksfradrag | brukt (importert); **standard (tabell)** — ikke alternativ beregning | VELG | – |
| F8 | Motoreffekt (kun hvis kalkulatoren spør) | 210 kW | TESTINPUT (oppgitt) | – |
| F9 | Kjøpesum/valuta (kun hvis kalkulatoren krever) | det du velger; noter det. Brukes ikke til å kontrollere engangsavgiften | VELG | – |

Bruksfradraget (planlegging) er 33 % fra 01.08.2026 til 01.02.2027 — kjøring oktober–desember 2026 ligger midt i trinnet. Unngå første registreringsdag 29–31 (U-009 — gjelder bare om du bytter F3 til en annen dato).

Skjermbilder og leveranse: `SJEKKLISTE.md`. Fyll `GR-PENDING-EV.md` om du vil, eller send meg skjermbildene og meldingen — jeg leser dem, beregner SHA-256 og registrerer proveniens.
