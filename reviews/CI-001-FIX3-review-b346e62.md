# CI-001-FIX3 — re-review av b346e62

## Konklusjon
Rekkefølgefeilen er rettet: felles preflight kjøres før Client opprettes i alle tre skript. P3 om Windows-stier er også rettet, og de leverte testene består på Windows. P2 kan likevel ikke lukkes ennå: valideringen godtar en databaseadresse som node-postgres faktisk tolker som en fjern vert.

## P2: query-parameter kan overstyre det kontrollerte vertsnavnet
**Sted:** tests/e2e/support/preflight.mjs, parseTarget (særlig new URL og LOCAL_HOSTS-kontrollen).

Reproduksjon uten nettverk:
`postgres://test@127.0.0.1:54322/test?host=db.example.invalid`

`new URL(...).hostname` er `127.0.0.1`, så preflightTargets godtar adressen. Men `pg.Client({connectionString: ...}).connectionParameters.host` er `db.example.invalid`. pg-connection-string leser query-parametere før hostname og beholder en oppgitt host-parameter. Dermed kan forbindelsen og testskrivingen fremdeles rettes mot en ikke-lokal vert til tross for forhåndsvalideringen. Den ekstra kontrollen i connectBackend bruker samme funksjon og avviser heller ikke adressen.

Dette er kontrollert med faktisk pg-konstruktør, uten connect(). Pakken og den gjenbrukte avhengigheten har begge pg-connection-string 2.14.1. En supplerende test bruker leveransens runStartup og en falsk Client: oppstarten fortsetter med konstruktør, connect og fixture-spørringer, uten avslag. Begge reviewer-regresjoner feiler som forventet. Ingen virkelig database eller nettverk er kontaktet.

**Nødvendig retting:** Avvis parametere som kan overstyre databasemålet, eller valider og bruk samme effektive tilkoblingskonfigurasjon som driveren bruker. Det holder ikke å kontrollere URL.hostname alene. Behold forhåndskontrollen før klientopprettelse, og legg til regresjon for host-parameter og URL-kodet parameternavn, i ekte modus og emulatormodus, samt oppstart uten DB-kall for alle tre skript. Behold lokale positive kontroller og feilmeldinger uten credentials. Ingen hosted-adgang eller ny avhengighet er nødvendig.

## Egne kontroller
- MANIFEST.sha256: 702 av 702 stemmer, kontrollert før egne reviewfiler ble lagt til.
- Vitest på leveransens kjørbare rottester uten de to kildeavhengige filene: 80 filer / 1 701 tester bestått.
- TypeScript: exit 0. ESLint: exit 0. Kjørt før reviewerens nye testfil ble lagt til.
- Reviewerens to nye regresjoner: begge feiler på verts-overstyringen beskrevet ovenfor.
- Preflight, de tre oppstartskallene, backendens ekstra kontroll, wrapperen, tilpasset regresjonshjelper og utvidede tester er lest.
- Tidligere reviewer-påstander om avslag før DB-kall er bevart for de opprinnelige ikke-lokale URL-ene. P3-testen består nå på Windows.

## Begrensninger
Ingen Bash-, database-, nettleser-, Supabase-, Actions-, build- eller qa-kjøring er utført av reviewer. Utviklerens emulatorløp er ikke gjentatt. De to kildeavhengige testfilene og dokumentkontrollen i fullt repo er ikke kjørt fordi pakken mangler primærkildene. Utviklerens fulle 1 827 tester er derfor ikke selv bekreftet.

At en vert er lokal beviser fortsatt ikke at databasen er en tom testdatabase; dette er allerede dokumentert av utvikler og er ikke det nye funnet. Trinn 3 bør vente til verts-overstyringen er rettet og re-reviewet. CI-001 forblir REVIEW. Ingen ny Actions-kjøring, main-endring, hosted migrasjon eller deploy er autorisert her.
