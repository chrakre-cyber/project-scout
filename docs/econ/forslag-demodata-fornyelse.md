# Forslag: fornyelse av syntetiske demodata — gjennomføringsforslag (ikke implementert)

**Status:** IMPLEMENTERT 21.10.2026 (ECON-006e, Christians beslutning etter forslaget; til uavhengig review). Teksten under er det opprinnelige forslaget; **avvikene fra forslaget står her og gjelder foran teksten under** (reviewens to presiseringer er tatt inn):

1. **Epoken må være ≤ nå — ingen toleranse** (forslagets `now + 5 min` er fjernet). Eksakt nåtid godtas, ett sekund frem avvises. Epoken justeres eller klemmes aldri; ugyldig epoke ⇒ alle kall feiler som `unavailable` («Kilden kunne ikke leses»), ingen fallback til standardepoken.
2. **`modifiedAt`/`sourceModifiedAt` og innhold er uendret** (ikke gjort relative): revisjonsgrunnlaget i `src/adapters/search-candidate/candidate.ts` inkluderer `sourceModifiedAt` og er ikke endret. Bare `observed` (`firstSeenAt`/`lastSeenAt`) fornyes, derfor er kandidat-id og revisjon byte-identiske med før fornyelsen (baseline `tests/fixtures/synthetic-identity-baseline.json`, tatt før endringen). Fixturene er derfor **ikke** omformet til relative forskyvninger: de absolutte observasjonstidene er en mal som avbildes monotont (heltall, BigInt, hele sekunder) inn i `[epoke − 48 t, epoke]` i `epoch.ts` (`renewObservations`). Rekkefølgen mellom alle observasjonstider bevares; spredningen komprimeres til 48 t.
3. Epoken har tre gulv i tillegg til «≤ nå»: eksakt format `ÅÅÅÅ-MM-DDTTT:MM:SSZ`/ekte dato; vinduets start ≥ rettighetsprofilens `validFrom` (2026-10-01); vinduets start ≥ datasettets siste `modifiedAt` (2026-10-05T09:00Z).
4. Standardepoken `SYNTHETIC_DEFAULT_EPOCH` = `2026-10-21T06:50:00Z` (implementeringstidspunktet, UTC). Overstyring: `SCOUT_SYNTHETIC_EPOCH` (server-only, lest bare i `epoch.ts`; tom verdi = ikke satt).
5. Merking: `Syntetisk generert <dd.mm.åååå> — ikke hentet fra leverandør` (UTC-dato fra epoken) vises i søkeskallet (`layout-generated-label`) ved siden av den uendrede `SYNTHETIC_ATTRIBUTION`; vises ikke når epoken er ugyldig. Proveniens (`description`, `normalizationNotes`) bærer samme tekst og et notat om at tidene er simulert; begge ligger utenfor revisjonsgrunnlaget.
6. Vinduet gjelder `firstSeenAt` og `lastSeenAt`; utløp er uendret: tidligste utløp ≥ epoke + 5 d, seneste ≤ epoke + 7 d.
7. Tester: `tests/synthetic-epoch.test.ts` (19). Nettleser: `tests/e2e/econ006.e2e.mjs`/`econ006d.e2e.mjs` kjører nå den **uendrede** appen med `SCOUT_SYNTHETIC_EPOCH`; `fresh_observations`-patchen er fjernet.
8. **Fornyelsesrutine:** se `src/providers/marketplace/synthetic/fixtures/FIXTURES.md` § «Fornyelse».


## 1. Problem og krav
Demoens `lastSeenAt` er faste datoer (siste 4.10.2026 + `demo-variation` 8.10.2026). Økonomiberegningen avviser kildedata eldre enn rettighetsprofilens oppbevaringstid (7 døgn): `sourceUntil = retentionExpiresAt(profil, lastSeenAt)` i `src/server/search-economics.ts` (verifisert: **bare `lastSeenAt` styrer utløpet**; `firstSeenAt` brukes til sortering i `search-run.ts` og visning). Fra 11.10.2026 gir den uendrede appen «Ikke beregnet — kildedataene er for gamle» for alle demoannonser (nettleserbelagt i 006c).

Føringer (Christian 21.10.2026): (1) eksplisitt, validert datasett-epoke; (2) observasjoner i et vindu på **0–48 timer før epoken**; (3) tydelig «syntetisk generert — ikke hentet fra leverandør»; (4) uendret utløpskontroll og uendret beregningsperiode (2026); (5) **ingen automatisk rullering** som gjør data evig ferske.

