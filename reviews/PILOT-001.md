# PILOT-001 — Dealer pilot readiness audit (kun audit)

Dato: 2026-10-23 · Basis: `origin/main` @ 0624d34 (ECON-003-2 / PR #8 merget) · Ingen kode endret, ingen PR.

## Verifikasjon (hva som er faktisk kjørt)

- **Kjørt i nettleser (Playwright/Chromium, ekte `next start`-bygg, partnermodus: eldre ruter blokkert, isolert PostgreSQL 16 + Supabase-emulator):** 37 skjermbilder + tekstdumper + layoutmålinger, desktop 1280×900 og mobil 390×844. Innlogging (feil/ok), bruker uten firma, tomt søkeoversikt, nytt søk (blankt og iX3-eksempel), lagre, resultater, kort, ekskluderte, detalj (demobil, uten fixtur, «må kontrolleres»), forhandleropplysninger-side, ugyldig/ukjent id, feil versjon, åpne→rediger→lagre v2→gjenåpne, ingen treff, foreldet epoke (`SCOUT_SYNTHETIC_EPOCH=2026-10-12`), kildefeil (`SCOUT_SYNTHETIC_FAILURE=unavailable`), anonym omdirigering. 0 JS-/konsollfeil.
- **Kun avledet fra kode/eksisterende tester (ikke vist i nettleser):** rettighetsskjult tilstand, utløpt avgiftsprofil (2026-12-31), manglende FX utover «kurs mangler»-visningen, RLS med ordinær bruker. Utfylling og lagring av forhandleropplysninger er ikke kjørt ende-til-ende i denne auditen (kun skjemaet vist).
- **Ikke vurdert:** faktiske forhandlere, ytelse under last, ekte leverandørdata (finnes ikke), tilgjengelighet utover enkle målinger (tap-mål <40px, tekst <12px).
- Kjente forhold bekreftet, ikke gjenoppdaget: live leverandørtilgang ikke godkjent; rettigheter fail-closed; EV-fritak som scenarieområde; kalenderfølsomme e2e; demoøkonomi utløper.

## A. Kort konklusjon

Kjernereisen **fungerer teknisk og er ærlig** (tydelig syntetisk merking, ukjent vises som ukjent, ingen JS-feil, ingen horisontal overflyt på mobil). Men Merovo er **ikke klar til å vises for en ekte forhandler** som pilot: den viser kun syntetiske biler, det finnes **ingen vei videre til original annonse eller selger**, og flere **motstridende økonomitekster** vil få en profesjonell kjøper til å tvile på tallene. Dette er en demo, ikke et verktøy forhandleren kan bruke i en kjøpssituasjon.

## B. Reisen, steg for steg (observert)

| Steg | Observert | Vurdering |
|---|---|---|
| Innlogging | Enkel side, tydelig «privat partnerdemo», feilmelding på norsk. Anonym → `/login`. | OK |
| Bruker uten firma | Ser «Du må være innlogget med en firmakonto … Logg inn» mens man allerede er innlogget; «Nytt søk» vises likevel. | Forvirrende (F-08) |
| Opprett søk | Skjema ~5 200 px høyt (desktop), ~9 000 px (mobil), 4 trinn, 70 for små tap-mål. Eksempelknapper hjelper. Fagbegreper («Prisavvik», «Planlagt norsk registrering», «Firmaprofil for økonomi») uten forklaring på hva som kreves for å få et tall. | Brukbart, tungt |
| Resultater | 125 vurdert → 3 treff / 1 må kontrolleres / 119 ikke. Kort med bilde, krav-oppsummering, annonsepris, estimat. Ekskludert-gruppen gir en side på ~72 000 px. | Treff OK; ekskludert uhåndterlig (F-09) |
| Forstå match | «Hvorfor vist» + «Vis forklaring» + detaljliste. Klart og konsist. | Bra |
| Forstå kostnad | Kort: «Demo-estimat 484 214 – 559 214 kr». Detalj: to–tre overlappende blokker (se F-02, F-03, F-04). | Svak |
| Detalj | Svært lang (~4 300 px desktop / ~7 300 px mobil). Mye juridisk/teknisk ordlyd. | For tung |
| Videre til annonse/selger | **Ingen lenke, ingen kontakt, ingen handling.** Flyten viser «Selger: ikke tilkoblet i demoen». | Blokker (F-01) |
| Lagre/redigere | Lagre v1, åpne, endre, lagre v2, gjenåpne, oversikt: fungerer. Resultater er per versjon (feil versjon gir tydelig melding). Resultatet «lagres ikke og kan ikke åpnes igjen». | OK; «kan ikke åpnes igjen» er en begrensning (F-10) |
| Feilstater | Ukjent/ugyldig id → «Fant ikke siden»; ingen treff → tydelig; foreldet epoke → «beregningen er utløpt»; kildefeil → melding. | OK |

## C. Funn

Prioritet: P0 = stopper pilot, P1 = må fikses før første forhandler, P2 = bør fikses i pilotperioden, P3 = polish.

| ID | P | Kategori | Funn | Evidens |
|---|---|---|---|---|
| F-01 | **P0** | Produktflyt | Ingen overgang til original annonse eller selger. `ResultAccess.canLinkToSource` finnes, men ingen UI bruker den; syntetiske annonser har `originalUrl: null` (korrekt, ingen oppdiktede lenker). Uten dette er reisen «finn → forstå → handle» brutt i siste ledd. Løsning krever godkjent leverandør (rettigheter) — ikke noe som kan «fikses» med copy. | kodesøk; skjermbilde 40/76: «Selger: ikke tilkoblet i demoen» |
| F-02 | **P1** | Økonomi/tillit | Motstridende transport: «Transport 8 000 kr» inngår i estimatet, og søket sier «inngår i budsjettet», men detalj-seksjonen sier «Transport (8 000 kr): støttes ikke (ikke regnet med)». | tekst 40 |
| F-03 | **P1** | Økonomi/tillit | Globalt banner øverst på resultatsiden: «Innkjøpskostnad til Norge er ikke beregnet» — samtidig som kortet under viser et estimat. Samme setning gjentas på hvert kort/detalj («…innkjøpskostnaden er ikke beregnet»). | tekst 30, 40 |
| F-04 | **P1** | Økonomi/tillit | «Minst 0 kr (ufullstendig)» for brutto utlegg/økonomisk kostnad der alt er ukjent (annonser uten fixtur). Nedre grense er teknisk riktig, men «0 kr» leses som et tall og strider mot prinsippet ukjent ≠ 0. Parallelt står «Estimert: ikke beregnet». | tekst 41, 42 |
| F-05 | **P1** | Økonomi/språk | Motstridende status-ordlyd: «Demo-estimat» + «Reglene … er ikke godkjent for validering. Alle tall er derfor estimater» + «Estimat — regler ikke godkjent» i hver rad + 6 punkter «Regler som ikke er godkjent». Korrekt, men en forhandler får ingen praktisk beskjed: kan jeg bruke tallet til å bestemme meg eller ikke? Ingen enkel «hva dette betyr». | tekst 40 |
| F-06 | **P1** | Data/pilot | Alle resultater er syntetiske (125 demobiler); kun én bil (dix3-001) har demoøkonomi. Alle andre kort viser «ikke beregnet». En forhandler kan ikke teste mot egne reelle behov. Dette er forventet (live tilgang ikke godkjent) men må være en eksplisitt pilotforutsetning. | kort-oppsummering `econ: scenarios/unavailable` |
| F-07 | **P1** | Økonomi/kalender | Demoøkonomien utløper ved profilens retensjon (7 dager) ≈ 28. okt; bekreftet at utløpt epoke gir «Kan ikke beregnes ennå — beregningen er utløpt: kildedataene er for gamle» (skjermbilde 61/62). Etter det viser demoen kun «ikke beregnet» uten at noe er feil. Ingen mekanisme som varsler pilotadministrator. | stale-epoke-instans (port 3101) |
| F-08 | P2 | UX | Bruker uten firma: teksten ber om innlogging selv om bruker er innlogget; «Nytt søk»-lenke vises. | tekst 11 |
| F-09 | P2 | UX/ytelse | «Oppfyller ikke»-gruppen rendres med 119 fulle kort (side ~72 000 px) og 124 elementer med 10 px-tekst («Illustrasjon»-merker). Bør være sammenslått/pagineres. | måling 33, 30 |
| F-10 | P2 | Produkt | «Resultatet … lagres ikke og kan ikke åpnes igjen senere.» En forhandler kan ikke gå tilbake til en liste en kollega så på; nytt søk gir nye beregninger. | tekst 30 |
| F-11 | P2 | UX | Detaljsiden dupliserer økonomi: «Estimert innkjøpskostnad til Norge» (ny) og «Anslått innkjøpskostnad til Norge» (gammel) med to ulike overskrifter og to sett av «Brutto utlegg / Økonomisk kostnad». «Engangsavgift» er 18 058 kr i oppsummeringen men 15 658 + vrakpant 2 400 i tabellen (riktig, men uforklart). | tekst 40 |
| F-12 | P2 | Mobil | Ingen horisontal overflyt (alle sider), men 70 tap-mål <40 px i skjemaet (avkrysningsrader), og svært lange sider (skjema ~9 000 px, detalj ~7 300 px). Resultatkort fungerer fint på mobil. | måling 71–77 |
| F-13 | P2 | Ordlyd | Fagtermer uten forklaring: «Økonomisk kostnad», «Brutto utlegg», «tollverdi (grense målt mot …)», «Mva.-grunnlag», «Beregningsgrunnlag (summeres ikke)». Riktige, men for en bilforhandler som ikke er regnskapsfører ikke selvforklarende. | tekst 40 |
| F-14 | P3 | Polish | Rene engelske slagord («Local demand. European supply.») på norsk side; «Exportpreis netto» i syntetisk annonsetekst (bevisst, tysk kildetekst). «Illustrasjon» 10 px. Kurs vises «11.5» (punktum, ikke «11,50»). | tekst, måling |
| F-15 | P3 | UX | «Registrer»-lenker i detaljen fører til egen side; «kan ikke registreres ennå» for EV-fritak. Ikke testet utfylling ende-til-ende. | tekst 40/43 |

## D. Det som fungerer bra (bekreftet)

- Syntetisk merking er konsekvent og uforvekslbar; ingen påstand om mobile.de.
- Ukjent vises «ukjent / ikke oppgitt», ikke 0 eller «skadefri» (unntatt F-04-formuleringen).
- Rettigheter/fail-closed og versjonssjekk gir tydelige meldinger; ukjent/ugyldig id lekker ikke info.
- Anonym tilgang og eldre ruter er blokkert (`/agents`, `/dashboard`, `/opportunities` → `/login`).
- Mobilkort leses godt; ingen overflyt.

## E. Kategorisering (antall)

Produktflyt 1 (P0) · Økonomi/tillit 5 (P1×4, P2×1) · Data/pilot 1 (P1) · Kalender 1 (P1) · UX/ytelse/mobil 5 (P2) · Ordlyd/polish 3 (P2/P3) · Totalt: 1 P0, 6 P1, 6 P2, 2 P3.

## F. Hva som ikke ble vist/bevist

Se «Verifikasjon». Spesielt: ingen ekte forhandler, ingen live data, ingen utfylt forhandleropplysninger-flyt gjennom lagring og ny beregning i denne auditen (dekket av tidligere e2e), ikke RLS-test, ikke ytelse.

## G. Minste sett som må fikses før første ekte forhandler

1. **F-01 (P0):** Bestem pilotens datagrunnlag. Uten godkjent leverandør finnes ingen original annonse/selger; piloten må enten (a) vente på godkjent kilde og bygge handoff (lenke bare når rettigheter tillater `canLinkToSource`), eller (b) uttrykkelig avtales som ren produktvisning med forhandler-«intervju», ikke som arbeidsverktøy. Dette er en beslutning, ikke en kodeendring alene.
2. **F-02 + F-03 + F-04 (tekstmotsigelser):** fjern/avklar «transport støttes ikke», det globale «ikke beregnet»-banneret og «Minst 0 kr». Små tekst-/visningsendringer uten endring av økonomiregler.
3. **F-05 + F-11:** én økonomiblokk i detalj, med én setning om hva tallet kan brukes til («estimat, ikke et tilbud/avgiftsvedtak»).
4. **F-07:** drift/pilotsjekkliste for utløp av demoøkonomien (~28. okt) før hver demo; ingen regelendring.
5. **F-06:** si klart til forhandleren at alle biler er syntetiske og kun iX3-demoen har tall.

Resten (F-08–F-15) kan vente til pilotperioden.

## Fotnote om metode

Auditscript og skjermbilder ligger utenfor repoet (scratchpad) og er ikke committet. Ingen genererte artefakter i `reviews/*/screenshots`.
