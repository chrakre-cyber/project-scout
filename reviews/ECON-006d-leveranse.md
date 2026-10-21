# ECON-006d — testrester fra avstemmingen + forslag (levert til uavhengig review)

**Status:** levert til uavhengig review. Ikke DONE. **ECON-005/006 er ikke markert DONE** (venter denne leveransen og Christians beslutning). Økonomiflagg `false`, E7 utsatt, E8 åpent. Ingen produksjonskode er endret; ingen hosted migrasjon, ingen deploy, ingen implementering av demodatafornyelse; ingen credentials i chat eller repo.

## 1. Testrestene (skilt fra BEV med ukjent elbilkvalifisering)
Tolkning: «ukjent rettighetsprofil» er dekket på **begge** måter — (a) *rettighetsprofil* ukjent/ikke i kraft, og (b) *kjøretøy-/registreringsprofil* ukjent eller ikke støttet (slik «ukjent profil» var ment i planens test 8). Kjørt to steder:
- **vitest gjennom faktisk visning** (`previewForDisplay` / `detailForDisplay`): `tests/economics-006d-remainders.test.ts`, 12 tester.
- **nettleser** (bygd app i Chromium; Auth/PostgREST-**EMULATOR**, ikke Supabase; isolert PostgreSQL; midlertidige app-kopier): `bash scripts/test-e2e-econ006d.sh` — **26/26 sjekker OK** (`reviews/ECON-006d/e2e-resultat.txt`, `e2e-run-green.log`, 8 skjermbilder). Historikk: første kjøring 24/26 (en for bred testforventning: søkets egne budsjettall «450 000 kr» i sammendraget ble regnet som økonomitall — rettet i testen; `e2e-forste-kjoring-24-av-26.log`); mellomkjøring 25/26 etter at jeg strammet en kontroll fra «eller» til «og» og den avslørte at jeg hadde påstått noe appen ikke viser (`e2e-mellomkjoring-25-av-26.log`, se UX-notat under); sluttkjøring **26/26** med den korrigerte kontrollen.

| Rest | Resultat (vitest + nettleser) |
|---|---|
| **Ukjent rettighetsprofil** | *Ingen profil registrert*: kilden kan ikke engang identifiseres (opak id kan ikke utledes) ⇒ detalj/skjema gir **«ikke funnet»**, resultatlisten har 0 annonser, ingen økonomi/estimat/nedre grense. *Profil som bare er utkast*: detalj og skjema er **blokkert med forklaring** («Det finnes ingen gyldig visningsprofil for denne kilden…»), ingen økonomi, ingen skjema, ingen tall |
| **Ukjent kjøretøy-/registreringsprofil** | Planlagt registrering «uspesifisert» og «varebil»: **«Ikke beregnet — Registreringsscenarioet støttes ikke (bare personbil)»**, ingen tall — også etter fullt bekreftet forhandlerinput. Ukjent drivlinje (alle felt «ukjent»): aldri estimat/scenarioer, drivlinje står som manglende, registrerbart felt med lenke |
| **B1** (akseptdato utenfor dokumentert periode) | Både 2027-01-05 (etter) og 2025-12-31 (før): status **ikke beregnet**, ingen punktestimat-tall, årsaken «Akseptdatoen ligger utenfor dokumentert periode.» vises og tolldato er et registrerbart manglende felt med lenke. Kontroll: samme input med dato i perioden gir «Estimat — ikke validert: 825 247 kr» (så avslaget skyldes datoen) |
| **J5** (ukjent fradragsstatus) | Diesel: kontantbehov er **én verdi 830 583 kr**; økonomisk kost = **to scenarioer 731 211 kr (hvis fradragsberettiget) / 830 583 kr (hvis ikke)**, ingen omtale av elbilfritak; «Hva mangler?» nevner fradragsstatus (lenke), ikke elbilkvalifisering |
| **Adskilt fra BEV** | BEV med *kjent* fradrag og *ukjent* elbilkvalifisering: scenarioene **384 727 / 459 727 kr er merket «elbilfritak»**, aldri fradrag; mangelen er «kan ikke registreres ennå» uten fradragslenke. BEV med *begge* ukjente: **fire ulike kombinasjoner**, alle merket med både elbilfritak og fradragsstatus; brutto utlegg vises som **«Fra 384 727 kr (scenarier)»** — ikke ett tall og uten fradragsmerking |
Alle tilfeller: positivt budsjettutfall false. Referanser er B-Merovo-scenario / fixturekonvensjon (`tests/e2e/support/econ006-reference.mjs`, kontrollert mot kjernen i `economics-006c-reference.test.ts`), ikke produksjonsregler. Kjøretøydata i skjemaet er fixtureinput.

**UX-notat (valgfri forbedring, ikke endret):** når brutto utlegg er scenarioer (BEV med ukjent elbilkvalifisering) vises bare «Fra <laveste> (scenarier)»; de enkelte kontantverdiene listes ikke separat (de ligger indirekte i økonomisk-kost-scenarioene). Forklaring av begge kontantverdier er en mulig forbedring.

**Funn:** uten registrert profil gir appen «ikke funnet», ikke en blokkering med årsak — fordi den opake id-en bygger på profilens miljø. Det er fail-lukket, men gir ingen forklaring til brukeren. Ikke endret (utenfor omfang); rapportert.

## 2. Kontroller (utvikler)
- Mutasjoner på de nye vitest-testene (kildene gjenopprettet og verifisert): fradrag ikke lenger et manglende felt ⇒ 1 feiler; scenarioetikett endret ⇒ 3; scenariosjekken fjernet i adapteren ⇒ 2; B1-vernet av ⇒ 2.
- `npx vitest run`: 71 filer / **1 645 tester grønne**; `tsc` ren; `eslint .` ren; `check-docs.mjs` OK. (Kjørt på nytt av nettleserskriptet etter at en ubrukt import ble fjernet og én kontroll i skriptet ble strammet fra «eller» til «og» — se sluttkjøringen i `e2e-run-green.log`.)

## 3. Forslagene (ikke implementert)
- **Demodatafornyelse:** `docs/econ/forslag-demodata-fornyelse.md` (gjennomføringsforslag): eksplisitt validert epoke (innebygd standard + server-only `SCOUT_SYNTHETIC_EPOCH`), observasjoner 0–48 t før epoken, «syntetisk generert — ikke hentet fra leverandør», uendret utløp og beregningsperiode, ingen rullering; fil for fil, valideringskoder, tester, beslutninger D1–D4.
- **Supabase-kontroll:** `docs/econ/forslag-supabase-kontroll.md` § 7: verktøy, hvor testene kan kjøres, og Christians konkrete handlinger. **Funn fra undersøkelsen:** `dockerd` kan startes i dette miljøet og Docker Hub virker, men `public.ecr.aws` (Supabase CLI sine images) gir `403` på bildelagene og `api.supabase.com` er ikke nåbar ⇒ **lokal Supabase og hosted kan ikke kjøres herfra**; foreslått sted: Christians maskin (anbefalt) eller GitHub Actions (krever godkjenning). Ingenting er kjørt mot Supabase.

## 4. Fortsatt IKKE verifisert
Ekte Supabase/PostgREST/GoTrue · øvrige rettighetsvarianter og forfalsket server-action-POST i nettleser · andre nettlesere, ekte mobil, skjermleser · hosted migrasjon · datoer er relative til kjøredato (beregningsomfang 2026) · hovedløpet bruker testkopier med friske observasjonstidspunkt (den uendrede demoen viser ingen økonomi siden 11.10.2026).
