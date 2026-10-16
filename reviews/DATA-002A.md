# DATA-002A — fundament for håndheving av visningsrettigheter (16.10.2026)

**Status: REVIEW** (implementert; ikke DONE før Codex-review). Vurderingen under («1.») ble skrevet og committet før implementasjon (`reviews/DATA-002A.md` i commit «vurdering før implementasjon»); «Resultat» er lagt til etterpå. Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `43f7829`, rent arbeidstre. Omfang: kun syntetisk provider og syntetiske rettighetsprofiler. Ingen ekte leverandør, ingen credentials, ingen live data, ingen bilder, ingen VIN, ingen Supabase-endring, ingen TAX-/deploy-/auth-/tenantendring.

## 1. Vurdering før implementasjon

### 1.1 Dagens rå annonsevei inn i `/searches`
```
getMarketplaceProvider() ─► provider.search()/getListing() ─► NormalizedListing (rå)
  ─► previewSearch()/assessListing() [src/server/search-preview.ts]
  ─► PreviewItem { listing: NormalizedListing, candidate: CandidateV2, meta: CandidateMeta, assessment }
  ─► app/searches/[id]/preview/page.tsx ─► <ResultCard item={PreviewItem}> ─► Explanation(vehicle)
  ─► app/searches/[id]/preview/[listingId]/page.tsx (henter listing direkte fra provideren og leser rå felt)
```
Sidene (serverkomponenter) kaller selv `getMarketplaceProvider()`, og komponentene tar `PreviewItem` med hele den rå annonsen.

### 1.2 Eksakte lekkasjepunkter (dvs. steder der rå leverandørdata kan nå UI uten rettighetsvurdering)
1. `ResultCard` (`src/components/search/ResultCard.tsx`) får hele `PreviewItem` og leser `listing.specs.{make,model,variant,firstRegistration,mileage,fuel,transmission,bodyType}`, `listing.price`, `listing.sourceListingId` direkte.
2. Detaljsiden (`.../preview/[listingId]/page.tsx`) henter `NormalizedListing` direkte fra provideren og viser tittel, registrering, km, drivstoff, girkasse, karosseri, effekt, farge, **selgertype og -land**, pris/prisgrunnlag/mva.-påstand, `sourceModifiedAt`, og **fritekst** (`listing.text`). Alt ukontrollert.
3. `PreviewItem` bærer også `candidate` (kandidatverdier som `variant`, `exteriorColor`) og `meta` (`provenance.description` — fritekst fra kilden — og `explanations[].sourceValue`, **kildens rå verdi**). Disse rendres ikke i dag (detaljsiden bruker bare `field`/`code`), men er tilgjengelige for komponentene.
4. `CarPlaceholder` styres av `specs.bodyType` (en spesifikasjon påvirker visningen).
5. Sidene importerer `@/providers/marketplace` og `MarketplaceError` — rå leverandørtilgang i UI-laget.
6. Forklaringstekstene (`Explanation`, `whyShown`, `mustSummary`, `wishSummary`) bygger bare på `VehicleEvaluation` (kriterie-id, prioritet, status, maskinlesbar årsakskode) og er i dag **verdifrie** — men typen forhindrer ikke at en fremtidig årsakskode bærer en verdi; dette er en regresjonsrisiko, ikke en nåværende lekkasje.
7. Utenfor `/searches` (ikke endret her): eldre flate (`/dashboard`, `/opportunities`, `/agents/**`) viser rå annonser/lagrede utdrag; de er blokkert for partnere (DEV-006G) og er ikke del av dette fundamentet.

