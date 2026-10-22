# ECON-005b – uavhengig rettingsreview

Commit: `612ccc22e2e12027d1ed5644a671d8b7986a4be9`.

**Konklusjon: P2-funnet fra reviewen av 75ff199 er lukket ved kodegjennomgang av rettingen, støttet av utviklerens dokumenterte DB-reproduksjon før/etter. Ingen nye blokkerende funn i denne avgrensede rettingsreviewen.** Reviewer har ikke selv kjørt PostgreSQL. Reviewbelegget må gjengi dette skillet.

## SQL-rettingen

CASE-grenen stopper SQL NULL og ikke-objekter før objektfunksjonene brukes. Det aggregerte nøkkelsettet coalesces til en tom tekstliste, slik at `{}` sammenlignes med det påkrevde settet og gir false. Et ytre coalesce sikrer boolsk retur. CHECK krever i tillegg IS TRUE. Det opprinnelige NULL-hullet er dermed fjernet uten å gi nye rettigheter eller endre rolle- og triggerkontroller.

At den uutgitte migrasjonen er rettet på plass er akseptabelt under den oppgitte forutsetningen om at den bare er anvendt i testklynger. Hvis den likevel er brukt i et delt miljø, må utrulling håndteres separat; reviewen er ingen hosted utrullingstillatelse.

## Verifikasjon

- Alle **20 manifestoppføringer** stemmer med SHA-256.
- Endret SQL, oppdaterte DB-tester, rapport og før/etter-logger er gjennomgått.
- **201 tester består** i reviewoppsettet: 32 rettighetstester, 125 medleverte 005a-tester og 44 economics-core-tester.
- Avgrenset typecheck består for rettighets-/proveniensdomenet, de kjørte rettighetstestene og de to aktuelle DB-testfilene med importerte avhengigheter. Typecheck av DB-testfiler er ikke en DB-kjøring.
- TypeScript-produksjonskoden er uendret fra den forrige reviewen. Migrasjonen er det eneste endrede produksjonsartefaktet i pakken.

## Viktige testbegrensninger

De oppdaterte rettighetstestene importerer `@/server/public-ids`, som ikke følger med denne eller den gjenbrukte baselinepakken. Originalfilen kunne derfor ikke lastes. Reviewer laget en separat reviewkopi som utelater kun de to avsluttende canonicalPermissions-format-testene og tilhørende importer; de resterende 32 testene er kjørt. Ingen erstatning eller mock av den manglende produksjonsmodulen er brukt. Proveniensens domenekode er lest, men de to nye format-testene er utviklerens belegg.

Eksisterende lokale avhengigheter (Vitest 5.0.3) og uendrede filer fra 75ff199-pakken er gjenbrukt. Ingen ren npm ci, produksjonskodeendring eller databaseendring er utført av reviewer.

Reviewer har **ikke** kjørt PostgreSQL, de 81 relevante DB-testene, full app-suite med 1 146 tester, full app-typecheck/lint, check-docs, qa-skript, build, e2e eller hosted migrasjon. Utviklerens isolerte DB-logg viser 81 relevante tester bestått; hele isolerte DB-suiten har fortsatt 12 feil og 247 hoppede tester. Den skal ikke omtales som en grønn full DB-suite.

## Backfill og eldre funn

Den aksepterte engangsbackfillen for synthetic-demo v1 er bevart og dokumentert. Nytt canonicalPermissions-felt endrer avtrykket; eldre avtrykk skal fortsatt gi rights_changed, uten omskriving for å omgå kontrollen.

Det tilsvarende hullet i eldre `private.rights_field_map_valid` er bekreftet av utvikleren og gjenkjennelig i kildekoden. Det er et eget DATA-funn, ikke en gjenåpning av den nå rettede 005b-validatoren. Det er ikke dokumentert at et tomt kart gir uautoriserte rettigheter, men det bryter database-/TypeScript-kontrakten.

**Anbefaling:** Avslutt 005b innen levert omfang etter produkteiers aksept. Rett den eldre validatoren som en liten separat oppgave med ny additiv migrasjon og før/etter-tester, før hosted rettighetsutrulling. Ikke endre den historiske DATA-002B-migrasjonen. Eventuelle ugyldige eksisterende rader må oppdages og rapporteres; ikke fyll inn antatte tillatelser eller svekk profilimmutabilitet for å få migrasjonen gjennom. Ingen ny full 005b-planleggingsrunde er nødvendig.
