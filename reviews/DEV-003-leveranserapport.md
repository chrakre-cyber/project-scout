# DEV-003 — leveranserapport

Dato: 05.10.2026 · Branch: `claude/wonderful-bardeen-yussx3` · Status: REVIEW (ikke DONE)

## Leveranse

Syntetisk `MarketplaceProvider` etter kontrakten i ARCHITECTURE.md. Dashboard og detaljside henter annonser bare gjennom provideren og kjenner ikke fixture-filer eller råfeltnavn. En ekte provider (DEV-006) kan settes inn i `src/providers/marketplace/index.ts` uten endring i UI eller domene.

Ingen mobile.de-tilkobling, scraping, Supabase, auth, avgiftsmotor, FX, LLM, e-post, secrets eller betalte tjenester.

## Slik virker provider- og normaliseringslaget

1. **Råposter** (`synthetic/raw.ts`): et internt, tydelig merket syntetisk format med egne feltnavn, desimalstrenger og kodeverdier. Ikke mobile.de-format.
2. **Oppløsning** (`synthetic/provider.ts`): poster med samme ID er revisjoner, og siste `modifiedAt` innen `asOf` gjelder. Identiske duplikater slås sammen. Motstridende poster med samme ID og tidspunkt avvises.
3. **Normalisering** (`synthetic/normalize.ts`) til `NormalizedListing`:
   - Ugyldig eller ukjent verdi → `null`/`unknown`, med et notat i `provenance.normalizationNotes`. Aldri 0.
   - Brutto/netto bare med belegg. Mva.-påstander gir aldri prisgrunnlag. Mva.-belegg fra tekst må stå ordrett i teksten.
   - Ustøttet valuta: beløpet bevares som tekst og `amount` blir `null`.
   - Pris 0 → `price: null`.
   - Registreringspresisjon bevares. Umulige datoer → `null`.
   - Miles bevares.
   - Poster uten ID, merke/modell eller med umulig observasjonshistorikk avvises som `malformed_data`.
4. **Søk:** deterministisk rekkefølge, 1-basert paginering (1–100 per side), `sourceTotal`, `truncated` over `resultCap` (standard 2 000), `rejected` per side, `modifiedSince` og strukturerte filtre. Ukjente verdier ekskluderes ikke, og pris sammenlignes ikke på tvers av valuta. Ugyldig vindu eller spørring → `invalid_query`.
5. **Feil:** `MarketplaceError` med sju koder. Bare `rate_limit`, `timeout` og `unavailable` er `retryable`. Feil simuleres per kall (`failures`) eller for alle kall (`failAll`, i appen via `SCOUT_SYNTHETIC_FAILURE`). UI viser kildefeil i stedet for å krasje.
6. **Ingen avgifts- eller AI-logikk** i provideren.

## R1 — valuta (fra DEV-001)

- `src/domain/currency.ts` har et uttrykkelig sett støttede valutaer (NOK, EUR, SEK, DKK, CHF, GBP, PLN) og parser desimalstreng til minste enhet med strengaritmetikk (DEC-018).
- Annonse i ustøttet valuta: `price.stated` beholder «41500.00 USD», `price.amount` er `null`, og UI viser beløpet ordrett med «valuta støttes ikke — vist som oppgitt, ikke omregnet».
- `formatMoney` kaster ikke lenger. Den viser minste enhet + valutakode i stedet for å gjette desimaler.
- USD-eksempler: `demo-009` (håndskrevet) og `syn-025/050/075/100` (generert). Ingen FX implementert.

## R6 — datatyper (fra DEV-001)

- `NormalizedListing.lastSeenAt` (≥ `firstSeenAt`, kontrollert).
- `ListingPrice.vat: SourceVatStatement` med `statedRateBasisPoints`, `reclaimableClaim` (claimed/denied/unknown), `evidence[]` og `origin` (structured_field/listing_text/none). Dette tilsvarer «mva.-opplysninger med belegg» og «VAT-opphav» i ARCHITECTURE og MOBILE_DE_INTEGRATION.
- `ListingPrice.stated` + `amount: Money | null`. `NormalizedListing.price: ListingPrice | null`.
- Skillet mellom kilde og vurdering: alle annonsefelt er kildens opplysninger (DEC-019). Scouts vurderinger (skatteprofil, fradragsrett) finnes ikke på annonsen.

## Endrede filer

