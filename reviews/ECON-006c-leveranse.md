# ECON-006c — brukerforløp i nettleser (levert til uavhengig review)

**Oppgave:** ECON-006c. **Status:** levert til uavhengig review. Ikke DONE. **ECON-005 og ECON-006 er IKKE erklært ferdige** — det skjer først etter uavhengig review av 006c. Økonomiflaggene er `false`; ingen nye beregningsregler, avrundingsvalg eller utvidelse av kjøretøyomfang; ingen hosted migrasjon, ingen deploy. Samtidig registrert: ECON-006b DONE (`reviews/ECON-006b-avslutning.md`).

## Hva som faktisk er verifisert, og med hva
| Lag | Hva det er i denne kjøringen | Verifisert |
|---|---|---|
| Appen | Ekte, bygd Next-app (`next build` + `next start`) i **ekte Chromium** (Playwright), desktop 1280 px og mobil 390 px | ja |
| Auth / PostgREST | **EMULATOR** (`tests/e2e/support/mini-supabase.mjs`), IKKE Supabase. Videresender appens kall til isolert PostgreSQL som rolle `authenticated` | emulatoren, ikke GoTrue/PostgREST |
| Database | **Isolert PostgreSQL 16-klynge** (alle migrasjoner anvendt); RLS, constraints og triggere er PostgreSQLs egne | ja (men uten Supabase-miljøet rundt) |
| Kilde | Syntetiske demoannonser (ikke mobile.de) | – |
| Mock | Bare i vitest (sesjon/utkast/lagring i side-/action-testene fra 006b) — brukes ikke i nettleserkjøringen | – |
| **Ekte Supabase/PostgREST/GoTrue** | **IKKE kjørt.** Egen, nødvendig kontroll hos eier før pilot (B6) | **nei** |

## Resultat
`bash scripts/test-e2e-econ006.sh`: **88 av 88 sjekker OK** (`reviews/ECON-006c/e2e-resultat.txt`, hele loggen `e2e-run-green.log`, 18 skjermbilder i `reviews/ECON-006c/screenshots/`). Kjøringen bygger appen fire ganger (uendret app + tre testkopier, se under) og tok ca. 8–10 minutter. Det tok 11 kjøringer å få grønt; alle rettinger underveis var **testforventninger/testoppsett**, ingen produksjonskode ble endret (se «Funn»).

Forløp som er dekket i nettleser:
- **Forhandlerskjema** (J2–J4): tomt skjema uten forhåndsutfylling; norske feltfeil; ingenting lagres ved feil; uten uttrykkelig bekreftelse lagres ingenting; fokus til feiloversikt; Tab når alle felt og knappen.
- **Lagring og gjenåpning**: rad lagret under firma A fra sesjon (appen sender aldri `dealership_id`); gjenåpning forhåndsutfyller (kurs med komma) men bekreftelsen er aldri avkrysset.
- **Diesel / PHEV / BEV** (J9, B7): diesel (Audi A6) **«Estimat — ikke validert: 830 583 kr»**, PHEV (Toyota RAV4) **1 097 958 kr**, BEV (Tesla Model 3) **to merkede scenarioer 384 727 / 459 727 kr** (med/uten elbilfritak; EV-kvalifisering er ikke innsamlet og vises som «kan ikke registreres ennå»). Nedbrytningen summerer til brutto utlegg, to summer vises, kurser med kilde/dato, «ikke rådgivning» i tillegg til usikkerhet. **Referanser:** uavhengig utledet med eksakt BigInt-aritmetikk (`tests/e2e/support/econ006-reference.mjs`) og avgifter fra de gyldne fixturene (CASE-003/-001/-002); `tests/economics-006c-reference.test.ts` kontrollerer referansene mot kjernen og fixturene. **Alle er B-Merovo-scenario / fixturekonvensjon (U-013 halvt opp) — ikke produksjonsregler.** Kjøretøydata i skjemaet er fixtureinput, ikke annonsens.
- **Manglende opplysninger**: delvis input gir aldri estimat; transport vises som «ukjent» (ikke 0); «Hva mangler?» lenker til faktiske skjemafelt.
- **Avrundingslikhet** (Passat, 585 082 × 25 % = 146 270,50): U-013 uavklart ⇒ **«Minst 1 065 075 kr (ufullstendig)»**, aldri punktestimat.
- **Utløpt kurs**: «må bekreftes på nytt: oppgitt kurs er utløpt», ingen tall fra gammel bekreftelse; aktiv ny bekreftelse gir estimat igjen.
- **Foreldet bekreftelse**: endret kostnadsgrunnlag i søket (gjort via søkeskjemaet) ⇒ «kostnadslinjene i søket er endret», gammel søkeversjon avvises, skjema forhåndsutfylt og krever aktiv ny bekreftelse.
- **Omfang/fordeling** (S2, transport 12 000 kr): feil sum avvises; korrekt fordeling lagres i øre.
- **Firmaprofil**: lagring, gjenåpning, gjelder bare der annonsen ikke har egen verdi; annonsens egen (også «ukjent») vinner.
- **Annet firma**: B får ikke se A sitt detalj/skjema/resultat/profil; B sin samme annonse har ingen av A sine opplysninger; **manipulert søk-id, falsk `dealershipId`, manipulert konfliktmarkør og markør mot annen annonse-id avvises uten skriving** (DOM manipulert i nettleser før innsending); gyldig innsending fra B lagres under B.
- **Rettighetsavslag** (egne app-kopier, se under): visning av økonomi nektet ⇒ kort «unavailable» uten tall, ingen forklaring, ingen lenke, direkte URL til skjema viser «kan ikke vises» uten skjema/markør. `listing_id` nektet ⇒ økonomien virker, men leverandørens annonse-id finnes ingen steder i HTML/RSC, og innsending virker fortsatt.
- **Kildefeil**, **anonym** (omdirigert), **foreldet kildedata** (se funn 1).
- **Rå identitet**: ingen kandidat-id (`<lengde>:synthetic-demo/…`) eller revisjonsavtrykk i skjemaets DOM, rå SSR/RSC-nyttelast, detaljside eller noen av **alle** action-svar (alle brukere og bygg); skjulte felt er bare `searchId`, opak `listingId` og `bindingMarker`.
- **Aldri positive budsjettutfall**: alle kort og detaljer har `data-positive-budget="false"`; kostnadsvurderingen mot budsjett er fortsatt «ikke beregnet»; ingen budsjettspråk (de faste forbeholdene som nekter «innenfor budsjett» er unntatt fra skanningen).
- **Mobil 390 px**: ingen horisontal rulling (skjema, detalj, profil), treffflater ≥ 40 px. Ingen JavaScript-feil i konsollen.

