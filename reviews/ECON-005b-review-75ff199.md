# ECON-005b – uavhengig review

Commit: `75ff1997f887adfb353e39ce9279bc304ae3704f`.

**Konklusjon: Ett P2-funn i SQL-valideringen. Behold ECON-005b på REVIEW og stopp før 005c.** Ingen hosted migrasjon eller økonomiparametergodkjenning er utført.

## P2: Tomt økonomirettighetskart slipper gjennom CHECK fordi validatoren returnerer NULL

Fil: `supabase/migrations/20261021090000_econ005b_derived_economics_rights.sql`, `private.economics_rights_map_valid` og constrainten som bruker den.

For `'{}'::jsonb` gir `jsonb_object_keys(j)` ingen rader. `array_agg(k order by k)` blir da SQL NULL, slik at sammenligningen med `array['price','registration','specs']` også blir NULL. De andre vilkårene er true. Funksjonen returnerer derfor NULL, ikke false.

En PostgreSQL CHECK avviser false, men tillater NULL. NOT NULL på selve kolonnen stopper ikke dette, siden `{}` er en ikke-null JSON-verdi. Dermed kan et ufullstendig kart lagres. Visningsconstrainten redder heller ikke tilfellet: `{}` er forskjellig fra det komplette kartet med tre false-verdier, så også display_derived_economics=true slipper gjennom denne kontrollen.

TypeScript avviser samme kart som ugyldig derivedEconomics og setter hele profilen utenfor kraft. Databasen og TypeScript har derfor ulik gyldighetsmodell, til tross for kravet om nøyaktig tre boolske nøkler og samsvar. De eksisterende SQL-beslutningsfunksjonene gir ikke i seg selv beregningsrett fra manglende nøkler; funnet er ikke et demonstrert bypass som gir økonomirettigheter. Det er et konkret hull i profilvalideringen og CHECK-kontrakten.

**Retting:** Gjør validatoren total og eksplisitt boolsk, slik at manglende nøkkelsett aldri blir SQL NULL. For eksempel kan nøkkelsammenligningen eller hele det trygt evaluerte resultatet coalesces til false, eller constrainten kan kreve `IS TRUE`. Sørg samtidig for at alle ugyldige JSON-former avvises forutsigbart uten å svekke noen annen kontroll.

Legg til DB-tester for `{}` både med visning false og true, og en direkte funksjonstest som krever false, ikke null. Ta også med tomt kart i TypeScript-/SQL-avstemmingen. Reviewer har levert tre forslag til DB-regresjonstester i `econ005b-empty-map-review.test.ts`. De er **ikke kjørt av reviewer**: PostgreSQL-binærer er ikke tilgjengelige lokalt. Funnet er basert på SQL-kode og treverdilogikk, ikke en påstått DB-kjøring.

## Demoprofil v1 – vurdering av avviket

En dokumentert engangsbackfill av bare `synthetic-demo`, version=1, environment=synthetic kan aksepteres som en migreringsbeslutning for internt syntetisk materiale. Dette bør ikke bli en generell adgang til å utvide verifiserte leverandørprofiler på plass. WHERE-avgrensningen og default-deny for øvrige profiler må beholdes; videre endringer følger versjoneringsvakten.

Begrunnelsen om bevaring av eldre visninger må være presis: canonicalPermissions har fått et nytt felt og avtrykket endres. Eldre proveniens med gammelt avtrykk kan derfor bli rights_changed selv uten v2. Ikke omskriv eldre proveniens/digester for å omgå denne kontrollen. Dokumenter denne konsekvensen; det er ikke nødvendig å gjøre en ny v2-omlegging for å rette P2-funnet.

## Andre kontroller

- Rettighetene er skilt mellom beregning per tillatt felt og visning. Felt som avsløres, kontrolleres mot eksisterende visningskart.
- Begge nye DB-kolonner har default-deny; backfill er avgrenset til den syntetiske profilen.
- Vakttriggeren inkluderer nye rettighetskolonner; nye beslutningsfunksjoner har tom search_path og eksplisitt revoke for de oppgitte klientrollene.
- Migrasjonen endrer ikke lagrede økonomitall, UI eller økonomiflaggene. Dette er fortsatt et rettighetsfundament, ikke integrasjonen fra 005c.

## Uavhengig verifikasjon og grenser

- Alle **97 manifestoppføringer** er kontrollert mot SHA-256.
- **199 tester består** i fem leverte filer: 30 rettighetstester, de medleverte 005a-testene og 44 economics-core-tester. Den tidligere separate tie-regresjonsfilen er ikke medlevert her; dette er ikke den fulle repo-suiten.
- Avgrenset **typecheck består** for provider-rights, proveniens, 005b-domenetestene og den nye DB-testfilen med importerte avhengigheter. At en DB-testfil typesjekker er ikke en databasekjøring.
- **ESLint exit 0** på samme sentrale kilde- og testfiler. Next-regelen melder at pages-mappen mangler i den partielle pakken.
- Migrasjon, eksisterende profiloppløsning og DB-testene er lest.

Eksisterende lokale avhengigheter (Vitest 5.0.3) ble brukt, ikke ren npm ci. Ingen produksjons- eller hosted database er endret. Ikke kjørt: PostgreSQL-/Supabase-/Auth-/PostgREST-tester, de 3 500 SQL/TS-sammenligningene, full repo-suite med 1 142 tester, full app-typecheck/lint, check-docs, qa-skript, build eller e2e. Disse utviklerresultatene er separat belegg. De oppgitte 12 DB-feilene/247 hoppede tester er ikke behandlet som en grønn full DB-suite.

## Neste steg

Rett det tomme kartet og kjør de målrettede DB-testene og relevante SQL/TS-sammenligninger på nytt. Lever liten rettingspakke med før/etter. Ingen ny produkt- eller kilderunde er nødvendig. Behold ECON-005b på REVIEW og migrasjonen unapplied i hosted miljø til rettingen er kontrollert.
