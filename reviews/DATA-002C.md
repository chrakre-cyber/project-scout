# DATA-002C — proveniens og trygg annonseidentitet (16.10.2026)

**Status: REVIEW** (implementert og testet; ikke DONE før Codex-review). Vurderingen (§1–3) ble committet før implementasjon; «Resultat» er lagt til etterpå. Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `bbb265a`, rent arbeidstre. Ingen ekstern leverandør, ingen credentials, ingen live data, ingen bilder, ingen VIN/registreringsnummer, ingen deduplisering, ingen TAX-/auth-/tenant-/deployendring.

## 1. Vurdering før implementasjon

### 1.1 Annonseidentitet gjennom hele `/searches`-flyten i dag
`provider.search()` → `NormalizedListing.sourceListingId` (leverandørens egen id; syntetisk: `demo-001`, `syn-017`, `dvar-003`) → `DisplayableListing.listingId` (kopi av den) → `ResultCard` bruker den som `data-listing`, som illustrasjonsfrø og i detaljlenken `/searches/{utkast}/preview/{listingId}?v={versjon}` → detaljsiden slår opp `provider.getListing(listingId)` direkte. Identiteten er altså leverandørens egen id, brukt som intern *og* offentlig nøkkel.

### 1.2 Hvor leverandørens annonse-id er eksponert
(a) URL (adressefelt, historikk, delte lenker, referer), (b) `data-listing`-attributt i DOM, (c) illustrasjonsfrø (påvirker kun farge), (d) det gatede feltet `providerListingId` (kontrollert av `listing_id`-retten), (e) tester/e2e (ikke produksjon). `listingId` er altså en **lekkasje utenfor visningsrettigheten** `listing_id`: selv om retten nektes, ligger id-en i URL-en.

### 1.3 Hvordan syntetiske annonser identifiseres i dag
Via `NormalizedListing.source === "synthetic-demo"` og `provenance.kind === "synthetic"`; den syntetiske profilen/policyen er nøklet på kilde-id. Id-en er unik bare innen kilden: to leverandører kan bruke samme lokale id.

### 1.4 Hva som bevares og hva som går tapt (proveniens)
Bevart på `NormalizedListing`: `source`, `sourceListingId`, `originalUrl`, `sourceModifiedAt`, `firstSeenAt/lastSeenAt`, `provenance{kind, description, normalizationNotes}`; kandidatmetadata: mapping-kilde/-versjon og revisjonskontrakt; visningsmodellen: profil-id/-versjon/miljø/`inEffect`. **Tapt eller aldri satt:** hentetid (`SearchPage.fetchedAt` forkastes i `previewSearch`), når kildedata utløper, hvilken profilversjon som *gjaldt ved hentingen* (kun den som gjelder ved visning), nedtrykk av profilens innhold (kan endres uten at det oppdages), normaliseringsversjon samlet, korrelasjons-id. Proveniens knyttes ikke til visningsmodellen (bevisst: den skal ikke til UI).

### 1.5 Konsekvenser for lagrede/gjenåpnede søk og resultat-URL-er
Utkast lagrer bare søkekravene (ingen resultater), så ingen lagret data peker på leverandør-id-er. Resultat-URL-er er **tilstandsløse**: detaljsiden henter annonsen på nytt. En opak offentlig id må derfor kunne slås opp uten en lagret tabell: den bygges som en **enveis, nøklet hash** (HMAC) av (leverandør-id, leverandørens annonse-id), og detaljsiden finner annonsen ved å gå gjennom leverandørens sider og sammenligne hash. Det er greit for den syntetiske kilden (115 annonser, 2 sider). For en ekte leverandør er det dyrt (kvote) og bør erstattes av en lagret, tenant-avgrenset handle-tabell med utløp (egen oppgave, krever DB + betrodd skriveveg). Gamle URL-er med `syn-…`/`demo-…` slutter å virke (404); de var aldri lagret/avtalt som varige lenker.

### 1.6 Trengs DB-endringer?
**Ikke for identitet/proveniens** (tilstandsløs id + serverintern proveniens). **Én liten, naturlig sikring** hører til DEV-005B0/002B-modellen: databasen forbyr allerede å endre profilens rettigheter på plass (vakttriggeren dekker *alle* statuser, også utkast), men **sletting** av verifiserte/trukne profiler er ikke blokkert (FK `on delete restrict` beskytter bare profiler som kjøringer peker på). Jeg legger til en vakt som nekter sletting av ikke-utkast-profiler (ny liten migrasjon). Regelen «brukt for ekte data ⇒ semantikk er uforanderlig» er allerede dekket for endring; unntaket for syntetiske utviklingsprofiler var en engangs-backfill i migrasjon `20261016090000` (før vakten dekket de nye kolonnene) og finnes ikke i kjøretiden.

