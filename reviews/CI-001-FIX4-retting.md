# CI-001-FIX4 — databaseparametere som overstyrer vert/port (retting etter re-review av b346e62, 21.10.2026)

**CI-001 forblir REVIEW.** Avgrenset retting av ett P2. Stoppet før trinn 3: ingen Actions-kjøring, ingen endring på `main`, ingen GitHub-innstillinger, ingen hosted migrasjon/deploy, ingen ny avhengighet (`pg` 8.23.1 er allerede en direkte avhengighet), ingen endring i app, migrasjoner, workflow eller PASS-regler. L3c utsatt. Økonomiflagg `false`, E7 utsatt, E8 åpent. **Ingenting er kjørt mot ekte Supabase.**

Review: `reviews/CI-001-FIX3-review-b346e62.md`. Rekkefølgefeilen og P3 (Windows-sti) er rettet og re-reviewet. Reviewerens begrensninger er bevart: reviewer kjørte ikke Bash, database, nettleser, Supabase, Actions, build eller `qa:*`; utviklerens emulatorløp er ikke gjentatt av reviewer; de to kildeavhengige testfilene og dokumentkontrollen i fullt repo er ikke kjørt; at en vert er lokal beviser ikke at databasen er en tom testdatabase.

## P2 — `?host=` overstyrer vertsnavnet som ble kontrollert
**Feil:** `postgres://test@127.0.0.1:54322/test?host=db.example.invalid` har `new URL(...).hostname === "127.0.0.1"` og ble godtatt, men node-postgres (`pg-connection-string` 2.14.1) lar query-parameteren vinne: `new pg.Client({connectionString}).connectionParameters.host === "db.example.invalid"`. Forbindelsen og testskrivingen kunne dermed gå til en fjern vert. Også `connectBackend` (samme funksjon) avviste ikke.
**Retting** (`tests/e2e/support/preflight.mjs`; ett sted, brukt av alle tre skript, wrapperen og `connectBackend`):
1. **Parametere som kan overstyre databasemålet avvises**: `host`, `hostaddr`, `port`, `dbname`, `database`, `service`. Navnet URL-dekodes, trimmes og sammenlignes uavhengig av store/små bokstaver, så `?%68ost=`, `?%48OST=`, `?HOST=` og `?%20host=` fanges. Også en `host=` som peker lokalt avvises (policy: ingen parameter får overstyre målet, uansett verdi).
2. **Samme effektive konfigurasjon som driveren**: adressen leses med den faktiske driveren (`new pg.Client({ connectionString }).connectionParameters`, bare konstruktøren — ingen forbindelse, DNS eller nettverk), og den effektive verten må være `127.0.0.1`/`localhost` og lik adressens vert/port. Dette fanger også tilfeller som gjentatt `host=a&host=b` (siste vinner) uten å måtte gjette driverens regler. Kan driveren ikke tolke adressen ⇒ «ugyldig».
3. Beholdt: kontrollen **før `Client` opprettes** i alle tre skript, og **ekstra vern i `connectBackend`** (begge moduser). Feilmeldinger nevner bare kategori, parameternavn eller vertsnavn — aldri passord, hel adresse eller parameterverdi. Harmløse parametere (`sslmode`, `application_name`) godtas.

## Tester (statiske/enhetstester — ingen database, nettleser eller nettverk)
- **Reviewerens to regresjoner** tatt inn uendret: `tests/ci-fix3-host-review-regressions.test.ts` (driverens effektive vert vs. URL-hostname + `runStartup` for L4 uten DB-kall).
- **Utvidet** i `tests/ci-e2e-preflight.test.ts` (+57): grunnlagskontroll mot den faktiske driveren; 13 overstyringsvarianter (host, `%68ost`, `%48OST`, `HOST`, gjentatt host i begge rekkefølger, lokal `host=localhost`, hostaddr, port, dbname, database, service, `%20host`) avvist i **begge moduser**; meldinger uten credentials/parameterverdier; harmløse parametere godtatt med lokal effektiv vert/port; invariant «alt preflight godtar har lokal effektiv driververt»; `connectBackend` avviser uten spørring i begge moduser; og for **hvert av de tre skriptene**: seks overstyringsvarianter i ekte modus og seks i emulatormodus ⇒ avslag og **null kall** (ingen `new Client`, `connect` eller spørring), pluss **lokale positive kontroller** med harmløs parameter i begge moduser (åpner forbindelsen først da).
- Totalt **83 filer / 1 886 tester** består (59 nye); `tsc`, `eslint`, `npm run build`, `qa:secrets` uten feil/funn.

## Før / etter
| | Før (b346e62) | Etter |
|---|---|---|
| Reviewerens to regresjoner | feiler | består |
| Reviewerens + nye overstyringstester (`ci-fix3-host-review-regressions` + `ci-e2e-preflight`, 108 tester) | **53 feilet, 55 bestått** | **alle bestått** (122 i fire filer inkl. FIX3-regresjonene og `ci-e2e-real`) |
(`reviews/CI-001-fix4/for-retting.txt`, `etter-retting.txt`)

## Emulatormodus (IKKE Supabase)
`econ006d` kjørt på nytt etter rettingen: **26/26** (isolert klynge-URL uten parametere passerer den nye driverkontrollen). `econ006` (94/94) og `l4-browser` (11 OK + 1 HOPP) er ikke kjørt på nytt: denne rettingen berører bare valideringsfunksjonen, og begge har samme forhåndskall og en parameterfri adresse som dekkes av enhetstestene over og av `econ006d`-løpet. (Kjøres på nytt hvis reviewer ønsker det.)

## Skille mellom bevistyper
Statiske tester/enhetstester (1 886, inkl. kjøring av oppstartsdelen med falsk Client og kall til den ekte `pg`-konstruktøren uten forbindelse) · emulator (`econ006d`) · **ekte Supabase: ingen kjøring**; ekte modus er aldri kjørt, L5 er ikke bestått, og L4 nettleserdel har fortsatt én sjekk som krever ekte GoTrue (HOPP i emulator).

## Begrensninger
- Kontrollen avviser kjente overstyringsparametere og verifiserer driverens effektive vert/port; den kan ikke gardere mot andre miljøvariabler som driveren leser når adressen mangler vert (`PGHOST`) — men en adresse uten lokal vert avvises allerede av URL-sjekken.
- Lokal vert beviser ikke at databasen er en tom testdatabase (ekte modus skriver og sletter egne testrader i den lokale stakken) — uendret og dokumentert tidligere.
- Port- og dbname-overstyring avvises som policy selv om verdien er lokal.
