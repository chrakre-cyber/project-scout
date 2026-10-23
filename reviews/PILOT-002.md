# PILOT-002 — Fjerne motstridende økonomipresentasjon

Dato: 2026-10-23 · Basis: `claude/charming-cannon-zwevp6` (PILOT-001 c5fa36f) · Kun presentasjon: ingen endring i `calculateEconomics`, avgiftstabeller, EV-fritak, FX, rettighetslogikk, demofixtur, kilde-URL-er eller leverandører. Demoens utløp (~28. okt) er ikke rørt.

## 1. Rotårsak per motsigelse

| # | PILOT-001-funn | Rotårsak (verifisert i kode og i den kjørte appen) |
|---|---|---|
| 1 | Estimat vises sammen med «innkjøpskostnad ikke beregnet» | Tre uavhengige tekster som ikke kjente til hverandre: (a) `whyShown()` avsluttet «treff»-forklaringen med «innkjøpskostnaden er ikke beregnet» (kort og detalj, alltid); (b) sidebanneret på resultatsiden brukte `BUDGET_NOT_CALCULATED` («Innkjøpskostnad til Norge er ikke beregnet …») for alle biler, også når én bil har estimat; (c) kort og detalj valgte bare mellom to budsjettnotiser, og i «ikke beregnet»-tilstand sto samme melding i tre lag (budsjettnotis, sammendragets overskrift og legacy-statuslinjen). |
| 2 | Transport 8 000 kr «med» og «støttes ikke (ikke regnet med)» | To ulike ting med samme beløp og samme ord. Søkets transportlinje (8 000 kr, ekskl. mva.) får behandlingen `unsupported / vat_basis_excl_gross_unknown` i `treatCostLines` (ingen mva.-regel for tillegg — policy 005a, uendret) og beskrives som «støttes ikke (ikke regnet med)». Estimatet har derimot sin EGEN transportpost, oppgitt til motoren via forhandleropplysning/demoforutsetning (`transportToBorder = 8000`). Visningen kjente ikke til at motoren allerede har transporten, og beskrev derfor en ubrukt søkelinje som om transport ikke var regnet med. |
| 3 | «Minst 0 kr (ufullstendig)» | Legacy-visningen (`amountText`, `economicsHeadline`) gjengir `lower_bound` fra motoren uten å spørre om grensen er meningsfull. Når alt er ukjent er nedre grense 0 — teknisk riktig, men leses som et beløp. Sammendraget (`toAcquisitionSummary`) avviser allerede dette (`unavailable`), så legacy-blokken sa noe sammendraget ikke sto inne for. |

## 2. Presentasjonsregel etter rettingen

1. **Én budsjettnotis**, lik i alle tilstander (kort, detalj og sidebanner): «Annonseprisen er ikke total innkjøpskostnad. Budsjettvurdering er ikke gjort.» (`SUMMARY_BUDGET_NOTE`). Den påstår aldri at kostnaden «ikke er beregnet».
2. **«Ikke beregnet» eies av sammendraget.** Bare `AcquisitionSummary` (tilstand `unavailable`) sier at innkjøpskostnaden ikke kan beregnes, og det sies én gang. «Hvorfor vist» nevner ikke lenger kostnad.
3. **Legacy-blokken (`EconomicsNote`) følger sammendraget:**
   - kompakt (kort): ikke synlig når sammendraget er `unavailable` (et skjult element beholder `data-economics-*` for kontroller); uendret ellers;
   - detalj: statusoverskriften skjules **bare** når sammendraget er `unavailable` (da gjentar eller motsier den det). Ved beløp (estimat/delsum/scenarier) beholdes den: den er maskinlesbar status for kontroller og motsier ikke sammendraget. Summene (Brutto utlegg / Økonomisk kostnad) vises bare når sammendraget viser et beløp. Nedbrytning, forutsetninger, usikkerhet, «dette mangler» og lenke til skjema beholdes.
   - rettighetsskjult tilstand (`hidden`/`unavailable` fra rettighetsgrensen) er uendret.
4. **Null er aldri et beløp.** En nedre grense på 0 vises som «Ikke beregnet» (`amountText`, `economicsHeadline`, `isZeroNok`). En meningsfull nedre grense (>0) er uendret («Minst X (ufullstendig)») og vises bare der sammendraget også viser en delsum.
5. **Søkelinjer vs. motorposter.** En søkelinje av typen transport som ikke brukes (`unsupported`, `unknown_amount`, `unmapped_unknown_scope`) beskrives som «ikke brukt fra søket (støttes ikke). Transporten som er med i estimatet er oppgitt separat i forhandleropplysningene» **når et estimat vises og motoren har en kjent/antatt transportpost i brutto utlegg** (i utløpt/ikke-beregnet tilstand sier teksten aldri «transporten i estimatet»). Uten slik post står den uendret «støttes ikke (ikke regnet med)». `mapped_to_input`, `added_to_total`, `not_included` og andre linjetyper er uendret.

## 3. Endrede filer

