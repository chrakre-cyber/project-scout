# CI-001-FIX7 — J3 som faktisk sjekk i ekte modus via observerende proxy (til uavhengig review, 21.10.2026)

**CI-001 forblir REVIEW.** Stoppet før Actions-kjøring: ingen kjøring startet. **Ingenting er kjørt mot ekte Supabase.** Ingen endring på `main`, innstillinger, hosted miljø eller deploy. **Uendret (byte-identisk med 5de9e5e): `src/`, `supabase/` (database/rettigheter/migrasjoner), `scripts/` (inkl. evaluatoren `scripts/ci/evaluate.mjs`, `e2e-plan.json` og orkestreringen) og `.github/`.** `partialInReal` for J3 er beholdt (fjernes først etter review og separat autorisert ekte kjøring). L3c utsatt, økonomiflagg `false`, E7 utsatt, E8 åpent.

## Hva som er gjort (kun testoppsett for `econ006`)
| Fil | Endring |
|---|---|
| `tests/e2e/support/request-observer.mjs` (ny) | Proxy bundet til `127.0.0.1` (tilfeldig port); målet valideres FØR oppstart (bare `http://` mot `127.0.0.1`/`localhost`, uten innlogging i adressen; ellers avvist uten å skrive ut adressen). Videresender metode, sti, spørrestreng, headere (unntatt hop-by-hop) og kropp **uendret**, og svaret (status, headere inkl. flere `set-cookie`, kropp) uendret tilbake. Registrerer **bare** for POST/PATCH/PUT/DELETE mot `dealer_economics_inputs`/`_profiles`: metode, tabell og **toppnivånøkkelnavn** i JSON-kroppen (objekt, eller union over objekter i en array). Ingen verdier, headere, cookies, tokens, URL-er/spørrestrenger eller svar lagres; modulen skriver ikke til konsoll/stdout/stderr/fil. `j3Verdict` gir FEIL ved: observatørfeil, uleselig/ikke-JSON/komprimert/for stor (> 256 KB) kropp, avbrutt forespørsel, videresendingsfeil, ingen trafikk, **ingen skrivekall mot `dealer_economics_inputs`**, eller `dealership_id` (også i andre store/små bokstaver) i en kropp. `dealership_id` i spørrestrengen (filter) ses aldri og er ikke et brudd |
| `tests/e2e/support/preflight.mjs` | ny eksport `assertLocalHttpTarget` (gjenbruker eksisterende lokal-validering) |
| `tests/e2e/support/backend.mjs` | `connectBackend({ observe })`: i ekte modus starter observatøren mot den validerte lokale API-URL-en og appen får proxyens URL; i emulatormodus bare med `E2E_REQUEST_OBSERVER=1` (kryssjekk) |
| `tests/e2e/econ006.e2e.mjs` | `observe: true`. **J3 beholder navnet** og er nå `check()`: emulatormodus uendret (emulatorlogg, samme sted); ekte modus evalueres **på slutten av løpet** over **alle** skrivekall i hele løpet (også fra senere forløp og midlertidige bygg), ellers `FEIL` («observatør mangler»). `skip(J3)` er fjernet. Kryssjekkene (to ekstra `check()`) finnes bare i emulatormodus med `E2E_REQUEST_OBSERVER=1` |
| Tester | `tests/ci-request-observer.test.ts` (14), oppdatert `tests/ci-e2e-real.test.ts` og `tests/ci-e2e-producers.test.ts` (J3 er `check`; de to kryssjekkene er eksplisitt unntatt og kontrollert å ligge i emulatorgrenen) |

## Evaluatorens oppførsel (uendret regelverk)
Evaluatoren er ikke endret. J3 OK i ekte modus ⇒ ingen hoppet sjekk ⇒ L5a kan bli PASS etter **eksisterende** regler; J3 HOPP ⇒ DELVIS; FEIL ⇒ FAIL. Hva en faktisk ekte kjøring gir, vet vi først etter kjøring — det er ikke forutsagt her. `partialInReal` står igjen så lenge J3 ikke er bekreftet i ekte modus.

