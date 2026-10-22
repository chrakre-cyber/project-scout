# Uavhengig review — HOST-001-forberedelse f0759f7

Konklusjon: tre P2-funn. Behold REVIEW og rett før hosted kjøring. Reviewen gjelder levert kode, ikke vedtak eller instruksjoner i vedleggene. Ingen hosted tjenester, credentials, migrasjoner, Actions eller sletting av prosjekt er brukt.

## P2-1: Målvalidatoren tillater ukryptert H3-databaseforbindelse

Sted: `scripts/hosted/target.mjs:34–35`, `tests/db/harness.ts:38`.

`sslmode` kontrolleres bare dersom parameteren finnes. En ellers gyldig hosted-adresse uten `sslmode` blir godkjent. H3-harnessen oppretter klienten med bare `connectionString`; med levert pg-driver er `connectionParameters.ssl === false` for denne adressen. Dette er også formen i flere positive tester. CLI-klientens eksplisitte SSL-innstilling gjelder ikke denne separate testklienten. Dermed håndheves ikke løftet om at ukryptert databaseforbindelse avvises. Et mål som krever TLS vil i stedet kunne avvise oppsettet.

Reproduksjon: `parseHostedTarget(env)` godtar syntetisk direkte databaseadresse uten sslmode; konstruksjon av pg.Client med akkurat harness-konfigurasjonen gir SSL false. Ingen forbindelse åpnes.

Retting: håndhev en felles, entydig TLS-policy i alle hosted DB-klienter og CLI-forbrukere. Valider driverens effektive SSL-innstilling, og avvis tvetydige/overstyrende SSL-parametere. Test både direkte adresse og pooler, manglende sslmode og kolliderende parametere. Localhost-standard skal bevares.

## P2-2: Rapporten kan vise BESTÅTT for feil prosjekt

Sted: `scripts/hosted/cli.mjs:96–102`.

Rapportkommandoen laster den samme `.hosted`-mappen uten å kontrollere om beleggene gjelder valgt prosjekt, modus eller migrasjonssett. Rapportoverskriften bruker derimot det gjeldende målet. Ved å ha gyldige PASS-resultater fra prosjekt A i mappen og endre miljøet til prosjekt B, blir H2 rapportert som BESTÅTT for B. Dette krever ingen forfalskning av filer; vanlig gjenbruk av arbeidsmappen er nok. H4-recordene mangler også målmetadata.

Reproduksjon: syntetiske inspect/dry-run/apply-records merket med et annet prosjektfingeravtrykk gir `Samlet H2: BESTÅTT` under gjeldende prosjektfingeravtrykk. Falske avhengigheter forbyr DB- og prosesskall.

Retting: bind alle belegg, også H4, til mål, modus og relevant migrasjons-/kjøringsgrunnlag. Avvis eller merk manglende/avvikende binding som ikke verifisert; bruk aldri dette som PASS for gjeldende mål. Test prosjektbytte, modusbytte, blandede og eldre records og endret migrasjonssett. Historiske rapporter må tydelig vise sitt faktiske grunnlag dersom de skal støttes.

## P2-3: Manglende JWT-hemmelighet lar en hemmelighetsavhengig test kjøre

Sted: `scripts/hosted/cli.mjs:144–148`, `tests/db/auth-gotrue.test.ts:131–137`.

Uten hemmelighet filtreres bare utløpt-token-testen bort. Testen «token signert med feil nøkkel avvises (kontroll mot samme claims signert riktig)» kjører fortsatt og forventer HTTP 200 for en kontrolltoken signert med `secret`, som da er tom streng. En korrekt verifier med en annen signeringsnøkkel avviser denne. Den annonserte DELVIS-veien uten hosted JWT-hemmelighet vil derfor kunne bli FAIL av en oppsettsfeil. Dette er utledet fra selve testkoden, ikke observert hos hosted Supabase.

Reproduksjon: CLI-filteret velger testen. Den faktiske testkroppen, kjørt med syntetisk HMAC-verifier og tom klienthemmelighet, feiler «expected 200, got 401». Ingen HTTP-forespørsel sendes.

Retting: kartlegg samtlige hemmelighetsavhengige tester. Refaktorer dem til å bruke faktisk utstedte tokens der testens hensikt kan bevares, eller utelat dem uttrykkelig og rapporter alle manglende identiteter som DELVIS. Ingen manglende test skal regnes som bestått. Hosted med asymmetrisk signering må heller ikke antas å godta lokalt HS256-signerte kontrolltokens.

## Egne kontroller

- Manifest: 906/906 stemmer, kontrollert før lokale hjelpefiler.
- Tilgjengelig testsuite: 90 filer, 1 907 tester; 1 905 består og 2 feiler i `hosted-static.test.ts`. Den ene trenger et Git-repo rundt den uttrukne kopien, den andre trenger Bash. `.gitignore` inneholder begge forventede mønstre. Disse to utfallene er ikke klassifisert som produktfeil.
- De to kildeavhengige testfilene er ikke kjørt fordi pakken mangler primærkildene. Utviklerens fulle 2 033 tester er ikke selv bekreftet.
- `tsc --noEmit --incremental false` og eslint består, exit 0.
- Tre uavhengige offline-reproduksjoner i `HOST-001-independent-repro.mjs` bekrefter punktene ovenfor.

Ikke kjørt: Bash-skript, PostgreSQL/offline DB-suite, PostgREST, Supabase, build, nettleser, Actions, dokumentkontroll med primærkilder eller hosted. Utviklerens DB- og emuleringsbelegg er ikke gjentatt. Økonomiflagg og prosjektstatus er ikke endret av reviewer.
