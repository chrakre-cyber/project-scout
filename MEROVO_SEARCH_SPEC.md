# Merovo — søk og innkjøpsbudsjett

Versjon 1.0 · 15. oktober 2026 · Oppgave SPEC-SEARCH-001 · Status: klar for gjennomgang, ikke implementert.

## 1. Formål og beslutninger

Forhandleren beskriver bilen kunden eller lageret trenger, og setter maksimal ønsket innkjøpskostnad til Norge. Merovo finner relevante biler og viser hvordan de passer kravene, ønskene og budsjettet.

Brukeren har avklart følgende retning i samtalen:

- mobile.de er hovedreferanse for søkets struktur, felter og betjening. Merovo bruker egen profil og norske begreper.
- Total innkjøpskostnad til Norge prioriteres foran ønsket norsk salgspris og margin.
- Budsjettet skal inkludere kjøpsgrunnlaget i lokal valuta, eventuell dokumentert reduksjon av lokal mva., omregning, norske avgifter og valgte tilleggskostnader.
- Transport, reise og andre relevante kostnader skal kunne legges inn av forhandleren.
- Forhandleren kan velge at biler inntil X prosent over budsjettet også skal vises og senere kunne utløse varsler.
- En mulig fremtidig FINN/VEND-kobling kan gi sammenlignbare norske annonser. Tilgang er uavklart. Annonsepriser er ikke dokumenterte salgspriser.

Detaljene under er konkrete implementeringsforslag. De innebærer ingen godkjenning av avgiftssatser, datatilgang, nye partnere eller publisering. Feltkatalogen er målbildet, ikke en påstand om dagens funksjoner.

## 2. Oppsett og betjening

Desktop bruker tydelige seksjoner med faste feltkolonner og synlige avkrysningsvalg, tilsvarende referansebildenes organisering. De sentrale feltene skal ikke skjules bak en meny for hvert enkelt valg. Lange utstyrslister kan ha «Vis flere» og et lokalt søk etter utstyr. På mobil stables feltene i leserekkefølge.

Seksjoner:

1. Bil og basisdata
2. Motor og tekniske data
3. Eksteriør og kjøreutstyr
4. Interiør og komfort
5. Tilstand, selger og kjøpsvilkår
6. Innkjøpsbudsjett til Norge
7. Oppsummering og lagring av søket

En fast oppsummering viser aktive kriterier, budsjett og slingringsmonn. Hvert filter kan fjernes enkelt. Den skal kunne betjenes med tastatur og ikke dekke felter, feilmeldinger eller lagreknappen på mobil. Fargevalg må også ha tekstetiketter. Vi viser ikke et oppdiktet antall markedstreff før en faktisk kilde har levert det.

## 3. Feltkatalog

Alle felt er valgfrie med mindre aktiveringskravene i seksjon 8 sier noe annet. «Alle» betyr ingen begrensning i søket. «Ikke oppgitt» gjelder manglende annonseverdi og er en annen tilstand.

### Bil og basisdata

| Felt | Betjening og betydning |
|---|---|
| Merke | Søkbar liste. Modeller avhenger av merke. |
| Modellserie / modell | Eksempelvis alle GLS eller en bestemt undergruppe. Stabile identiteter og provider-mapping kreves; ikke gjett modellfamilie fra delstreng. |
| Variant / utstyrspakke | Modellavhengig valg der kilden støtter det, ellers tydelig merket fritekst. Eksempel: AMG Line. Pakke og enkeltutstyr er separate kriterier. |
| Flere bilalternativer | Flere merke/modell-kombinasjoner i ett søk, foreslått som en senere utvidelse. Alternativene kombineres med ELLER. |
| Ekskluder bilalternativ | Senere utvidelse, synlig i oppsummeringen. Eksklusjon har forrang over inkludering. |
| Årsmodell | Fra–til, som egen opplysning. Må ikke utledes av registreringsåret. |
| Førstegangsregistrering | Fra–til med kildens presisjon. År, måned og dato beholdes uten oppdiktet presisjon. |
| Kilometerstand | Fra–til i km. Maksfelt er tilstrekkelig i første byggetrinn. |
| Karosseri | Sedan, stasjonsvogn, SUV, kombi, coupé, cabriolet, van og annet, med kontrollert kildekartlegging. |
| Seter | Fra–til. Eksakt antall kan angis med samme verdi i begge felter. |
| Dører | Valg fra kildekatalog, også «Alle». Skyvedør kan være en avansert detalj. |