## 2. Anbefalt standard og overstyring
- **Innebygd standardepoke** (committed konstant): tidspunktet datasettet ble generert, satt ved implementeringen — f.eks. `2026-10-21T12:00:00Z` (verdien fastsettes i implementeringscommit). Standarden endres bare ved en bevisst ny «fornyelses»-commit.
- **Server-only overstyring `SCOUT_SYNTHETIC_EPOCH`** (valgfri): ISO-UTC `YYYY-MM-DDTHH:MM:SSZ` for å klargjøre en demo uten kodeendring. Leses bare i én fil (`epoch.ts`), på samme måte som `SCOUT_PUBLIC_ID_KEY` i `public-ids.ts`; arkitekturtesten som låser listen av miljøvariabler oppdateres bevisst. Ikke `NEXT_PUBLIC_`; aldri sendt til klienten.
- **Anbefaling:** standard + overstyring. Konstanten gir deterministiske tester og et definert utgangspunkt; overstyringen lar eier klargjøre en partnerdemo uten ny deploy av kode (kun konfigurasjon). **Ingen** utledning fra «nå».

## 3. Designet (fil for fil)
| Fil | Endring |
|---|---|
| `src/providers/marketplace/synthetic/epoch.ts` (ny, ren) | `SYNTHETIC_DATASET_VERSION` («syn-2026-10-21.1»), `SYNTHETIC_DEFAULT_EPOCH`, `OBSERVATION_WINDOW_HOURS = 48`, `resolveSyntheticEpoch({ env, now }) → { epoch, source: "default" \| "override" }` og feilklassen `SyntheticEpochError` (koder under). Eneste fil som leser `process.env.SCOUT_SYNTHETIC_EPOCH`. Klokken injiseres (`now`), brukes **bare til validering**, aldri til å beregne observasjonstidspunkt |
| `fixtures/*.ts` + `raw.ts` | `observed` endres fra absolutte datoer til **relative forskyvninger** `{ firstSeenHoursBeforeEpoch, lastSeenHoursBeforeEpoch }` med `48 ≥ first ≥ last ≥ 0` (heltall timer). `modifiedAt` (kildens endringstid) blir også relativ (`modifiedHoursBeforeEpoch`, ≥ first) slik at revisjonsrekkefølgen (`demo-004`, `syn-010`) bevares; `modifiedAt` er ikke en observasjon og kan ligge utenfor 48 t-vinduet |
| Omforming av dagens data | Monoton avbildning av dagens rekkefølge på `firstSeenAt` og `lastSeenAt` inn i 0–48 t (bevarer sortering; ved lik verdi gjelder dagens tie-break på id, kontrolleres i `search-run.ts`). Håndskrevne poster får håndsatte forskyvninger; genererte poster utledes deterministisk av indeksen (ingen tilfeldighet) |
| `normalize.ts` | `firstSeenAt = epoke − first`, `lastSeenAt = epoke − last` (UTC, sekunder). Proveniens: `description` og to `normalizationNotes`: `synthetic_dataset=<versjon>` og `synthetic_epoch=<ISO>`; beskrivelsen sier at dataene er **generert, ikke hentet fra leverandør, og at observasjonstidspunktene er simulerte relativt til generert-tidspunktet** |
| `provider.ts` | Tar `epoch` som valgfri opsjon (tester); ellers `resolveSyntheticEpoch(...)` **én gang ved konstruksjon**. Ugyldig epoke ⇒ alle kall feiler som `unavailable` (eksisterende «Kilden kunne ikke leses») — aldri stille fallback til standard |
| Visning | Eksisterende etikett «Syntetiske demodata – ikke ekte leverandørdata» (`SYNTHETIC_ATTRIBUTION`) beholdes uendret (mange tester/e2e låser strengen). Ny fast linje ved siden av på kort, detalj og skall: **«Syntetisk generert <dd.mm.åååå hh:mm UTC> — ikke hentet fra leverandør.»** (dato fra notatet `synthetic_epoch`, via en liten ren hjelper; ingen nye felt i `NormalizedListing`, så kandidatadapterens lukkede nøkkellister røres ikke) |
| Uendret | `provider-rights.ts` (oppbevaring 7 d), `search-economics.ts`, `to-cost-assessment.ts`, `DOCUMENTED_RULE_PERIOD` (2026), alle økonomiregler/flagg, kandidat-id/revisjonsavtrykk (observasjonstid ligger utenfor avtrykket — bekreftet i 006c) |

## 4. Validering av epoken (fail-lukket)
| Kode | Betingelse |
|---|---|
| `epoch_format` | ikke strengt `YYYY-MM-DDTHH:MM:SSZ`, eller ugyldig kalenderdato/tid |
| `epoch_future` | senere enn `now + 5 min` (så ingen observasjon ligger i fremtiden: `source_observation_in_future` finnes allerede som vern) |
| `epoch_before_profile` | tidligere enn rettighetsprofilens `validFrom` (2026-10-01T00:00:00Z) |
Ingen øvre aldersgrense: en gammel epoke er gyldig og gir **utløpte** data — det er ønsket, ærlig atferd. Epoken flyttes aldri av koden.

