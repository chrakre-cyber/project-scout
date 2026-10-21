# J3 i ekte modus — kartlegging og forslag (ikke implementert)

Status 21.10.2026. Forslaget er **ikke implementert**, ikke reviewet og ikke kjørt. J3 forblir HOPP/DELVIS i ekte modus, og L6 erstatter den ikke.

## 1. To forskjellige påstander
| | Påstand | Hvem beviser den | Dekning i dag |
|---|---|---|---|
| **A (appen)** | Appen sender aldri `dealership_id` **i kroppen** til skrivekall (POST/PATCH) mot `dealer_economics_inputs`/`dealer_economics_profiles`; firma settes av databasen | må observere de faktiske forespørslene fra appen | emulatormodus (`mini-supabase` logger `bodyKeys`); **ekte modus: ikke dekket (J3 = HOPP)** |
| **B (databasen)** | Databasen avviser at klienten oppgir/flytter `dealership_id` (kolonnerettigheter 403/42501, trigger setter firma) | API-tester mot ekte PostgREST | L6 (`tests/db/rest-isolation.test.ts`), **14/14 i kjøring 39623552258** |

A uten B: en feil i appen ville vært fanget av databasen, men som 403 mot brukeren. B uten A: databasen er trygg, men appens oppførsel er ubevist og et løsnet grant ville ikke blitt oppdaget av en eventuell app-endring. De kan ikke erstatte hverandre. (Indirekte hint: lagring lykkes i L5 med dagens grants, noe som tilsier at INSERT-kroppen ikke har `dealership_id` — men det er en slutning fra B, dekker ikke UPDATE-kroppen eller fremtidige grantendringer, og regnes ikke som verifisering av A.)

Merk: appen sender `dealership_id` som **filter i spørrestrengen** (`.eq("dealership_id", …)` i SELECT/UPDATE). Det er ikke skriving og er ikke det J3 påstår; en verifisering må se på kroppen.

## 2. Hvorfor ekte modus ikke kan se det i dag
Skrivekallene gjøres av **serveren** (server actions → `src/server/dealer-economics-store.ts` → Supabase-klient), ikke av nettleseren. Playwright (`page.route`/`request`-hendelser) ser bare nettleserens trafikk og er blind for dem. Emulatoren ser dem fordi den *er* serveren de snakker med.

## 3. Alternativer
| # | Alternativ | Vurdering |
|---|---|---|
| 1 | **Observerende gjennomsendingsproxy i e2e-oppsettet** (test-kode, mellom appen og stakkens API) | **Anbefalt.** Ingen appendring, ingen endring i stakken, ser nøyaktig det appen sender |
| 2 | Playwright-nettverkshendelser | Ser ikke serverkall — utelukket |
| 3 | PostgreSQL-/PostgREST-logging i stakken | Krever stakkonfigurasjon; logger lett verdier; kolonnelister er vanskelige å få pålitelig — frarådes |
| 4 | Debug-krok i appkoden | Endrer produksjonskode for en test — utelukket |
| 5 | Supabase lokal analytics/API-logger | Ikke aktivert i CI-oppsettet, tungt — frarådes |

## 4. Minste avgrensede løsning (alternativ 1)
- Ny `tests/e2e/support/request-observer.mjs`: en liten HTTP-server på `127.0.0.1` (tilfeldig port) som videresender alt uendret (metode, sti, headere, kropp, svar, inkl. forhåndsforespørsler og `/auth/v1`) til stakkens lokale API-URL og avviser ikke-lokale mål. Bare i `econ006`, ekte modus; `NEXT_PUBLIC_SUPABASE_URL` for den (uendrede) appbyggingen peker på proxyen. Vertsnavnet er det samme (`127.0.0.1`), så øktcookiens navn (avledet fra vertsnavn) er uendret.
- **Det eneste som registreres** (kun for POST/PATCH/PUT/DELETE mot `/rest/v1/dealer_economics_inputs` og `…_profiles`): metode, tabellnavn og **navnene** på toppnivånøklene i JSON-kroppen (union for arrayer), filtrert til `^[a-z_]{1,64}$`. Aldri verdier, headere, cookies, tokens, spørrestreng/URL, svar eller kropp; kroppen leses i minnet (maks. f.eks. 256 KB) og kastes.
- J3-sjekken (samme navn som i dag) blir `check()` i stedet for `skip()` i ekte modus: **minst ett** observert skrivekall, og **ingen** inneholder `dealership_id`. Feiler lukket: ingen observerte skrivekall (vakuøst), ikke-parsbar/for stor kropp, eller manglende observatør ⇒ FEIL, ikke OK. Ved feil skrives bare metode, tabell og nøkkelnavn.
- Planendring (`partialInReal` for J3 fjernes) gjøres **først etter review og en ekte kjøring** som viser J3 = OK. Frem til da forblir L5a DELVIS og J3 hindrer full PASS. Dette er en endring av PASS-kravene og krever eksplisitt beslutning.

## 5. Hvordan det kan testes uten å logge sensitive data
Offline (vitest, ingen Supabase), mot en lokal måleserver:
1. Videresendingen er uendret: status, svarkropp og headere kommer tilbake, målet mottar identiske byte (inkl. `Authorization`/`apikey`, som aldri lagres).
2. **Ingen lekkasje:** send forespørsler med unike sentinel-verdier i kropp-verdier, headere, cookies, spørrestreng og URL; etter kjøring inneholder hverken registreringene, den formaterte feilmeldingen, stdout eller stderr noen av dem (kun nøkkelnavn passerer allowlist).
3. **Negativ kontroll:** en kropp med `dealership_id` (objekt og array-element) gir FEIL; en kropp uten gir OK.
4. Feiler lukket: 0 skrivekall, ugyldig JSON, for stor kropp, ukjent tabell ⇒ ikke OK.
5. Kryssjekk mot uavhengig kilde: kjør emulatorløpet av `econ006` gjennom observatøren og sammenlign nøkkelsettene med emulatorens egen `bodyKeys`-logg (må være like).
6. Statisk: ingen `console`/`write` av kropp, headere eller URL i observatøren; ikke-lokalt mål avvises.
7. Mutasjon: en midlertidig variant av appens lagring som sender `dealership_id` i kroppen må gi FEIL (kun i en kastet kopi, ikke innsjekket).
Merknad om eksisterende emulatorsjekk: `mini-supabase` registrerer `Object.keys(body)`; for en arraykropp gir det indekser, ikke feltnavn. Appen sender objekter, så dagens sjekk er gyldig, men observatøren bør håndtere arrayer eksplisitt.

## 6. Risiko og åpne spørsmål (til beslutning)
- Proxyen står på stien for alle økt- og auth-kall i econ006-løpet; feil i videresending kan gi falske feil (ikke falske OK, siden sjekken feiler lukket).
- Byggetids-URL (`NEXT_PUBLIC_SUPABASE_URL`) endres for dette ene løpet; cookienavn og CORS (forhåndsforespørsler videresendes til stakken) må verifiseres i en ekte kjøring.
- Kostnad: én liten støttefil + wiring i `backend.mjs`/`econ006` + ca. 8 offline-tester; ingen ekstra innlogginger eller tid av betydning.
- Beslutning trengs om: (1) om alternativ 1 skal implementeres, (2) at J3-sjekken da blir `check()` i ekte modus og at `partialInReal` fjernes først etter vellykket ekte kjøring.
