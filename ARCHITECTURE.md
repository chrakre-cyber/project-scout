# Arkitektur — arbeidskontrakt v0.1

03.10.2026. Denne filen spesifiserer modulgrenser; den er ikke en påstand om implementert kode. Faktiske pakkeversjoner låses av utvikler ved oppsett og dokumenteres i lockfile.

## Komponenter

| Komponent | Ansvar | Skal ikke gjøre |
|---|---|---|
| Next.js / UI | Login, agenter, opportunities, eksplisitte kalkyleforutsetninger | Holde serverhemmeligheter eller kontakte mobile.de med klientnøkler |
| Serverlag | Inputkontroll, autorisasjon, providers, kalkyler, AI-adapter og jobber | Stole på klientens dealership_id uten membership-kontroll |
| Supabase / Postgres | Auth, data, RLS, constraints, run-logg, outbox | La service-role-data eksponeres i nettleseren |
| n8n | Tidsstyrt trigger og driftsoversikt | Eie en annen kopi av avgifts-/marginlogikken |
| MarketplaceProvider | Søke/hente og normalisere kildeannonser | Bestemme forhandlerens salgspris eller avgifter |
| Kost-/bidragsmotor | Deterministiske beregninger med versionssnapshot | Bruke LLM som matematikk-/regelautoritet |
| LLM-adapter | Tekstanalyse med schema, korte belegg og cached versjon | Endre bilspesifikasjoner eller tax profile uten bekreftelse |
| E-postadapter | Sende avtalt opportunity-varsel via outbox | Bruke tilfeldig mottaker fra annonsetekst |

## Foreslått kodeplassering

- `src/domain/`: money, vehicle, agent, matching, cost, contribution, scoring.
- `src/providers/marketplace/`: interface, mock, mobile-de.
- `src/providers/ai/` og `src/providers/email/`: isolerte eksterne tjenester.
- `src/server/`: autorisasjon, DB-queries og serverjobb-entrypoints.
- `src/app/`: skjermer og serverruter.
- `supabase/migrations/`: migrasjoner med versjon.
- `tests/fixtures/`: syntetiske data; API-formatfixturer skilles fra interne fixturer.
- `tests/reference-cases/`: referanser med kilder/dato/input og forventet output.

## Marketplace-kontrakt

```typescript
interface MarketplaceProvider {
  search(query: SearchQuery, window: SearchWindow): Promise<SearchPage>;
  getListing(sourceListingId: string): Promise<NormalizedListing | null>;
}
// SearchPage: items, nextPage, sourceTotal, truncated, fetchedAt
// SearchWindow: modifiedSince?, page?, pageSize?
// NormalizedListing: source, sourceListingId, originalUrl,
// sourceModifiedAt?, firstSeenAt, price, specs, text?, seller?, provenance
```

Det faktiske kildeformatet normaliseres i hver adapter. Mock-provider returnerer vår interne kontrakt og merkes syntetisk. API-testfixturer følger valgt mobile.de-format først når mapping er kontrollert mot dokumentasjon/testkonto. Ikke gi oppdiktede kildeobjekter status «mobile.de JSON».

Pris er et beløp + valuta + grunnlag (`gross`, `net`, `unknown`) og mva.-opplysninger med belegg. Førsteregistrering beholder presisjon (`date`, `month`, `year`), ikke oppdiktet dag. CO2 bevarer enhet og testmetode. Ukjent felt er `null`, ikke 0.

Feiltyper: authentication, forbidden, rate_limit, invalid_query, timeout, unavailable, malformed_data. Autentisering/forbidden gir stopp og synlig blokkering; kun transient feil får begrenset retry med backoff og jitter.

### Implementert i DEV-003 (syntetisk provider)

Koden ligger i `src/providers/marketplace/` (`types.ts`, `errors.ts`, `index.ts`) og `src/providers/marketplace/synthetic/`. UI henter annonser bare via `getMarketplaceProvider()`. Konkretiseringer av kontrakten:

