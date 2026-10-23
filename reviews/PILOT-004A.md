# PILOT-004A — Kjerneopprydding i forhandlerrettet økonomispråk

Dato: 2026-10-23 · Basis: `main` cbf836b · Kode-commit: `fe9f202` · Kun presentasjon. Ingen endring i formler, avgiftstabeller, mva.-/elbilfritaklogikk, FX, rettigheter, demofixturens verdier, kildefriskhet eller leverandører. PILOT-004B (utvidbar dypforklaring, bred dedup av usikkerhetslisten) er ikke startet.

## 1. Fjernet/skjult (legacy-elementer)

| Element | Før | Nå |
|---|---|---|
| Kort: legacy-statuslinje «Anslått innkjøpskostnad til Norge: Estimat — ikke validert: X · Dette er ikke en budsjettvurdering …» | Under sammendraget, gjentok totalen | Skjult når sammendraget finnes (alle tilstander). Et skjult element beholder `data-economics-*` (maskinlesbar status for kontroller); ingen tekst. |
| Detalj: legacy-overskrift («Estimat — ikke validert: X» / «Scenarier — fradragsstatus er ukjent» / «Minst X (ufullstendig)») | Gjentok totalen og tilstanden | Skjult når sammendraget finnes |
| Detalj: «Brutto utlegg: X» (samme tall som sammendragets total i alle beløpstilstander) | Egen sum | Totalen gjentas ikke. Forklaringen «Det er ikke nødvendigvis kontantbetaling ved grensen …» beholdes én gang. |
| Detalj: «Økonomisk kostnad: X» | Alltid vist | Omdøpt **«Kostnad etter mva.-fradrag»** og vist bare når den avviker fra sammendragets total (kjent fradrag eller to scenarier). Identisk ⇒ skjult. |
| Detalj, «ikke beregnet» + utløpt avgiftsgrunnlag: legacy-årsaksliste («Kontantbehovet er ikke beregnet.», «Forutsetning mangler …») | Intern kodeoversettelse | Skjult for `tax_period`; sammendraget sier årsaken. Den innholdsløse reserveteksten «Forutsetning mangler eller er ikke dokumentert.» vises ikke lenger som egen punktlinje (og tom gruppe vises ikke). |

Detaljsiden gir nå: sammendrag (total/område/delsum/«ikke beregnet») → ev. «Kostnad etter mva.-fradrag» (bare ved avvik) → nedbrytning, forutsetninger, usikkerhet, «dette må oppgis» → ikke rådgivning. Totalen står én gang (verifisert i test og nettleser).

## 2. Ordlydserstatninger

| Før | Etter |
|---|---|
| Estimat — ikke validert | Estimat (vises bare uten sammendrag; ellers ikke) |
| Reglene for mva., avrunding, tollkurs og fradrag er ikke godkjent for validering. Alle tall er derfor estimater. | Endelig kostnad må kontrolleres før kjøp. Avgift og mva. er beregnet av Merovo og er ikke en offisiell beregning. |
| Regler som ikke er godkjent for validering (gruppetittel) | Dette må kontrolleres før kjøp |
| «Mva.-reglene er ikke godkjent for validering», «Ordinær tollsats er ikke godkjent», «Fradragsregelen er ikke godkjent», «Avgiftsprofilen er ikke godkjent», «Vurderingen er ikke validert» | «Mva. / Tollsatsen / Fradragsregelen / Avgiftsgrunnlaget / Vurderingen må kontrolleres før kjøp» |
| Regelmotor — estimat (regler ikke godkjent) / Beregnet av regelmotoren | Beregnet av Merovo — estimat / Beregnet av Merovo |
| Ordinær sats fra tolltariffen (ikke godkjent) | Ordinær sats fra tolltariffen — må kontrolleres |
| Ikke løst | Ikke avklart |
| Beregningsgrunnlag (summeres ikke) | Grunnlag for beregningen (kommer ikke i tillegg) |
| Dette sier ikke at tallene er riktige, sikre eller godkjente. | Det betyr ikke at tallene er riktige eller endelige — endelig kostnad må kontrolleres før kjøp. |
| Selv med bekreftede opplysninger er resultatet et estimat — ikke validert. Skjemaet godkjenner ingen regel … (skjemasiden) | Selv med bekreftede opplysninger er resultatet et estimat. Endelig kostnad må kontrolleres før kjøp. Skjemaet gir ingen budsjettvurdering. |
| Syntetisk demokurs (docs/tax/demo-series.json) — ikke en markedskurs (+ gjentatt i parentes) | Syntetisk demokurs — ikke en markedskurs (filstien er fjernet fra demoinputens kursetikett; parentesen vises ikke når den er lik kildeteksten) |
| Økonomisk kostnad | Kostnad etter mva.-fradrag |

