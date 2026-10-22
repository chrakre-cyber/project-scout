# CI-001 — uavhengig review av diagnostikk i 7e3e549

## Konklusjon
Ingen nye blokkerende funn. Diagnostikken er avgrenset og kan brukes i en separat autorisert kjøring for å undersøke de to L6-feilene. Årsaken til feilene er fortsatt ikke bekreftet; denne reviewen godkjenner ingen endring i testforventninger eller tilgangsregler. CI-001 forblir REVIEW.

## Gjennomgang
REST-hjelperen registrerer bare metode, tabellnavn uten filter, HTTP-status og formatkontrollert SQLSTATE/PostgREST-kode. Etter en feilet test skrives sporet til en fil angitt av SCOUT_L6_DIAG_FILE. Orkestreringen setter denne til den private arbeidskatalogen for L3a.

Evaluatoren leser bare eksakt formaterte linjer knyttet til feilede testnavn fra den fastlåste listen. Ugyldige linjer og ekstra felt forkastes. Maksimalt 40 operasjoner per test tas med. Testnavn i rapporten kommer fra forventningslisten, ikke vilkårlig fritekst i diagnostikkfilen. Diagnostikknotater beregnes separat fra status, slik at FAIL ikke kan bli PASS på grunn av diagnostikken. Eksisterende sluttsanering gjelder også denne teksten.

Selve testdefinisjonene fra første describe("L6 ...") og ut filen er byte-for-byte tekstidentiske med reviewet 247af27. Ingen påstander eller forventninger er endret. Endringen i REST-hjelperens returverdi bevarer tidligere kontrakt.

## Reviewerens egne kontroller
- MANIFEST.sha256: 857 av 857 stemmer, kontrollert før egne probe-filer ble lagt til.
- Vitest på kjørbare rottester uten de to kildeavhengige filene: 85 filer / 1 803 tester bestått.
- TypeScript --noEmit --incremental false: exit 0.
- ESLint: exit 0.
- src: 150 filer byte-identiske med 247af27.
- supabase/migrations: 12 filer byte-identiske med 247af27.
- .github: workflow byte-identisk med 247af27.

### Egen funksjonsprøve av feilhåndteringen
Reviewer har i tillegg hentet den faktiske beforeEach/afterEach/noteTrace-koden fra leveransen og kjørt den under samme Vitest-versjon med én bevisst feilet syntetisk test og én bestått kontroll. Dette bruker ingen database, nettleser eller nettverk.

Prøven bekreftet at:
1. Den bevisst feilede testen fortsatt gir testprosessen exit 1.
2. Bare den feilede testen skriver diagnostikklinje.
3. Filterverdien fra forespørselen blir ikke skrevet.
4. Testnavnet matcher evaluatorens fastlåste identitet, og PATCH/HTTP 400/kode 21000 når rapportnotatene.
5. Gruppen forblir FAIL etter at diagnostikken er lest.

Denne prøven tester diagnostikkflyten med syntetiske statuser. Den viser ikke at den virkelige feilen skyldes safeupdate.

## Årsakshypotesen
De to ufiltrerte PATCH-kallene er et relevant undersøkelsesspor. Den tidligere kjøringen ga ikke tilstrekkelig informasjon til å avgjøre hvor hver test stoppet. Operasjonsrekkefølgen og feilkoden i neste kjøring kan skille hypotesen fra tidligere oppsettsfeil eller andre avslag. En simulering som gir samme mønster er ikke bekreftelse på at safeupdate er aktivt i Supabase-stakken.

## Begrensninger
Reviewer har ikke kjørt Bash, PostgreSQL, PostgREST, GoTrue, ekte Supabase, nettleser/e2e, build, qa:secrets eller Actions. Utviklerens offline-binærharness og emulering er ikke gjentatt. De to kildeavhengige testfilene og dokumentkontrollen i fullt repo er ikke kjørt fordi primærkildene mangler. Utviklerens fulle 1 929 tester er ikke selv bekreftet. Den offentlige originalkjøringen er heller ikke hentet eller uavhengig bekreftet i denne reviewen.

## Neste steg
Etter brukerens separate autorisasjon: én manuell kjøring fra arbeidsgrenen med den reviewede diagnostikken, uten andre kodeendringer. Les operasjon/status/kode for hver av de to testene før eventuell retting. Behold testforventninger, RLS, PASS-krav og kjent J3-delvis dekning. Ingen main-endring, hosted migrasjon eller deploy er utført eller autorisert av reviewen.
