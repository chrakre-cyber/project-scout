# TAX-001A — presentasjonsserie: ellers like biler til EUR 100 000

**SYNTETISK DEMO – ikke tilbud, ikke offisiell avgiftsfasit, ikke verifisert norsk total. Alle kurser, frakter og bekreftelser er demoantagelser.**

## Felles, daterte demoantagelser (15.10.2026)

- **fxNokPerEur:** 11.50 (SYNTETISK, dato 2026-10-15; ikke Tolletatens kurs)
- **freightToBorderEur:** 1200 (SYNTETISK)
- **insuranceToBorderEur:** 150 (SYNTETISK)
- **rounding:** ROUND_HALF_UP til 2 desimaler (demo-regel, ikke offisiell avrunding)
- **importVatParam:** 25 % kun som aritmetisk demoparameter (R-IMP-VAT-001 er ikke primærkontrollert)

## A. Brutto/netto-scenarioer (kjøpsgrunnlag og tollverdi)

| Scenario | Kjøpsgrunnlag (EUR) | Tollverdi (EUR) | Tollverdi (NOK, demo-kurs) | Import-mva. (r_demo 25 %) | Kjøpsgrunnlag-status | Komplett? |
|---|---|---|---|---|---|---|
| S1 ingen dokumentert nettojustering | 100000.00 | 101350.00 | 1165525.00 | 291381.25 | komplett (syntetisk): brutto betalt, ingen justering | kjøpsgrunnlag og tollverdi kan vises (syntetiske antagelser); engangsavgift og total UAVKLART |
| S2 dokumentert nettoeksport, 19 % inkl. | 84033.61 | 85383.61 | 981911.52 | 245477.88 | komplett (SYNTETISK demobekreftelse) | som S1 |
| S3 dokumentert nettoeksport, 25 % inkl. | 80000.00 | 81350.00 | 935525.00 | 233881.25 | komplett (SYNTETISK demobekreftelse) | som S1 |
| S4 allerede annonsert netto 100 000 | 100000.00 | 101350.00 | 1165525.00 | 291381.25 | komplett kun hvis nettoen er bekreftet i dokumentert tilbud; ellers uavklart | som S1, men kjøpsgrunnlaget forutsetter bekreftelse |
| S5 marginbeskatning | — | — | — | — | UAVKLART | kan ikke vises |
| S6 uavklart mva. | — | — | — | — | UAVKLART | kan ikke vises |

Merknader:
- 100000/1,19 ≈ 84033,61 EUR og 100000/1,25 = 80000 EUR er **aritmetikk**, ikke tilbud eller verifiserte norske totalsummer. Ingen lokal sats bestemmes av land.
- «Import-mva. (r_demo)» bruker 25 % som en *syntetisk parameter*; satsen er ikke primærkontrollert (R-IMP-VAT-001). Grunnlagets sammensetning (om engangsavgift inngår) er ikke avklart, så kolonnen er **ikke** import-mva. slik den faktisk vil bli.
- S4 gir samme tall som S1 fordi ingenting trekkes ut; forskjellen er at S4 forutsetter bekreftet netto, ellers er den uavklart.
- S5 og S6 kan ikke vises: ingen tall oppdiktes.

## B. Biltyper (ellers samme scenario S2: dokumentert netto 19 %)

| Profil | Kjøpsgrunnlag S2 (EUR) | Tollverdi (NOK, demo) | Engangsavgift | Import-mva. | Total | Komplett? |
|---|---|---|---|---|---|---|
| Personbil bensin (PB-BEN) | 84033.61 | 981911.52 | IKKE BEREGNET – regler ikke primærkontrollert; krever: planlagt norsk registreringsdato (dato); første utenlandske registrering (dato med tilstrekkelig presisjon for bruksfradragstrinn); egenvekt (kg, norsk definisjon) … | kun syntetisk parameter 25 % | kan ikke vises | delvis (kjøpsgrunnlag og tollverdi) |
| Varebil diesel (klasse uavklart) (VB-DIE) | 84033.61 | 981911.52 | IKKE BEREGNET – regler ikke primærkontrollert; krever: planlagt norsk registreringsdato (dato); første utenlandske registrering (dato med tilstrekkelig presisjon for bruksfradragstrinn); egenvekt (kg, norsk definisjon) … | kun syntetisk parameter 25 % | kan ikke vises | delvis (kjøpsgrunnlag og tollverdi) |
| Elbil (personbil) (PB-BEV) | 84033.61 | 981911.52 | IKKE BEREGNET – regler ikke primærkontrollert; krever: planlagt norsk registreringsdato (dato); første utenlandske registrering (dato med tilstrekkelig presisjon for bruksfradragstrinn); egenvekt (kg, norsk definisjon) … | kun synthetic parameter 25 % (C3-014); for elbil avhenger den av uavklart fritaksgrense | kan ikke vises | delvis (kjøpsgrunnlag og tollverdi) |
| Ladbar hybrid (personbil) (PB-PHEV) | 84033.61 | 981911.52 | IKKE BEREGNET – regler ikke primærkontrollert; krever: planlagt norsk registreringsdato (dato); første utenlandske registrering (dato med tilstrekkelig presisjon for bruksfradragstrinn); egenvekt (kg, norsk definisjon) … | kun syntetisk parameter 25 % | kan ikke vises | delvis (kjøpsgrunnlag og tollverdi) |

**Hva kan være komplett:** kjøpsgrunnlag (A) og tollverdi (A), under syntetiske antagelser og en SYNTETISK demobekreftelse. **Hva er uavklart:** engangsavgift (alle profiler), bruksfradrag, import-mva. (sats/grunnlag/elbil-grense), fradragsbehandling og dermed de tre sluttresultatene (budsjettsum, økonomisk kost, kapitalbehov). Ingen av radene er en offisiell avgiftsfasit.

## C. De tre resultatene (kun definisjon her – se purchase-basis.md §6)
Retting i TAX-001B: tidligere formel «økonomisk kost = budsjettsum − fradrag pluss en ikke-fradragsberettiget del» er trukket tilbake (økonomisk kost er ikke en funksjon av valgfri budsjettsum, og ikke-fradragsberettiget mva. ligger allerede i brutto beløp).
1. **Budsjettsum til Norge** = Σ brutto `amountNok` for komponenter valgt i budsjettet (`includedInBudget`). Fradragsberettiget mva. trekkes **ikke** fra (DEC-030).
2. **Økonomisk anskaffelseskost** = Σ (`amountNok` − fradragsberettiget mva.) for komponenter som er reell kostnad (`includedInEconomicCost`), uavhengig av budsjettvalg; ukjent fradragsandel gir `not_calculated`.
3. **Betalings-/kapitalbehov** = Σ brutto betalinger; bekreftet og scenario-inndekning (refusjon, fradrag) vises separat.
Eksplisitt regnede syntetiske referanser: C3-031 … C3-038.
