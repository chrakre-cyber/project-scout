# ECON-005c – uavhengig review

Commit: `c1295cf520de0108d78d32d03bd116c54effa8bd`.

**Konklusjon: Fire P2-funn i adapter-/servergrensene. Behold 005c på REVIEW og stopp før 005d/ECON-006.** Ingen av funnene innebærer at dagens falske økonomiflagg er omgått eller at produksjonen gir validated-budsjettreff. De gjelder likevel riktigheten og rettighetskontrollen i det nye estimatsporet.

## P2-1: Annonse og kandidat kan blandes uten at forhandlerbekreftelsen forkastes

Fil: `src/server/search-economics.ts`, `assessEconomics()`, bindingen rundt linje 104 og adapterkallet.

Bindingen kontrolleres mot req.candidate, men beregningen leser req.listing. Det finnes ingen kontroll av at de to faktisk gjelder samme annonse. Med en bekreftelse for ad-1, korrekt kandidat-id for ad-1 og req.listing.sourceListingId='another-ad' blir resultatet fortsatt assessed med dealerInput=fresh. Beregningen bruker dermed tekniske forhandleropplysninger fra én annonse sammen med kildepris fra en annen, og merker vurderingen med den gamle kandidatidentiteten.

**Retting:** Etabler et betrodd par av aktuell annonse og kandidat før bekreftelsen kan brukes. Kontroller minst kilde/annonseidentitet mot den kanoniske kandidat-id-en. Sikre også at revisjonen som bindingen gjelder, kommer fra den aktuelle annonsen og riktig mapping, ikke bare fra en uavhengig oppgitt streng. Dette kan løses ved servergenerert kandidat/par eller en verifisert innholdsreferanse; ikke ved bare å endre dokumentasjonen og anta at en framtidig kaller alltid gjør det riktig. Bevar feltrettighetsgrensene ved kontrollen.

Reviewers test bruker en id bygget etter den eksisterende source.length-kontrakten. En del leverte 005c-fixturer har den håndskrevne prefiksen `13:synthetic-demo/...`; source.length er faktisk 14. Bruk den eksisterende kandidatadapteren eller den kanoniske id-funksjonen i legitime testpar fremfor å videreføre en slik testidentitet.

## P2-2: Ugyldig split brukes i økonomikjernen før mapperen avviser den

Fil: `src/adapters/search-economics/to-economics-input.ts`, split-grenen rundt linje 136; bekreftelsesvalideringen i `src/server/dealer-economics.ts`.

parseScope sjekker format og beløpsgrenser, mens confirmDealerInput bare sjekker at linje-id finnes. Adapteren bruker split-beløpene direkte uten å kontrollere at summen er linjens beløp eller at scope passer linjens type.

Reproduksjon: søkets transportlinje er 8 000 NOK (800 000 øre). Bekreftet split har 10 000 000 øre til grensen og 0 etter grensen. Med manglende separate transportbeløp gir kjernen transportToBorderNok=100000 og beregner kostnad/mva. på dette. Først etterpå markerer 005a linjen med split_sum_mismatch. Incomplete-status opphever ikke at feil beløp allerede er brukt og kan følge med i resultat-/visningsmodellen.

**Retting:** Valider scope mot aktuell kostnadslinje før lagring og før bruk av lagret input. Split må være for transport, være ikke-negativ og summere nøyaktig til linjens beløp. Ugyldig fordeling må ikke mates inn i kjernen. Test også split på forsikring, endret linjebeløp, og samspill med eksplisitte komponentoverstyringer. Ikke endre 005a-mapperens eksisterende vern.

## P2-3: Fremtidig kildeobservasjon kan få en fersk vurdering

Fil: `src/server/search-economics.ts`, kildegyldigheten rundt linje 115–117.

lastSeenAt parses, men sammenlignes ikke med now. Et framtidig tidspunkt får retensjonen lagt til og behandles som gyldig kildegrunnlag. Med now=2026-10-20T10:00:00Z og lastSeenAt=2026-10-21T10:00:00Z returneres en faktisk CostAssessment og estimerte beløp. Det eksisterende proveniensdomenet avviser framtidig hentetid; denne nye grensen gjør ikke det.

**Retting:** Kontroller at observasjonstidspunktet er en gyldig UTC-tid og ikke senere enn injisert nåtid før det kan danne en kildegyldighetsgrense. Framtidig/ugyldig tid skal gi en presis ikke-beregnet/stale-årsak og ingen brukbar kostnadsvurdering. Bruk samme prinsipp som provenienskontrakten. Behold korrekt grense for legitim, nylig observert og utløpt kilde.

