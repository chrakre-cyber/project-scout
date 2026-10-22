# Transkripsjon og proveniens

## Dato og gjennomføring

- Oppgitt operatør: Christian, som leverte bildene og bekreftet gjennomføringen i samtalen. Ingen separat identitetskontroll.
- Kjøredato: 18.10.2026, uttrykkelig bekreftet av brukeren.
- Automatisk beregningsdato/norsk registreringsdato: 18.10.2026 ifølge brukerens forklaring om at dagens dato brukes og feltet ikke kan velges. Ikke synlig i bildene.
- Eksakt klokkeslett: ukjent.
- Verktøy: Skatteetatens importkalkulator, oppgitt gjennom samtalekonteksten. Bildene viser kalkulatortittelen «Regn ut hva det koster å importere bil til Norge» i EV-inputbildet. Adresselinje og eksakt URL/versjon er ikke dokumentert.
- Referanseomfang: explicit_inputs. Kjøretøynavn er testetiketter fra oppdraget; VIN, variant og teknisk dokumentasjon foreligger ikke.
- Skjermbildenes opprinnelige utsnitt er bevart. Ingen ytterligere beskjæring eller redigering er gjort i pakken.

## 1 – ladbar hybrid / Urus som testetikett

Inputbildet viser personbil, ladbar hybridbil, brukt kjøretøy Ja, registrert i utlandet 01.09.2026, oppgitt CO₂ Ja, 140 g/km, WLTP, innkjøpspris 600 000 NOK, bensin og egenvekt 2 610 kg. Bildet slutter ved egenvekt; alternativ beregning er ikke synlig.

Første resultatbilde viser avgift 529 069,00, innkjøpspris 600 000,00, mva. 150 000,00 og sum 1 279 069,00 NOK.

Det senere nedbrytningsbildet viser en annen innkjøpspris: 2 600 000,00. Vrakpantavgift er 2 400,00, engangsavgift vist med to desimaler er 526 669,74, total i avgifter 529 069,00, mva. 650 000,00 og totalpris 3 779 069,00 NOK.

Dette er to dokumenterte prisversjoner. Det finnes ikke et nytt fullstendig inputbilde til pris 2 600 000. Ikke registrer alle bildene som én uendret inputtilstand eller anta at ingen andre felt ble endret.

## 2 – elbil / BMW iX3 som testetikett

Inputbildet viser personbil, Elbil - personbil, brukt kjøretøy Ja, registrert i utlandet 01.08.2023, innkjøpspris 350 000 NOK og egenvekt 2 185 kg. Alternativ beregning (valgfritt) vises uten utfylt verdi. CO₂-felt er ikke vist og skal ikke registreres som observert 0 fra skjermbildet.

Første resultatbilde viser avgift 16 748,00, innkjøpspris 350 000,00, mva. 12 500,00 og sum 379 248,00 NOK.

Det senere nedbrytningsbildet viser en annen innkjøpspris: 300 000,00. Vrakpantavgift er 2 400,00, engangsavgift vist med to desimaler er 14 348,95, total i avgifter 16 748,00, mva. 0,00 og totalpris 316 748,00 NOK.

Dette er to dokumenterte prisversjoner. Det finnes ikke et nytt fullstendig inputbilde til pris 300 000. Ikke anta at alle øvrige felt var uendret.

## 3 – diesel / Mercedes E 400 d som testetikett

Inputbildet viser personbil, Bensin/dieselbil, brukt kjøretøy Ja, registrert i utlandet 01.11.2023, oppgitt CO₂ Ja, 179 g/km, WLTP, innkjøpspris 350 000 NOK, diesel og egenvekt 1 976 kg.

Resultatbildet viser Alternativ beregning (valgfritt) uten utfylt verdi, avgift 333 723,00, innkjøpspris 350 000,00, mva. 87 500,00 og sum 771 223,00 NOK.

Nedbrytningen viser vrakpantavgift 2 400,00, engangsavgift med to desimaler 331 323,97, total i avgifter 333 723,00, innkjøpspris 350 000,00, mva. 87 500,00 og totalpris 771 223,00 NOK.

## Sammenstilling

| Test | Engangsavgift vist | Vrakpant vist | Total avgift vist | Tidligere forventet total |
| --- | ---: | ---: | ---: | ---: |
| 1 PHEV | 526 669,74 | 2 400,00 | 529 069,00 | 529 069 |
| 2 EV | 14 348,95 | 2 400,00 | 16 748,00 | 16 748 |
| 3 diesel | 331 323,97 | 2 400,00 | 333 723,00 | 333 723 |

Alle viste avgiftstotaler samsvarer numerisk med de tidligere forventningene. Dette er en sammenligning av skjermbildeverdier, ikke en selvstendig kjøring av repoets motor eller godkjenning av dens implementering.

To-desimalsvisningen dokumenterer ikke intern presisjon eller mellomavrunding. Ingen bilder viser lenken «Engangsavgiften består av» åpnet med full komponentberegning. Bruksfradragsprosent og satser er ikke synlige. CO₂-feltbetegnelsene «vektet kombinert» og «kombinert» er testintensjon, ikke eksplisitte etiketter i bildene. Ikke utled skjulte input, mellomledd eller avrundingsregler fra resultatsamsvaret.
