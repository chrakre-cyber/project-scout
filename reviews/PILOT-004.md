# PILOT-004 — Forenkle forhandlerrettet økonomispråk i detaljvisningen (kun audit)

Dato: 2026-10-23 · Basis: `main` cbf836b (PILOT-003 merget) · **Ingen kode endret, ingen PR.** Hjelpeskript for utdrag er slettet etter bruk.

**Metode og grenser.** Tilstandene under er rendret med de faktiske komponentene (`ResultCard`, `AcquisitionSummary`, `EconomicsNote`/`EconomicsExplanation`) gjennom den ekte pipelinen (rettigheter → adapter → motor → visningsgrense → sammendrag), med samme sammensetning som detaljsiden (`whyShown`, budsjettnotis, sammendrag, legacy-blokk). Det er **ikke** nettleserkjøring for alle tilstander; den kuraterte demoen og «ikke beregnet» uten input er i tillegg sett i ekte nettleser (PILOT-001/002/003). Tilstander: komplett estimat (diesel, forhandlerinput), EV-scenarier/kuratert demo, meningsfull delsum, utilgjengelig uten input, utløpt avgiftsprofil (2027), manglende kurs (EUR), eget forhandlerinput (EUR/BEV). Ingen skjult/«TAX»/«REVIEW»-kode er synlig for forhandler; `data-*`-attributter er ikke brukersynlige.

## A. Konklusjon

- Alvorlighet: **middels, og den svekker tilliten**: tallene er riktige og ærlig merket, men siden leses som en intern valideringsrapport.
- Det samme totalbeløpet står 3–4 ganger under ulike navn (komplett estimat: sammendrag, «Estimat — ikke validert», «Brutto utlegg», «Økonomisk kostnad»), og kortet gjentar totalen i en ekstra statuslinje.
- Intern språkbruk er fortsatt synlig i aktiv reise: «ikke validert», «ikke godkjent for validering», «Regelmotor», «Ikke løst», «Beregningsgrunnlag (summeres ikke)», «Dokumentasjonsdekning».
- «Ikke beregnet»-tilstandene viser 2–3 overlappende «dette mangler»-lister, og i tilstanden utløpt avgiftsprofil er årsaken feil beskrevet («Akseptdato — Registrer»).
- Blokkerer det pilot? **Ikke teknisk, men P1 før første forhandler ser siden**: fem små tekst-/presentasjonsendringer (§E) fjerner det. Ingen økonomilogikk må endres.

## B. Detaljsidens økonomiblokker i rekkefølge (komplett estimat / scenarier)

