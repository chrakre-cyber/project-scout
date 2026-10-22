# CI-001 — resultat av Actions-kjøring 39603111353 med L6-diagnostikk (til uavhengig review, 21.10.2026)

**CI-001 forblir REVIEW.** Ingen kode, tester, RLS, grants, migrasjoner eller PASS-krav er endret etter 7e3e549. Ingen ny kjøring er startet. Ingen endring på `main`, innstillinger, hosted miljø eller deploy. L3c utsatt, økonomiflagg `false`, E7 utsatt, E8 åpent.

Kjøring: <https://github.com/chrakre-cyber/project-scout/actions/runs/39603111353> · full commit `a8fe61f4688bacfbf44f84c6480b36553d52d9a4` (identisk med reviewet 7e3e549 bortsett fra dokumentasjon) · `workflow_dispatch` fra `claude/wonderful-bardeen-yussx3` · ca. 12 min · conclusion failure · samlet **IKKE FULLT BESTÅTT**. Kilde: sanert jobbsammendrag i den offentlige loggen; ikke uavhengig reviewet.

## Samme utfall som kjøring 39596080162
L1, L2, L3b (ikke Supabase), L4a (11/11), L4b (12/12, modus ekte), L5b (26/26), L7 bestått. L5a: 93 OK, 1 HOPPET = **J3** ⇒ DELVIS (uendret; ikke erstattet av API-dekning); L5 samlet DELVIS. L3a: 542, 534 bestått, **2 feilet**, 6 hoppet (de seks oppgraderingstestene, dekket av L3b). L6: 12/14. De samme **to** testene feiler (telles i både L3a og L6). Stakk-images er nå rapportert fra `public.ecr.aws/supabase/*` (samme versjoner: gotrue v2.197.0, kong 2.8.1, postgres 17.11.0.002, postgrest v16.4).

## Diagnostikken, sammenholdt med testenes forventning
Operasjonene er i den rekkefølgen testen utfører dem. Forventning er lest fra `tests/db/rest-isolation.test.ts`.

**Test 1 — «eget firma: POST, GET, PATCH; duplikat gir 409 (23505)»**
| # | Operasjon | Faktisk | Forventet | Utfall |
|---|---|---|---|---|
| 1 | POST A | 201 | 201 | som forventet |
| 2 | POST B | 201 | 201 | som forventet |
| 3 | POST A (duplikat) | 409 / 23505 | 409 / 23505 | som forventet |
| 4 | GET A | 200 | 200, kun eget firma | som forventet |
| 5 | **PATCH (uten filter)** | **400 / 21000** | **200** | **avviker — her feiler testen** |

**Test 2 — «på tvers av firma: B ser/endrer ikke As profil; …»**
| # | Operasjon | Faktisk | Forventet | Utfall |
|---|---|---|---|---|
| 1 | GET (filter på As firma, som B) | 200 | 200, tom | som forventet |
| 2 | GET (som B) | 200 | 200, kun B | som forventet |
| 3 | PATCH (filtrert på As firma, som B) | 200 | 200, tom | som forventet |
| 4 | POST med falsk dealership_id (A) | 403 / 42501 | 403 / 42501 | som forventet |
| 5 | POST med dealership_id (B) | 403 / 42501 | 403 / 42501 | som forventet |
| 6 | **PATCH (uten filter, `dealership_id`-flytting)** | **400 / 21000** | **403 / 42501** | **avviker — her feiler testen** |

(Testene kjører operasjonene sekvensielt og stopper ved første brutte påstand. At neste operasjon i det hele tatt ble sendt, viser at påstandene før den holdt — inkl. radinnholdet i #1–#4/#2. Statuser og koder er det diagnostikken registrerer; radinnhold er ikke registrert.)

## Vurdering
- **Hvilken operasjon feiler:** i begge tester den **ufiltrerte PATCH** (de eneste to i `tests/db/`): HTTP **400**, kode **21000** (`cardinality_violation`). Alle øvrige operasjoner, også de filtrerte PATCH, POST-avvisningene (403/42501) og duplikatet (409/23505), oppfører seg som testene forventer.
- **Feil 2 er selvstendig, ikke en følgefeil.** Test 1 fullførte oppsettet (A og B opprettet, #1–#4 som forventet) før den feilet på siste operasjon. Test 2 nådde sin egen operasjon #6 med alle foregående påstander holdt, og avviker først der. Begge feiler på samme type operasjon, ikke fordi den ene bygger på den andres feil.
- **Ikke RLS-avvisning:** RLS og kolonnerettigheter gir 403/`42501` i denne stakken (se #4/#5 i test 2) og filtrert PATCH som B gir 200 med 0 rader. Avvisningen 400/21000 er en annen mekanisme og skjer før testens forventede RLS-/grant-utfall; testens `move`-påstand (403/42501 for flytting av `dealership_id`) har derfor **ikke blitt evaluert mot RLS/grants i ekte stakk**. Ingenting her viser en RLS-svakhet, og ingenting bekrefter kolonnerettighetsvernet for akkurat den operasjonen — det gjenstår å dekke.
- **Årsak:** status 400 og SQLSTATE 21000 på nøyaktig de to ufiltrerte skrivingene er sterkt forenlig med en «krever WHERE»-regel i stakkens API-lag (som pg-safeupdate). **Dette er ikke bekreftet:** feilmeldingsteksten, hvilken komponent som avviser, og om safeupdate er aktiv i stakken er ikke registrert (diagnostikken tar bevisst ikke med meldingstekst). Jeg påstår derfor ikke at safeupdate er årsaken; dagens belegg er statuskode + SQLSTATE + at kun ufiltrerte operasjoner rammes.
- **Hva som ikke er undersøkt:** om avvisningen kommer fra PostgREST-konfigurasjonen eller en databaseutvidelse; om andre skrivinger uten filter i andre tabeller ville vært avvist (ingen slike finnes i testene).

## Videre (venter på beslutning — ikke gjort)
1. Review av dette resultatet.
2. Beslutning om retting av testene: gi de to PATCH-kallene filter på eget firma (`?dealership_id=eq.<firma>`), slik appen selv gjør. Det beholder intensjonen («eget firma kan endre», «flytting av `dealership_id` avvises»), men endrer testkoden og krever din godkjenning. Rettingen kan ikke bekrefte at kolonnerettighetene avviser flytting før den kjøres mot ekte stakk.
3. Ingen RLS-/grantendring er indisert av dagens belegg.
