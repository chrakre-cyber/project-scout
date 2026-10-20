# ECON-006b — forhandlerskjema og firmaprofil (levert til uavhengig review)

**Oppgave:** ECON-006b (videreført ECON-005-restarbeid, B1): brukerflate for forhandleropplysninger og firmaprofil, koblet til den eksisterende valideringen (`parseDealerInput`, `validateLineScopes`) og lagringen (`DealerEconomicsStore`, RLS). Samtidig registrert: ECON-006a DONE (`reviews/ECON-006a-avslutning.md`, `ECON-006a-re-review-84603c6.md`).
**Status:** levert til uavhengig review. Ikke DONE. 006c er ikke startet. Utviklerens egne kontroller er ikke en uavhengig review.

## Brukerutfall
- **Detaljsiden** har en lenke «Registrer eller endre forhandleropplysninger» (kun når økonomien kan vises, ellers ingen lenke). Hver registrerbar mangel i «Hva mangler?» lenker til riktig felt; felt som ikke samles inn i dag (EV-kvalifisering m.fl.) står uendret som «kan ikke registreres ennå» — ingen utvidelse av kjøretøyomfang.
- **Skjema** `/searches/[id]/preview/[listingId]/dealer-input`: gruppert (`fieldset/legend`), alle felt med etikett, feilsammendrag med lenker + feltfeil, 44 px treffflater via eksisterende stiler. Grupper: drivlinje, avgiftsvekt, CO₂, første registrering, norsk registrering, tolldeklarasjon, utenlandsk mva., kurs (kjøpesum og toll, forhandleroppgitt med kilde og dato), kostnader (transport til/etter, forsikring, lasting, klimagassavgift, registreringsgebyr), omfang per søkekostnadslinje (til/etter/fordelt/annet, fordeling valideres), mva.-håndtering og fradrag, henvisning, uttrykkelig bekreftelse.
- Annonsens påstander vises ved siden av som «ikke dokumentasjon» og **fylles aldri ut**. Tomt felt = utelatt = ukjent. «0» er bare et faktisk skrevet 0. Det finnes ingen valgmulighet for annonsepåstand som grunnlag.
- **Bekreftelse** er en avkrysning som aldri er forhåndsvalgt; uten den lagres ingenting. Etter lagring: tilbake til detaljsiden med melding; vurderingen beregnes på nytt (ingenting avledet lagres).
- **Foreldelse:** når annonsen får ny revisjon, finner ikke visningen den gamle bekreftelsen (nøkkel inkluderer revisjon) ⇒ ikke brukt. Skjemaet forhåndsutfylles da fra nyeste tidligere bekreftelse for samme kandidat med tydelig merknad; **ingenting bekreftes automatisk**. Endret kostnadsgrunnlag/scenario/rettigheter/utløpt kurs vises som «må bekreftes på nytt» med årsak; skjemaet er forhåndsutfylt til gjennomgang.
- **Firmaprofil** `/searches/economics-profile` (lenke fra søkeoversikten): standard mva.-håndtering og fradragsstatus; tomt = ingen standard. Overstyrer aldri en bekreftet verdi for annonsen (en uttrykkelig «Ukjent» på annonsen overstyrer profilen). Leses profilen ikke, vises ingen skjema (så en lagring ikke kan overskrive den med tomme verdier).

## Binding og sikkerhet
- Firma kommer fra den validerte sesjonen (`getSessionContext`) via lagringen; databasen avgjør (RLS/trigger). Skjemaet kan ikke oppgi firma (ukjente nøkler avvises av parseren; skjemaets ekstra felt ignoreres; testet).
- Søk, kandidat og revisjon utledes av serveren på nytt (`getDraft` + `resolveDealerTarget`, som går gjennom samme rettighets- og proveniensgrense som visningen). Skjemaets skjulte felt (`draftVersion`, `candidateId`, `candidateVersion`) er bare konfliktkontroll: avvik ⇒ «Annonsen eller søket er endret…», ingenting lagres.
- Manglende visningsrett (`unavailable`) ⇒ ingen skjema og ingen registrering.
- Omfang valideres mot AKTUELLE kostnadslinjer både i skjemaet og av `confirmDealerInput` (reserve).