| # | Blokk | Formål | Nyttig? | Duplikat? |
|---|---|---|---|---|
| 1 | «Hvorfor vist» + krav/ønsker | Hvorfor bilen er med | Ja | – |
| 2 | Budsjettnotis («Annonseprisen er ikke total innkjøpskostnad. Budsjettvurdering er ikke gjort.») | Hindre feillesing av annonseprisen | Ja (én gang) | Gjentas i legacy-blokken som «Dette er ikke en budsjettvurdering …» og som «Ikke rådgivning» |
| 3 | **Estimert innkjøpskostnad til Norge** (sammendrag): total/område, scenarier, kort nedbrytning, kurser, notater, «dette gjør estimatet sikrere» | Svaret forhandleren kom for | **Ja — kjernen** | – |
| 4a | Legacy-overskrift «Anslått innkjøpskostnad til Norge» + «Estimat — ikke validert: X» / «Scenarier — fradragsstatus er ukjent» | Statuslinje | Nei | **Ja**: samme total og tilstand som #3 |
| 4b | «Brutto utlegg: X» + lang forklaring | Utlegg uavhengig av hvem som betaler når | Delvis | **Ja** i komplett estimat (= totalen i #3); i delsum samme tall som #3 |
| 4c | «Økonomisk kostnad: X» (+ scenarier med/uten fradrag) | Kostnad etter mva.-fradrag | **Ja for mva.-registrerte, når den avviker fra #3** | Ja når fradrag er ukjent og tallene er identiske med #3 |
| 4d | «Slik er beløpet bygget opp» (tabell med Tilstand/Grunnlag) + «Beregningsgrunnlag (summeres ikke)» | Vise hver post | Ja, men | Gjentar #3-linjene (kjøpesum/avgift/mva./transport) med flere detaljer; kolonnene «Tilstand»/«Grunnlag» er intern språkbruk |
| 4e | «Forutsetninger» (kurser, datoer, fradrag, mva.-håndtering, regelstatus) | Hva estimatet hviler på | Ja | Kurser gjentas fra #3 («Kurser brukt i estimatet») |
| 4f | «Dine valgte tillegg fra søket» | Forklare søketillegg | Bare når det finnes tillegg | Tom variant («Ingen tillegg lagt inn») gir ingenting |
| 4g | «Hva som er usikkert i dette tallet» (regler / påstander / mangler / ikke innsamlet / annet) | Usikkerhet | Delvis | Gjentar forutsetninger og manglende felt; 6 regelpunkter er intern |
| 4h | «Dette må oppgis for å beregne mer» + «Registrer eller endre forhandleropplysninger» | Vei til å forbedre estimatet | Ja | Gjentar #3 «Dette gjør estimatet sikrere» / «Dette mangler for å beregne» |
| 4i | «Ikke rådgivning.» + «Beregnet med bekreftede forhandleropplysninger» | Ansvarsavgrensning/kilde | Ja (kort) | – |
| 5 | Opplysninger fra annonsen, demoberikelse, «Hvorfor oppfyller kravene», «Opplysninger demokilden ikke har» | Annonsedetaljer | Utenfor dette oppdraget | – |

**Resultatkortet** (kompakt): sammendraget (total/delsum/område + 1 linje poster) **og** en ekstra legacy-linje «Anslått innkjøpskostnad til Norge: Estimat — ikke validert: 468 723 kr · Dette er ikke en budsjettvurdering. …» som gjentar totalen og budsjettforbeholdet.

## C. Internt språk som er synlig (aktiv reise)

| # | Nåværende tekst | Hvor | Hva det egentlig betyr | Anbefalt forhandlerspråk | Pri |
|---|---|---|---|---|---|
| C1 | «Estimat — ikke validert: 468 723 kr» | Kort (legacy-linje), detalj-overskrift (estimat/delsum) | Merovos beregning er ikke sertifisert | Skjul (totalen står i sammendraget). Ellers: «Estimat» | P1 |
| C2 | «Reglene for mva., avrunding, tollkurs og fradrag er ikke godkjent for validering. Alle tall er derfor estimater.» | Detalj, «Forutsetninger» | Avgifts-/mva.-regnestykket er ikke offisielt kontrollert | «Endelig kostnad må kontrolleres før kjøp. Avgift og mva. er beregnet av Merovo og er ikke en offisiell beregning.» | P1 |
| C3 | Gruppen «Regler som ikke er godkjent for validering»: «Suspensjon av tollkurs er ikke kontrollert», «Regelen for tollkurs er ikke bekreftet», «Engangsavgiften er et estimat», «Ordinær tollsats er ikke godkjent», «Mva.-reglene er ikke godkjent for validering», «Avrundingsregelen er ikke bekreftet», «Fradragsregelen er ikke godkjent» | Detalj, usikkerhet | Samme budskap som C2, i sju interne varianter | Én gruppe «Dette bør kontrolleres før kjøp» med 2–3 punkter: tollkurs, engangsavgift, mva. og fradrag; resten (avrunding, suspensjon) bak «Se detaljer» | P1 |
| C4 | «Regelmotor — estimat (regler ikke godkjent)», «Beregnet av regelmotoren», «Ordinær sats fra tolltariffen (ikke godkjent)» | Detalj, tabellkolonnen «Grunnlag» | Merovo har regnet; ikke dokumentert | «Beregnet av Merovo (estimat)», «Ordinær tollsats (estimat)» | P1 |
| C5 | «oppgitt eller beregnet», «Ikke løst», «utelatt etter scenarioantakelse (regler som 0)» (tilstandskolonnen); kolonneoverskriftene «Tilstand»/«Grunnlag» | Detalj, tabell | Kjent / ikke beregnet / ikke aktuelt | «kjent», «ikke beregnet», «ikke aktuelt»; «Kilde» i stedet for «Grunnlag» | P2 |
| C6 | «Beregningsgrunnlag (summeres ikke)» | Detalj, tabell | Tollverdi, mva.-grunnlag og tollavgift er ikke ekstra kostnad | «Grunnlag for avgift og mva. (kommer ikke i tillegg)» | P2 |
| C7 | «Dokumentasjonsdekning: 0 av 4 kjente kostnadsposter har tilbud eller dokument som grunnlag. Dette sier ikke at tallene er riktige, sikre eller godkjente.» | Detalj, over tabellen | Ingen post er dokumentert | «Ingen av postene er dokumentert med tilbud eller faktura ennå.» (uten «godkjente») | P2 |
| C8 | «Kontantbehovet er ikke beregnet.», «Kjøpesummen er ikke løst.», «Import-mva. er ikke beregnet.», «Forutsetning mangler eller er ikke dokumentert.» (generisk reservetekst) | Detalj, årsaker/«Mangler» | Interne feilkoder oversatt ordrett | Fjern der «Dette mangler» allerede sier det; reservetekst → «Opplysning mangler» | P2 |
| C9 | «Selv med bekreftede opplysninger er resultatet et estimat — ikke validert. Skjemaet godkjenner ingen regel og gir ingen budsjettvurdering.» | Skjemaside (forhandleropplysninger) | Samme budskap som C2 | «Resultatet er et estimat. Endelig kostnad må kontrolleres før kjøp.» | P2 |
| C10 | «Syntetisk demokurs (docs/tax/demo-series.json) — ikke en markedskurs» | Detalj, forutsetninger (demo) | Filsti lekker til UI | «Syntetisk demokurs — ikke en markedskurs» | P2 |
| C11 | «Dette er ikke en budsjettvurdering. Estimater, nedre grenser og scenarier gir aldri «innenfor budsjett», fullt treff eller varsel.» | Kort (legacy), detalj ×2 | Utviklerens avgrensning, ikke forhandlerens beslutning | Behold én kort linje (budsjettnotisen finnes); fjern denne | P2 |
| C12 | «Anslått» vs «Estimert innkjøpskostnad til Norge» (to titler), «Brutto utlegg», «Økonomisk kostnad» | Detalj | To navn på samme størrelse; to fagbegreper | Én tittel; «Kostnad etter mva.-fradrag» i stedet for «Økonomisk kostnad»; skjul «Brutto utlegg» når = totalen | P2 |

Ikke funnet synlig i aktiv reise: «TAX», «REVIEW», «regelstatus», profil-/regelkoder, rå statuskoder. Alle «godkjent/validert»-forekomster over er de eneste.

## D. Duplisering

| Gjentatt innhold | Hvor | Anbefaling | Hvorfor |
|---|---|---|---|
| Totalen/tilstanden (komplett: 4×; delsum: 4× under «Foreløpig delsum», «Minst», «Brutto utlegg», «Økonomisk kostnad»; scenarier: område + «Scenarier — fradragsstatus er ukjent» + «Fra X (scenarier)» ×2) | Detalj | **Skjul** legacy-overskrift og «Brutto utlegg» når de er lik sammendraget; **behold** «Økonomisk kostnad» bare når den avviker (fradrag kjent/scenario) og døp den om | Ett tall, ett navn; mva.-registrerte får fortsatt nettokostnaden |
| Legacy-linje på kortet («Anslått …: Estimat — ikke validert: X · Dette er ikke en budsjettvurdering …») | Kort | **Skjul** når sammendraget viser beløp (behold skjult statusnode for kontroller) | Totalen og forbeholdet står allerede i kortet |
| «Kurser brukt i estimatet» + «Forutsetninger → Kurs …» | Detalj | **Slå sammen**: behold kursene i Forutsetninger, fjern fra sammendraget (eller omvendt) | Samme to kurser to ganger |
| Postene (kjøpesum, engangsavgift, mva., transport) i sammendrag + i tabell | Detalj | **Behold** tabellen som utvidbar «Se hvordan beløpet er beregnet» | Tabellen har ekstra poster (forsikring, tollverdi …) |
| Manglende felt: «Dette mangler for å beregne» / «Dette gjør estimatet sikrere» (sammendrag) + «Mangler (gir nedre grense …)» + «Dette må oppgis for å beregne mer» (legacy) | Detalj (alle tilstander uten fullt estimat) | **Slå sammen til én liste** (sammendragets, med «Registrer»-lenker) | Kurs for kjøpesum/tollkurs står 3×, transport 3× |
| Enkeltpunkter: «Mva.-håndtering er ukjent» ×2, «Transport til innførselsstedet er ukjent» ×2 (identiske linjer), «Elbilkvalifikasjon» ×3 (uavklart / ikke innsamlet / «kan ikke registreres ennå»), fradragsstatus i forutsetninger + usikkerhet + manglende | Detalj | **Fjern dupliserte linjer** (dedupliser på tekst/felt) | Ren presentasjon |
| «Ikke innsamlet i appen ennå» (6 punkter) + «Annet» | Detalj | **Slå sammen** til én linje «Ikke med i estimatet: provisjon, betalingskostnader, andre importavgifter og øvrige kostnader.» | Seks punkter sier ett budskap |
| Budsjettforbehold: budsjettnotis, «Dette er ikke en budsjettvurdering …» (×2), «Ikke rådgivning» | Kort og detalj | **Behold bare budsjettnotisen + «Ikke rådgivning»** | Tre varianter av samme forbehold |
| «Dine valgte tillegg fra søket» når «Ingen tillegg lagt inn i søket» | Detalj | **Skjul** når tom | Ingen informasjon |

## E. Minste fiksett (5 endringer, ingen økonomilogikk)

1. **Fjern duplisert total/status** (P1): skjul legacy-statuslinjen på kortet og legacy-overskrift + «Brutto utlegg» i detalj når sammendraget viser beløpet; behold «Økonomisk kostnad» kun når den avviker, omdøpt «Kostnad etter mva.-fradrag».
2. **Én enkel språkrunde** (P1): bytt «Estimat — ikke validert», «ikke godkjent for validering»/«Regler som ikke er godkjent …», «Regelmotor», «Ikke løst», «Dokumentasjonsdekning …godkjente», «Beregningsgrunnlag (summeres ikke)» og tabellkolonnene til forhandlerspråk (C1–C7, C9–C10) — kun tekstkonstanter.
3. **Én mangler-liste og riktig årsak ved «ikke beregnet»** (P1): bruk sammendragets «Dette mangler» som eneste liste; fjern «Mangler …»-gruppen og «Dette må oppgis»-dublett; i tilstanden utløpt avgiftsprofil/akseptdato utenfor periode: årsakstekst «Beregningen dekker bare regler for 2026; datoen ligger utenfor» i stedet for «Akseptdato — Registrer» (kun presentasjonsmapping av eksisterende årsakskode).
4. **Trim usikkerhetsdelen** (P2): ett punkt «Endelig avgift og mva. må kontrolleres før kjøp» (+ 2–3 konkrete), dedupliser identiske linjer, slå sammen «Ikke innsamlet» til én linje, skjul tomme «Dine valgte tillegg».
5. **Skjul dypforklaringen som standard** (P2): legg tabellen, «Forutsetninger» og usikkerhet i én utvidbar «Se hvordan beløpet er beregnet» (`<details>`, åpen i e2e via attributt/tekst om nødvendig); sammendraget + kort liste «Dette bygger estimatet på» (kurser, datoer, fradrag) står synlig.

## F. Foreslått implementasjon (ikke utført)

- `src/lib/search-labels.ts`: `ECONOMICS_LABELS.estimate_not_validated`, `RULES_NOT_APPROVED`, `UNCERTAINTY_GROUP_TITLE`, `BASIS_LABEL`, `STATE_LABEL`, `BREAKDOWN_BASIS_NOTE`, `COVERAGE_DISCLAIMER`, `DF_NOT_VALIDATED`, `ECONOMICS_REASON_TEXT` (generisk reservetekst, «ikke godkjent»-linjer), `FX_LABEL` i `src/server/demo-economics.ts` (fjerne filstien); nytt: tekst for «årsak: utenfor dokumentert periode».
- `src/components/search/EconomicsNote.tsx`: skjul kompakt legacy-linje og overskrift når sammendraget viser beløp (utvidelse av PILOT-002-regelen).
- `src/components/search/EconomicsExplanation.tsx`: skjul `Sums`' «Brutto utlegg» når den er lik sammendraget; omdøp «Økonomisk kostnad»; kolonneoverskrifter; deduplisering i `Uncertainty`; skjul tom søkelinjeseksjon; `<details>` rundt breakdown/forutsetninger/usikkerhet; fjern `Missing`-listen når sammendraget har en.
- `src/components/search/AcquisitionSummary.tsx`: ev. fjerne «Kurser brukt i estimatet» hvis Forutsetninger beholdes.
- Ingen endring i `src/domain/economics`, `src/domain/tax`, FX, rettigheter, `demo-economics`-verdier eller `to-cost-assessment`.

## G. Verifikasjonsplan

- Enhetstester som må oppdateres bevisst (tekst/struktur): `economics-005d-display` (faste etikett-snapshots, `stripNegations`), `economics-006a-explanation`, `economics-006d-remainders`, `econ-003-acquisition-summary`, `econ-003-demo-fixture`, `search-display-ui`, `pilot-002-economics-coherence`, `pilot-003-demo-validity`. Nye tester: ingen «ikke validert»/«ikke godkjent»/«Regelmotor»/filsti i forhandlerrettet utdata; totalen forekommer ikke mer enn én gang i legacy-blokken; én mangler-liste; utløpt avgiftsprofil viser årsak (ikke «Registrer akseptdato»); beløp og scenarier (484 214 – 559 214 kr) uendret.
- e2e (må kjøres og sammenlignes mot dokumentert `main`-baseline linje for linje): `search005`, `econ006` (leser «Estimat — ikke validert», `economics-headline`, «Minst …», «Brutto utlegg»-linjer — betingelser må justeres uten å endre check-navn, jf. `ci-e2e-producers`), `econ006d`.
- Nettleser (PILOT-001-driveren + utdrag for: komplett estimat, scenarier/demo, delsum, utilgjengelig, utløpt avgiftsprofil (klokke 2027), manglende kurs, eget input): desktop og mobil; ingen «ikke validert/godkjent/Regelmotor/docs/tax», total maks én gang, én mangler-liste, ingen «Minst 0», demoen uendret.
- Faste kontroller: full vitest, typecheck, lint, build, `qa:demo`, `docs/tax/check-docs.mjs`.

## Funnliste (klassifisert)

| ID | Pri | Tagger | Funn |
|---|---|---|---|
| F-1 | P1 | Duplication, Pilot trust | Totalen 3–4× i detalj + ekstra legacy-linje på kortet (C1/D) |
| F-2 | P1 | UX/copy, Pilot trust | «Estimat — ikke validert» synlig på kort og detalj (C1) |
| F-3 | P1 | UX/copy, Economics | «ikke godkjent for validering»-språk: forutsetninger, usikkerhetsgruppe, 7 regelpunkter (C2–C3) |
| F-4 | P1 | UX/copy | «Regelmotor», «Ikke løst», «Beregningsgrunnlag (summeres ikke)», «oppgitt eller beregnet» (C4–C6) |
| F-5 | P1 | Economics, UX/copy | Utløpt avgiftsprofil: «Dette mangler: Akseptdato — Registrer» (feil årsak); 2–3 overlappende mangler-lister (C8/D) |
| F-6 | P2 | Duplication | Identiske punkter ×2–3 (mva.-håndtering, transport, elbilkvalifikasjon), «Ikke innsamlet» ×6, tom tilleggsseksjon |
| F-7 | P2 | UX/copy | Fagbegreper «Brutto utlegg»/«Økonomisk kostnad», to titler «Anslått»/«Estimert» (C12) |
| F-8 | P2 | UX/copy | Dokumentasjonsdekning/«godkjente» (C7); forbehold gjentatt 3 ganger (C11) |
| F-9 | P2 | UX/copy | Filsti `docs/tax/demo-series.json` synlig i demoens forutsetninger (C10) |
| F-10 | P2 | UX/copy | Skjemaside: «ikke validert … godkjenner ingen regel» (C9) |
| F-11 | P3 | UX/copy | Kurs vist «11.5»/«10.663058» (punktum), «(36950 EUR)» uten tusenskille |