- `NormalizedListing` har i tillegg `lastSeenAt`, og `price` kan være `null` (pris ikke oppgitt). `price` har `stated` (beløp som kildens desimalstreng + valuta, alltid bevart), `amount` (`Money` eller `null` ved ustøttet valuta, se DEC-018) og `vat` (sats, fradragspåstand claimed/denied/unknown, belegg og opphav). Alle annonsefelt er kildens opplysninger; Scouts vurderinger ligger i kalkyler.
- `SearchPage.rejected` lister poster som ikke kunne normaliseres (`malformed_data`); resten av siden leveres. `getListing` kaster `malformed_data` for en slik post og returnerer `null` når annonsen ikke finnes.
- `firstSeenAt`/`lastSeenAt` er syntetisk observasjonshistorikk i mock-dataene. For ekte kilder settes de av ingestion (DEV-005B), ikke av kilden.
- Syntetisk søk ekskluderer ikke annonser med ukjent verdi for et filter, og sammenligner ikke pris på tvers av valuta. Hardfilter og needs_review avgjøres i DEV-010. Miles regnes eksakt om (1 mi = 1,609344 km) bare for sammenligning; lagret verdi beholder kildens enhet.
- Fixturene ligger under `src/providers/marketplace/synthetic/fixtures/` (ikke `tests/fixtures/`) fordi demoen bruker dem i appen. Opphav: `FIXTURES.md` i samme mappe.

## Kjøring av én agent

1. Verifiser aktiv agent og firmatilgang; ta tidsavgrenset lock.
2. Opprett `search_run` og hent siste vellykkede checkpoint.
3. Søk med overlappende tidsvindu; håndter alle sider og begrensning eksplisitt.
4. Upsert annonce med `(source, source_listing_id)`; opprett revision ved endret content-hash.
5. Hent detaljannonse ved behov. Re-evaluer eksisterende annonser hvis agentens forutsetninger endres.
6. Bruk hardfilter først. Beregn kost, bidrag og score bare med sporbare input.
7. Kjør analyse for relevante kandidater etter rettighetskontroll. Cache på listing revision + prompt/model-version.
8. Lagre immutable kalkylesnapshot og opprett outbox-rad for kvalifisert opportunity.
9. Oppdater checkpoint bare etter at annonser og resultater er lagret; e-post sendes fra kø separat.
10. Avslutt run og lock. Feil i én annonse logges uten at annen gyldig data slettes.

Standard planleggingsmål er hvert 30. minutt; faktisk intervall fastsettes av kvoter og avtale. Søke-jobben er asynkron og skal ikke bindes til en lang nettleserforespørsel. Jobbrute må autentiseres med separat serversecret og begrenset funksjon.

## Manuell søkekjøring (DEV-005A)

Omfang: DEV-005A = manuelle, tenant-isolerte søkekjøringer med snapshots. **DEV-005B** (delt ingestion: `listings`, `listing_revisions`, dedup på tvers av kjøringer, sjekkpunkter, låser) er BLOCKED på BUS-002 / OPEN-001 / OPEN-002 og finnes ikke ennå. Resultatrader fra DEV-005A er ikke autoritative input til automatikk før FU-005-1 (betrodd server-side skriving) er løst; «Se annonse» slår opp mot nåværende provider, ikke lagret revisjon (DEC-026).


Agent → Search Run → Provider → Resultat er adskilt: `src/domain/matching.ts` og `src/domain/search-run.ts` (rene regler, rangering, snapshot), `src/server/search-pipeline.ts` (provider-sider, tidsavbrudd, begrenset retry, validering, hashing; provider injiseres), `src/server/search-runs.ts` (orkestrering mot databasen), databasen (tabeller, constraints og triggere for tenant, status og idempotens — ingen domenelogikk) og UI (`/agents/[id]/runs`). Provideren er fortsatt `MarketplaceProvider`; en ekte provider (DEV-006) kan byttes inn uten UI-endring. Se DEC-026/027.