## Endrede/nye filer
- Domene: `src/domain/search-economics/dealer-form.ts` (ren; skjemaverdier ↔ input, feilkoder, feilsti→felt), `index.ts`.
- Server: `src/server/dealer-input-flow.ts` (innsending, forhåndsutfylling, profil), `src/server/search-display.ts` (`resolveDealerTarget` — `detailForDisplay` bygger nå på den; samme gating).
- App: `…/dealer-input/{page,actions,state}.ts(x)`, `src/app/searches/economics-profile/{page,actions,state}.ts(x)`, detaljsiden (lenke + melding), søkeoversikten (profillenke).
- Komponenter: `DealerInputForm.tsx`, `DealerProfileForm.tsx`, `DealerFormFields.tsx`; `EconomicsNote`/`EconomicsExplanation` (valgfri `dealerFormHref`, lenker fra «hva mangler»).
- Etiketter: `src/lib/search-labels.ts` (006b-seksjon, `FIELD_ANCHOR`).
- Tester: `economics-006b-{form,flow,actions,components}.test.ts` (120 tester); `architecture.test.ts` (to nye klientkomponenter på listen).
- Docs: `DECISIONS.md` runde 54, `MVP_BACKLOG.md`, `reviews/ECON-006a-avslutning.md`, `reviews/ECON-006a-re-review-84603c6.md`.

## Ikke endret (bevisst)
Økonomiflagg (false), beregningsregler, avgiftsmotor, avrunding, `classifyBudget`, støttet kjøretøyomfang, migrasjoner (ingen), lagringsskjema (de to 005c-tabellene brukes uendret). Ingen hosted migrasjon, ingen deploy.

## Kontroller faktisk kjørt (utvikler)
- `npx vitest run`: 67 filer / **1 606 tester grønne** (1 486 før; 120 nye 006b-tester). `tsc`, `eslint .` og `check-docs.mjs` rene/OK.
- `npx next build`: vellykket; de nye rutene er registrert (`…/dealer-input`, `/searches/economics-profile`). `qa:secrets`: ingen funn. `qa:demo`: alle kontroller bestått.
- Nye tester: skjemamodell (69: tomt = utelatt, 0 bevares, normalisering, hviteliste, presisjon/verdi, fordeling i øre, rundtur, parser som bakstopp); flyt mot minnelager (23: bekreftelse, stale, rettigheter, ingen skriving ved feil, idempotent erstatning, gjennom visningsgrensen før/etter, ny revisjon, endret kostnadsgrunnlag, utløpt kurs, forhåndsutfylling, profil); actions med mockede avhengigheter (12); komponenter/tekster (16: struktur, aldri forhåndsvalgt bekreftelse, ankere treffer felt).
- Mutasjoner (kopi/sed, filene gjenopprettet og verifisert), alle fanget: bekreftelse ikke påkrevd (2 feiler), stale-sjekk fjernet (5), rettighetssjekk fjernet (2), tomt beløp → 0 (5), ukjent registrering beholder valgt grunnlag (1), fordelingsavvik ignorert (2), avkrysning forhåndsvalgt (2), firma fra skjema i domenet (3) og i action (1).

## Begrensninger (ærlig)
1. **Ikke kjørt:** nettleser/e2e og kjørende app (006c: J1–J10 med skjermbilder), lagringen mot ekte Supabase/PostgREST (separat, nødvendig kontrollpunkt før pilot — B6; minnelageret i testene er ikke en bekreftet Supabase-integrasjon), DB-suiten (ingen DB-endring), hosted migrasjon, deploy. Sidene (`page.tsx`) er kontrollert via `next build` og statisk skanning, men ikke rendret i nettleser.
2. Konflikt (side utdatert) beholder brukerens verdier i svaret, men skjemaet må åpnes på nytt for å få ny revisjon; skriftlig tekst i det utdaterte skjemaet må tas med manuelt. Bevisst: ingen automatisk bekreftelse mot en annonse brukeren ikke har sett.
3. Utenlandsk mva.-dokumentasjon, kursgyldighet m.m. valideres av eksisterende kjerne/parser; skjemaet legger ikke til regler. Eksplisitt «ukjent» for kostnadsfeltene finnes ikke som eget valg (tomt = ukjent, samme betydning).
4. BEV-funnet fra 006a gjelder fortsatt: EV-kvalifisering samles ikke inn (vises som scenarier); ikke utvidet.
5. Etikettene i skjemaet er ikke språkvasket av uavhengig leser.

## Neste oppgave
Uavhengig review av 006b. Deretter, kun etter Christians godkjenning: 006c (brukerforløpstester: test 8 med tre profiler i vitest, e2e med emulator J1–J10 — emulator ≠ bekreftet Supabase).