## P2-4: Registreringsfelt leses uten beregningsrett

Fil: `src/adapters/search-economics/to-economics-input.ts`, linje 111: `const fr = a.listing.specs.firstRegistration`.

Feltet leses ubetinget før kontrollen av allowedFields og selv når forhandlerens egen firstRegistration skal brukes. En getter-basert test registrerer ett oppslag med bare price-rett, mens kontrakten og testnavnene sier at felt uten beregningsrett ikke leses. Verdien brukes ikke videre i dette tilfellet; dette er ikke påvist som en utlevering av feltet til UI. Det bryter likevel den eksplisitte grensen om kontroll før lesing.

**Retting:** Flytt selve lesingen inn i grenen hvor beregningsrett for registration er gitt og det ikke brukes en egen forhandlerverdi. Test med getters for nektede felt slik at null i utdata ikke alene regnes som bevis for at feltet ikke er lest. Kontroller tilsvarende mønster for specs/pris.

## Reproduksjoner

`economics-005c-review-regressions.test.ts` kopieres til repoets tests/. Fire nye tester er kjørt mot den leverte koden; alle fire feiler og reproduserer forholdene over. Ingen produksjonskode er endret. Funnene krever avgrensede tekniske rettinger, ikke en ny kilde- eller økonomiregelrunde.

## Planavvik og øvrig kodegjennomgang

Å la manglende registration/specs-beregningsrett gi ukjent kildefelt, mens genuint egne forhandlerverdier kan brukes, er en forsvarlig avgrensning. Price er fortsatt påkrevd i denne adapteren. Dette aksepterer ikke den ubetingede lesingen i P2-4. UsedListingFields og visningskontrollen må fortsatt dekke alle kildefelt som faktisk brukes/avsløres.

Migrasjonen og lagringslaget er lest: firmabundet RLS, begrensede skrivekolonner, sammensatt søk/firma-FK, uforanderlig nøkkel og serverparsing ved lesing/skriving. Jeg fant ikke et reprodusert nytt firmalekkasjeproblem i kodegjennomgangen. Dette er ikke en uavhengig bekreftelse av RLS via PostgreSQL/PostgREST; slike kjøringer er ikke utført av reviewer.

Kilde-/forhandlerinput som ikke samles inn i denne skiven skal fortsatt fremgå som begrensninger. Ingen ny innsamling, UI eller provider bør legges til for å lukke funnene.

## Uavhengige kontroller og begrensninger

- **327 manifestoppføringer:** SHA-256 stemmer.
- **52 medleverte enhetstestfiler / 1 148 tester består.** economics-source-driven.test.ts og tax-engine.test.ts er bevisst ikke kjørt fordi primærkildearkivene mangler. DB-testene inngår ikke.
- **Fire nye reviewer-regresjoner feiler** som beskrevet.
- **Typecheck av den medleverte appkopien består** (`tsc --noEmit --incremental false`).
- **ESLint av den medleverte appkopien består**, exit 0 uten funn. Kjøringen skjedde før siste tillegg i reviewerens egen testfil; de originale produksjonsfilene var uendret.
- Adapter, inputdomene, serverorkestrering, lagringsimplementasjon, migrasjon og relevante tester er gjennomgått.

Eksisterende lokale avhengigheter, inkludert Vitest 5.0.3, ble brukt; ingen ren npm ci. Reviewkopien fikk bare node_modules-kobling og reviewerens egen testfil. Ingen produksjonscheckout eller database er endret.

Ikke kjørt: PostgreSQL-/Supabase-/Auth-/PostgREST-tester, full kildeavhengig suite på 1 274 tester, check-docs mot hele arkivet, qa-skript, build, e2e eller hosted migrasjon/deploy. Utviklerens isolerte DB-resultat på 258 beståtte med 12 feil og 247 hoppede er separat belegg og ikke en grønn full DB-suite. Supabase-lagringsimplementasjonen er ikke uavhengig HTTP-testet.

## Neste steg

Rett de fire punktene samlet og lever en rettingspakke med før-/etter-kjøring. Behold økonomiflagg, ECON-002/004, classifyBudget, rollegrenser og 005a/b uendret. Oppdater bare testfixturer som trenger korrekt kanonisk identitet, med eksplisitt begrunnelse. Stopp før 005d/ECON-006 og ingen hosted migrasjon.