### Motor og tekniske data

| Felt | Betjening og betydning |
|---|---|
| Drivstoff / drivlinje | Bensin, diesel, el, hybrid og ladbar hybrid. Hybridundergrupper, hydrogen og gass legges til som særskilte verdier bare med støttet mapping. |
| Girkasse | Automat, manuell, eventuelt halvautomat der kilden skiller dette. |
| Hjuldrift | Firehjulsdrift, forhjulsdrift og bakhjulsdrift. |
| Effekt | Fra–til, visning i hk eller kW. Én normalisert enhet, presis konvertering og dokumenterte grenseverdier. |
| Slagvolum, sylindre og tankvolum | Avanserte fra–til-felter med synlige enheter. |
| Vekt | Avansert felt. Den konkrete vekttypen må oppgis; egenvekt og tillatt totalvekt må ikke blandes. |
| Forbruk | Avansert maksimumsfelt med enhet og testmetode der tilgjengelig. Ikke bland liter/100 km og kWh/100 km. |
| Utslippsklasse | Separat fra CO₂ og testmetode. Ingen automatisk avgiftsberegning bare fra Euro-klasse. |
| Miljømerke / partikkelfilter | Markedsspesifikke, avanserte kildefelt. Tysk miljømerke er ikke det samme som utslippsklasse. |

CO₂, målemetode, avgiftsrelevant vekt og registreringsdato er også kalkyleinput. De trenger ikke alle være synlige søkefelter, men må finnes og være gyldige hvis beregningsprofilen krever dem.

### Eksteriør og kjøreutstyr

- Utvendig farge: flere tillatte farger. Metallic og matt lagres separat fra selve fargen.
- Hengerfeste: hvilket som helst, fast/avtakbart/svingbart, avtakbart/svingbart eller bare svingbart. Merovo må definere presis betydning for hvert valg.
- Minste tilhengervekt med brems, uten brems og minste kuletrykk er tre forskjellige kg-felter.
- Parkeringsutstyr: foran, bak, ryggekamera, 360-kamera, automatisk parkering og utkjøringsassistent.
- Cruisekontroll: vanlig eller adaptiv, med tydelig regel for om adaptiv oppfyller et generelt cruisekrav.
- Søkbar utstyrskatalog: blant annet luftfjæring, adaptivt understell, panoramatak, soltak, elektrisk bakluke, LED-/xenon-/laserlys, fjernlysassistent, blindsonevarsling, filholder, trafikkskiltgjenkjenning, vinterpakke, oppvarmet frontrute og hjulsett.

### Interiør og komfort

- Interiørfarge og materiale som separate valg: skinn, delskinn, kunstskinn, stoff, Alcantara, velur og annet når kilden beskriver dette.
- Klima: klimaanlegg, automatisk klima og antall soner. Foreslått regel: et minimum på to soner kan oppfylles av tre eller fire; eksakt antall må være et eget valg hvis ønsket.
- Seteutstyr: elektriske seter, minne, setevarme foran/bak, ventilasjon, massasje og sportsseter.
- Annet utstyr: rattvarme, head-up-display, CarPlay, Android Auto, DAB, navigasjon, lydanlegg, trådløs lading, Isofix, parkeringsvarmer, nøkkelfri adgang og digitalt instrumentpanel.
- Airbagnivå, rattplassering og spesialinnredning kan ligge blant avanserte valg.