## Hvordan rettighetsavslag ble testet uten testkrok
Produksjonskoden har ingen mulighet til å endre rettighetsprofilen. Skriptet bygger derfor **midlertidige kopier** av appen (`tests/e2e/support/patched-build.mjs`) med en eksakt tekstendring og starter dem på egne porter: (a) `deny_economics_display`, (b) `deny_listing_id`; begge også med (c) `fresh_observations` (se funn 1). Patchene feiler høyt hvis teksten de endrer ikke lenger finnes. Repoets kode røres aldri; kopiene slettes.

## Funn (ingen krevde endring av produksjonskode)
1. **Demoens kildedata er «for gamle» for økonomi i dag.** Demoannonsenes observasjonstidspunkt er faste datoer (siste 4.10.2026), og kildedata utløper etter rettighetsprofilens oppbevaringstid (7 døgn). Fra 11.10.2026 gir den uendrede appen «Ikke beregnet — Beregningen er utløpt: kildedataene er for gamle» for alle demoannonser (fail-lukket, verifisert i nettleser). Hovedløpet bruker derfor en testkopi med «sist sett = nå minus 1 time» (revisjonsavtrykket påvirkes ikke). **Produktkonsekvens:** en partnerdemo etter 11.10.2026 viser ingen økonomi uten at demodataene får oppdaterte tidspunkt — utenfor 006c-omfang; krever en beslutning.
2. **Uten forhandlerinput vises «Minst … (ufullstendig)»** (nedre grense) på kort/detalj, ikke alltid «Ikke beregnet». Det er riktig atferd; testforventningen ble rettet.
3. **Avrundingslikhet U-013** treffer reelle demoannonser (f.eks. syn-036): resultatet er en nedre grense. Regelen er fortsatt uavklart.
4. **Databasevern bekreftet i nettleserkjøringen:** nøkkelen til en bekreftelse (kandidat/revisjon) kan ikke endres (`dealer_input_immutable`), og en rad uten bekrefter (`confirmed_by` NULL) leses ikke som tillit (fail-lukket).
5. BEV når ikke punktestimat (EV-kvalifisering innsamles ikke) — uendret fra 006a; vist som to scenarioer.

## Simuleringer (merket i sjekkene)
«Ny annonserevisjon» og «endrede rettigheter» kan ikke oppstå i demoen under en kjøring. De er **simulert ved å endre lagret rad i testdatabasen** (oppdateringstriggeren slås av midlertidig akkurat mens raden endres, i den isolerte testdatabasen, aldri i appen). Selve foreldelseslogikken er også dekket i vitest (005c/006b).

## Kontroller (utvikler)
- Nettleser: 88/88 (over). **Mutasjonskjøring:** rå kandidat-ID som React-nøkkel ⇒ fanget av rå-SSR/RSC-sjekken; forhåndsavkrysset bekreftelse ⇒ fanget av tomt-skjema-sjekken (`reviews/ECON-006c/e2e-mutasjonskjoring.txt`; kildene gjenopprettet og verifisert rene).
- `npx vitest run`: 70 filer / **1 633 tester grønne** (inkl. `economics-006c-reference.test.ts`, 8 tester). `tsc`, `eslint .`, `check-docs.mjs` rene/OK; `npm run build` OK; `qa:secrets` ingen funn; `qa:demo` bestått.

## IKKE verifisert
- **Ekte Supabase/PostgREST/GoTrue** (JWT-nøkler, PostgREST-feilkoder, Auth-flyt). Emulatorresultater må ikke omtales som bekreftet Supabase-integrasjon.
- Rettighetsvarianter utover (a) visning av økonomi nektet og (b) `listing_id` nektet: prisvisning nektet, ingen beregningsrett for registrering/spesifikasjoner, trukket/utløpt profil — dekket bare i vitest (006b side-/action-tester, statisk rendring), ikke i nettleser. Forfalsket **server-action-POST på protokollnivå** mot en app med nektet rett er ikke prøvd (kun via vitest-action-testene).
- Andre nettlesere enn Chromium, ekte mobil, skjermleser; visuell/språklig vurdering av tekstene av en uavhengig leser.
- Datoer er relative til kjøredato (kursgyldighet til +20 dager, norsk registreringsdato +10 dager): kjøring etter utløpet av 2026-regelperioden vil gi andre resultater.
- DB-suiten (Supabase-avhengige filer), hosted migrasjon, deploy, mobile.de.

## Neste oppgave
Uavhengig review av 006c. Først deretter kan det vurderes om ECON-006 (og med forbehold ECON-005: E8 `EconomicTarget` åpent/utsatt, E7 utsatt, ekte Supabase-kontroll gjenstår) kan avsluttes — det er Christians beslutning. Separat beslutning trengs om demoens utløpte kildedata (funn 1).