- **Nye:**
  - Provider: `src/providers/marketplace/{types,errors,index}.ts`, `src/providers/marketplace/synthetic/{raw,normalize,provider}.ts`
  - Fixturer: `src/providers/marketplace/synthetic/fixtures/{handwritten,generated,index}.ts`, `FIXTURES.md`
  - Øvrige: `src/domain/currency.ts`, `src/components/SourceErrorNotice.tsx`
  - Tester: `tests/{helpers,normalize.test,provider.test,synthetic-dataset.test}.ts`, `reviews/DEV-003-leveranserapport.md`
- **Endret:**
  - Kode: `src/domain/types.ts`, `src/lib/format.ts`, `src/components/ListingCard.tsx`, `src/app/dashboard/page.tsx`, `src/app/opportunities/[id]/page.tsx`, `src/demo/fixtures.ts` (bare agenter igjen), `src/demo/repository.ts`, `tests/format.test.ts`
  - Docs: `.env.example`, `README.md`, `ARCHITECTURE.md` (seksjon «Implementert i DEV-003»), `DECISIONS.md` (DEC-018, DEC-019), `MVP_BACKLOG.md`, `reviews/DEV-001-leveranserapport.md` (R1/R6 lukket)
- **Slettet:** `tests/demo-fixtures.test.ts`. Invariantene er videreført i `tests/synthetic-dataset.test.ts` og gjelder nå hele datasettet.

Reviewrettingene fra DEV-001 er beholdt: `agentRules: false`, belegg-krav for brutto/netto, «Annonser i visningen», «Først sett i Scout» og dokumentlenkene.

## Kontroller som faktisk er kjørt

| Kontroll | Resultat |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm test` | 45/45 bestått, 4 testfiler |
| Mutasjonskontroll (midlertidig innført feil) | Brutto uten belegg godtatt → 2 tester feilet. Miles behandlet som km → 1 test feilet. Koden er tilbakestilt og grønn. |
| `npm run build` | OK |
| `next start` + HTTP | `/` 307. `/dashboard` 200, 24 kort, «av 109 i syntetisk kilde». Side 2 200 med USD-annonse. Side 5 200, 13 kort. Side 6 «Ingen treff». `?page=abc` gir side 1. Agent B 3 kort. Ukjent agent «Fant ingen demo-agent». `/agents` 200. Detaljsider 200: demo-001 (belegg, «Sist sett i Scout»), demo-004 (mva.-påstand), demo-009 (USD + merknad), syn-037 («Pris ikke oppgitt»), demo-005 (notat om brutto uten belegg). `/opportunities/finnes-ikke` 404. Banner på alle. |
| Simulert kildefeil | `SCOUT_SYNTHETIC_FAILURE=unavailable`: dashboard og detaljside gir 200 med «Kildefeil (unavailable)» og 0 kort. `authentication` vises på samme måte. |
| Playwright (Chromium) desktop 1280 og mobil 390 | Dashboard → demo-009 → side 2 (24 kort) → Mine agenter → «Vis 3 treff» (3 kort). 0 konsollfeil, ingen horisontal scroll. |

Ikke kjørt: `npm ci` fra ren tilstand (avhengighetene er uendret siden DEV-001), deploy og andre nettlesere enn Chromium.

## Kjente begrensninger og åpne punkter

- **Agentvisningen** bruker fortsatt DEV-001s håndplukkede koblinger (`demoListingIds`) via `getListing`. Agentsøk med filtre hører til DEV-004/DEV-005.
- **TEST_PLAN** nevner «10 ulike agentoppsett» i mock-datasettet. Det er ikke laget her; agentoppsett hører til DEV-004.
- **Ukjente verdier i søk:** Det syntetiske søket tar med annonser med ukjent verdi. En ekte kilde vil ofte ekskludere dem. Dette er dokumentert i ARCHITECTURE og må vurderes i DEV-006/DEV-010.
- **Valutasettet** er en arbeidsbeslutning (DEC-018). Ingen FX (OPEN-005/DEV-009).
- **Observasjonstider:** `firstSeenAt`/`lastSeenAt` er syntetiske i mock-dataene. Ingestion (DEV-005) eier dem for ekte kilder.
- **Fortsatt åpne fra DEV-001:** R5 (konvertering bigint↔number før DEV-002), R7 (bredere filter i DEV-004), R9 (npm audit i lint-verktøy).
- **Review:** Dette er levert og selvkontrollert av hovedutvikler. Uavhengig review gjenstår.

## Neste oppgave

Uavhengig review av DEV-003. Deretter DEV-002, når SET-002 (Supabase) er klart. DEV-004 forutsetter både DEV-002 og DEV-003.