## 5. Ingen evig ferskhet (eksplisitt)
- Observasjonstidspunkt = epoke − (0…48 t), **faste** — aldri `now − x`.
- Dermed er hver post brukbar fra epoken til `epoke − last + 7 d`, dvs. **minst 5 døgn og høyst 7 døgn** etter epoken; deretter «Ikke beregnet — kildedataene er for gamle» (uendret kontroll). Posten med `last = 48 t` utløper først (epoke + 5 d), posten med `last = 0` sist (epoke + 7 d).
- Test og statisk skann sikrer at ingen kode i den syntetiske kilden leser klokken for å sette observasjonstid (`Date.now`, `new Date()` uten argument, `setInterval/cron` i epoke-/fixturekode).
- Rutine for partnerdemo: eier setter `SCOUT_SYNTHETIC_EPOCH` til klargjøringstidspunktet og restarter; etter ca. 5 døgn må det gjentas — avtalen med partner bør si at demodata er «generert <dato>».

## 6. Nødvendige tester (må med)
1. **Epokevalidering** (injisert klokke): format, fremtid, før profil, gyldig; ugyldig ⇒ kildefeil (alle kall `unavailable`), aldri fallback.
2. **Vindu:** for alle poster `epoke − 48 t ≤ firstSeen ≤ lastSeen ≤ epoke`; `modifiedAt ≤ firstSeen`; revisjonsrekkefølge og dedupliseringsregler uendret (eksisterende DEV-003-tester).
3. **Utløp uendret:** ved `now = epoke + 4 d 23 t` er alle poster brukbare for økonomi; ved `epoke + 5 d + ε` utløper den første; ved `epoke + 7 d + 1 s` er alle utløpt (`sourceUntil`, `source_data`-begrensning og «kildedataene er for gamle» i visning). Samme test viser at profilens oppbevaring (604 800 s) ikke er endret.
4. **Identitet:** snapshot av alle offentlige id-er, kandidat-id-er og revisjonsavtrykk før/etter endringen er identisk (observasjonstid er utenfor avtrykket); sortering i `search-run` uendret.
5. **Ingen rullering:** to provider-instanser med ulik `now` og samme epoke gir identiske tidspunkt; skann av kildekoden for klokkebruk i epoke-/fixturekode.
6. **Proveniens og merking:** beskrivelse og notater inneholder «generert» og «ikke hentet», aldri «hentet»; den nye linjen vises på kort og detalj; eksisterende etikett uendret.
7. **Miljøvariabel:** arkitekturtesten oppdateres bevisst (én ny variabel, bare lest i `epoch.ts`, aldri `NEXT_PUBLIC_`, aldri i klientkode).
8. **Regresjon:** hele vitest-suiten, spesielt `synthetic-dataset`, `normalize`, DEV-003/-005-tester og 005/006-økonomitestene.
9. **Nettleser (006c/d-oppsettet):** fjern `fresh_observations`-patchen; kjør den **uendrede** appen med `SCOUT_SYNTHETIC_EPOCH = nå − 1 t` (forventer samme resultater som i dag uten patch), pluss tre negative løp: epoke > 7 d gammel (alt «for gammelt»), epoke i fremtiden (kildefeil), ugyldig format (kildefeil).
10. **Uavhengig review** (ærlighets-/proveniensflate) og reviewerens egen kjøring av punkt 1–8.

## 7. Nødvendig vs valgfritt
**Nødvendig:** punkt 3 (relative forskyvninger, epoke, validering, proveniens/merking), tester 1–9, oppdatering av `FIXTURES.md`/README/TEST_PLAN, beslutningslogg.
**Valgfritt (ikke anbefalt nå):** `npm`-skript som skriver ut gjeldende epoke og utløpsvindu · «data eldes om N dager» i etiketten · dedikert «demo klargjort»-side · rullerende utviklermodus (**frarådes**: gjør data evig ferske) · flere/andre fixtureposter.

## 8. Risiko og avgrensning
- Omforming av `observed` i ~110 poster krever gjennomgang av alle tester som antar dagens datoer (grep: `synthetic-dataset`, `normalize`, DEV-005-kjøringer, eksempeldata); estimert som hoveddelen av arbeidet.
- Komprimering til 48 t kan gi like `firstSeenAt`; sorteringens tie-break må være deterministisk (verifiseres).
- Demoen blir først brukbar for økonomi når epoken er satt til en nylig dato; standarden (committed) vil selv utløpe — bevisst.
- Påvirker ikke noen rettighets-, avgifts- eller økonomiregel, og ingen ekte kilde.

## 9. Beslutninger jeg trenger fra Christian
**D1** godkjenner du designet (relative forskyvninger, 0–48 t, standard + `SCOUT_SYNTHETIC_EPOCH`)? · **D2** ordlyd på merkelinjen: «Syntetisk generert <dato> — ikke hentet fra leverandør.» (eller annen) · **D3** skal standardepoken være implementeringstidspunktet (anbefalt) eller en annen fast dato? · **D4** godkjenner du at `FIXTURES.md`/README får fornyelsesrutinen (eier setter epoke før demo)? Estimat (utførelsestid): ≈ 1 dag + uavhengig review.
