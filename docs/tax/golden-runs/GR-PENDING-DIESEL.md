# GR-PENDING-DIESEL — Diesel

**Status: FORBEREDT, IKKE KJØRT.** Ingen kalkulatorkjøring er utført; kalkulatoren er ikke tilgjengelig for Claude (nettverk blokkert), og nødvendig input mangler (se MANGLER under). Dette er en **ny** referanse etter `docs/tax/golden-run-template.md` — den er ikke dokumentasjon av en tidligere kjøring. Det som står under «Dokumentert» er gjenbrukt ordrett fra ECON-001-oppdraget (Christian, 2026-10-18) og er ikke rekonstruert fra noe forventet resultat. **18.10.2026 er historisk testdato for de eksisterende fixturene og skal ikke brukes som kjøredato her; kjøredato er den faktiske datoen kjøringen utføres.** Det forventede resultatet fra tidligere validering er bevisst *ikke* forhåndsutfylt (resultat registreres fra den nye kjøringen).

**Oppdatering 18.10.2026:** en kjøring for denne bilen er mottatt som skjermbilder og registrert som `GR-20261018-03` i `2026-10-18/REGISTRERING.md` (`explicit_inputs`, ikke klasse 1). Denne malen forblir uutfylt og er ikke grunnlag for den registreringen.

**Omfang:** standard `referenceScope = explicit_inputs`. Tekniske kjøretøydokumenter (`powertrainEvidence`, vektdefinisjon, CO₂-felt) er **ikke påkrevd** for en slik kjøring; uten dem dokumenterer kjøringen kalkulatorens resultat for oppgitte testinput og **ikke den konkrete bilen**. Felt merket MANGLER som bare gjelder `vehicle_specific` kan stå tomme.

| Felt-ID | Status | Verdi |
|---|---|---|
| `referenceId` | **MANGLER** | `GR-PENDING-DIESEL` er midlertidig; endres til `GR-<åååååmmdd>-<nn>` ved kjøring |
| `calculatorRunDate` | **MANGLER** | |
| `calculatorVersionOrUrl` | **MANGLER** | |
| `runBy` | **MANGLER** | |
| `vehicleIdentification` | Dokumentert (delvis) | Mercedes-Benz E 400 d 4MATIC Estate (merkelapp «diesel»). Mangler: variant/motorkode/modellår/avgiftsgruppe-bekreftelse (ikke VIN) |
| `firstRegistrationDate` | Dokumentert (delvis) | arbeidsdato 01.11.2023 — presisjon **måned**; faktisk dag **MANGLER** |
| `norwegianRegistrationDateUsed` | **MANGLER** | |
| `taxWeightAndDefinition` | Dokumentert (delvis) | 1 976 kg («reference Norwegian tax weight»); definisjon og kilde **MANGLER** |
| `co2ValueAndMethod` | Dokumentert (delvis) | WLTP 179 g/km; felt («kombinert»/«vektet kombinert») og dokument **MANGLER** |
| `powertrainEvidence` | **MANGLER** | oppgitt kun som merkelapp «diesel»; teknisk dokumentasjon (stempeldrevet motor? ladbar?) mangler |
| `allInputs` | **MANGLER** | |
| `inputScreenshot` | **MANGLER** | |
| `resultScreenshot` | **MANGLER** | |
| `resultBreakdown` | **MANGLER** | |
| `notes` | | Diesel: dokumenter CO₂-felt («kombinert») og minimumsvekt fra typegodkjenning. Drivstoff påvirker ikke avgiften; tekniske data gjør det. |

**Annen dokumentert kontekst (ikke avgiftsinput):** annonse netto EUR 38 562; km 34 353; effekt 243 kW; slagvolum 2 925 cc.

**Erklæring (fylles ved kjøring):** «Dette er en ny kjøring utført <dato>; den er ikke en rekonstruksjon av tidligere case.» — ____
