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

## Duplikater, varsler og prisendringer

Ingestion er idempotent. MVP sender høyst ett første varsel per `(dealership_id, agent_id, source, source_listing_id, notification_type=initial)`; endrede annonser oppdaterer opportunity uten nye prisvarsler i v0.1. En outbox-unique constraint stopper duplikater i DB. E-postleverandørens idempotency-mulighet brukes hvis tilgjengelig; crash etter akseptert sending men før DB-kvittering må avstemmes, ikke blindt resend.

Ingen garanti om «exactly once» på tvers av en ekstern e-posttjeneste. Uavklarte sends får `delivery_unknown`, kontroll og avstemming.

## Firmatilgang og drift

User ID utledes fra validert sesjon. Firma utledes fra membership; browserinput er aldri tilstrekkelig autorisasjon. RLS testes med ordinære brukercredentials. Servicerolle brukes bare i avgrensede serverjobber med eksplisitt scope og audit-logg.

Monitorér siste vellykkede run, antall treff, truncation, API-/LLM-forbruk, kø, sendfeil og blokkerte kalkyler. Pause-knapp stopper neste kjøring og nye varsler; pågående jobb sjekker aktiv status før enqueue. Logg IDs/status, ikke secrets eller komplette annonse-/kundetekster.

Gjenoppretting fra backup og replay av jobb er del av pilotporten. Retensjon og tilgang til bilder/tekst bestemmes av avtale og databehandlerforhold, ikke av ubegrenset teknisk lagringsmulighet.