## 3. Utløpt avgiftsgrunnlag: riktig årsak

**Rotårsak:** kjernekoden `customs_acceptance_date_outside_documented_period` var koblet til inputfeltet «akseptdato» (`FIELD_OF` i `explain.ts`), så sammendraget sa «Dette mangler: Akseptdato — Registrer», og lenken ble vist. Datoen var allerede oppgitt; det er avgiftsgrunnlagets gyldighetsperiode (2026) som ikke dekker den.
**Rettelse (kun presentasjon):** koden mappes til `null` (ingen opplysning retter det ⇒ ingen «Registrer»), og sammendraget får `cause: "tax_period"` (gjenkjent fra eksisterende usikkerhetskode). Visning: «Kan ikke beregnes ennå. **Avgiftsgrunnlaget er ikke tilgjengelig for denne datoen.** Beregningen dekker avgifts- og mva.-regler for 2026. Å registrere en annen dato retter ikke dette.» (årstall fra `DOCUMENTED_RULE_PERIOD`). Tilsvarende i usikkerhetslisten. Avgiftsprofilen og perioden er ikke endret.

## 4. Gjenstående ordlyd i `src/` (søk)

| Søk | Forekomster | Nås i aktiv reise? |
|---|---|---|
| `ikke validert` | Kommentarer i `search-labels.ts` (oppdatert), `economics/types.ts`, `tax/types.ts` | Nei (kommentarer) |
| `ikke godkjent` / `godkjent for validering` | Kommentarer i `explain.ts`, `landed-cost.ts`, `tax/profile-no-2026-a.ts` | Nei (kommentarer/interne regelnotater) |
| `Regelmotor` / `Ikke løst` | Ingen | – |
| `docs/tax/` | Kommentarer i `demo-economics.ts`, `economics/*`, `tax/*` | Nei (kommentarer) |
| `Beregningsgrunnlag` | Kommentarer i domenetyper | Nei |
| `Validert beregning` (`ECONOMICS_LABELS.validated`) | Etikett | **Nei i praksis:** status `validated` er uoppnåelig med registerprofilen; beholdt som del av typekontrakten (rettighetsbeskyttet, ingen visning) |

Fortsatt synlig, bevisst utenfor 004A (følger i PILOT-004B): «Regelen for tollkurs er ikke bekreftet», «Avrundingsregelen er ikke bekreftet», «Suspensjon av tollkurs er ikke kontrollert», «Engangsavgiften er et estimat»; tabellkolonnene «Tilstand»/«Grunnlag» og «oppgitt eller beregnet»; «Dokumentasjonsdekning»; gjentatte mangler-lister og «Ikke innsamlet»-gruppen; «Ikke rådgivning»; «Estimert»/«Anslått» som to titler; punktum i kurs («11.5»).

## 5. Endrede filer

Kode: `src/lib/search-labels.ts`, `src/components/search/EconomicsNote.tsx`, `src/components/search/EconomicsExplanation.tsx`, `src/components/search/AcquisitionSummary.tsx`, `src/domain/search-economics/acquisition-summary.ts` (kun `cause`), `src/domain/search-economics/explain.ts` (kun feltkobling → `null`), `src/server/demo-economics.ts` (kun kursetikett uten filsti).
Tester: `tests/pilot-004a-dealer-language.test.ts` (ny, 12 tester); oppdatert bevisst: `tests/economics-005d-display.test.ts`, `tests/economics-006a-explanation.test.ts`, `tests/economics-006b-components.test.ts`. e2e-betingelser (check-navn uendret): `tests/e2e/econ006.e2e.mjs`, `tests/e2e/econ006d.e2e.mjs`.

## 6. Tester (faktisk kjørt)

| Kontroll | Resultat |
|---|---|
| `tests/pilot-004a-dealer-language.test.ts` | 12/12; tilbakeføring av `src/` feller 8 (tallene 9–12 er uendret og passerer) |
| Full `vitest run` | 101 filer / 2 304 tester OK |
| `tsc --noEmit`, `eslint .`, `next build` | OK |
| e2e `search005` | 77/77 OK |
| e2e `econ006` | 86/94 — **samme 8 feilede sjekker som `main`-baseline** (J3 ×3, J6, J7, J9 PHEV, avrundingslikhet, preview ×2) |
| e2e `econ006d` | 23/26 — **samme 3 feilede sjekker som baseline** (J5 ×2, B1-kontroll) |