### 1.3 Foreslått typegrense
- Nytt rent domenemodul `src/domain/display-policy.ts`:
  - `Field<T> = {state:"value"; value:T} | {state:"unknown"} | {state:"withheld"} | {state:"unavailable"}`.
  - `DisplayFieldKey`: `title, price, mileage, registration, specs, text, sellerType, sellerLocation, listingDates, providerName, sourceUrl` (bilder er utelatt; ingen VIN).
  - `DisplayPolicy` (provider-id, profilversjon, miljø `synthetic|sandbox|live|unverified`, virkningsperiode, attribusjonstekst, `allow` per felt).
  - `DisplayableListing` (hvert felt er et `Field`, pluss `listingId`, `attribution` og policy-sammendrag).
  - `applyDisplayPolicy(listing, policy, now, opts?) → DisplayableListing`: ren; leser et felt **kun** når policyen tillater det (lat evaluering), kloner verdien, setter `withheld` for forbudte felt (også når verdien er null — fraværet avsløres ikke), `unknown` når tillatt men ikke oppgitt, `unavailable` når kalleren melder at feltet ikke kunne hentes. Policy utenfor virkningsperiode eller ukjent kilde ⇒ alt `withheld` (default-deny).
  - Syntetisk profil `synthetic-demo` (alt tillatt, miljø `synthetic`, attribusjon «Syntetiske demodata – ikke ekte leverandørdata»); alle andre kilder får `deny-all` som standard.
- Ny servermodul `src/server/search-display.ts` er **eneste** sted som både kjenner provider/rå annonse og lager UI-modellen: `previewForDisplay(spec)` og `detailForDisplay(spec, listingId)` returnerer `DisplayItem { listing: DisplayableListing, assessment, unknowns:[{field,code}] }` (uten `candidate`, `meta.provenance.description` og `sourceValue`).
- Komponenter og sider i `/searches` tar bare `DisplayItem`/`DisplayableListing`. Hver rendring bruker `Field`-tilstanden («ikke oppgitt» / «vises ikke (leverandørvilkår)» / «ikke tilgjengelig nå»).

### 1.4 Filer som endres
Ny: `src/domain/display-policy.ts`, `src/lib/display-text.ts`, `src/server/search-display.ts`, `src/components/search/ListingFacts.tsx`, `tests/display-policy.test.ts`, `tests/search-display-ui.test.ts`.
Endret: `src/components/search/ResultCard.tsx`, `src/app/searches/[id]/preview/page.tsx`, `src/app/searches/[id]/preview/[listingId]/page.tsx`, `src/lib/search-labels.ts` (attribusjonskonstanten hentes fra policyen), `tests/architecture.test.ts` (ny regresjonsvakt), `reviews/DATA-002A.md`, `MVP_BACKLOG.md`.
Ikke endret: `search-preview.ts` (rå, server-intern), søkemodellen/evalueringen, adaptere, providere, Supabase, auth/tenant, TAX, deploy.

### 1.5 Tester som legges til
1. **Domenetester** (`display-policy.test.ts`): per felt: forbudt ⇒ `withheld` og verdien finnes ikke i serialisert utdata (sentinelverdier); lat evaluering (en `Proxy` rundt rå annonse kaster hvis et forbudt felt leses); `unknown` ≠ `withheld` ≠ `unavailable`; policy utenfor virkningsperiode og ukjent kilde ⇒ alt `withheld`; ingen aliasing mot rå objekter; tillatt og oppgitt ⇒ `value`.
2. **UI-nære tester** (`search-display-ui.test.ts`): rendrer `ResultCard`, `ListingFacts` og `Explanation` (`renderToStaticMarkup`) med en deny-policy og sentinel-verdier i alle felt (tittel, variant, pris, km, fritekst, selgerby, farge …) og beviser at ingen sentinel finnes i markup, `JSON.stringify(DisplayItem)` eller forklaringstekstene; og at tillatte felt vises.
3. **Arkitekturvakt**: komponenter og sider under `/searches` kan ikke importere `NormalizedListing`, `PreviewItem`, `@/providers/**`, `@/server/search-preview` eller `@/adapters/search-candidate/**`; `DisplayableListing`-modulen importerer ingen provider/UI.
4. **Regresjon**: eksisterende søke-/demotester og nettleserflyt (emulator).

## 2. Resultat

