# TAX-001B — hendelsesdatoer: hvilken dato styrer hvilken komponent

Status 15.10.2026. «E1» = lest i kildepakken (T03 rundskriv 2026, T07, T20, T21, T22); «uavklart» = ikke lest eller ikke avgjort. Regelversjon velges **per komponent** etter komponentens egen hendelsesdato, ikke etter én felles «planlagt registreringsdato».

| Komponent | Styrende hendelse / dato | Belegg | Status |
|---|---|---|---|
| Engangsavgift – plikt | Første gangs registrering i Kjøretøyregisteret (stortingsvedtaket § 1; forskrift § 1-2) | T03 2.1.1 | E1 |
| Engangsavgift – satstabell (vekt/CO2) | Hvilken satsversjon som gjelder ved registrering nær årsskifte eller ved endring i året | stortingsvedtaket §§ 2–3 (T04) ikke lest; påstått endring 1.9.2026 = **uavklart kildeopplysning U-001** | uavklart |
| Engangsavgift – CO2-målemetode (NEDC/WLTP) når metode er ukjent | Dato for første gangs registrering **i utlandet** (før 1.9.2018 → NEDC-behandling) | T03 3.2.5 | E1 |
| Engangsavgift – grunnlagsdata | Statens vegvesens godkjenning/enkeltgodkjenning; obligatorisk før beregning og forhåndsbetaling | T03 3.1, 3.2.1 | E1 |
| Bruksfradrag – alder | Fra første gangs registrering i utlandet til registrering i Norge, **dato til dato** | T03 4.2; T07 | E1 (måneds-/dagsgrenser: uavklart U-002) |
| Bruksfradrag – 20-årstrinn | 1. januar i det året det har gått 20 år siden første gangs registrering | T03 6.21 | E1 |
| Vrakpantavgift | Første gangs registrering; betales sammen med engangsavgiften | T03 3.4; T20 | E1 |
| Vrakpantutbetaling | Skroting – ikke del av importkostnad | T09 | E1 (utenfor beregning) |
| Import-mva. – innbetaling | Innførsel: deklarasjon og betaling til Tolletaten ved grensen (privatperson-side) | T21 | E1 (kun betalingsrekkefølge) |
| Import-mva. – grunnlag/tollverdi | Kjøpesum + frakt + forsikring til norsk grense (nylig kjøpt bil) | T21 | E1 (overordnet); detaljer ikke lest |
| Tollkurs | Hvilken dato Tolletatens kurs hentes fra (deklarasjon eller frigivelse) | T10 ikke lest | uavklart (R-IMP-FX-001) |
| Mva.-sats/elbilfritak | Datoen mva.-regelen skal anvendes mot (innførsel); fremtidig nedtrapping | T14 ikke lest | uavklart (R-IMP-VAT-003) |
| Inngående mva.-fradrag | Mva.-oppgjør/termin og dokumentasjon hos importøren | T22 (2025-utgave) dekker ikke terminvalg | uavklart |
| Utenlandsk mva./nettofaktura | Leveringsdato/fakturadato i selgerland | T16/T17 ikke lest | uavklart |

## Konsekvenser for kontrakten (forslag til TaxInputV1, ikke implementert)
- `events.firstRegistrationAbroad` (dato, presisjon), `events.importDeclaration` (dato), `events.customsValuation`/`fx.customsRateDate` (dato), `events.norwegianRegistration` (dato), `events.enkeltgodkjenning` (dato, valgfri).
- `ruleSetSelection` per komponent: `{component, governingEvent, ruleSetId, version}`. Mangler hendelsesdato → komponenten blir `not_calculated`, aldri antatt lik en annen dato.
- Import- og registreringsdato kan ligge i ulike regelperioder (f.eks. innførsel i desember, registrering i januar). Kontrakten må tillate dette; ingen sats velges før hendelsesdatoen er kjent og regelkilden er lest.
