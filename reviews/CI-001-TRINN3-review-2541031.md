# CI-001 trinn 3 — uavhengig review av 2541031

## Konklusjon
Ett P2-funn må rettes før aktivering: L4-planen inneholder emulatorens begrunnelse for en hoppet sjekk som del av sjekkidentiteten. Dermed gir også et helt vellykket ekte L4-løp FAIL i vurdereren. CI-001 forblir REVIEW.

## P2: L4-planen samsvarer ikke med sjekkens navn i ekte modus
**Sted:** scripts/ci/e2e-plan.json:18; sammenholdt med tests/e2e/l4-browser.e2e.mjs:131–132 og scripts/ci/e2e-names.mjs:22–24.

Produsenten i ekte modus skriver sjekkidentiteten:
`gjenbruk av gammel sesjon etter utlogging avvises av GoTrue (sesjonen er revokert server-side)`

Planen forventer derimot samme tekst med suffix:
` — emulatoren validerer bare JWT-signatur/utløp og har ingen sesjonsrevokering; krever ekte GoTrue`

Suffixet er begrunnelsen som skip() legger til i emulatorens utskrift, ikke selve sjekkidentiteten. Når ekte modus skriver OK med det korte, korrekte navnet, finner vurdereren både en MANGLER og en UVENTET sjekk. Følgen er FAIL uansett om nettlesersjekken består. Leveransens forventning om at L4b kan bestå ved første ekte kjøring stemmer derfor ikke med den leverte sjekkplanen.

**Egen reproduksjon:** To tester leser sjekkidentitetene fra selve L4-skriptets check()-kall i stedet for evaluatorens plan. En syntetisk ekte-modus-rapport med alle tolv faktiske sjekker OK og exit 0 blir FAIL. Den andre testen viser direkte at ekte-modus-navnet mangler i planen. Begge feiler som forventet. Ingen nettleser eller Supabase er kjørt.

**Retting:** Bruk sjekkens stabile navn som identitet; HOPP-/FEIL-begrunnelse må holdes separat. Kontroller identitetene mot produsentene og legg til produsent–konsument-tester. Dagens fixtures bygges fra samme plan som vurdereren leser og oppdager derfor ikke dette avviket. Behold strenge krav om nøyaktig én forekomst, reell modus og ingen ukjente sjekker. Behold J3 som DELVIS, ikke PASS. Ikke løs avviket med generell prefiksmatching eller ved å akseptere ukjente navn.

## Reviewerens egne kontroller
- MANIFEST.sha256: 849 av 849 stemmer, kontrollert før egne reviewtester ble lagt til.
- Leveransens kjørbare rottester uten tax-engine og economics-source-driven: 82 filer / 1 775 tester bestått.
- TypeScript --noEmit --incremental false: exit 0.
- ESLint: exit 0.
- To egne kontraktregresjoner: begge feiler på P2-funnet ovenfor.
- src: 150 filer byte-identiske med FIX4-pakken 7f49445.
- Migrasjoner: 12 filer byte-identiske med 7f49445.

Koden for sjekkparsing, vurdering, plan, innloggingsbudsjett, orkestrering og workflow og nye tester er lest. Eksisterende avhengigheter er gjenbrukt, uten installasjon.

## Øvrig gjennomgang
Rapporten har separate L4b/L5a/L5b/L5-statuser, og PARTIAL, NOT_RUN og feil hindrer samlet PASS. J3 gir fortsatt delvis dekning. Orkestreringen kjører nettleserløp etter L7, holder rå stdout/stderr i privat katalog og sender resultatet gjennom eksisterende sanering. Wrapperen bruker midlertidig skjermbildekatalog og laster ikke opp skjermbilder. Formuleringene om at ingen skjermbilder «lagres» bør forstås som ingen varig lagring/opplasting: filene skrives midlertidig under kjøringen.

Workflow beholder manuell trigger og contents: read; jobbgrensen er nå 180 minutter. Innloggingsbudsjettet venter etter den tidligere DB-suiten og mellom løpene fremfor å redusere tester. Denne gjennomgangen bekrefter ikke at den beregnede ventingen eller tidsrammen er tilstrekkelig på en ekte runner.

## Begrensninger og status
Reviewer har ikke kjørt Bash, PostgreSQL, nettleserløp, emulatororkestrering, build, qa:secrets, Actions eller ekte Supabase. Utviklerens emulatorresultater er ikke gjentatt. De to kildeavhengige filene og dokumentkontrollen i fullt repo er ikke kjørt fordi kildearkivene mangler. Utviklerens fulle 1 901 tester er ikke selv bekreftet.

Ingen aktivering, endring på main, GitHub-innstillingsendring, hosted migrasjon eller deploy er utført eller autorisert her. L3c forblir utsatt og økonomiflaggene uendret. Rett P2 og lever til re-review før ny Actions-kjøring.