## 2. Beslutninger (utkast)
- **Offentlig id:** `m1_` + base64url av de første 18 byte av HMAC-SHA256(nøkkel, `m1|{leverandør}|{leverandørens id}`) = 24 tegn; verken leverandørnavn eller leverandørens id er kodet inn, og to leverandører med samme lokale id får ulike id-er. Nøkkel: `SCOUT_PUBLIC_ID_KEY` (valgfri, server-only). Uten nøkkel brukes en innebygd, *ikke-hemmelig* pepper **kun for syntetiske kilder**; for sandbox/live uten nøkkel **feiler id-generering lukket**. Hosting trenger ingen ny variabel for demoen; nøkkelen er et krav før ekte data (porten legges i rapporten).
- **Proveniens (`src/domain/provenance.ts`, server-internt):** leverandør-id, miljø, leverandørens annonse-id, rettighetsprofil (id@versjon + innholdsavtrykk), hentetid, kildedata-utløp, skjema-/mapping-versjon, kilde-URL-referanse (kun hvis tillatt), attribusjon, korrelasjons-id. `evaluateProvenance` skiller **valid / source_expired / rights_expired / rights_revoked / rights_unknown / rights_changed / unavailable** og feiler lukket. Proveniens går aldri inn i `DisplayItem`/`DisplayableListing` (visningsgrensen fra DATA-002A er uendret og er fortsatt eneste vei til UI).
- **Innholdsavtrykk av profil:** proveniens bærer SHA-256 av profilens *semantiske* rettigheter; endres en profilversjon på plass etter at data er hentet, feiler visning lukket (`rights_changed`). Dette utfyller databasevakten i kode-/registerlaget.
- **Ikke gjort:** deduplisering, VIN/registreringsnummer, DB-lagret handle-tabell, profil-lasting fra DB, bilder.

## 3. Filer som endres
Ny: `src/domain/provenance.ts`, `src/server/public-ids.ts`, `supabase/migrations/20261016100000_data002c_profile_delete_guard.sql`, `tests/provenance.test.ts`, (DB-test utvides i `tests/db/rights-profile-model.test.ts`).
Endret: `src/domain/display-policy.ts` (`listingId` blir opak offentlig id), `src/server/search-display.ts` (intern proveniensvei, oppslag via offentlig id, fail-closed), `src/app/searches/[id]/preview/[listingId]/page.tsx` (id-format, blokkert-utfall), `src/components/search/ResultCard.tsx` (ingen leverandør-id i `data-listing`/frø), DATA-002A/B-tester som refererer id-er, `tests/e2e/search005.e2e.mjs`, `tests/architecture.test.ts`, `.env.example`, `DATABASE_SCHEMA.md`, `DECISIONS.md`, `MVP_BACKLOG.md`, `reviews/DATA-002C.md`.

## 4. Resultat

### 4.1 Filer endret
Ny: `src/domain/provenance.ts`, `src/server/public-ids.ts`, `supabase/migrations/20261016100000_data002c_profile_delete_guard.sql`, `tests/provenance.test.ts`.
Endret: `src/domain/display-policy.ts` (`listingId` = opak id; `applyDisplayPolicy` krever `publicId`; `PUBLIC_ID_PATTERN`), `src/server/search-display.ts` (proveniens, fail-closed, oppslag via opak id, `previewInternal`), `src/server/search-preview.ts` (`retrievedAt` per annonse), `src/app/searches/[id]/preview/[listingId]/page.tsx` (id-format, blokkert-utfall), `src/app/searches/[id]/preview/page.tsx` (merknad om skjulte annonser), `src/lib/search-labels.ts` (`BLOCKED_TEXT`), tester (`architecture`, `display-policy`, `provider-rights`, `search-display-ui`, e2e, DB: `rights-profile-model`, `qa-catalog`, `rights-retention`), `.env.example`, `DATABASE_SCHEMA.md`, `DECISIONS.md` (DEC-035), `ARCHITECTURE.md`, `MVP_BACKLOG.md`, rapporten. `ResultCard`/`ListingFacts`/provider-/adapterkode er uendret (de bruker allerede `listingId` fra visningsmodellen).