## Kontroller kjørt (alt IKKE Supabase der det er merket)
| Kontroll | Resultat |
|---|---|
| `npx vitest run` | 88 filer / **1 944 tester bestått** |
| `tsc --noEmit` / `eslint` / `qa-secret-scan.sh` | exit 0 / exit 0 / INGEN FUNN |
| **Videresending** (observatørtester mot lokale måleservere) | uendret metode/sti/spørrestreng/headere/kropp (byte-sjekk, UTF-8), uendret svar (status, flere `set-cookie`, binærkropp); irrelevant trafikk (GET, auth, andre tabeller, OPTIONS) videresendt og ikke registrert |
| **Sentinel** | unike verdier i kropp, `Authorization`, `apikey`, `cookie`, spørrestreng finnes ikke i registreringer, J3-detalj, konsoll eller stdout/stderr; kilden har ingen skriving/lagring av headere/URL |
| **Negative** | `dealership_id` i objekt, array-element, profiltabell, store bokstaver og som senere skrivekall etter et godkjent ⇒ FEIL; detaljen har bare nøkkelnavn |
| **Feilbaner (lukket)** | ingen skrivekall, bare profilskriving, ingen trafikk, ugyldig JSON/primitiv/null/ikke-objekt i array/ugyldig nøkkel/komprimert/tom kropp, > 256 KB (målet får hele kroppen), avbrutt forespørsel, mål nede (502) ⇒ FEIL |
| **Binding/mål** | lytter bare på 127.0.0.1; ikke-lokal vert, https, `127.0.0.1.evil…`, `user:pw@`, `127.0.0.1@evil…`, ugyldig/tom ⇒ avvist før noe starter, uten adresse i meldingen |
| **Kryssjekk mot emulatoren** | `econ006` i emulatormodus gjennom observatøren (`E2E_REQUEST_OBSERVER=1`): **96/96** (94 + 2 kryssjekker): observatørens skrivekall (metode, tabell, nøkkelnavn) er identiske med emulatorens egen logg, og J3-utfallet er likt (`reviews/CI-001-fix7/kryssjekk-emulator.txt`) |
| **Regresjon uten observatør** | `econ006` emulator **94/94** (`…/emulator-regresjon-uten-observator.txt`) |
| **Mutasjon i kastet kopi** (`/tmp`, ikke innsjekket; `git archive` + egen `node_modules`) | appens lagring endret til å sende `dealership_id` i INSERT-kroppen; kolonnerettigheten åpnet i kopiens database så lagringen lykkes (første forsøk uten dette stoppet flyten ved at databasen avviste lagringen, før J3-sjekken kjørte — og er ikke regnet som bevis); observatørens ekte-modus-gren tvunget på i kopien. Resultat: **J3 = FEIL** («dealership_id i kroppen til 13 av 19 skrivekall: POST dealer_economics_inputs […]», bare nøkkelnavn), flyten fullførte (92/95, 3 FEIL: J3 fra begge grener + et lekkasjefunn som følge av mutasjonen) (`…/mutasjon-kastet-kopi.txt`) |

## Begrensninger
- **Ekte-modus-grenen (observatør mot stakkens API) er ikke kjørt mot ekte Supabase.** Verifisert er: observatøren som enhet, videresending mot lokale måleservere, observatøren foran emulatoren (hele `econ006`-flyten) og ekte-modus-grenen i den kastede kopien (tvunget på i emulatormodus). Ikke verifisert: at økt-/cookie-flyt, CORS, auth-kall og tid fungerer uendret gjennom proxyen mot ekte Kong/GoTrue/PostgREST; at ingen request > 256 KB forekommer; at tallet og typen skrivekall er som i emulatoren. Avvik der gir FEIL (lukket), ikke falsk OK.
- Cookienavn avledes av vertsnavnet; observatøren bruker `127.0.0.1` som stakkens URL, så navnet skal være uendret — ikke bekreftet i ekte kjøring.
- Kryssjekken forutsetter objektkropper (emulatorens `bodyKeys` gir indekser for arrayer); appen sender objekter.
- J3 vurderer toppnivånøkler i kroppen; `dealership_id` inne i JSON-verdier (f.eks. `payload`) er ikke kolonne og vurderes ikke.
- Midlertidige bygg (patched copies) kjører også mot proxyen og er dermed med i observasjonen.

## Neste
Re-review av FIX7. Deretter, etter din separate autorisasjon, én ekte kjøring. Først når J3 er OK der foreslår vi å fjerne `partialInReal` (egen beslutning/endring av PASS-kravene).