### 2.1 Filer endret
Ny: `src/domain/display-policy.ts`, `src/lib/display-text.ts`, `src/server/search-display.ts`, `src/components/search/ListingFacts.tsx`, `tests/display-policy.test.ts`, `tests/search-display-ui.test.ts`, `tests/fixtures/display-sentinel.ts`.
Endret: `src/components/search/ResultCard.tsx` (tar `DisplayItem`), `src/app/searches/[id]/preview/page.tsx` og `.../[listingId]/page.tsx` (henter kun via `previewForDisplay`/`detailForDisplay`; ingen provider i UI-laget), `src/lib/search-labels.ts` (attribusjonskonstanten kommer fra policyen), `tests/architecture.test.ts` (ny vakt), `MVP_BACKLOG.md`, denne rapporten.
Ikke endret: søkemodellen/evalueringen, `search-preview.ts`, adaptere, providere, Supabase/migrasjoner, auth/tenant, TAX, deploy. Ingen ny avhengighet. Ingen bilder, ingen VIN, ingen ekte leverandør.

### 2.2 Hva som er bygget
- **`src/domain/display-policy.ts` (rent domene):** `Field<T>` med `value | unknown | withheld | unavailable`; `DisplayPolicy` (profil-id/versjon, miljø `synthetic|sandbox|production|unverified`, virkningsperiode, attribusjon, `allow` per felt); `DisplayableListing`; `applyDisplayPolicy(listing, policy, now, {unavailable?})`.
  - Felt: `title, price, mileage, registration, specs (fuel/transmission/bodyType/powerKw/color), text, sellerType, sellerLocation, listingDates, providerName, sourceUrl`.
  - Forbudt felt (eller profil utenfor virkningsperiode) ⇒ `withheld`, også når verdien er null (fraværet avsløres ikke). Tillatt og ikke oppgitt ⇒ `unknown`. Tillatt men kalleren melder det som ikke hentet ⇒ `unavailable` (forbudt vinner).
  - **Lat evaluering:** et forbudt felt *leses aldri* fra den rå annonsen (bevist med `Proxy`-test). Verdier dypkopieres (ingen aliasing mot rå objekter).
  - **Default-deny:** `policyForSource` gir den frosne syntetiske profilen kun for `synthetic-demo`; alle andre kilder får `deny-all`.
- **`src/server/search-display.ts` (servergrensen):** `previewForDisplay(spec)` og `detailForDisplay(spec, id)` returnerer `DisplayItem {listing: DisplayableListing, assessment, unknowns:[{field,code}]}`. Rå annonse, kandidat, `meta.provenance.description` og `explanations[].sourceValue` forlater ikke modulen.
- **UI:** `ResultCard` og ny `ListingFacts` rendrer kun feltstater: verdi / «ikke oppgitt» / «vises ikke (leverandørvilkår)» / «ikke tilgjengelig nå». Illustrasjonen styres bare av tillatt karosseri. Tittel uten tillatelse blir «Annonse». Kildehenvisningen på kort og detalj kommer fra policyen (`attribution`), ikke en hardkodet streng.
- **Forklaringstekster:** `Explanation`, `whyShown`, `mustSummary`, `wishSummary` bygger bare på kriterie-id, status og årsakskoder og er bevist verdifrie (test med sentinelverdier). Evalueringen er uavhengig av visningsretten.
- **Syntetisk oppførsel er uendret:** ingen synlig forskjell for partnerdemoen (e2e 76/76).