### 4.2 Strategi for offentlig id
`m1_` + base64url(18 byte av HMAC-SHA256(nøkkel, `m1|<lengde>:<leverandør>|<leverandørens id>`)) = 24 tegn. Enveis; verken leverandørnavn eller leverandørens id er kodet inn; lengdeprefiks hindrer kollisjon via sammensetning (funnet og rettet av en egen test). Samme (leverandør, id) gir alltid samme id; to leverandører med samme lokale id gir ulike id-er (annonse-id er ikke globalt unik). Nøkkel: `SCOUT_PUBLIC_ID_KEY` (≥ 16 tegn, server-only); syntetisk uten nøkkel bruker en innebygd, ikke-hemmelig pepper; **sandbox/produksjon uten nøkkel feiler lukket** (ingen id ⇒ annonsen vises ikke). Ny miljøvariabel: valgfri for demoen (ingen hostingendring nødvendig), **påkrevd før sandbox/live**. Oppslag er tilstandsløst: detaljsiden går gjennom leverandørens sider og sammenligner id-er (greit for 115 syntetiske annonser; kvotekrevende for ekte leverandører → egen handle-tabell senere). Resultat-URL: `/searches/{utkast}/preview/m1_…?v={versjon}`; gamle URL-er med `syn-…`/`demo-…` gir 404.

### 4.3 Proveniensfelt (serverinternt, aldri UI)
`publicId`, `providerId`, `environment`, `providerListingId`, `rightsProfile{id@versjon, version, digest}`, `retrievedAt`, `sourceExpiresAt` (min(hentet + retensjon, profilens slutt); null = ingen lagring), `schemaVersion` (`kilde@mappingversjon`), `sourceUrlRef` (kun hvis profilen tillater kilde-URL), `attribution{required,text}`, `correlationId`. Skilt fra *visbar* kilde-/attribusjonsinfo, som kun kommer fra `DisplayableListing` (policyens `attribution`, `providerName`, `sourceUrl`). `DisplayItem` har fortsatt bare nøklene `listing/assessment/unknowns` (testet), og ingen proveniensnøkkel finnes i serialisert visningsutdata (testet).

### 4.4 Utløp og fail-closed (`evaluateProvenance`)
`valid · source_expired · rights_expired · rights_revoked · rights_unknown · rights_changed · unavailable`. Rekkefølge: rettigheter (ukjent versjon/leverandør → `rights_unknown`; endret profilavtrykk → `rights_changed`; trukket → `rights_revoked`; utløpt → `rights_expired`; utkast/ikke begynt → `rights_unknown`) → kildedata (lagret kopi etter retensjon, ikke-lagret data eldre enn 5 min, ugyldig/fremtidig hentetid → `source_expired`) → `unavailable` (annonsen er borte hos kilden; kalleren melder det). Ingen verdier fra utløpt/trukket data havner i utfallet, og ingenting blir «ukjent» eller syntetisk i stillhet. Listevisningen skjuler slike annonser og teller dem (`coverage.withheldByProvenance`, vist som nøytral merknad); detaljsiden viser en nøytral blokkeringstekst per årsak (`BLOCKED_TEXT`) uten annonsedata. `unavailable` produseres i dag ikke av tilstandsløse flyter (annonse som ikke finnes gir 404); det er klart for lagrede resultater.

### 4.5 Rettighetsprofilens uforanderlighet
Regelen «semantikken i en profilversjon som er brukt for ekte data kan ikke endres på plass; nye rettigheter/restriksjoner = ny versjon» er **allerede håndhevet av DB-vakten for alle profiler og statuser** (også utkast; DEV-005B0 + DATA-002B-utvidelsen). Lagt til nå: (1) **DB:** verifiserte/trukne sandbox-/live-profiler kan ikke *slettes* (migrasjon `20261016100000`); syntetiske utviklingsprofiler og utkast kan (før-live-unntaket), FK beskytter brukte profiler. Unntaket gjelder bare sletting og er eksplisitt begrenset til miljø `synthetic`; endring på plass er forbudt også for syntetiske. (2) **Kode:** profilavtrykket i proveniens gjør at en profil som endres på plass i kodet/lastet register etter hentingen gir `rights_changed` (fail closed). **Eneste historiske unntak:** DATA-002B-backfillen av `synthetic-demo` v1 (engangs, før-live, i migrasjon). **Oppfølging som gjenstår:** når profiler lastes fra databasen, må laster og proveniens bruke samme avtrykk; en eksplisitt «låst etter første bruk»-markering er ikke nødvendig siden alle semantiske kolonner allerede er uforanderlige.
**Oppdaget regresjon fra DATA-002B (rettet nå):** de eksisterende DB-testene i `tests/db/rights-retention.test.ts` setter inn profiler uten de nye påkrevde kolonnene (`environment`, `attribution_text`), og ville feilet mot faktisk Supabase. Jeg kunne ikke kjøre hele filen her (krever Auth), men *profiltabell-delen* er kjørt mot isolert PostgreSQL (6/6) etter at hjelpefunksjonen setter `environment='synthetic'` og `attribution_text`; opprydding av syntetiske testprofiler virker med den nye slettevakten. Resten av `rights-retention.test.ts` er ikke kjørt.

