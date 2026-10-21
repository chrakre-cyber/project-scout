# ECON-006e – uavhengig review av 2d2b54f

Grunnlag: `ECON-006e-review-2d2b54f.zip`, implementering, tester, identitetsbaseline, dokumentasjon og utviklerens nettleserlogger.

## Konklusjon

**Ingen blokkerende funn i den kontrollerte implementeringen.** Demodatafornyelsen kan avsluttes innen levert omfang etter at dokumentkontrollen er kjørt og registrert i fullt repo, se merknaden nedenfor. Dette er ikke parametergodkjenning, bekreftet Supabase-integrasjon eller pilotgodkjenning.

## Kontroll av løsningen

- Standardepoken er en fast konstant. Server-overstyringen leses ett sted. Klokken brukes til validering, ikke til løpende å flytte observasjonene.
- Strengt UTC-format og kalenderdato kontrolleres. Eksakt nåtid godtas, mens epoke i fremtiden avvises uten toleranse eller automatisk justering. Gulvene tar hensyn til profilens gyldighet og datasettets siste endringstid.
- Observasjonene flyttes deterministisk og monotont inn i 0–48-timersvinduet. `sourceModifiedAt`, annonseinnhold og revisjonskontrakt er bevart. Identitets- og baselinekontrollene består.
- Ugyldig epoke gir kildefeil, uten stille fallback. En provider med ugyldig konfigurasjon mellomlagres ikke.
- Normalisert proveniens beskriver generering og simulerte observasjoner, ikke henting fra en virkelig leverandør. Søkeskallet viser genereringsdato og beholder den eksisterende syntetisk-merkingen. Layouten er dynamisk.
- Oppbevaringstiden og økonomiens utløpskontroll er uendret. Testene kontrollerer faktisk utløp etter den enkelte annonses `lastSeenAt`, samt at samme epoke med en senere klokke ikke gir nye observasjonstider. Standardepoken blir derfor gammel igjen som tilsiktet.
- Økonomikjerne, skattemotor og migrasjonsfiler er byte-identiske med den foregående 006d-pakken.
- Nettleseroppsettet bruker epokekonfigurasjonen i den uendrede appen; den tidligere `fresh_observations`-patchen er fjernet. Endrede rettighetsprofiler prøves fortsatt med særskilte testkopier. Dette skillet er riktig dokumentert.

## Dokumentkontroll: presisering før avslutning

Det stemmer at `npm run check-docs` ikke finnes i `package.json`. Selve kontrollen finnes likevel som `docs/tax/check-docs.mjs`, med dokumentert kjøring:

```text
node docs/tax/check-docs.mjs
```

Reviewer kjørte denne kommandoen i pakken. Den avslutter med feil på manglende arkiverte primærkildefiler, som er utelatt fra reviewpakken. Dette er ikke belegg for en implementeringsfeil, men heller ikke en bestått kontroll. Kjør kommandoen i fullt repo, rett eventuelle reelle funn og registrer resultatet før DONE. Oppdater rapportens begrunnelse for manglende kjøring; ikke legg til eller omskriv kilder for å få en ufullstendig reviewpakke grønn.

## Reviewerens egne kjøringer

| Kontroll | Resultat |
| --- | --- |
| Manifest | 619 av 619 SHA-256-oppføringer stemmer |
| Kjørbare enhetstester | 70 filer / 1 538 tester består |
| TypeScript (`--noEmit --incremental false`) | Består |
| ESLint | Består uten feil eller advarsler |
| Økonomikjerne, skattemotor og migrasjoner mot 006d | Ingen endrede filer i de sammenlignede katalogene |
| Dokumentkontroll i pakken | Ikke bestått: arkiverte primærkilder mangler |

De to kildeavhengige testfilene `tax-engine.test.ts` og `economics-source-driven.test.ts` er ikke kjørt. Reviewer bekrefter derfor ikke selv utviklerens fulle 1 664 tester. Eksisterende lokale avhengigheter er brukt.

Nettleserresultatene 94/94 og 26/26 er gjennomgått som utviklerbelegg, ikke gjentatt av reviewer. Reviewer har ikke kjørt build, PostgreSQL, ekte Supabase/PostgREST/GoTrue, `qa:*`, hosted migrasjon eller deploy.

## Videreføring

Etter dokumentkontrollen kan 006e avsluttes avgrenset. Demoens økonomiflyt kan da demonstreres med nylig, eksplisitt satt epoke, men både datautløp og regelperioden 2026 gjelder fortsatt. Ekte Supabase og hosted miljø står igjen som nødvendige pilotkontroller. Økonomiflaggene forblir false, E7 utsatt og E8 åpent. Ingen nye tjenester, hosted migrasjoner eller deploy er godkjent gjennom denne reviewen.