Dekning av kravene: (1) kort har ingen gjentatt total/status; (2) detaljen har ett primært beløp (komplett 468 723 én gang; delsum 433 723 én gang; demoområdet én gang); (3) «Kostnad etter mva.-fradrag» bare ved avvik (ikke-fradragsberettiget komplett: skjult; demo med ukjent fradrag og kjent fradrag: vist); (4–7) ingen «ikke validert», «ikke godkjent (for validering)», «Regelmotor», «Ikke løst», «Beregningsgrunnlag», filstier eller `.json` i kort/detalj i sju tilstander; (8) utløpt avgiftsgrunnlag viser riktig årsak, uten «Registrer akseptdato» eller lenke; manglende kurs er fortsatt «Registrer»; (9–12) 468 723, 445 558 – 520 558, demoen 484 214 – 559 214 og delsum 433 723 uendret.
**Forbehold om e2e:** de kalenderfølsomme baselinefeilene feiler fortsatt på tallene (forventede fixturetall 830 583 osv. mot 816 384 …), så de oppdaterte betingelsene i J3/J6/J7/J9/B1/J5/avrundings-sjekkene kan ikke bevises grønne i e2e før de datofølsomme fixturene rettes. Ikke-tallsdelene er dekket av enhetstestene og skjermbildene under. De to sjekkene som beskrev den gamle, misvisende årsaken (B1 «tolldato er et registrerbart manglende felt») og de som leste «Estimat — ikke validert»/Brutto utlegg er oppdatert; de passerer eller feiler nå på samme måte som baseline. Tidligere ekstra feil («J9 BEV scenarioer», B1 ×4) ble rettet ved å lese scenarioene fra sammendraget og oppdatere B1-betingelsen til riktig årsak.

## 7. Nettleserverifisering (ekte app; PILOT-001-driveren; e2e-skjermbilder)

- **Demo-scenarioområde (klokke i dag):** «Demo-estimat 484 214 – 559 214 kr» én gang; «Kostnad etter mva.-fradrag: Fra 450 983 kr (scenarier)» med fire scenarier; nedbrytning med «Beregnet av Merovo — estimat», «Ikke avklart», «Grunnlag for beregningen (kommer ikke i tillegg)»; kursene «Syntetisk demokurs — ikke en markedskurs» uten filsti eller dobbel parentes; «Endelig kostnad må kontrolleres før kjøp». 0 forbudte termer; 0 JS-/konsollfeil.
- **Utilgjengelig (annonse uten input):** én «Estimert innkjøpskostnad til Norge: ikke beregnet», «Dette mangler»-liste med Registrer-lenker, ingen intern terminologi.
- **Utløpt avgiftsgrunnlag (serverklokke 2027-01-31, demobilen):** «Kan ikke beregnes ennå. Avgiftsgrunnlaget er ikke tilgjengelig for denne datoen. Beregningen dekker avgifts- og mva.-regler for 2026. Å registrere en annen dato retter ikke dette.» — ingen «Akseptdato — Registrer», ingen Minst, ingen nedbrytning, ingen intern terminologi. Utløpt med forhandlerinput (e2e-skjermbilde `04-B1-akseptdato-utenfor-periode`): samme riktige årsak i sammendrag og under «Mangler»; ingen lenke til akseptdato.
- **Normal komplett forhandlerinput (e2e-skjermbilde `05-detalj-diesel-estimat`):** «Estimert total til Norge 816 384 kr» én gang med kort nedbrytning; ingen «Brutto utlegg»/«Økonomisk kostnad»-sum; breakdown med «Beregnet av Merovo», «Ikke avklart» ikke relevant her; RULES-tekst på forutsetninger. (Tallet 816 384 er dagens fixture-/kalenderresultat som i baseline.)
Kort (resultatliste) i nettleser: ingen legacy-statuslinje; 0 «ikke validert/godkjent».

## 8. Er de tre P1-funnene løst?

1. **Duplisert total/status (F-1):** ja — kort og detalj har én primær total/tilstand; «Kostnad etter mva.-fradrag» bare ved avvik.
2. **Intern valideringsterminologi (F-2/F-3/F-4):** ja for det som er angitt i oppdraget («Estimat — ikke validert», «ikke godkjent (for validering)», «Regelmotor», «Ikke løst», «Beregningsgrunnlag», filsti). Ikke helt «finished»: andre regelformuleringer («Regelen for tollkurs er ikke bekreftet» m.fl.) og tabellspråk gjenstår til 004B.
3. **Feil årsak ved utløpt avgiftsprofil (F-5):** ja for årsaken og «Registrer»-lenken. Overlappende mangler-lister er ikke deduplisert (004B).

Klar for PR etter review.
