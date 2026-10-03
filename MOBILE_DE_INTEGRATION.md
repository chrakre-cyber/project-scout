# mobile.de-integrasjon og datatilgang

Kontrollert 03.10.2026. Kilder S01–S02 i SOURCES.md. Dokumentasjonen beskriver tekniske muligheter; den gir ikke automatisk kommersiell brukstillatelse.

## Verifiserte tekniske fakta

- Search API søker på kriterier og henter en annonse med ad-key.
- API-account trenger aktivering; vanlig dealer-account er omtalt for egen inventory.
- Basic authentication brukes med serverlagrede credentials.
- Velg nytt JSON-format eksplisitt: `Accept: application/vnd.de.mobile.api+json`.
- Søk: `GET /search-api/search?{parameters}`. Detalj: `GET /search-api/ad/{ad-key}`.
- Detaljuthenting kan gi flere felter enn søkeresultatet.
- Pagination gir maksimalt 2 000 annonser for et søk. Store søk må snevres inn; resultatet må merkes ufullstendig hvis grensen nås.

Dette er ikke en bekreftelse av vår konto, kvote, pris eller datadekning.

## Før reell bruk — BUS-001/BUS-002

Christian ber om skriftlig avklaring av:

1. Betalt B2B-tjeneste til flere norske forhandlere, inkludert slutkundenes rett til å bruke treffene.
2. Tillatte søk og volum, intervall, requestkvoter og skalering fra 5 til 20 kunder.
3. Lagringstid, cache, historiske pris-/annonse-revisjoner og sletting ved bortfall av annonse/avtale.
4. Visning av bilder, tekst og avledede oppsummeringer, logo/attribution og original-lenker.
5. E-postvarsler med data/bilder/avledede tall.
6. LLM-behandling via tredjepart: hva som kan sendes, hvor, og om selger-/personopplysninger må fjernes.
7. Kommersiell pris, oppstart, minimumsforpliktelse, oppsigelse og viderebruk av avledede data.
8. Testkonto, representative responser og riktig aktuell kontrakt.

API-credentials alene består ikke Gate A. Dersom én rettighet begrenses, tilpasses løsningen før data brukes, eksempelvis bildevisning eller tekstbehandling. Hvis kjernebruken ikke tillates, må ny lovlig kilde vurderes.

## Mapping og søk

- Bruk mobile.de sine reference data for make/model og enum-verdier; ikke send norske UI-etiketter som API-ID uten mapping.
- Mapping skal dokumenteres felt for felt mot det valgte JSON-formatet.
- Bevar source-ID, currency, gross/net/unknown, VAT-opphav, date precision og CO2-testmetode.
- Modell/variant som «993» kan kreve kombinert modell-/års-/tekstfilter. Test mot representative annonser; et modellnavn er ikke automatisk en chassisgenerasjon.
- Første kjøring henter relevante tilgjengelige annonser innen avtalt kvote. Senere brukes modification-time med overlapp og ID-dedup. Lag checkpoint først etter at data er lagret.
- modification-time er ikke bevis på at annonsen er nyopprettet.
- Begrensning/truncation vises i run-logg og UI; ikke lov full markedsovervåking når datakilden returnerer delmengde.

## Feilhåndtering og aksept

401/403: stopp, flagg tilgang og informer operatør. 429/transient serverfeil: begrenset retry og kvotebevisst backoff. 404 på detalj: marker utilgjengelig. Parsefeil: logg kontrollert og unngå gjetting. Dokumenter faktiske API-feil som adapteren observerer; ikke anta alle leverandørkoder på forhånd.

DEV-006 er ferdig når autentisering, mapping, representative filtre, detaljuthenting, paging, truncation, retry og rettighetsvalg er kontrollert mot den godkjente kontoen. Mock-fixturer er separat; de beviser bare vår interne kontrakt.