### Lagringsrettigheter og betrodd skrivevei (DEV-005B0)

- **Rettighetsprofil per provider** (DEC-028): lagring er default-deny og styres av en versjonert, verifisert profil (retensjon, datatyper, virkningsperiode). Domenet (`src/domain/rights.ts`) projiserer resultatutdraget gjennom profilen før hashing og lagring; databasen håndhever det samme (hvitelistet snapshot, `expires_at`, usynlighet via RLS). Se `DATABASE_SCHEMA.md`.
- **Betrodd skrivevei** (DEC-029): brukerens sesjon starter en kjøring (tenant-sjekket i databasen). Lagring og avslutning av resultater går via `src/server/trusted-ingest.ts` som den begrensede databaserollen `scout_ingest` (fem funksjoner, ingen tabellrettigheter). Orkestreringen i `src/server/search-runs.ts` bruker begge: brukerklient for start og lesing, betrodd vei for skriving. `pg` og `SCOUT_INGEST_DATABASE_URL` er avgrenset til denne ene modulen (arkitekturtest).
- **Synlighet:** lagrede data er lesbare bare mens raden ikke er utløpt OG profilen fortsatt gjelder (trukket/utløpt profil skjuler umiddelbart; `effective_to` er øvre grense). Purge fjerner også slike rader.
- **Retensjon:** `npm run purge:expired` (eller funksjonen direkte) sletter utløpte rader. Ingen scheduler er satt opp; DEV-013 eier periodisk kjøring.
- Ingen ekstern provider, ingen global katalog og ingen n8n: DEV-005B er fortsatt BLOCKED.

## Duplikater, varsler og prisendringer

Ingestion er idempotent. MVP sender høyst ett første varsel per `(dealership_id, agent_id, source, source_listing_id, notification_type=initial)`; endrede annonser oppdaterer opportunity uten nye prisvarsler i v0.1. En outbox-unique constraint stopper duplikater i DB. E-postleverandørens idempotency-mulighet brukes hvis tilgjengelig; crash etter akseptert sending men før DB-kvittering må avstemmes, ikke blindt resend.

Ingen garanti om «exactly once» på tvers av en ekstern e-posttjeneste. Uavklarte sends får `delivery_unknown`, kontroll og avstemming.

## Firmatilgang og drift

### Implementert i DEV-002

- **Supabase-klient:** opprettes bare på serveren (`src/lib/supabase/server.ts`, `@supabase/ssr`) med URL og publishable key. Brukerens sesjon ligger i cookies. `src/proxy.ts` (Next 16-erstatningen for middleware) fornyer sesjonen, men autoriserer ingenting. Det finnes ingen nettleserklient for data.
- **Sesjonskontekst:** `src/server/session.ts` henter brukeren med `auth.getUser()` (validert mot Auth) og firma fra `dealership_members` under RLS. Resultatet er en av statusene `not_configured`, `anonymous`, `no_membership` eller `member`.
- **Agentlagring:** server actions bruker `dealership_id` fra konteksten og ignorerer skjemafelt som firma-ID, `active` og `version`. RLS `WITH CHECK` avviser uansett andre firma.


User ID utledes fra validert sesjon. Firma utledes fra membership; browserinput er aldri tilstrekkelig autorisasjon. RLS testes med ordinære brukercredentials. Servicerolle brukes bare i avgrensede serverjobber med eksplisitt scope og audit-logg.

Monitorér siste vellykkede run, antall treff, truncation, API-/LLM-forbruk, kø, sendfeil og blokkerte kalkyler. Pause-knapp stopper neste kjøring og nye varsler; pågående jobb sjekker aktiv status før enqueue. Logg IDs/status, ikke secrets eller komplette annonse-/kundetekster.

Gjenoppretting fra backup og replay av jobb er del av pilotporten. Retensjon og tilgang til bilder/tekst bestemmes av avtale og databehandlerforhold, ikke av ubegrenset teknisk lagringsmulighet.
