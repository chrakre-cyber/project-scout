# Uavhengig review — HOST-001-FIX2, 54bd269

Konklusjon: ingen nye P1/P2-funn. Windows-rettingen i programstarteren og hovedmodulsjekken fungerer i de lokale kontrollene. Ett P3-funn i den nye testfilen bør rettes før Windows-suiten brukes som akseptkontroll. HOST-001 forblir REVIEW; ingen hosted kjøring er godkjent.

## P3: Test av faktiske inngangspunkter bruker Linux-stier på Windows

Sted: `tests/hosted-launch.test.ts:15` og `:23–25`.

`real` velger alltid `path.posix`, selv om ROOT er en Windows-sti. nodeToolEntry får derfor feil filsti og hevder at et installert inngangspunkt ikke finnes. Forventningene bruker også hardkodede `/node_modules/...`-stier. Testen feiler på Windows selv når programstarteren og pakkene fungerer. Dette er en testportabilitetsfeil, ikke en observert feil i programstarteren.

Uavhengig reproduksjon på Windows: samme installerte Supabase-pakke finnes med path.win32, men gir «inngangspunktet til supabase finnes ikke» med testens path.posix. Den faktiske selvtesten starter Supabase uten problemer.

Retting: bruk vertsplattformens path-funksjoner i kontrollen av faktiske filer, og sammenlign med native/normaliserte forventede stier. Behold eksplisitt posix i simulerte Linux-tester og win32 i simulerte Windows-tester. Ikke gjør Windows-testen til et hopp.

## Faktisk Windows-kjøring utført av reviewer

Kjørt med eksisterende avhengigheter i den uttrukne reviewkopien, uten npm ci eller annen installasjon:

- Plattform win32, arkitektur arm64, Node v24.21.0.
- Selvtesten finner JS-inngangene for Supabase, Vitest og Next.
- Alle tre svarer på --version med exit 0, startet uten shell.
- Selvtestens 20 argumenter, inkludert mellomrom, anførselstegn, spesialtegn, unicode og tom streng, kommer uendret fram.
- Shell-tolking skjer ikke i denne kontrollen; run.sh har LF.
- Git Bash mangler, og den kontrollen feiler med tydelig kategori. Samlet selvtest gir korrekt IKKE BESTÅTT, exit 1. Dette er forventet på denne maskinen før Git Bash er installert.
- CLI kjørt uten hosted-miljø gir mål-avslag og exit 2. Dermed utføres hovedmodulen på Windows; den avslutter ikke lenger stille.

Dette bekrefter Windows-programstart, ikke hosted-migrasjon, CLI dry-run, sertifikatkjede eller skann gjennom Git Bash. Supabase-versjonskallet opprettet lokal `.temp/cli-latest`-metadata; dette er ikke en levert migrasjonsendring eller hosted kjøring.

## Øvrige egne kontroller

- Manifest: **922/922**, kontrollert før kjøringer og lokale hjelpefiler.
- Tilgjengelig testsuite: **91 filer / 1 981 tester: 1 975 består, 6 feiler**.
- Én feil er P3 ovenfor. Fem skyldes manglende Git-repo rundt ZIP-kopien eller manglende Bash: gitignore, git-attributter, run.sh, verktøytest med bash og samlet selvtest.
- De to kildeavhengige testfilene med 126 tester er ikke kjørt. Utviklerens 2 107 tester er ikke selv bekreftet.
- TypeScript og ESLint: exit 0.
- src (150 filer), de 15 leverte supabase-filene, .github (1 fil) og scripts/ci (12 filer) har uendret innhold fra FIX1.
- target, binding, gate, inspect, report og cleanup er byte-identiske med FIX1. Tidligere rettinger av TLS, mål-/beleggbinding og JWT er bevart.
- `.gitattributes` inneholder den avgrensede regelen `*.sh text eol=lf`.

Ikke kjørt: installasjon/npm ci, Bash-skann, build, DB-suite, PostgreSQL, PostgREST, nettleser, Supabase-stakk, Actions, hosted eller dokumentkontroll med primærkildene. Ingen prosjektopprettelse, hosted migrasjon, credentials, innstillingsendringer, main-endringer eller deploy er gjort. Ingen brukerprosjekter eller data er slettet.

Neste: rett den lille testportabilitetsfeilen. Deretter gjenstår installasjon av Git for Windows, en ordinær lokal arbeidsklone med avhengigheter og ny samlet Windows-selvtest før H1/H2. Reviewkopiens eksisterende avhengigheter er ikke belegg for at npm ci fungerer i brukerens kommende klone.