Utstyrsnavn må ha stabile interne nøkler, norske etiketter og sporbar mapping fra kilden. En utstyrspakke beviser ikke automatisk at alle enkeltfunksjoner finnes. Kildeutsagn om utstyr vises som oppgitt, ikke som fysisk kontrollert.

### Tilstand, selger og kjøpsvilkår

| Felt | Forslag til valg / regel |
|---|---|
| Ny / brukt | Alle, ny, brukt. |
| Skadestatus | Alle, ekskluder oppgitt skadede, bare oppgitt skadede. Ukjent er ikke «skadefri». |
| Servicehistorikk | Oppgitt historikk, ny service eller andre klart definerte kildeverdier. |
| Garanti / sertifisering | Garanti og navngitt bruktbilprogram er separate kriterier. Katalogen avhenger av kilde og marked. |
| Tidligere eiere | Maksimumsantall. |
| Tidligere bruk | Demo, taxi, utleie og lignende der dette er oppgitt. Registreringstype er ikke nødvendigvis tidligere bruk. |
| Kontroll gyldig til | Valgfritt. Tysk HU/TÜV må ikke omtales som norsk EU-godkjenning. |
| Selgertype | Forhandler, privat eller firma der kilden skiller disse. |
| Lokasjon | Land først. Postnummer/radius senere der data og kilde støtter det. |
| Mva. oppgitt i annonsen | Alle, mva. spesifiserbar, mva. ikke spesifiserbar. Ukjent beholdes særskilt. |
| Næring / eksport-import | Kildeklassifisering, ikke bekreftelse på at bilen kan kjøpes netto eller importeres. Forklaring kreves før feltet tilbys. |
| Annonsens alder | Siste 1, 3, 7 eller 14 dager, hvis kildens publiseringstid er tilgjengelig. «Ny i Merovo» er en separat tid. |
| Søk i annonsetekst | Supplerende fritekst. Ingen automatisk bekreftelse av strukturerte krav. |
| Selgervurdering, bilder og video | Sekundære felt som bare tilbys når kilde og bruksrett tillater det. |

## 4. Absolutte krav og ønsker

Foreslått standard: bilidentitet, intervaller og uttrykkelige kjøpsvilkår er absolutte krav. Utstyrsvalg merkes som «må ha» når de velges, med mulighet for å endre dem til «ønskelig». Dette er et designforslag som skal synliggjøres i skjemaet, ikke skjult prioritering.

- Innenfor samme valgliste betyr flere farger, drivstoff eller karosserier ELLER.
- Mellom ulike krav gjelder OG. Alle utstyrselementer markert «må ha» må være oppfylt.
- Kjent brudd på et absolutt krav gir ikke treff. Prisavvik kan aldri oppheve et slikt krav.
- Manglende verdi for et absolutt krav gir «Må kontrolleres», ikke bekreftet treff og ikke automatisk kjøpsvarsel.
- Ønsker påvirker rekkefølge og forklaring, men ekskluderer ikke bilen. Resultatet viser oppfylt, ikke oppfylt og ikke oppgitt separat. Ukjent teller ikke som oppfylt.
- Hvis kilden ikke kan forhåndsfiltrere et felt, kan Merovo vurdere det etter henting når data finnes. Ingen stille bortfall av filtre.
- Hvis feltet verken kan hentes eller vurderes, skal dette opplyses før aktivering. Et ukjent, påkrevd kriterium må aldri annonseres som støttet og bekreftet.

Ingen avansert scoremodell eller automatisk verdsetting innføres i denne oppgaven. Foreslått første rekkefølge er: fullstendige treff innenfor budsjett, fullstendige treff innenfor valgt prisavvik, deretter kontrollbehov i egen gruppe. Innen gruppene vises ønsker og kostnad som eksplisitte sorteringsvalg, med stabil ID som siste sorteringsnøkkel.

## 5. Innkjøpsbudsjett til Norge

