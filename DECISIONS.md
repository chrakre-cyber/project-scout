# Beslutningslogg

Oppdatert 03.10.2026. «Vedtatt» gjengir produktvalgene i samtalen. «Arbeidsbeslutning» er konkretisering i denne pakken. Endringer gjøres som nye poster med lenke til erstattet beslutning; historikk slettes ikke.

| ID | Status | Beslutning | Begrunnelse / revurdering |
|---|---|---|---|
| DEC-001 | Vedtatt | Forhandler oppgir norsk salgspris | Unngår valuation-motor; vurder etter betalingsbevis |
| DEC-002 | Vedtatt | mobile.de er første mål-kilde; mock fra start | Tilgang er ekstern avhengighet; adapter tillater ny lovlig kilde |
| DEC-003 | Vedtatt | Maks 10 aktive agenter per firma | Avgrenser drift og prispakke; revurder ved bruksmønster |
| DEC-004 | Vedtatt | Priser, avgifter, bidrag og score beregnes med kode | AI brukes til annonseforståelse, ikke økonomisk fasit |
| DEC-005 | Vedtatt | Estimert transport fra tabell | Live-pris senere; alle linjer merkes med estimat/kilde/dato |
| DEC-006 | Vedtatt | Tre hovedskjermer og e-postvarsler | Fokus på innkjøpsflyten |
| DEC-007 | Vedtatt | Next.js, Supabase, n8n, én LLM og e-posttjeneste | Kontoer, kostnader og regioner er ikke etablert |
| DEC-008 | Vedtatt | GitHub blir fasit; én hovedutvikler per oppgave | Unngår motstridende filer og kodeendringer |
| DEC-009 | Vedtatt | 990 kr/mnd eks. mva., 30 dager gratis, manuell faktura | Hypotese til pilot; ingen Stripe i MVP |
| DEC-010 | Vedtatt | Ordinært bruksfradrag; ikke alternativ beregning | Avgrenser regelmotoren |
| DEC-011 | Arbeidsbeslutning | Dag 30 = pilotstart; evaluering etter 14 faktiske bruksdager | Pilot-KPI etter to uker kan ikke bevises på startdagen |
| DEC-012 | Arbeidsbeslutning | Bidrag og likviditetsbehov skilles; mva.-grunnlag må valideres | Tidligere retail minus kost-eksempler er utilstrekkelige som fasit |
| DEC-013 | Arbeidsbeslutning | Ukjent skatteprofil eller kritiske data gir ingen marginvarsel | Treff kan vises med kontrollbehov |
| DEC-014 | Arbeidsbeslutning | Fritekst-til-filtre er sekundær etter kjerneflyten | Strukturerte filtre dekker hovedbehovet |
| DEC-015 | Arbeidsbeslutning | Historiske annonse- og bildata beholdes bare hvis avtalen tillater det | «Data moat» er ikke en gitt bruksrett |
| DEC-016 | Arbeidsbeslutning | Ingen ekstern utvikler; tidsskala har buffer | Christian styrer AI-arbeid, oppsett og QA; AI-tid er ikke autonom levering |
| DEC-017 | Arbeidsbeslutning (03.10.2026, DEV-001) | Pengebeløp i domenet er heltall i minste valutaenhet (`amountMinor`) + ISO 4217-valuta | Oppfyller DATABASE_SCHEMA-kravet om én representasjon uten flyttall. DEV-002 bør bruke `bigint` minor units + valuta i migrasjonen; revurder hvis avgiftsregler krever høyere presisjon enn øre |

| DEC-018 | Arbeidsbeslutning (05.10.2026, DEV-003) | Appen støtter et uttrykkelig sett valutaer (NOK, EUR, SEK, DKK, CHF, GBP, PLN). Annonser i andre valutaer beholder kildens beløp som tekst; `amount` er `null`, og ingenting regnes om eller vises med gjettede desimaler | Løser DEV-001 review R1 uten FX. Settet kan utvides med ISO 4217-desimaler når en kilde krever det; FX-kilde er OPEN-005/DEV-009 |
| DEC-019 | Arbeidsbeslutning (05.10.2026, DEV-003) | Annonsefelt er bare kildens opplysninger. Brutto/netto krever ordrett belegg; mva.-påstander lagres som claimed/denied/unknown med belegg og opphav, og gir aldri prisgrunnlag eller fradragsrett | Konkretiserer CLAUDE.md pkt. 4 og PRODUCT_SPEC §7 i datamodellen. Scouts vurderinger hører til kalkylesnapshot (DEV-007) |

## Åpne avklaringer

| ID | Spørsmål | Eier | Frist / kobling | Effekt hvis uavklart |
|---|---|---|---|---|
| OPEN-001 | Godkjennes paid multi-dealer service, caching, bilder, varsler og LLM-behandling? | Christian | 07.10, BUS-001/BUS-002 | Reell markedspilot blokkert |
| OPEN-002 | Hva koster datatilgang, hvilke kvoter og hvilken forventet behandlingstid? | Christian | 07.10, BUS-002 | Budsjett og kjøreintervall åpne |
| OPEN-003 | Hvilke import-/salgsprofiler valideres først, og hvilke felter krever de? | ChatGPT + Christian | 10.10, TAX-001 | Marginmotorens pilotdekning åpen |
| OPEN-004 | Hvem verifiserer mva.-/salgsgrunnlaget mot offisielle regler og konkrete dealer-caser? | Christian + ChatGPT | Før QA-002 | Ekte marginvarsler blokkert |
| OPEN-005 | Lovlig datakilde for valutakurs, transportgrunnlag og kommersiell bruk? | Christian + ChatGPT | Før DEV-009 | Daterte manuelle forutsetninger i demo |
| OPEN-006 | Selskap som inngår API-avtale, fakturerer og er behandlingsansvarlig? | Christian | Før BUS-005 | Ekte pilot og avtaler blokkert |

## Ny beslutning — mal

ID / dato / status / eier / beslutning / begrunnelse / konsekvens / erstatter / hva som utløser revurdering.
