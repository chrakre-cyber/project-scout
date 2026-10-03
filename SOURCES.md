# Kilder og avklaringer

Kontrolldato: 03.10.2026. Offentlige primærkilder er brukt for de kritiske API- og avgiftsforutsetningene. Lenker er dokumentasjon, ikke vår kommersielle avtale eller bevis på en implementert motor. Kilder må kontrolleres på nytt ved regelårsskifte eller leverandørendring.

| ID | Primærkilde | Hva den støtter | Hva den ikke avklarer |
|---|---|---|---|
| S01 | [mobile.de API overview](https://services.mobile.de/manual/index.html) | API-account og aktivering; dealer-account for egen inventory | Tillatelse og pris for Scout som paid multi-dealer service |
| S02 | [mobile.de Search API](https://services.mobile.de/docs/search-api.html) | Search/detail, auth, media type, paginggrense og reference data | Vår kvote, faktisk feltdekning eller kontovilkår |
| S03 | [Skatteetaten: andre importavgifter](https://www.skatteetaten.no/person/avgifter/bil/importere/andre-avgifter/) | Generelt tollverdigrunnlag, import-mva., vrakpant- og klimagassavgift | Full forhandler-/elbil-/salgsprofil |
| S04 | [Skatteetaten: bruksfradrag](https://www.skatteetaten.no/person/avgifter/bil/importere/engangsavgift/bruksfradrag/) | Ordinær versus alternativ metode og aldersreduksjon | Komplett engine-regelsett eller våre testresultater |
| S05 | [Mva.-håndboken, kapittel 8](https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-8/MVA2025_M-8-3) | § 8-4-unntak for videresalg og behov for eksplisitt fradragsbehandling | Den enkelte forhandlers dokumentasjon og transaksjonsprofil |
| S06 | [Mva.-håndboken, kapittel 6](https://oppslag.rettskilder.skatteetaten.no/rettskilder2/type/handboker/merverdiavgiftshandboken/gjeldende/MVA2025_M-6) | Importørens salg av bruktimportert bil versus bruktbil tidligere registrert i Norge | Alle særtilfeller eller full beregning av salgsavgiftsgrunnlag |
| S07 | [Skatteetatens importkalkulator](https://www.skatteetaten.no/person/avgifter/bil/importere/regn-ut/) | Referansepunkt for import-/registreringsavgifter | Dealer-bidrag, fradragsrett, transporttilbud eller valutahandelskost |
| S08 | [Skatteetaten: mva. ved import](https://www.skatteetaten.no/bedrift-og-organisasjon/avgifter/mva/utland/import/) | Videre avklaringspunkt for importbehandling | Betalingsforløpet i den konkrete dealer-casen |

## Klassifisering av innhold i pakken

**Kontrollerte fakta:** avgrensede forhold dokumentert av kildene over.

**Prosjektbeslutninger:** 10 agenter, én første kilde, egne retail-estimater, tre skjermer og foreslått stack/prispakke. Disse kommer fra samtalen, ikke fra markedsdata.

**Arbeidsanslag/hypoteser:** tidsbruk, budgettak, 990-kroners betalingsvilje, pilot-KPI og SWOT. Ingen av dem er validert av denne dokumentleveransen.

**Åpne avklaringer:** API-pris/rettigheter, konkrete 2026-regelprofiler, kurskilder, transportpriser, fradragsrett og salgsgrunnlag. Det er bevisst ikke lagt inn oppdiktede satstabeller eller feltmapping.

Teknisk stack er valgt som prosjektretning. Kontoer, produktnivåer, priser, regioner og pakkeversjoner må avklares når de faktisk opprettes; tidligere omtale av gratis/lave priser skal ikke brukes som budsjettfasit.