Primærfeltet heter **«Maks innkjøpskostnad til Norge, inkl. beregnede norske avgifter»**, i NOK. Hjelpeteksten lister hva som inngår. Første modell bruker en sammenligningssum inklusive beregnet norsk import-mva. slik brukeren har bedt om. Dette er en budsjettsum, ikke nødvendigvis endelig økonomisk kostnad eller kontantutlegg ved grensen.

Kalkylen viser separate linjer for:

1. Annonsepris og valuta med kildens oppgitte brutto/netto-grunnlag.
2. Dokumentert kjøpsgrunnlag for eksport. Eventuell lokal mva.-justering krever belegg; avgift trekkes ikke fra en netto pris en gang til.
3. Valutakurs og eventuelt valutapåslag, med kilde, dato og versjon.
4. Transport og forsikring, med nødvendig skille mellom utenlandsk og norsk strekning.
5. Reise/henting og andre kostnadslinjer valgt av forhandleren.
6. Norsk import-mva., engangsavgift og øvrige relevante avgifter etter en validert profil. Rekkefølge og grunnlag bestemmes av profilen; dette er ikke en enkel, universell prosentsum.
7. Eventuell klargjøring og registreringskostnader som er valgt inkludert.
8. Samlet budsjettsum, avvik i NOK/prosent, økonomisk kostnad etter eventuell dokumentert fradragsrett og separat betalings-/likviditetsoversikt når denne kan beregnes.

For hver egendefinert kostnad kreves navn, beløp, valuta, mva.-grunnlag og om den inngår i budsjettet. En kostnad som ikke gjelder velges uttrykkelig bort eller settes uttrykkelig til 0. Tomt er ukjent. Pakkepriser merkes med hva de inkluderer for å unngå dobbelttelling.

Forhandleren kan ønske netto eksportkjøp, men dette er ikke et bevis på at det er mulig for en bestemt bil. Ubekreftet kjøpsgrunnlag eller manglende avgiftsinput gir «Totalkostnad ikke avklart» med mangelliste. Ingen grønn budsjettstatus eller kostnadsbasert varsel før alle nødvendige deler er avklart. Manuelle beløp merkes som manuelle med dato/opphav og er ikke en godkjent avgiftsprofil.

Satser, fradragsrett, toll-/avgiftsgrunnlag og kjøretøydekning fastsettes ikke av dette dokumentet. TAX-001/TAX-002 og uavhengige referanser kreves før beregningsmotoren gir virkelige budsjettreff. Inntil da kan syntetiske beregningseksempler demonstreres, tydelig merket som slike.

## 6. Prisavvik og varsling

«Vis også biler inntil X % over budsjettet» er valgfritt og avslått som standard. Brukeren skriver prosenten selv. Foreslått teknisk grense er 0–100 % med opptil to desimaler; grensen er et implementeringsforslag, ikke et avtalt prisvalg.

Eksempel som kun illustrerer budsjettgrenser:

| Budsjett 750 000 kr, valgt avvik 10 % | Status |
|---|---|
| Total ≤ 750 000 kr | Innenfor budsjett |
| 750 000 kr < total ≤ 825 000 kr | Over budsjett, innenfor valgt avvik |
| Total > 825 000 kr | Utenfor valgt prisgrense |
| Total ukjent / uvalidert | Totalkostnad ikke avklart |

Lik øvre grense er inkludert. Grensebeløp beregnes deterministisk i øre; aldri flyttallsavrunding som slipper en bil over grensen inn. Avvik lagres som basispunkter. Ved deling til en hel øregrense rundes tillatt maksimum ned, slik at den avtalte prosenten ikke overskrides. Visningsavrunding endrer ikke beslutningen.

Visning og varsling er egne innstillinger. Et senere valg «Varsle også innenfor prisavviket» krever at avvik er aktivert. Varsler krever ellers fullstendige beregninger, oppfylte absolutte krav, gyldige rettigheter og avtalte mottakere. Ingen e-post eller tidsstyrt søk bygges bare ved å legge til disse innstillingene. Varslingsløsningen beholder krav til deduplisering og idempotens.

