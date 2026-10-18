# Sjekkliste: tre manuelle kalkulatorkjøringer (PHEV, EV, diesel)

Ingen kode- eller hash-arbeid for deg: du leverer filene, jeg beregner SHA-256 og registrerer proveniens etter mottak.

## A. Før hver kjøring
1. Åpne `GUIDE-<kjøretøy>.md`. Skaff faktisk **første registreringsdag** (vognkort/utenlandsk registreringsbevis). Velg **norsk registreringsdato** (helst kjøredato, innenfor 2026).
2. Ikke gjett. Mangler du en opplysning, la den stå tom og si fra.
3. Velg **standard bruksfradrag (tabell)**; ikke alternativ beregning.

## B. Under kjøringen — skjermbilder (PNG/PDF, uten beskjæring/redigering, ett sett per kjøretøy)
Navn: `<GR-PENDING-…>_S<nn>_<kort tekst>.png`
| Nr. | Hva | Må vise |
|---|---|---|
| S00 | startsiden for kalkulatoren | nettleserens **adresselinje (URL)** og **klokke/dato** (hele skjermen) + eventuell versjon/dato på siden |
| S01…Sn | **hvert** inputsteg, utfylt, før «Neste» | alle felt med etiketter og valgte verdier (inkl. nedtrekksvalg: kjøretøytype, drivlinje/drivstoff, brukt/ny, avgiftsgruppe); bla/ta flere bilder om siden er lang |
| S-sum | oppsummering av input (hvis kalkulatoren har en) | alle input samlet |
| S-res1 | resultatsiden, øverst | samlet avgift og dato/klokkeslett om vist |
| S-res2 | resultatet med **alle delposter utvidet** | engangsavgift, vrakpantavgift, bruksfradrag (prosent), evt. «avgift før fradrag», merknader/advarsler |
| S-res3 | «slik er avgiften beregnet»/detaljside/PDF-eksport (hvis finnes) | lagre også PDF-en |
Skriv i en melding til meg: **kjøredato og klokkeslett**, **navn på den som kjørte**, og **norsk registreringsdato du tastet**.

## C. Tekniske dokumenter (for kjøretøyspesifikk referanse; se D)
Typegodkjenning/CoC (sider som viser: minimumsvekt/«mass in running order», CO₂-felt «kombinert»/«vektet kombinert», motortype/drivstoff, ladbarhet) og vognkort/utenlandsk registreringsbevis med første registreringsdato. Ta bilde/skann av de relevante sidene; marker ikke over teksten.

## D. To typer validering (hva hver kjøring faktisk dokumenterer)
Eksisterende klasse 1 («uavhengig kontrollert referanse»; `check-docs.mjs`: E1-kilder + `independentReference` {tool, runDate, output}) er **uendret** og ikke svekket.
| Type | Krever | Dokumenterer | Dokumenterer **ikke** |
|---|---|---|---|
| **1. Kalkulatorkjøring med eksplisitte testinput** | skjermbilder S00–S-res3 + kjøredato/URL; alle input synlige | at den offisielle kalkulatoren gir resultat X for **disse inputene** → kontroll av motorens regler (satser, bruksfradragstrinn, vrakpant, avrunding av sluttbeløp) og kandidat til klasse 1 per `independentReference` | at inputene er kjøretøyets egne tekniske data (vektdefinisjon, CO₂-felt, drivlinje) |
| **2. Kjøretøyspesifikk referanse** | type 1 **pluss** tekniske dokumenter (C) som viser at inputene tilsvarer bilen | i tillegg: at avgiften gjelder **dette kjøretøyet** (grunnlag for vekt-/CO₂-/drivlinjekobling, ECON-007) | regelverk etter kjøredato, MVA, andre kjøretøy |
Uten teknisk dokumentasjon registrerer jeg kjøringen som type 1 (ikke som kjøretøyets egen avgift). Registreringen får feltet `referenceScope` (`explicit_inputs` / `vehicle_specific`) — klasse-definisjonen endres ikke.

## E. Etter mottak (mitt arbeid)
1. Legger filene i `docs/tax/golden-runs/<GR-åååååmmdd-nn>/`; beregner **SHA-256**; skriver proveniens (mottatt dato, opprinnelige filnavn, hva hver fil viser).
2. Leser skjermbildene og fyller `GR-…md` (ingenting rekonstrueres; avvik mellom dine meldinger og skjermbilder flagges).
3. Kjører motoren mot de dokumenterte inputene og rapporterer samsvar/avvik per delpost.
4. Registrerer referansen (`references.json`, klasse 1 etter eksisterende definisjon, `referenceScope`). **Ingen parameter godkjennes av meg.**

## F. Dine øvrige valg (ikke del av kjøringen)
- **R-OTA-014:** (A) uttrykkelig tekst eller (B) forarbeider som primærkilde kan løfte E1P → E1. Aksept av en juridisk vurdering registreres som beslutning, ikke som kilde, og endrer ikke evidensnivået alene.
- **Godkjenning av parametere** er din beslutning etter kjøringene.
