# DATA-002A — fundament for håndheving av visningsrettigheter (16.10.2026)

**Status: pågår (vurdering skrevet før implementasjon; oppdateres under «Resultat» etter implementasjon).** Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `43f7829`, rent arbeidstre. Omfang: kun syntetisk provider og syntetiske rettighetsprofiler. Ingen ekte leverandør, ingen credentials, ingen live data, ingen bilder, ingen VIN, ingen Supabase-endring, ingen TAX-/deploy-/auth-/tenantendring.

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
