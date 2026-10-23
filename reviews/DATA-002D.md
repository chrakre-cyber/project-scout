# DATA-002D — kjøretidslasting av rettigheter og stabile resultat-handles (23.10.2026)

**Status: REVIEW** (implementert og testet; ikke DONE før uavhengig review og produkteiers aksept). §1–§6 (vurdering) ble committet FØR kode (`54bd7ae`); §7–§11 er lagt til etterpå.
Startpunkt: `origin/main` = `ca715da` (PR #6 merget), grenen `claude/charming-cannon-zwevp6` restartet fra den. Rent arbeidstre; baseline `npx vitest run` = 95 filer / 2 141 tester grønne.

**Navnekollisjon (viktig for sporing).** Id-en «DATA-002D» er allerede brukt én gang: `reviews/DATA-002D-{retting,review-c4bf382,avslutning}.md` og migrasjon `20261022090000_data002d_rights_field_map_validator.sql` gjelder den *smale* validatorrettingen (`rights_field_map_valid` skal gi true/false), akseptert som DONE 20.10.2026. Denne oppgaven («runtime rights loading + provider result handles») er en annen leveranse og er nøyaktig det DATA-002C §4.8 pkt. 3–4 la igjen som blokkere («profiler lastes ikke fra databasen … lagret handle/proveniens»). De eksisterende filene er uendret; denne rapporten er `reviews/DATA-002D.md` uten suffiks. Ny migrasjon får egen tidsstempel/navn (`…_data002d_runtime_rights_read`). Anbefaling til produkteier: registrer oppgaven som DATA-002D-2 i backloggen (jeg endrer ikke id-en selv).

## 1. Nåværende arkitektur (lest, ikke antatt)

| Lag | Fil | Hva det gjør i dag |
|---|---|---|
| Rettighetsmodell | `src/domain/provider-rights.ts` | `ProviderRightsProfile` (leverandør, miljø synthetic/sandbox/live, versjon, status draft/verified/revoked, `validFrom`/`validUntil`, `display`/`matching` per felt (13 nøkler), `storage` (retensjon, cache, historikk, storable), `usage`, `geography{unrestricted,countries}`, `attribution`, `deepLinkRequired`, `onRevocation`, `derivedEconomics`). `validateProfile` speiler DB-constraints. `resolveRights(provider, profiles, now)` → `ResolvedRights` (inForce + profil, eller avslag med årsak `unknown_provider/not_verified/revoked/not_started/expired/invalid_profile`). Hjelpere: `canDisplay`, `canMatch`, `canDeriveEconomics`, `canDisplayEconomics`, `economicsDecision`, `toDisplayPolicy`, `restrictForMatching`, `retentionExpiresAt`, `isWithinRetention`, `geographyAllows`. Default-deny gjennomgående. |
| Profilregister | samme fil, `REGISTERED_PROFILES` | **Hardkodet liste med kun `synthetic-demo` v1.** Dette er den eneste «kilden» runtime-koden bruker; ingen database leses. |
| Lagring | `private.provider_rights_profiles` (migrasjoner 20261008/20261016/20261021/20261022) | Autoritativ tabell med samme felt som TS-profilen, vakttrigger (rettigheter kan ikke endres på plass; sletting av ikke-utkast nektes), RLS på, **alle rettigheter tilbakekalt** fra `public/anon/authenticated/service_role`. Bare `scout_ingest` kan kjøre `SECURITY DEFINER`-funksjoner, men ingen av dem *leverer profilene til applikasjonen* (`rights_profile_in_force` er revokert fra alle roller; `trusted_run_policy` leverer lagringspolicy for én kjøring, ikke profilen). |
| Proveniens | `src/domain/provenance.ts` | `InternalProvenance` (publicId, providerId, environment, `providerListingId` (rå), `rightsProfile{id,version,digest}`, `retrievedAt`, `sourceExpiresAt`, `schemaVersion`, `sourceUrlRef`, attribusjon, `correlationId`). `evaluateProvenance` → `valid/source_expired/rights_expired/rights_revoked/rights_unknown/rights_changed/unavailable` (feiler lukket). `canonicalPermissions` = profilens semantiske avtrykk. |
| Opak identitet | `src/server/public-ids.ts` | `m1_` + 24 tegn base64url av HMAC-SHA256 (nøkkel `SCOUT_PUBLIC_ID_KEY`); syntetisk uten nøkkel bruker ikke-hemmelig pepper, sandbox/live uten nøkkel kaster `PublicIdKeyMissingError` (lukket). `profileDigest` = SHA-256 av `canonicalPermissions`. |
| Visningsgrense | `src/domain/display-policy.ts`, `src/server/search-display.ts` | `applyDisplayPolicy` er eneste vei til UI (rå leverandør-id forlater aldri serveren; `DisplayItem` har kun `listing/assessment/unknowns/economics/media/enrichment`). `internalItem` bygger proveniens, evaluerer den og lager `publicId`; `opts.profiles ?? REGISTERED_PROFILES` på 3 steder (`previewInternal`, `resolveDealerTarget`, `detailForDisplay`) + `search-economics.ts`. |
| Betrodd DB-vei | `src/server/trusted-ingest.ts` | Eneste fil som leser `SCOUT_INGEST_DATABASE_URL` og importerer `pg` (arkitekturvakt i `tests/architecture.test.ts`); `server-only`; `scout_ingest`-rollen. |
| Syntetisk kilde | `src/providers/marketplace/synthetic/*` | Eneste provider; kilde-id `synthetic-demo`; BMW iX3-demoen kjører gjennom `/searches`. |

## 2. Hva som allerede dekker kravene (bevares uendret)
- Default-deny for ukjent/utkast/trukket/ikke begynt/utløpt/ugyldig profil (`resolveRights`, `stateOf`).
- Effektiv dato og utløp (`validFrom`, eksklusiv `validUntil`), versjon, leverandør, miljø, geografi (`geographyAllows`: ukjent land nektes når begrenset).
- Per-felt visning og matching adskilt; retensjon (`retentionExpiresAt`/`isWithinRetention`); avtrykk som avslører endring på plass (`rights_changed`).
- Opak Merovo-id (`publicId`) og serverintern proveniens med rettighetsprofil@versjon; rå leverandør-id er et rettighetsstyrt felt (`listing_id`).
- Skille syntetisk vs. leverandørbasert: `environment`, `SYNTHETIC_RIGHTS_PROFILE` (speiler DB-raden), id-nøkkel-regel (pepper bare syntetisk).

## 3. Hva som mangler → minimal implementasjon

| # | Mangel | Forslag (minimalt, additivt) |
|---|---|---|
| M1 | **Profiler lastes ikke fra den autoritative tabellen.** `REGISTERED_PROFILES` er en kodekonstant; en ekte leverandørprofil kan ikke nå kjøretiden uten kodeendring (det er nettopp «hardkodede antakelser»). | (a) Ny additiv, skrivebeskyttet migrasjon: `private.trusted_rights_profiles()` (SECURITY DEFINER, tom `search_path`, `stable`, returnerer alle profilrader uansett status, **kun `execute` for `scout_ingest`**, tilbakekalt fra alle andre). (b) `trustedRightsProfiles()` i `trusted-ingest.ts` (eneste fil som kjenner pool/env). (c) Ren domenemapper `profileFromRow` (snake_case → `ProviderRightsProfile`, streng og total; ugyldig rad ⇒ avvises, aldri delvis tolket). (d) Server-lasteren `loadRuntimeRights()` som bygger et `RuntimeRights`-øyeblikksbilde: syntetisk profil fra kode (miljø `synthetic` ⇒ kan ikke kreve DB; demoen skal virke uten Supabase) + DB-profiler. **Kode kan ikke levere sandbox/live-profiler** (avvises). Konflikt (samme leverandør+versjon, ulikt avtrykk i kode og DB) ⇒ leverandøren feiler lukket. DB konfigurert men utilgjengelig/ugyldig ⇒ kun syntetisk profil gjelder, alt leverandørbasert nektes (`unavailable`). Ingen cache (en tilbakekalling skal gjelde umiddelbart, DEC-028); ytelse noteres som åpent punkt. |
| M2 | **Ingen typet handle.** Kode refererer et resultat via `publicId` + hele `InternalProvenance` (som bærer rå `providerListingId`). Ingen minimal, validerbar referanse. | `ProviderResultHandle` (ren domenetype): `{ version: 1, providerId, environment, resultId (m1_…), provenanceRef, rights: { profileId, version, digest }, retrievedAt }`. **Ingen rå leverandør-id, ingen payload, ingen URL**. `createResultHandle(provenance)`, streng `parseResultHandle(unknown)` (ukjente nøkler, feil format, rå-id-lignende verdier avvises), `verifyHandleAgainstProvenance` (leverandør-, id-, rettighets- og `provenanceRef`-avvik). `provenanceRef` = avledet avtrykk (SHA-256) over proveniensens identitetsfelt — ikke en ny lagret id. Server: `verifyHandleMapping` (resultId må være HMAC av (leverandør, leverandørens id); manglende nøkkel for sandbox/live ⇒ lukket). |
| M3 | **Ingen samlet spørre-flate.** Spørsmålene «kan vises / pris / bilder / selger / lagres / hvor lenge / må oppdateres / kan lenkes / gyldig for geografi» besvares i dag av spredte kall (`canDisplay`, `toDisplayPolicy`, `geographyAllows`, `retentionExpiresAt`, `evaluateProvenance`). | `evaluateResultAccess(handle, provenance, rights, context)` → `ResultAccessDecision` (typet, alle felt default `false`/`denied` med årsak): `status`, `canDisplay`, `fields` (per felt), `canShowPrice`, `canShowImages`, `canShowSellerInfo`, `canLinkToSource`, `mayRetain`, `retentionSeconds`/`retainUntil`, `mustRefreshBeforeDisplay`/`refreshAfter`, `geographyAllowed`, attribusjon/dypelenkekrav. Bygger på eksisterende `resolveRights`/`evaluateProvenance`/`toDisplayPolicy` — ingen ny regeltolkning i spredte betingelser. |
| M4 | **Kjøretidskilden er ikke koblet inn.** `search-display.ts`/`search-economics.ts` bruker `REGISTERED_PROFILES` som standard. | Standard erstattes av `await loadRuntimeProfiles()` på de tre inngangene i `search-display.ts` (eksplisitt `opts.profiles` vinner fortsatt, så alle eksisterende tester er uendret). Uten DB-konfigurasjon (demo, CI) = samme profilsett som i dag. `InternalItem` får `handle` (serverintern; `DisplayItem`/UI uendret). |

**Ikke-mål / gjenstår bevisst:** ingen lagret handle-/proveniens-tabell (stateløst oppslag beholdes; DATA-002C §4.8 pkt. 4 forblir åpent), ingen nye leverandørvilkår eller profiler, ingen live-integrasjon, ingen UI-/ECON-endring, ingen håndheving av cache/historikk/varsler/purge utover det evaluatoren *rapporterer*.

### Publikum / «kun profesjonelle brukere» — IKKE representert i modellen
Profilen har **ingen** felt for publikum/brukertype (profesjonell vs. privat). Oppgaven sier «der det allerede er representert». Det er det ikke, så jeg **oppfinner ikke** et. Evaluatoren tar ikke imot en publikumsparameter som kunne tolkes som tillatelse; spørsmålet dokumenteres som åpent punkt (krever beslutning + migrasjon + kontraktsgrunnlag). Geografi er representert (`geography.countries`), men *hvilket* land profilens liste gjelder (forhandlerens marked, annonsens opprinnelse, bruker) er ikke spesifisert i modellen eller DATA-002B; evaluatoren tar imot et eksplisitt `geographyCountry` og behandler ukjent som nektet når leverandøren er begrenset. Semantikken markeres som uavklart i §7.

### «Må oppdateres før visning» — tolkning (flagges, ikke avgjort av kilde)
Ingen eksisterende kode bruker `cacheSeconds`. Konservativ tolkning som er konsistent med `evaluateProvenance` og default-deny: `cacheSeconds = 0` ⇒ data kan ikke serveres fra cache ⇒ `mustRefreshBeforeDisplay = true` når alderen overstiger det transiente vinduet (`TRANSIENT_FRESH_MS`, 5 min); `cacheSeconds > 0` ⇒ `refreshAfter = retrievedAt + cacheSeconds`. Dette er en implementasjonskonklusjon, ikke en leverandørrett; tolkningen noteres som uavklart.

## 4. Migrasjonspåvirkning
Én ny, additiv, skrivebeskyttet migrasjon (funksjon + grants). Ingen tabellendring, ingen data endres, ingen constraint/trigger/RLS berørt. `tests/db/qa-catalog.test.ts` pinner listen over `SECURITY DEFINER`-funksjoner og `scout_ingest`-rettigheter og må utvides med den nye funksjonen (det er hensikten med vakten). **Ikke anvendt i noe hostet miljø**; hosted utrulling krever egen godkjenning og miljøkontroll.

## 5. Sikkerhet/personvern
- Funksjonen eksponerer rettighetsprofiler (kontraktsmetadata, ikke persondata) og er kun kjørbar for `scout_ingest`; ordinær bruker, `anon`, `authenticated`, `service_role` og `public` kan ikke kalle den (testes mot faktisk PostgreSQL).
- Tilkoblingsstreng forblir kun i `trusted-ingest.ts` (vakten som begrenser lesing av `SCOUT_INGEST_DATABASE_URL`); feil oversettes til koder uten feiltekst.
- Handle bærer verken rå leverandør-id, payload eller kilde-URL; `resultId` er enveis-HMAC. Parser avviser ukjente nøkler slik at rå verdier ikke kan «smugles» inn.
- Ingen secrets i kode/git/logg. Ingen nye miljøvariabler.

## 6. Bakoverkompatibilitetsrisiko
Lav, med to å følge med på: (1) `search-display.ts` blir `await`-avhengig av lasteren ved standardprofiler — uten `SCOUT_INGEST_DATABASE_URL` er resultatet identisk med `REGISTERED_PROFILES`, og alle tester som sender `profiles` eksplisitt er uendret; (2) med DB konfigurert gjelder DB-raden `synthetic-demo` v1 parallelt med kodeprofilen — avtrykkene må være like (de speiler hverandre i dag), ellers feiler leverandøren lukket (tilsiktet; testes). BMW iX3-demoen kjører på kodeprofilen uten DB og berøres ikke.

---

## 7. Implementasjon (etter vurderingen)

### 7.1 Filer
**Nye:** `src/domain/rights-runtime.ts`, `src/domain/result-handle.ts`, `src/domain/result-access.ts`, `src/server/rights-runtime.ts`, `src/server/result-handles.ts`, `supabase/migrations/20261024090000_data002d_runtime_rights_read.sql`, `tests/data-002d-runtime-rights.test.ts`, `tests/db/data002d-runtime-rights-read.test.ts`.
**Endret:** `src/server/trusted-ingest.ts` (+`trustedRightsProfiles`), `src/server/search-display.ts` (standardprofiler lastes ved kjøring; `InternalItem.handle`), `src/domain/provider-rights.ts` (kun `sourceRef`-tekst på kodeprofilen, se 7.5), `tests/db/qa-catalog.test.ts` (pinner den nye funksjonen), `tests/hosted-logic.test.ts` (12 → 13 migrasjoner), `docs/econ/hosted-plan-h1-h4.md`, `DATABASE_SCHEMA.md`, `DECISIONS.md` (runde 94), `MVP_BACKLOG.md`.
**Urørt (som avtalt):** all ECON-/TAX-kode og `search-economics.ts`, UI/komponenter, provider-laget, eksisterende migrasjoner, `DisplayItem`.

### 7.2 Arkitektur for kjøretidsrettigheter
```
private.provider_rights_profiles  (autoritativ; RLS, alle rettigheter tilbakekalt)
        │  private.trusted_rights_profiles()  — SECURITY DEFINER, kun scout_ingest, alle statuser
        ▼
trusted-ingest.ts: trustedRightsProfiles()  (eneste fil som kjenner pool/env; null = ikke konfigurert)
        ▼  rå rader (unknown)
server/rights-runtime.ts: loadRuntimeRights({reader})  — feil ⇒ "unavailable" (ingen feiltekst videre)
        ▼
domain/rights-runtime.ts: profileFromRow (streng, total) → buildRuntimeRights → RuntimeRights
        ▼                                        { profiles, blockedProviders, status, rejected, loadedAt }
resolveRuntimeRights(rt, provider, now) → ResolvedRights  (eksisterende default-deny-modell, uendret)
        ▼
domain/result-access.ts: evaluateResultAccess(handle, provenance, ctx) → ResultAccessDecision
```
Regler i `buildRuntimeRights`: (1) syntetiske kodeprofiler gjelder alltid; (2) kode kan IKKE levere sandbox/live (avvises + leverandøren blokkeres); (3) defekt DB-rad ⇒ leverandøren blokkeres (en gyldig eldre versjon slipper ikke gjennom i stedet); (4) samme (leverandør, versjon) i kode og DB med ulikt avtrykk ⇒ konflikt, leverandøren blokkeres; (5) status `ok / database_not_configured / database_unavailable / degraded`. Produktkode (`search-display.ts`) bruker `opts.profiles ?? await loadRuntimeProfiles()`; eksplisitt `profiles` vinner fortsatt, så alle eksisterende tester er uendret. Ingen cache (tilbakekalling gjelder umiddelbart).

### 7.3 Design av resultat-handle
`ProviderResultHandle` (readonly, frosset): `{ version: 1, providerId, environment, resultId (m1_…, enveis HMAC fra DATA-002C), provenanceRef (pv1_ + 128 bit SHA-256 av proveniensens identitetsfelt), rights: { profileId, version, digest }, retrievedAt }`. Ingen rå leverandør-id, ingen kilde-URL, ingen nyttelast. `parseResultHandle(unknown)` er streng (nøyaktig disse nøklene, mønster per felt, `profileId` må være `providerId@version`) — rå id eller nyttelast kan ikke smugles inn. `verifyHandle(handle, provenance)` skiller `provider_mismatch / result_id_mismatch / rights_mismatch / provenance_mismatch`. `verifyHandleMapping` (server) bekrefter at `resultId` er Merovos HMAC for (leverandør, id); manglende nøkkel for sandbox/live ⇒ `opaque_mapping_missing` (lukket). `InternalItem.handle` er serverinternt; `DisplayItem` er uendret (testet: nøklene er fortsatt `assessment, economics, enrichment, listing, media, unknowns`).

### 7.4 Fail-closed
Alt under gir `canDisplay=false`, alle evner `false`, `retentionSeconds 0`, tomme `fields/storable` og en årsak: ingen profil (`unknown_provider`), utløpt (`expired`), ikke begynt, utkast (`not_verified`), trukket, ugyldig profil, defekt/ukjent/manglende feltrettighet i DB-raden (`invalid_profile`; ukjent nøkkel eller ikke-boolsk verdi tolkes aldri som tillatt), handle ↔ proveniens-misforhold (leverandør/resultat-id/rettighet/proveniens), profilen endret/erstattet siden hentingen (`rights_changed`), lagringstid overskredet (`retention_exceeded`), ikke-lagret data eldre enn 5 min (`transient_data_stale`), annonsen borte (`unavailable`), geografi ikke tillatt (`geography_not_allowed`; ukjent land nektes når leverandøren er begrenset), ugyldig handle (parser), manglende opak kartlegging (`opaque_mapping_missing`), database utilgjengelig (bare syntetisk gjelder).

### 7.5 Funn underveis (fra faktisk DB-kjøring)
DB-testen avslørte at den syntetiske DB-raden og `SYNTHETIC_RIGHTS_PROFILE` **ikke** hadde samme rettighetsavtrykk: `sourceRef` i DB (DEV-005B0-migrasjonen) har en ekstra setning («Retensjon er en test-verdi, ikke en leverandøravtale.») som koden manglet, og `sourceRef` inngår i `canonicalPermissions`. Med DB konfigurert ville lasteren derfor ha meldt `code_database_conflict` og BLOKKERT demoen. Rettet ved å la kodeprofilens `sourceRef` følge DB-teksten (den historiske migrasjonen er urørt; ingen rettighet endret; ingen test pinnet strengen). Rekkefølgen på JSON-nøkler og `verifiedAt` (= tidspunktet migrasjonen ble anvendt) avviker også, men er ikke semantisk og ikke i avtrykket. DB-testen låser nå at raden og kodeprofilen er like.

## 8. Synthetic/demo-kompatibilitet
Uendret og testet: uten `SCOUT_INGEST_DATABASE_URL` er profilsettet identisk med `REGISTERED_PROFILES`; BMW iX3-demoen gir treff med handle (`environment: synthetic`, `resultId == listing.listingId`); detaljsiden via opak id virker; syntetisk id kan kartlegges uten nøkkel (innebygd pepper), en sandbox-handle kan ikke det. En defekt/blokkert sandbox-leverandør og en utilgjengelig database påvirker ikke syntetiske resultater (kodeprofilen er uavhengig av DB), og omvendt arver syntetiske resultater ingen leverandørrestriksjoner (profilene er adskilt per leverandør/miljø). Påviste kontroller: `qa-demo-mode.sh` og `qa-partner-mode.sh` («ALLE KONTROLLER BESTÅTT»).

## 9. Tester faktisk kjørt (23.10.2026)
| Kontroll | Resultat |
|---|---|
| `npx vitest run` (baseline før endring: 95 filer / 2 141) | **96 filer / 2 204 bestått** (+63 nye i `tests/data-002d-runtime-rights.test.ts`) |
| `bash scripts/test-db-isolated.sh` på `data002d-runtime-rights-read`, `qa-catalog`, `data002d-field-map`, `rights-profile-model`, `econ005b-rights`, `econ005b-empty-map-review` (isolert PostgreSQL 16, ikke Supabase) | **6 filer / 151 bestått**; «OPPGRADERING OK» (SEARCH-005-øyeblikksbildet uendret) |
| `npx tsc --noEmit`, `npx eslint .`, `node docs/tax/check-docs.mjs` | rene / OK |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | INGEN FUNN (lokal-Supabase-delen hoppet over; første kjøring flagget en credential-formet teststreng i min egen testfil — omskrevet) |
| `bash scripts/qa-demo-mode.sh`, `bash scripts/qa-partner-mode.sh` | alle kontroller bestått |
| `bash scripts/test-e2e-search005.sh` (Chromium mot emulator) | **76/77**. Den ene feilen (`DEV-006C: ingen «sterkt treff»-status …`) er **identisk på uendret `main`** (verifisert ved å stashe mine endringer og kjøre på nytt) ⇒ ikke forårsaket av denne endringen, ikke undersøkt videre (utenfor omfang). Skriptet overskriver sporede skjermbilder i `reviews/SEARCH-005/`; de er tilbakestilt og ikke med i commit. |
**Mutasjonskontroll (domene):** 8 bevisste feil ble alle oppdaget (geografisjekk fjernet; `rights_changed` fjernet; defekt rad blokkerer ikke leverandøren → 13 tester feiler; ekte profil i kode godtas; kode/DB-konflikt ignoreres; parseren tillater ukjente nøkler → 4; leverandørmisforhold ignoreres → 2; pris alltid tillatt). **Migrasjon:** grant fjernet, grant utvidet til `authenticated`, og filter på `verified` ga hver 2 feilende DB-tester.
**Ikke kjørt:** hele DB-suiten og Supabase-avhengige DB-filer (Auth/PostgREST finnes ikke i den isolerte klyngen), `qa:migrations`, `npm run test:db` mot lokal Supabase, hosted-kjøringer, `test-e2e-econ006*.sh`/`real-supabase`. Ingen uavhengig review ennå.

## 10. Migrasjons-/utrullingspåvirkning
Én ny migrasjon `20261024090000` (additiv, skrivebeskyttet, ingen datarad endres); **ikke anvendt i noe hostet miljø**. Uten den: med `SCOUT_INGEST_DATABASE_URL` satt feiler lesing ⇒ `database_unavailable` ⇒ bare syntetisk profil gjelder (lukket; ikke et driftsstopp for demoen). Hosted: migrasjonen må anvendes sammen med de tre tidligere uanvendte (`20261021…23`), `hosted-plan-h1-h4.md` er oppdatert (13 migrasjoner, fire aldri anvendt). Ingen nye miljøvariabler. Ingen cache ⇒ ett kort oppslag per visningsforespørsel når databaseveien er konfigurert.

## 11. Gjenstående og uavklart (ingenting her er løst eller oppfunnet)
1. **Publikum / «kun profesjonelle brukere» er ikke representert i modellen** og er derfor ikke vurdert (evaluatoren har ingen slik parameter som kunne tolkes som tillatelse). Krever beslutning, kontraktsgrunnlag og migrasjon.
2. **Geografiens landsemantikk er uspesifisert** (forhandlerens marked, annonsens opprinnelse eller bruker). Evaluatoren tar imot et eksplisitt `geographyCountry` fra kalleren; ingen produktkode kaller den ennå.
3. **Tolkningen av `cacheSeconds`** (0 ⇒ ikke servert fra cache ⇒ oppdater etter 5 min; > 0 ⇒ oppdater etter cache-tiden) er min konservative implementasjonskonklusjon, ikke en leverandørrett eller kildebelagt regel.
4. **Eksisterende oppførsel, uendret og verifisert:** en *trukket nyere* versjon undertrykker ikke en eldre, fortsatt gyldig versjon (`resolveRights` og DB-funksjonen `rights_profile_in_force` velger høyeste versjon *i kraft*). Hvis tilbakekalling av en leverandør skal gjelde alle versjoner, må det besluttes og modelleres. Den nye lasteren skjerper bare *defekte* rader (blokkerer leverandøren), ikke trukne.
5. **Evaluatoren er ikke koblet til UI/visningsflyten** utover at `handle` bygges på `InternalItem`; `applyDisplayPolicy` er fortsatt eneste vei til UI (bevisst: ingen UI-endring). Å la `search-display` konsultere `evaluateResultAccess` per felt er et senere steg.
6. **Stateløst id-oppslag** (`resolvePublicId` blar gjennom leverandørens sider) og lagret, tenant-avgrenset handle-/proveniens-tabell med utløp er fortsatt åpent (DATA-002C §4.8 pkt. 4) — ikke i dette omfanget.
7. Håndheving av cache/historikk/varsler/purge (`on_revocation`) er fortsatt bare modell; evaluatoren *rapporterer* verdiene.
8. Ytelse: ingen cache av profiler (tilsiktet); måles først når en ekte leverandør er koblet til.
9. Navnekollisjon på DATA-002D (se toppen): anbefalt id DATA-002D-2.
10. Én eksisterende e2e-feil (`DEV-006C`, se §9) er ikke undersøkt.