Kode-commit `3a82c02` (presentasjon): `src/lib/search-labels.ts` (`BUDGET_NOT_CALCULATED` fjernet; `isZeroNok`, `searchLineText`, `SEARCH_LINE_ENGINE_TRANSPORT_NOTE`; null-vern i `economicsHeadline`; doc på `SUMMARY_BUDGET_NOTE`), `src/lib/search-explain.ts` (`whyShown` uten kostnadspåstand), `src/components/search/EconomicsNote.tsx`, `src/components/search/EconomicsExplanation.tsx`, `src/components/search/ResultCard.tsx`, `src/app/searches/[id]/preview/page.tsx`, `src/app/searches/[id]/preview/[listingId]/page.tsx`, `src/domain/search-economics/explain.ts` (kun `kind` på `SearchCostRow` — presentasjonsfelt, ingen beregning).
Tester: `tests/pilot-002-economics-coherence.test.ts` (ny, 11 tester), `tests/econ-003-acquisition-summary.test.ts` og `tests/economics-005d-display.test.ts` (fjernet referanse til slettet konstant; ny forventning at «ikke beregnet» ikke gjentas), e2e-betingelser (check-navn uendret): `tests/e2e/search005.e2e.mjs` (3 sjekker), `tests/e2e/econ006.e2e.mjs` (J1 ×3 + preview-sjekk).

## 4. Tester (faktisk kjørt)

Se seksjon 7 for resultater. Nye regresjonstester (alle mot ekte pipeline der det er mulig; demoen kjøres gjennom `previewForDisplay` → motor → rettighetsgrense → komponenter):

| Krav | Test |
|---|---|
| 1 estimat + «ikke beregnet» | «1. estimat/scenarier …» (kort og detalj-sammensetning) |
| 2 scenarioområde + «ikke beregnet»; iX3 uendret | «2. scenarioområdet …» (484 214 – 559 214 kr) og «8. …» |
| 3 delsum + «ikke beregnet» | «3. meningsfull delsum …» |
| 4 utilgjengelig uten null-beløp | «4. alle annonser uten forhandlerinput …» (>50 ekte demobiler; én overskrift, ingen `Brutto utlegg:`, ingen `Minst`) |
| 5 «Minst 0 kr» fraværende | «5.», «5b.» (modell, tekst, overskrift, alle komponentvarianter) |
| 6 oppgitt motor-transport beskrevet som med | «6.» (ekte demo) og «6b.» |
| 7 ikke-støttet søketransport forblir utelatt | «7.» |
| 9 vanlig ikke-demo uendret | «9.» |

Mutasjonssjekker: tilbakeføring av `whyShown`+`ResultCard` felte tester 1, 2, 4, 9; tilbakeføring av `EconomicsNote` felte 2, 4, 5.

## 5. Gjenstående forekomster (brukersynlig kode)

Søkt: `Minst 0`, `ikke beregnet`, `ikke regnet med`, `ikke validert`, `ikke godkjent` (src).

| Streng | Sted | Vurdering |
|---|---|---|
| `Minst 0` | kun i kommentar (`search-labels.ts:430`, «ingen «Minst 0 kr»») | Ingen brukersynlig forekomst. |
| `Minst {amount} (ufullstendig)` | `search-labels.ts` (`incomplete_lower_bound`), `EconomicsExplanation.amountText` | **Beholdt:** meningsfull nedre grense (>0), nå beskyttet mot 0 og bare synlig der sammendraget viser delsum. |
| «Estimert innkjøpskostnad til Norge: ikke beregnet» | `SUMMARY_UNAVAILABLE_HEADLINE` | **Beholdt:** den ene «ikke beregnet»-meldingen. |
| «ikke beregnet» på linjenivå | `SUMMARY_LINE_UNKNOWN` (MVA-linjen i scenarier), `STATE_LABEL`/`missing`-tittel («Mangler (gir nedre grense eller ikke beregnet)»), `Ikke beregnet` i `amountText` (`none`), kontantbehov/`cash_requirement_not_calculated` | **Beholdt:** linje-/postnivå (ukjent post), ikke global påstand; MVA ulik per scenario er korrekt «ikke beregnet». |
| `ECONOMICS_LABELS.not_calculated` «Ikke beregnet» | legacy-statusoverskrift i tilstanden `not_calculated` uten sammendrag, og rettighetsskjult tilstand | **Beholdt:** skjules i detalj/kort når sammendraget finnes (regel 3). |
| `src/app/opportunities/[id]/page.tsx`, `src/components/ListingCard.tsx` («Estimert bidrag: ikke beregnet», «Avgiftsstatus: ingen validert skatteprofil …») | eldre ruter | **Beholdt, utenfor omfang:** `/opportunities` er blokkert som standard (`SCOUT_ENABLE_LEGACY_ROUTES`) og ikke del av pilotflyten. |
| «støttes ikke (ikke regnet med)» | `LINE_TREATMENT_TEXT.unsupported` | **Beholdt** for søkelinjer uten motor-transport (regel 5). Overstyres bare for transport når motoren har en transportpost. |
| «Estimat — ikke validert», «ikke godkjent for validering», «regler ikke godkjent» | `ECONOMICS_LABELS`, `RULES_NOT_APPROVED`, `ROW`/`BASIS`-tekster, `ECONOMICS_REASON_TEXT` | **Beholdt bevisst:** reflekterer faktisk regelstatus (rettighets-/validerings-fail-closed). Ordlyden i detaljen er fortsatt tung (se PILOT-001 F-05/F-13) — ikke en motsigelse, og ikke i dette oppdraget. |
| `Vurderingen er ikke validert.`, `Kontantbehovet er ikke beregnet.` m.fl. i `ECONOMICS_REASON_TEXT` | årsakslister | **Beholdt:** konkrete årsaker, vises under «Mangler»/«usikkerhet». |
| «inngår i budsjettet» i søkeoppsettet («Transport: 8 000 kr … inngår i budsjettet») | søkeoppsummering | **Beholdt:** beskriver forhandlerens egen budsjettdefinisjon, ikke estimatet; ikke endret (kan forveksles — anbefalt vurdert i PILOT-001-oppfølging). |
| Kommentarer i `src/server`, `src/domain` | – | Ikke brukersynlig. |