## 7. Resultatkort og forklaring

Kortet viser bil, kilde, relevante spesifikasjoner og lenke til originalannonsen når datatilgang tillater det. I tillegg:

- «Innenfor budsjett», «8 % over budsjett» eller «Totalkostnad ikke avklart».
- Beregnet budsjettsum og klikkbar oppdeling, med dato på beregningsgrunnlaget.
- Absolutte krav og ønsket utstyr med forklaring på eventuelle ukjente data.
- Kildeoppgitt mva.-status og separat status for bekreftet eksportpris.
- Kostnader som ikke inngår i budsjettet, synlig i oppsummeringen.

Sammenlignbare FINN-annonser er fremtidig avtalebetinget arbeid. Ingen automatisk «norsk markedsverdi», salgsprisfasit eller marginpåstand utledes fra dem.

## 8. Lagring, aktivering og eksisterende søk

Målbildet for aktivering erstatter kravet om forventet norsk salgspris og positivt minimumsbidrag. Det krever søkenavn, et tilstrekkelig avgrenset bilsøk og positivt innkjøpsbudsjett i NOK. Den eksisterende grensen på ti aktive søk per firma beholdes.

Aktivering betyr at kjøretøysøket kan kjøres. En ufullstendig kalkyle hindrer budsjettklassifisering og kostnadsvarsler, men skal ikke hindre at forhandleren ser relevante biler med tydelig kontrollbehov. Dette må fremgå før aktivering.

Teknisk overgang må planlegges som egen implementering:

- Versjonert søkeskjema og snapshot. Skill kjøretøykrav, ønsker, budsjett, kostnadsforutsetninger og varslingsvalg.
- Nye felter må valideres i UI, på server og i databasen der de lagres. Sikkerhet og atomisk agentgrense bevares.
- Nye migrasjoner, ikke redigering av eksisterende anvendte migrasjoner. Oppdater også hvitelistene for resultat-snapshots og rettighetsprojeksjon før nye providerfelter lagres.
- Gamle søk og kjøringer beholdes med opprinnelig versjon. En gammel annonseprisgrense i EUR må ikke konverteres til nytt totalbudsjett i NOK uten brukerens valg.
- Historiske søkeresultater omtolkes ikke. Ved oppgradering av et gammelt søk vises eksisterende kriterier, og forhandleren må angi nytt budsjett før det aktiveres med den nye modellen.
- Ingen automatisk pause/sletting av gamle søk i en migrasjon uten en uttrykkelig overgangsplan. Første nye skjema kan være et separat utkast til overgang og aktivering er verifisert.
- Rettighetsprofil, versjon, utløp, firmaskille og betrodd skrivevei gjelder fortsatt. Kalkylesnapshots må omfattes av avklarte lagringsrettigheter; ingen implisitt ubegrenset lagring av avledede data.

## 9. Avvik fra dagens kode

Gjennomgått kode i project_scout_DEV_005B per 15. oktober:

| Dagens løsning | Endring som trengs |
|---|---|
| Ett merke/modell/variant per søk | Behold først; flere alternativer krever nytt schema og matching. |
| Årsfilter sammenligner førsteregistreringsår | Skill modellår og registrering, og merk eksisterende søk korrekt. |
| Kilometergrense, drivstoff, gir, karosseri og land | Utvid med avklarte felter og kildeegenskaper. |
| Farge finnes på annonsetypen, men ikke som søkefilter | Legg til validering og matching; manglende farge skal være ukjent. |
| Effekt og vekt finnes delvis på annonsetypen | Verifiser semantikk/enheter før nye søkefelter. |
| Ingen strukturert utstyrsmatching/setefilter | Nye annonsefelter, kriterier, syntetiske fixturer og resultat-snapshots. |
| Maks annonsepris i samme valuta | Eget totalbudsjett i NOK med uavhengig beregningsstatus. |
| Retail, minimumsbidrag og reserve kreves for aktivering | Endre krav i både server og database etter ny produktbeslutning. |
| Matching: match / needs_review / excluded | Behold kjøretøyutfallet, legg til separat budsjettutfall og ønskeforklaring. |

