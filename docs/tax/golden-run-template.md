# Registreringsmal: ny kalkulatorkjøring som golden-referanse (ECON-002)

**Bruk:** ett utfylt eksemplar per *ny* kjøring i Skatteetatens kalkulator. Kjøringen registreres som en **ny referanse** (`GR-<åååååmmdd>-<nn>`), **aldri** som dokumentasjon av CASE-001/002/003 — de gamle kjøringene rekonstrueres ikke. Fyll bare inn det som faktisk ble tastet inn eller vist; la ukjent stå tomt (tom ≠ 0). Legg utfylt mal og skjermbilder i `docs/tax/golden-runs/<referanse-ID>/` og registrer kjøringen i `references.json` (klasse 1 krever `independentReference` {tool, runDate, output}) først når alle punktene under er fylt.

| Felt-ID | Fylles inn | Verdi |
|---|---|---|
| `referenceId` | GR-åååååmmdd-nn | |
| `calculatorRunDate` | faktisk dato og klokkeslett for kjøringen (ikke testdato) | |
| `calculatorVersionOrUrl` | URL til kalkulatoren + synlig versjon/dato i utskriften | |
| `runBy` | hvem som kjørte | |
| `vehicleIdentification` | merke, modell, variant, motor/drivlinje (ikke VIN) | |
| `firstRegistrationDate` | dato dd.mm.åååå; **presisjon:** dag / måned / år (ikke gjett dag) og kilde (vognkort, annonse …) | |
| `norwegianRegistrationDateUsed` | datoen som ble tastet inn i kalkulatoren som norsk registreringsdato | |
| `taxWeightAndDefinition` | kg + hva vekten er (minimumsvekt fra typegodkjenning/CoC?) + dokument | |
| `co2ValueAndMethod` | g/km, WLTP/NEDC og feltet («kombinert» / «vektet kombinert») + dokument | |
| `powertrainEvidence` | teknisk dokumentasjon: stempeldrevet forbrenningsmotor ja/nei, ekstern lading ja/nei (typegodkjenning/CoC/kjøretøyregister, med side) | |
| `allInputs` | alle felt slik de ble tastet inn i kalkulatoren (inkl. kjøretøyklasse/avgiftsgruppe, eventuelle valg) | |
| `inputScreenshot` | filnavn + SHA-256 | |
| `resultScreenshot` | filnavn + SHA-256 | |
| `resultBreakdown` | avgift, vrakpantavgift, bruksfradrag-prosent og eventuelle delposter **slik kalkulatoren viste dem**; samlet beløp | |
| `notes` | avvik, advarsler fra kalkulatoren, hva som er uklart | |

**Merk (runde 9):** malen er et anbefalt dokumentasjonssett, ikke definisjonen av klasse 1. Minstekravet følger evidensmodellen og referanseregisteret (`docs/tax/golden-runs/2026-10-18/REGISTRERING.md` §4); «alle punktene» gjelder for en fullstendig, kjøretøyspesifikk referanse.

**Erklæring:** «Dette er en ny kjøring utført <dato>; den er ikke en rekonstruksjon av tidligere case. Alle verdier er hentet fra kalkulatorens skjermbilder og de oppgitte dokumentene.» — signatur/initialer: ____
**Kryss av før innlevering:** ☐ alle felt-ID-er fylt (ingen gjettede verdier) ☐ to skjermbilder med hash ☐ teknisk dokumentasjon vedlagt ☐ kjøredato ≠ testdato med mindre den faktisk er samme dag.
