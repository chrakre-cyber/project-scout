# ECON-006b – uavhengig review av 8a42bc5

Grunnlag: `ECON-006b-review-8a42bc5.zip`, manifest, diff mot 84603c6, domene-/serverflyt, sider, komponenter og tester.

## Konklusjon

**Ett P2-funn. Behold ECON-006b på REVIEW og stopp før 006c til retting og re-review.**

## P2 – kandidat-ID lekker leverandørens annonse-ID til klienten

Sted: `src/app/searches/[id]/preview/[listingId]/dealer-input/page.tsx`, props til `DealerInputForm`, og `src/components/search/DealerInputForm.tsx`, `candidate`-prop og skjult `candidateId`-felt.

Siden sender `target.candidate` til en klientkomponent. Kandidatens ID er ikke opak: `candidateId(source, sourceListingId)` bygger `${source.length}:${source}/${sourceListingId}`. Skjemaet legger hele denne verdien i HTML som `name="candidateId"`. Dermed ligger rå leverandøridentitet i DOM og klientprops, selv om den offentlige URL-en bruker en opak `m1_…`-ID.

Dette omgår den etablerte visningsgrensen fra DATA-002C: leverandørens annonse-ID skal bare kunne vises gjennom det rettighetsstyrte feltet `providerListingId` / `listing_id`, ikke indirekte gjennom en intern identitetsstreng. `resolveDealerTarget` er uttrykkelig dokumentert som serverintern, med kandidatidentitet som UI aldri skal få. Den nye skjemasiden bryter den kontrakten. At feltet er skjult og bare brukes til konfliktkontroll, hindrer ikke innsyn.

**Selv reprodukert:** render av det faktiske skjemaet med en kandidat laget etter samme kanoniske ID-format gir:

```html
<input type="hidden" name="candidateId" value="14:synthetic-demo/provider-private-listing-783129"/>
```

Vedlagt `economics-006b-independent-regressions.test.ts` kontrollerer at den rå leverandør-ID-en ikke finnes i markup. Testen feiler på levert kode. Dette er ikke påvist tilgang til et annet firmas lagrede input; funnet gjelder lekkasje utenfor feltvisningsretten og gjeninnføring av identiteten DATA-002C skulle skjerme.

**Rettingskrav:** hold rå kandidatidentitet på serveren. Bruk eksisterende opak offentlig identitet og en opak/integritetsbeskyttet konfliktmarkør ved behov. Bevar ny serverutledning av kandidat og revisjon, konfliktkontroll og firmabinding. Ikke fjern revisjonskontrollen for å fjerne feltet. Ikke erstatt det med klartekst-base64 eller flytt rå ID til en annen klientprop, skjult attributt, React-nøkkel som serialiseres, eller feilrespons.

Test faktisk side → klientprops/markup ved nektet `listing_id`, og at gyldig innsending fortsatt lagres mens endret revisjon, feil offentlig identitet og manipulert konfliktmarkør avvises uten skriving. Testens props kan tilpasses en ny trygg kontrakt; behold assertions om fravær av rå ID. Eksisterende komponenttest som forventer `candidateId` som skjult felt må oppdateres fordi den låser den utrygge kontrakten.

## Andre kontroller

Statisk gjennomgang viser at action henter sesjon og firmabundet søk på nytt, utleder kandidat via resolveren og bruker serververdiene ved lagring. Skjemamodellen holder tomme beløp adskilt fra faktisk oppgitt 0. Bekreftelse kreves ved innsending. Forhåndsutfylling velger ikke bekreftelsesboksen. Eksisterende tester for omfangsvalidering, rettighetsavslag, foreldelse og firmafra-sesjon består.

Forhåndsutfylling fra tidligere revisjon er et tillegg til planen, men den er i denne leveransen eksplisitt merket og krever ny bekreftelse. Reviewen godkjenner ikke automatisk kopiering eller bruk av den tidligere bekreftelsen i beregningen.

## Reviewerens egne kjøringer og begrensninger

- **561 av 561 SHA-256-oppføringer** stemmer før reviewerens lokale testtillegg.
- **65 filer / 1 480 eksisterende tester består**.
- Ny uavhengig regresjon: **1 test feiler** med ID-lekkasjen over.
- TypeScript (`--noEmit --incremental false`) og ESLint består på levert tilstand før testtillegget.

Eksisterende lokale avhengigheter er brukt. De to kildeavhengige testfilene `tax-engine.test.ts` og `economics-source-driven.test.ts` er ikke kjørt fordi primærkildearkivene er utelatt. Utviklerens fulle resultat på 1 606 tester er derfor ikke selv bekreftet av reviewer.

Reviewer har ikke kjørt build, `check-docs`, `qa:*`, PostgreSQL, ekte Supabase/PostgREST, kjørende app, nettleser/e2e, hosted migrasjon eller deploy. Render-testen er en statisk komponenttest, ikke bekreftet nettleser- eller lagringsintegrasjon. Disse kontrollpunktene gjenstår. Økonomiflaggene skal fortsatt være false; ingen beregningsregel trenger endring for å rette funnet.