### 4.6 Visningsgrense
DATA-002A er fortsatt eneste vei til UI. `applyDisplayPolicy` krever nå en opak `publicId` (ingen leverandør-id kan bli `listingId`); leverandørens id er et eget, rettighetsstyrt felt (`providerListingId`, `listing_id`-retten). Arkitekturvakten er utvidet: UI importerer/nevner ikke proveniens, id-/avtrykksmodul eller interne typer; id-nøkkelen leses bare i `public-ids.ts`; servergrensen bruker `buildProvenance`/`evaluateProvenance`; detaljsiden bruker kun `PUBLIC_ID_PATTERN`. Mutasjonstestet (en forbudt import i `ListingFacts` gjør testen rød).

### 4.7 Tester faktisk kjørt
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | uten feil |
| `npx vitest run` | **29 filer, 635 / 635** bestått (611 før + 24 nye: `provenance.test.ts` 21 + arkitektur 3) |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| `bash scripts/test-db-isolated.sh tests/db/rights-profile-model.test.ts tests/db/qa-catalog.test.ts tests/db/search-drafts.test.ts` (isolert PG 16, ikke Supabase) | **114 / 114**; «OPPGRADERING OK» |
| profiltabell-delen av `rights-retention.test.ts` (utdrag mot isolert PG) | 6 / 6 |
| `bash scripts/test-db-mutations.sh` | alle 6 bevisste feil oppdaget |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **emulator**) | **77 / 77** (inkl. ny sjekk: lenker og `data-listing` er `m1_…`, ingen `syn-/demo-/dvar-` i DOM) |
| `bash scripts/qa-partner-mode.sh`, `bash scripts/qa-demo-mode.sh` | alle kontroller bestått |
Testdekning mot kravlisten: opak id ✔; leverandørens id ikke i URL (sentinel) ✔; to leverandører med samme lokale id ✔; proveniens bærer profilversjon ✔; ukjent profil lukket ✔; utløpt proveniens lukket ✔; trukket profil lukket ✔; synthetic-demo-regresjon ✔; detaljnavigasjon virker ✔ (enhet + e2e); arkitekturvakt grønn ✔.
**Ikke kjørt:** DB-/RLS-suitene som krever Supabase Auth (`agents`, `rls`, `qa-isolation/-limit/-validation`, `search-runs`, resten av `rights-retention`), eldre e2e-skript og `qa-upgrade-check.sh`; migrasjonene `20261016090000` og `20261016100000` er ikke anvendt hosted.

### 4.8 Gjenstående blokkere før DATA-003 (mobile sandbox-adapter)
1. Skriftlige sandbox-vilkår er ikke lest/registrert (ingen verifisert `mobile-sandbox`-profil).
2. **Hosting:** `SCOUT_PUBLIC_ID_KEY` må settes (server-only) før sandbox/live; ellers vises ingenting (lukket).
3. Profiler lastes ikke fra databasen; en server-only leseveg og felles avtrykk mellom DB og kode må bygges.
4. Tilstandsløst id-oppslag er kvotekrevende for ekte leverandører: lagret, tenant-avgrenset handle-/proveniens-tabell med utløp (DB + betrodd skriveveg) bør komme før ekte volum.
5. Håndheving av cache/historikk/gjenbruk/geografi/varsler/tilbakekallings-purge for visningsdata er fortsatt bare modell.
6. Begge hosted-migrasjoner (`20261016090000`, `20261016100000`) må anvendes, og DB-/RLS-suitene (inkl. oppdatert `rights-retention`) kjøres mot faktisk Supabase.
7. Eldre flate og ruter utenfor `/searches` mangler fortsatt visningsgrensen.
8. Ingen deduplisering (bevisst): samme bil fra to leverandører får to ulike id-er.

### 4.9 Status
**DATA-002C = REVIEW.** Ingen ekstern leverandør, ingen credentials, ingen live data, ingen bilder, ingen VIN/registreringsnummer, ingen deduplisering, TAX/auth/tenant/deploy uendret.

**Kode-commit:** `e9cf250`.
