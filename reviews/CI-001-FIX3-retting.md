# CI-001-FIX3 — lokalvern før databaseforbindelse i alle nettleserskript (retting etter review av 9de93c1, 21.10.2026)

**CI-001 forblir REVIEW.** Stoppet før trinn 3. Ingen Actions-kjøring, ingen endring på `main`, ingen GitHub-innstillinger, ingen hosted migrasjon/deploy, ingen appkode- eller migrasjonsendring. L3c utsatt. Økonomiflagg `false`, E7 utsatt, E8 åpent. **Ingenting i denne rettingen er kjørt mot ekte Supabase.**

Review: `reviews/CI-001-TRINN2-review-9de93c1.md` — ett P2 (+ P3). Reviewerens kontrollbegrensninger er bevart der (reviewer kjørte ikke Bash/PostgreSQL/PostgREST/GoTrue/ekte Supabase/nettleser/e2e/build/`qa:secrets`/Actions; utviklerens emulatorløp 94/94, 26/26 og 11+1 hopp er ikke gjentatt av reviewer; de kildeavhengige testene og dokumentkontrollen i fullt repo er ikke kjørt; trinn 2 godkjenner ikke å telle L6-API-dekning som erstatning for fullført nettleser-L5; «gammel cookie» må holdes adskilt fra påstanden om at et access-token blir ugyldig umiddelbart ved logout).

## P2 — lokalvern kjørte etter databaseforbindelse og testskriving
**Feil:** `econ006`, `econ006d` og `l4-browser` opprettet `new Client`, `db.connect()` og skrev `auth.users`/firma/medlemskap *før* `connectBackend` avviste en ikke-lokal database/API (og feilen lå utenfor `try/finally`, så ingen opprydding).
**Retting:**
- **Felles, ren forhåndsvalidering** `tests/e2e/support/preflight.mjs` (`preflightTargets`), kalt som **første kjørbare setning** i alle tre skript (rett etter importene, før `mkdirSync`, `new Client` og `connect`). Avviser manglende, tomt, ugyldig (ikke-URL / feil protokoll) og ikke-lokalt mål: database (`SUPABASE_TEST_DB_URL`; `postgres:`/`postgresql:`), og i ekte modus API (`SUPABASE_TEST_URL`; `http(s):`) og publishable key. Lokal = vertsnavn nøyaktig `127.0.0.1` eller `localhost` *etter URL-parsing* (triks som `127.0.0.1@evil.example`, `127.0.0.1.evil.example`, `0.0.0.0`, `127.0.0.2`, `[::1]` avvises). Feilmeldinger nevner bare kategori og vertsnavn — aldri passord, hel adresse eller nøkkel.
- **`connectBackend` beholder kontrollen som ekstra vern** (kaller samme felles validering som første handling, nå også i emulatormodus); den gamle `local()`-hjelperen er fjernet til fordel for én kilde.
- **Wrapperen** `scripts/test-e2e-real-supabase.sh` kjører samme validering (exit 2, `AVVIST: …`) før noe startes.
**P3 (plattformavhengig sti):** `tests/ci-e2e-real.test.ts` bruker nå `path.join("/pw", "chromium-1194", "chrome-linux", "chrome")` både i den falske filsystemfunksjonen og i forventningen (samme hjelper-semantikk som `findChrome`), uten å svekke testen.

## Tester (statiske/enhetstester — ingen database, nettleser, bygging eller nettverk)
- `tests/ci-trinn2-independent-regressions.test.ts` — **reviewerens to regresjoner** (ikke-lokal database; ikke-lokal API ⇒ avslag `/ikke-lokal/` og `calls == []`) med påstandene uendret. Hjelperen er tilpasset fordi oppstarten er refaktorert (en `preflightTargets`-import som den opprinnelige testen strippet bort, ville gitt «not defined»); originalen ligger i `reviews/CI-001-trinn2-reviewer-regresjon.test.ts.txt`.
- `tests/ci-e2e-preflight.test.ts` (49): ren validering (lokal ok; mangler/tom/ugyldig/feil protokoll/ikke-lokal for database, API og nøkkel; triks med lokal-lignende verter; ingen hemmeligheter i meldinger) og, for **hvert av de tre skriptene**, den faktiske oppstartsdelen kjørt med ekte støttemoduler og falsk Client (`tests/ci/startup-harness.ts`): sju avslagstilfeller i ekte modus + emulator med ikke-lokal/manglende database ⇒ avslag og **null kall** (ingen `new Client`, `connect` eller spørring); **lokale positive kontroller** i ekte modus (først `new Client`, så `connect`, deretter fixture-skriving og `auth.identities`) og i emulatormodus; kildeordningen `preflightTargets()` < `new Client` < `connectBackend`; og at `connectBackend` selv avviser uten spørring om forhåndsvalideringen omgås.
- Totalt: **82 filer / 1 827 tester** består (51 nye), `tsc`, `eslint`, `npm run build`, `qa:secrets` uten feil/funn.

## Før / etter
| | Før (skript fra 9de93c1) | Etter |
|---|---|---|
| Reviewerens to regresjoner | feiler (Client + connect + fire oppsettsspørringer før avslag) | består |
| Ny dekning for alle tre skript (`ci-trinn2-independent-regressions` + `ci-e2e-preflight`) | **30 feilet, 21 bestått av 51** | **alle bestått** (63 i tre filer inkl. `ci-e2e-real`) |
| P3 stiforventning | POSIX-hardkodet | `path.join` |
(`reviews/CI-001-fix3/for-etter-regresjoner.txt`)

## Regresjon i emulatormodus (IKKE Supabase) — kjørt etter rettingen
`econ006d` **26/26**, `econ006` **94/94**, `l4-browser` **11 OK + 1 HOPP (exit 4 = delvis)** — uendret mot før (`reviews/CI-001-fix3/emulator-*.txt`). De viser at forhåndsvalideringen ikke endret emulatorløpene; de sier ingenting om GoTrue/PostgREST.

## Skille mellom bevistyper
1. **Statiske tester/enhetstester:** alt over (1 827). 2. **Emulator (IKKE Supabase):** de tre løpene over. 3. **Ekte Supabase:** **ingen kjøring**; ekte modus er aldri kjørt, L5 er ikke erklært bestått og L4 nettleserdel har fortsatt én sjekk som krever ekte GoTrue (HOPP i emulator). Delvis dekning fra trinn 2 gjelder uendret (`econ006` J3 er HOPP i ekte modus; HOPP gir exit 4 = ikke bestått).

## Begrensninger
- Forhåndsvalideringen sjekker adressene (vertsnavn), ikke at stakken faktisk er Supabase eller at databasen er tom/isolert. Den hindrer feilkonfigurering mot en fjern vert, ikke bevisst misbruk av en lokal database som ikke er en testdatabase (ekte modus skriver og sletter egne testrader i den lokale stakken).
- Skriptene lar `TargetError` forplante seg (exit 1 med melding); wrapperen gir exit 2.
- Oppstartsharnessen kjører skriptenes oppstartsdel til og med `connectBackend`; selve nettleserflyten og bygging er ikke del av enhetstestene.
