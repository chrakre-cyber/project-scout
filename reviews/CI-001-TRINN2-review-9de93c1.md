# CI-001 trinn 2 — uavhengig review av 9de93c1

## Konklusjon
Ett P2-funn må rettes før trinn 3: lokalvernet kjøres etter databaseforbindelse og testskriving i alle tre nettleserskriptene. Ingen appkode eller migrasjoner er endret. CI-001 forblir REVIEW.

## P2-1: valider lokalt mål før databaseforbindelse og oppsett
**Berørt:** tests/e2e/l4-browser.e2e.mjs:21–33, econ006.e2e.mjs:42–57 og econ006d.e2e.mjs:31–39; lokalvernet ligger i tests/e2e/support/backend.mjs:17–19.

Alle tre starter med `new Client`, `db.connect()` og opprettelse av auth.users, firma og medlemskap. Først etter dette kalles connectBackend, som kontrollerer at API- og databaseadressen er lokale. Med en feilkonfigurert ikke-lokal SUPABASE_TEST_DB_URL kan oppsettet dermed skrive til den databasen før «Nekter å kjøre mot ikke-lokal» kastes. Også en ikke-lokal API-adresse gir oppsettsskriving før avslag. Fordi feilen skjer før hovedløpets try/finally, utføres heller ikke den senere oppryddingen på denne banen.

Wrapperen henter verdier fra supabase status, men validerer dem ikke selv før start. Direkte kjøring av .mjs-skriptene bruker de oppgitte miljøverdiene. Det er derfor ikke tilstrekkelig å teste connectBackend isolert med en allerede opprettet falsk db: avslag må skje før skriptene åpner forbindelsen.

**Egen reproduksjon:** To regresjonstester kjører den faktiske L4-oppstartsseksjonen til og med connectBackend med en falsk Client og ekte backend-validering. Ingen database, nettleser eller nettverk kontaktes. Både ikke-lokal database og ikke-lokal API gir først `connect` og fire oppsettsspørringer, deretter det forventede avslaget. Begge testene feiler på kravet om null forbindelser og null spørringer.

**Forventet retting:** En felles, ren forhåndsvalidering av modus og nødvendige adresser må kjøres før Client opprettes eller forbindelsen åpnes i alle tre skript. Manglende, ugyldig eller ikke-lokalt mål må avvises uten DB-kall. Behold kontrollen inne i backend som ekstra vern. Test hele oppstartsrekkefølgen for alle tre, med lokale positive kontroller og avslag for ikke-lokal database/API. Ingen ny adgang til hosted er godkjent.

## P3: plattformavhengig testforventning
På Windows feiler én eksisterende test i tests/ci-e2e-real.test.ts:26. Hjelperen bruker path.join, men den falske filsystemfunksjonen og forventningen bruker hardkodet POSIX-sti /pw/chromium-1194/chrome-linux/chrome. Bruk path.join i testens falske stier og forventning, eller gjør Linux-avgrensningen uttrykkelig. Dette er ikke påvist feil på Ubuntu-runneren og er ikke et separat blokkerende P2-funn.

## Reviewerens egne kontroller
- MANIFEST.sha256: 689 av 689 stemmer, kontrollert før reviewfiler ble lagt til.
- Kjørbare rottester uten tax-engine og economics-source-driven: 78 filer; 1 649 tester bestått og 1 feilet (Windows-stiforventningen ovenfor).
- To nye reviewer-regresjoner: begge feiler som beskrevet under P2-1.
- TypeScript: exit 0. ESLint: exit 0. Disse ble kjørt på leveransen før reviewerens nye testfil ble lagt til.
- src: 150 filer byte-identiske med trinn 1-pakken 7ffcdfa.
- Migrasjoner: 12 filer byte-identiske. Workflow: byte-identisk.
- Kode i backend-/nettleserhjelpere, wrapper, de tre nettleserløpene, relevante app-sesjonsfunksjoner og tester er lest.

Eksisterende avhengigheter ble gjenbrukt. Ingen installasjon eller nedlasting av nettleser er utført. Testene ovenfor startet ikke en nettleser.

## Øvrige observasjoner
Ekte modus kobler appen til valgt API fremfor mini-supabase. Hoppede sjekker får egne HOPP-linjer og exit 4, og manglende nettleser har exit 3. J3 er uttrykkelig delvis i ekte modus; denne reviewen godkjenner ikke å telle L6-API-dekning som erstatning for fullført nettleser-L5. Appen bruker getUser ved sesjonskontroll; vurderingen av gammel cookie må holdes adskilt fra en påstand om at et access-token i seg selv øyeblikkelig blir ugyldig ved logout.

## Begrensninger
Reviewer har ikke kjørt Bash, PostgreSQL, PostgREST, GoTrue, ekte Supabase, nettleser/e2e, build, qa:secrets eller Actions. Utviklerens emulatorløp 94/94, 26/26 og 11 + 1 hopp er ikke gjentatt av reviewer. De to kildeavhengige testfilene og dokumentkontrollen i fullt repo er ikke kjørt fordi kildearkivene mangler. Utviklerens fulle 1 776 tester er ikke selv bekreftet.

Ingen endring på main, ingen Actions-start, hosted migrasjon eller deploy. Trinn 3 bør vente på retting og re-review. Økonomiflaggene forblir uendret.
