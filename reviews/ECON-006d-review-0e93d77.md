# ECON-006d – uavhengig review av 0e93d77

Grunnlag: `ECON-006d-review-0e93d77.zip`, testkode, manifest, nettleserlogger og forslagene for demodata og Supabase.

## Konklusjon

**Ingen blokkerende funn i den leverte testendringen.** ECON-006d kan avsluttes som avgrenset testleveranse. Forslaget for demodata trenger de to presiseringene nedenfor før implementering. Dette er ikke godkjenning av Supabase-integrasjon, hosted migrasjon, deploy eller pilotklarhet.

## Testrestene

- Testene går gjennom `previewForDisplay`/`detailForDisplay` og dekker ukjent rettighetsprofil, utkastprofil, ukjent drivlinje og ikke støttet registreringsscenario.
- B1 prøves på begge sider av 2026-perioden, med positivt kontrolltilfelle innenfor perioden. Det kontrolleres at avslagsårsak videreføres og at resultatet ikke blir et punktestimat.
- J5 skiller uttrykkelig ukjent fradrag fra ukjent elbilkvalifisering: diesel har én bruttoverdi og to kostnadsscenarioer; BEV har fritaksscenarioer; begge ukjente gir fire merkede kombinasjoner.
- Nettleserskriptet og loggen dokumenterer utviklerens 26/26 kontroller. Feil gir ikke suksess-exit. Midlertidige appkopier og emulator er synlig avgrenset fra produksjon og ekte Supabase.
- Begrensningen i kontantscenariovisningen er korrekt dokumentert: brukeren får «Fra … (scenarier)», ikke en egen full liste med alle kontantverdier. Det er ikke fremstilt som levert detaljvisning.

## To presiseringer før demodata implementeres

### 1. Avvis fremtidig epoke strengt

Forslagets §4 bruker `now + 5 min`, samtidig som kravet er at epoken ikke ligger i fremtiden. En epoke to minutter frem i tid og en observasjon med forskyvning 0 gir en fremtidig `lastSeenAt`. Den eksisterende økonomikontrollen vil fortsatt avvise observasjonen, men forslaget garanterer dermed ikke at alle genererte observasjoner ligger i fortiden.

Bruk `epoch <= now` uten fem minutters toleranse. Test eksakt nåtid og ett sekund frem i tid. Ikke svekk `source_observation_in_future`, ikke klem eller flytt epoken automatisk.

### 2. Bevar revisjonsgrunnlaget ved ren observasjonsfornyelse

Forslaget gjør `sourceModifiedAt` relativt til epoken, men krever samtidig uendrede revisjonsavtrykk. Det er uforenlig med dagens kontrakt: `revisionBasis` i `src/adapters/search-candidate/candidate.ts` inkluderer uttrykkelig `sourceModifiedAt`, mens `firstSeenAt`, `lastSeenAt` og normaliseringsnotater er utelatt.

Ved ren observasjonsfornyelse anbefales å bevare innhold og `sourceModifiedAt` og bare fornye de simulerte observasjonstidene/proveniensen. Dersom datasettinnhold eller endringstid faktisk skal endres, må ny revisjon og ny forhandlerbekreftelse være en uttrykkelig forventet konsekvens. Ikke endre revisjonskontrakten for å få en «uendret identitet»-test grønn.

## Supabase-forslaget

Forslaget skiller nødvendig lokal/hosted verifikasjon fra emulator og valgfri CI. Rapporterte nettverks-/registerproblemer gjelder Claudes miljø; reviewer har ikke gjentatt dem eller verifisert at et annet miljø har nødvendig tilgang. Den eldre formuleringen om at verktøy mangler bør leses sammen med den nyere kartleggingen om installerte verktøy og blokkert register/API.

Ingen gjennomføring mot et hosted prosjekt eller bruk av betalt tjeneste er godkjent her. Valg av kjørested, opprettelse av tomt testprosjekt og tillatelse til migrasjoner må fortsatt være eksplisitt. Et testskript som fjerner emulatoren må testes mot ekte Auth/PostgREST og ikke bare gjenbruke emulatorens antakelser om brukere, roller og feilkoder.

## Reviewerens egne kontroller

| Kontroll | Resultat |
| --- | --- |
| Manifest | 627 av 627 SHA-256-oppføringer stemmer |
| Kjørbare tester | 69 filer / 1 519 tester består |
| TypeScript (`--noEmit --incremental false`) | Består |
| ESLint | Består uten feil eller advarsler |
| Produksjonskode mot b2f57b2 | 148 filer under `src/` sammenlignet, ingen endret |

Eksisterende lokale avhengigheter er brukt. `tax-engine.test.ts` og `economics-source-driven.test.ts` er ikke kjørt fordi primærkildene mangler i pakken. Reviewer bekrefter derfor ikke selv utviklerens fulle 1 645 tester.

Reviewer har ikke gjentatt 26/26-nettleserkjøringen eller kjørt PostgreSQL, ekte Supabase/PostgREST/GoTrue, build, `check-docs`, `qa:*`, hosted migrasjon eller deploy. Loggene er gjennomgått som utviklerbelegg, ikke som egen kjøring.

## Videreføring

Testrestene er tilstrekkelig dokumentert til avgrenset avslutning av 006d. ECON-005/006 kan vurderes avsluttet innen det eksplisitt avtalte estimat-/scenariomfanget dersom Christian aksepterer at ekte Supabase og hosted miljø er separate, åpne pilotkontroller. Ingen regelgodkjenning følger av en slik avslutning. Demodatafornyelse er fortsatt et eget implementeringsarbeid; økonomiflagg false, E7 utsatt og E8 åpent videreføres.