## 6. Gjenstående/ikke endret

- Detalj-duplisering: legacy-blokken har fortsatt egen tittel «Anslått innkjøpskostnad til Norge» (sammendraget heter «Estimert …»). Overskriften som gjentar tilstanden er skjult; titler er ikke slått sammen (ikke redesign).
- Demoens utløp (~28. okt), F-06/F-07, F-08–F-15 fra PILOT-001: ikke rørt.
- Dagens sjekker i e2e er kalenderfølsomme (se seksjon 7).

## 7. Kjørte kontroller (faktisk kjørt, siste kode = `3a82c02`)

| Kontroll | Resultat |
|---|---|
| Fokuserte tester `tests/pilot-002-economics-coherence.test.ts` | 11/11 OK |
| Full `vitest run` | 99 filer / 2 275 tester OK |
| `tsc --noEmit` | OK |
| `eslint .` | OK (ingen funn) |
| `next build` | OK |
| e2e `search005` | 77/77 OK |
| e2e `econ006` | 86/94 — **identiske 8 feil som baseline på HEAD (c5fa36f)**, sammenlignet på full feillinje inkl. detaljtekst. Alle er de kjente kalenderfølsomme J3/J6/J7/J9/avrundings-/preview-sjekkene. |
| e2e `econ006d` | 23/26 — **identiske 3 feil som baseline** (J5 ×2, B1; samme kalenderfølsomhet) |
| Ekte app, nettleser (PILOT-001-driveren kjørt på nytt) | 0 «Minst 0»; 0 «innkjøpskostnaden er ikke beregnet»-påstander ved siden av beløp; detalj for demobilen: «Transport (8 000 kr): ikke brukt fra søket (støttes ikke). Transporten som er med i estimatet er oppgitt separat …»; uten fixtur: én «ikke beregnet»-overskrift, ingen Brutto utlegg-sum. |

Merknader: (a) e2e-sjekkenes betingelser er justert i fem sjekker (J1 ×3, J1-banner, preview-banner, search005 ×3), check-navn uendret (CI-identitetstesten). J1 godtar nå «lower_bound» der kortet er «ikke beregnet» (sammendraget `unavailable`), fordi «Minst …» ikke lenger vises uten støtte. (b) Én e2e-kjøring ga en ekstra feil («alle action-svar … >10 svar», 8 svar); ikke reprodusert i to nye kjøringer — vurdert som flak (telling, ikke lekkasje). (c) e2e ble ikke kjørt på nytt etter siste endring (`showSums` i `engineTransportIncluded`, påvirker bare «ikke beregnet»-tilstander; dekket av enhetstest 7 og nettleserkjøringen over, som ble gjort før denne ene linjen). (d) Skjermbildekataloger under `reviews/` er tilbakestilt; ingenting generert er committet.

## 8. Er PILOT-001 P1-motsigelsene helt løst?

- **F-02 transport:** ja — i dataene audit-en observerte (demoen) og i enhetsregelen. Gjenstår: søkeoppsettets «inngår i budsjettet» (beholdt, beskriver budsjettdefinisjonen).
- **F-03 «ikke beregnet» + estimat:** ja for kort, detalj og sidebanner (verifisert i appen). «Ikke beregnet» står bare i sammendragets overskrift og på linjenivå (f.eks. MVA-linjen i scenarier, som er korrekt).
- **F-04 «Minst 0 kr»:** ja — ingen vei fra motoren til bruker gir «Minst 0»; en meningsfull grense (>0) vises bare når sammendraget viser delsum. Ukjent post vises «ukjent», aldri 0.
- Ikke løst (utenfor omfang, uendret): F-05 (tung ordlyd/«hva kan tallet brukes til»), F-11 (to titler/duplisert økonomiblokk i detalj utover den skjulte overskriften), F-01, F-06, F-07.