### 2.3 Tester som er lagt til (alle kjørt)
- `tests/display-policy.test.ts` (11): alle felt `value` under syntetisk profil; ett felt av gangen forbudt ⇒ `withheld` og ingen verdi i serialisert utdata (alle 11 nøkler), mens de andre forblir synlige; deny-all uten sentinel; lat evaluering (Proxy); `unknown`/`withheld`/`unavailable` holdes adskilt; 0-verdi bevares; kloning; ukjent kilde, utløpt og ikke-begynt profil ⇒ alt `withheld`; frosset profil.
- `tests/search-display-ui.test.ts` (6): `ResultCard`, `ListingFacts`, `Explanation` rendret med `renderToStaticMarkup` under deny-all og delvis profil — ingen sentinelverdier (tittel, variant, pris, mva.-belegg, km, farge, fritekst, selgerby, kilde-URL, datoer) i markup, i `JSON` av hele visningsutfallet eller i forklaringstekstene; vurdering finnes fortsatt; `DisplayItem` har bare nøklene `assessment/listing/unknowns` og bærer ikke `sourceValue`/proveniensfritekst; fremmed kilde gir ingen synlige elementer.
- `tests/architecture.test.ts` (5 nye): komponenter/sider i `/searches` importerer ikke provider, `search-preview` eller kandidatadapter; nevner aldri `NormalizedListing`, `PreviewItem`, `assessListing`, `previewSearch`, `getMarketplaceProvider`, `MarketplaceProvider`, `CandidateMeta`, `CandidateV2` og leser ikke rå felt (`originalUrl`, `sourceModifiedAt`, `seller`, `sourceListingId`, `provenance`); begge forhåndsvisningssidene importerer `search-display`; policymodulen er rent domene; `ResultCard`/`ListingFacts` tar `DisplayItem`/`DisplayableListing`. **Vakten er mutasjonstestet:** å importere `NormalizedListing` i `ResultCard` eller `getMarketplaceProvider` i `ListingFacts` gjør testene røde (tilbakestilt etterpå).

### 2.4 Kontroller faktisk kjørt
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | uten feil |
| `npx vitest run` | **27 filer, 583 / 583** bestått (561 før + 22 nye) |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **emulator** + isolert PG, ikke Supabase) | **76 / 76** (uendret nettleserflyt, inkl. forhåndsvisning, detalj, forklaringer, tenant-isolasjon, innlogging) |
| `bash scripts/qa-partner-mode.sh`, `bash scripts/qa-demo-mode.sh` | alle kontroller bestått |
Ikke kjørt: DB-/RLS-suitene og eldre e2e-skript mot faktisk Supabase (ingen DB-/sikkerhetskode endret).

### 2.5 Gjenstående veier der rå leverandørdata kunne nå UI (ærlig oversikt)
1. **Eldre flate (blokkert for partnere, fortsatt i koden):** `/dashboard` (`ListingCard`), `/opportunities/[id]` og `/agents/**` (lagrede kjøringsutdrag via `applyStoragePolicy`, ikke visningspolicy) viser rå/lagrede data uten `applyDisplayPolicy`. Må enten få samme grense eller fjernes før ekte leverandørdata brukes der; de skal ikke aktiveres (`SCOUT_ENABLE_LEGACY_ROUTES`) mot ekte data.
2. **Vakten dekker bare `/searches`-UI:** `previewSearch`/`assessListing` returnerer fortsatt rå `PreviewItem` (server-intern). En ny rute utenfor `src/components/search`, `src/components/merovo` og `src/app/searches` kunne importere dem; vakten fanger ikke det.
3. **Ingen ekte profiler:** policyene er kode (syntetisk + deny-all). Profilinnlasting fra databasen, felt-for-felt-tillatelser fra avtale, cache/lagring/geografi/grenser kommer i DATA-002B; proveniens i DATA-002C.
4. **Behandling vs. visning:** matching bruker fortsatt alle kandidatfelt uavhengig av visningsretten. Forklaringene er verdifrie og viser bare status, men om avledede utfall (treff/«hvorfor») av et forbudt felt er tillatt, er en avtalesak (DATA-001 §3).
5. **`listingId`** (leverandørens annonse-id) brukes som intern nøkkel i URL og `data-listing`. Om en leverandør begrenser visning av id-en må den behandles som felt senere.
6. **Ikke modellert (bevisst):** bilder og VIN finnes ikke i modellen og håndteres ikke.
7. Kandidatadapteren avviser i dag annonser fra fremmede kilder; det er en tilfeldig ekstra sikring, ikke et rettighetsmessig forsvar, og må ikke regnes som en.

### 2.6 Status
**DATA-002A = REVIEW.** Kodemessig komplett for syntetisk provider og syntetiske profiler; Codex-review gjenstår. Ingen ekte leverandørdata er aktivert.

**Kode-commit:** `6c38f49`.
