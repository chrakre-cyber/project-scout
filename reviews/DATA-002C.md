# DATA-002C — proveniens og trygg annonseidentitet (16.10.2026)

**Status: pågår** (vurdering først; resultat legges til under «Resultat»). Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `bbb265a`, rent arbeidstre. Ingen ekstern leverandør, ingen credentials, ingen live data, ingen bilder, ingen VIN/registreringsnummer, ingen deduplisering, ingen TAX-/auth-/tenant-/deployendring.

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
