# ECON-004 – konsolidert implementeringsreview

Commit: `dc97f04349aba52a02cf8536ab5e4c98c24f3a97`.

**Konklusjon:** B1 er kontrollert uten nye funn. Ett P2-funn i økonomikjernens samlede håndtering av ukjent provisjon hindrer avslutning som estimat-/scenariomotor. ECON-004 beholdes på REVIEW. Ingen regel, produktkonvensjon eller økonomiflagg godkjennes.

## P2: Ukjent om provisjonen inngår i prisen kan gi en for høy nedre grense

Fil: `src/domain/economics/landed-cost.ts`, linje 388, grenen `paidSeparatelyFromPrice === null`.

Grenen markerer input som uavklart og hopper videre. Den utelater en eventuell tilleggskostnad, men tar ikke hensyn til at provisjonen kan være en innkjøpsprovisjon som allerede ligger i kjøpesummen og kan skilles ut av tollverdien. Dermed blir den beregnede mva.-grensen for høy for en gyldig fullføring.

Reproduksjon: diesel, kjøpesum 100 000 NOK, transport til innførselsstedet 8 000, øvrige relevante kostnader uttrykkelig ikke aktuelle/0. Innkjøpsprovisjon 3 000 NOK med `deductionConditionsMet: true`. Bare `paidSeparatelyFromPrice` endres mellom radene. Avgift 333 723 NOK. Syntetisk godkjente økonomiflagg og half-up brukes for å isolere feilen; dette er ikke en godkjenning av registerprofilen.

| Betaling av provisjon | Mva. | Brutto total | Økonomisk kost, non_recoverable |
|---|---:|---:|---:|
| Ukjent (`null`) | **27 000, lower_bound** | **468 723, lower_bound** | **468 723, lower_bound** |
| Allerede i prisen (`false`) | 26 250 | 467 973 | 467 973 |
| Betalt separat (`true`) | 27 000 | 471 723 | 471 723 |

Den oppgitte nedre grensen overstiger altså en støttet fullføring med 750 NOK. `incomplete`-status alene gjør ikke grensen gyldig. Ved recoverable er mva.-grensen også feil, selv om mva.-effekten da ikke øker økonomisk kost.

**Retting:** Ta hensyn til begge betalingsmåter ved beregning av nedre grenser. Ved ukjent rolle/vilkår må relevante fradragsmuligheter også bevares. Behold usikkerhet og kontroller mot ugyldige beløp, uten å dobbelttelle kostnad eller behandle en ukjent betaling som bekreftet inkludert. Hvis en trygg beløpsgrense ikke kan beregnes, bruk ikke-beregnet-kontrakten. Test alle relevante fullføringer, flere poster og avrundingslikhet.

Reviewers regresjonstester: `economics-consolidated-review-regressions.test.ts` (kopieres til `tests/` slik at fixtureimporten løses). Begge tester feiler på den reviewede koden, for recoverable og non_recoverable. Ingen eksisterende forventning er endret.

## B1 og øvrig gjennomgang

- Datoperioden kontrolleres uavhengig av kursgren. Utenfor 2026 er mva., oppgjør og totaler ikke beregnet; mva.-grunnlag er null.
- De 18 B1-testene består. Egne grenseprøver ved 2025-12-31, 2026-01-01, 2026-12-31 og 2027-01-01 bekrefter kontrakten.
- Tidligere rettinger av beløpsrepresentasjon og fradrag ved avrundingslikhet består fortsatt i reviewers direkte kjøringer, inkludert de tidligere 3 600 sammenligningene. Disse avgrensede prøvene dekket ikke ukjent betalingsmåte; de er ikke bevis for alle mulige fullføringer i hele API-et.
- Samlet kodegjennomgang omfatter pris/utenlandsk mva., kursnormalisering og datoer, transport/forsikring, kostnader og importavgifter, provisjon, avgiftsadapteren, elbilscenarioer, mva.-oppgjør, totaler, status og avrundingsfunksjoner.
- Ingen juridisk kildegodkjenning er utført. Restpunktet for tollkursregimet før 3.9.2026 er ikke godkjent av B1.

## Uavhengig kjørte kontroller

- **168 manifestoppføringer:** SHA-256 stemmer.
- **Vitest:** ni leverte testfiler, 189 tester bestått. Dette omfatter alle leverte `economics-*`-testfiler før reviewers nye test samt `econ-golden-fixtures.test.ts`.
- **Nye reviewer-tester:** to tester kjørt, begge feiler og reproduserer P2-funnet.
- **Typecheck:** bestått med en avgrenset reviewkonfigurasjon som inkluderer økonomikjernen, avgiftsmotoren, økonomitestene og deres importerte fixturer. Pakken mangler andre appmoduler, så dette er ikke full repo-typecheck.
- **ESLint:** exit 0 for økonomikjernen og de ni leverte testfilene. Next-regelen ga melding om at appens pages-mappe ikke finnes i den partielle pakken.
- **Egne direkte kjøringer:** B1-grenser, tidligere regresjoner, 3 600 avgrensede nedre-grense-sammenligninger og den nye provisjonsreproduksjonen.

Eksisterende lokale avhengigheter ble brukt, inkludert Vitest 5.0.3. Ingen ny installasjon eller ren `npm ci` er utført. Reviewkonfigurasjon og nye tester ligger bare i den utpakkede reviewkopien; produksjonskode er ikke endret.

Ikke kjørt: fullt repo med 970 tester, full app-typecheck/lint, check-docs mot komplett kildearkiv, build, e2e eller DB. Utviklerens oppgitte kontroller er fortsatt separat belegg. Kildearkivene er ikke revalidert som del av denne implementeringsreviewen.

## Neste steg

Rett P2-funnet og lever en avgrenset rettingspakke. Denne konsoliderte reviewen kan da gjenbrukes sammen med rettingsreviewen; en ny full dokumentasjonsrunde er ikke nødvendig uten ytterligere endringer. Etter lukking kan avgrenset avslutning av ECON-004 og oppstart av ECON-005a vurderes, fortsatt uten å godkjenne økonomiflaggene.
