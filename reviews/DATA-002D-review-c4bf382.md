# DATA-002D – uavhengig review

Commit: `c4bf382728d41eb8b0d00c74c1a52cb11443799c`.

**Konklusjon: Den separate DATA-002B-validatorfeilen er rettet. Ingen nye blokkerende funn i denne avgrensede reviewen.** DATA-002D kan avsluttes innen levert omfang etter produkteiers aksept. Dette er ikke belegg for hosted migrasjon eller full produksjonsklarhet.

## Migrasjonen

- Ny additiv migrasjon; den historiske DATA-002B-migrasjonen beholdes.
- Kartleggingen bruker `IS NOT TRUE`, slik at den fanger nettopp SQL NULL fra den gamle validatoren. Feilmeldingen identifiserer provider, versjon og hvilket kart som er ugyldig.
- Ved ugyldige eksisterende rader kastes en feil før CREATE OR REPLACE og endring av constraints. Ingen datarad oppdateres eller slettes og ingen profilrettighet fylles inn.
- Ny validator håndterer SQL NULL og ikke-objekter via CASE; tomt nøkkelsett sammenlignes som tom liste, og resultatet coalesces til false. Riktig sett av 13 boolske nøkler kreves fortsatt.
- Begge constraints krever `IS TRUE`. Ingen nye rolle-, RLS- eller triggerrettigheter gis. CREATE OR REPLACE-funksjonen beholder eksisterende funksjonsidentitet/privilegier.
- De medleverte oppgraderingstestene dekker både gyldige rader og stopp ved ugyldige rader, med sammenligning av innhold før/etter. Testene er lest, ikke kjørt med PostgreSQL av reviewer.

## TypeScript

Endringen i validateProfile er avgrenset til display-/matching-kartene: null, arrays og andre ikke-objekter registreres som ugyldige fremfor å nå Object.keys/Object.values. Manglende/ugyldige feltkart får dermed ugyldig profil ved rettighetsoppløsning. Dette er ikke en påstand om at hele validateProfile tar vilkårlig ukjent JSON uten forutgående parsing; funksjonen har fortsatt en typet profilkontrakt.

## Uavhengig verifikasjon

- Alle **23 SHA-256-manifestoppføringer** stemmer.
- **210 tester består** i seks testfiler/reviewkopier: ni nye DATA-002D-tester, 32 rettighetstester, 125 medleverte 005a-tester og 44 economics-core-tester.
- Avgrenset **typecheck består** for rettighets-/proveniensdomenet, de kjørte domenetestene og relevante DB-testfiler med importerte avhengigheter. Typecheck av DB-tester er ikke en DB-kjøring.
- SQL, TypeScript-diff, nye tester og oppgraderingskontroller er gjennomgått.

## Begrensninger og testoppsett

Pakken og tidligere baselinepakker mangler `@/server/public-ids`, som den fulle provider-rights-testfilen importerer. De ni nye DATA-002D-testene ble derfor kopiert uendret til en selvstendig reviewtest med bare nødvendige domene-/fixtureimporter. Den opprinnelige hele provider-rights-testfilen er ikke kjørt. De 32 rettighetstestene gjenbruker reviewkopien fra 005b; de to serveravhengige format-testene inngår fortsatt ikke i reviewers tall. Ingen serverhjelper er erstattet med mock.

Endret provider-rights.ts er lagt over en utpakket baselinekopi, sammen med testkontekst. Eksisterende lokale avhengigheter (Vitest 5.0.3) ble brukt; ingen ren npm ci. Ingen produksjonscheckout eller database er endret.

Ikke kjørt av reviewer: PostgreSQL-/Supabase-/Auth-/PostgREST-kjøringer, full repo-suite med 1 155 tester, full app-typecheck/lint, check-docs, qa-skript, build, e2e eller hosted migrasjon. Utviklerens 145 relevante DB-tester og øvrige logger er separat belegg. De uendrede 12 feilene og 247 hoppede testene i isolert full DB-suite skal fortsatt oppgis som begrensning, ikke som en grønn full DB-suite.

## Videreføring

Ingen ny planleggings- eller kilderunde er nødvendig for denne rettingen. Hosted utrulling krever sin egen miljøkontroll; migrasjonens stopp ved ugyldige rader er tilsiktet og skal ikke omgås. ECON-005c kan nå starte etter produkteiers aksept, med 005a/b beholdt og alle økonomiflagg fortsatt false. ECON-005 som helhet er ikke DONE.