Ingen av endringene i denne tabellen er implementert av spesifikasjonsoppgaven.

## 10. Foreslått byggeorden og ferdigkriterier

**SEARCH-001A — søkeskjema og feltmodell:** Lag en lokal, interaktiv forhåndsvisning i Merovo-profil med hovedseksjonene, synlige utstyrsvalg, faste oppsummeringer og brukerens GLS-eksempel. Deretter implementeres versjonerte typer, validering og syntetiske felter for prioriterte krav. Ingen virkelige beregningspåstander eller dummy-markedstrefftall.

**SEARCH-001B — lagring og matching:** Planlegg og gjennomfør ny migrasjon, søkeversjoner og kontrollert overgang. Oppdater server, RLS-relevante kontroller, provider-kontrakt, matching og snapshots samlet. Historiske data bevares.

**COST-001 — budsjettmotor:** Avklar første importprofil og uavhengige referanser før beregning. Implementer kostnadslinjer, avgiftsprofiler og eksakte budsjettgrenser uten å introdusere salgspris/marginkrav.

**SEARCH-001C — videre felt og varsler:** Flere modellalternativer, avanserte felt og automatiske varsler kommer når grunnlag, datatilgang og avhengigheter er klare. Ikke nye eksterne tjenester som bieffekt.

Kontroller som kreves i implementeringen:

1. GLS-eksempelet kan angis uten forventet salgspris eller margin.
2. AND/OR og krav/ønsker fungerer likt i skjema, provider og domene; ukjent blir ikke bekreftet.
3. Modellår og registreringsår blandes ikke. Intervaller og enheter testes ved grenser og manglende presisjon.
4. Utstyrsukjent skiller seg fra eksplisitt manglende utstyr. Pakkenavn gir ikke oppdiktede egenskaper.
5. Et dokumentert nettokjøp belastes ikke lokal mva. to ganger. Ubekreftet mva. gir ikke oppdiktet total.
6. Kostnader inkluderes én gang. Valutakurs, beløpspresisjon, avrunding og datakilder er sporbare.
7. 750 000/825 000-grensene testes på grensen, ett øre under og ett øre over. Ukjent kostnad får ingen budsjettklassifisering.
8. Prisavvik slipper ikke gjennom et kjent brudd på et absolutt bilkrav.
9. Eksisterende søk, versjoner, firmaskille, maks ti aktive og betrodd skrivevei bevares i oppgraderingstest.
10. Desktop, mobil, tastatur, feilmeldinger og oppsummering er kontrollert. Lagret søk kan lastes inn igjen uten endring av betydning.

## 11. Referanser og begrensninger

Primært visuelt grunnlag er brukerens opplastede mobile.de-skjermbilder i samtalen 15. oktober 2026. De dekker hovedseksjoner, utstyr og flere åpne nedtrekksmenyer. Menyene for alle modeller, land og sertifiseringer er ikke fullstendig dokumentert; ingen uttømmende datakatalog hevdes.

- mobile.de detaljsøk: https://www.mobile.de/s/auto
- FINN bilsøk som sekundær referanse: https://www.finn.no/mobility/search/car
- Eksisterende kode: src/domain/types.ts, matching.ts og aktiveringsmodellen, med prosjektets PRODUCT_SPEC, ARCHITECTURE, DATABASE_SCHEMA, IMPORT_ENGINE_SPEC og DECISIONS som bakgrunn.

Dette dokumentet er et produkt- og implementeringsgrunnlag. Det bekrefter ikke API-støtte, databruksrettigheter eller skatteregler. Ingen live scraping, avtale, utsending eller ekstern integrasjon er utført.
