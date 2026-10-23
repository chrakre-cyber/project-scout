# ECON-003 — gyldne økonomifixturer og aritmetikktester

**Status: DONE som avgrenset fixture- og aritmetikkleveranse (godkjent av Christian 2026-10-19 ved commit `398710a`, etter uavhengig review uten blokkerende funn; se §7).** *(Levert til REVIEW tidligere samme dag.)* Startpunkt: commit `57eee19fbe073a4ca62d70fcc12928782bed1abb` (ECON-002 DONE innen avtalt omfang; TAX-fundamentet REVIEW). Kun fixturer, teststruktur og aritmetikktester. Ikke implementert: landed-cost-kjerne (ECON-004), UI, DB, auth, providere. Ikke endret: avgiftsmotor, satser, omfang, klasse 1-definisjon, godkjenninger, blokkeringer. U-003, U-008 og U-013 er ikke løst.

## 1. Gapvurdering (før implementering)
**Backlogg-rad:** «Gyldne fixturer (3 caser: offisiell reproduksjon + Merovo-utvidelse med transport) og aritmetikktester»; avhengigheter: ECON-001, «D5/kurs bekreftet». **Spesifikasjon:** ECON-001 §4.2–4.3, §6, §7 (A/B), §12, §16 (D1–D8).
| Hva finnes | Hva mangler | Uavklarte forutsetninger |
|---|---|---|
| `GOLDEN_CASES` (ECON-001-tall, EUR-priser, oppgitte offisielle kjøpesum/mva./total) og `OBSERVED_RUNS` (dokumenterte observasjoner, prisversjoner, brukerbekreftet dato, skjermbildekoblinger); tre klasse 1-referanser; avgiftsmotor (ECON-002) | Økonomifixturer som kobler casene (A og B), observerte sum-/mva.-verdier per prisversjon (sum var ikke i fixturen), uavhengig aritmetikkorakel, B-scenarioer (transport, mva.-tilstander, kurs-roller), `docs/econ/` (nevnt i ECON-001 §14, fantes ikke) | **U-013** mva.-avrunding uten kilde; **R-IMP-VAT-003** elbilfritakets anvendelse; **R-IMP-VAT-002 / R-DED-001** E1P; **U-003/U-008** (ECON-004); de historiske EUR-casenes offisielle kjøpesum/mva./total er **oppgitt uten skjermbilder** |
**Avhengighetene «D5/kurs bekreftet»:** D5 (vrakpant inkludert) er bekreftet av ECON-001 og ses i de dokumenterte kalkulatornedbrytningene (vrakpant 2 400 + engangsavgift = total, uten øre); kurs 10,6709 er bekreftet som **fixture-input** (D6), ikke som offisiell kurs. **Ingen blokkering av ECON-003-arbeidet**; de uavklarte punktene er merket i fixturene (`OPEN_ITEMS`) i stedet for å løses.
**To A-lag, ikke én sannhet:** de dokumenterte observasjonene bruker NOK-priser som ikke er de historiske EUR-casenes kjøpesum, mens de historiske caset-verdiene mangler skjermbilder. Derfor er A delt i *A-observert* (dokumentert) og *A-oppgitt* (`stated_not_documented`). Avgiftstotalene (529 069 / 16 748 / 333 723) er felles; de to lagene sammenlignes ikke på mva./total.

## 2. Levert
- `tests/fixtures/econ-golden.ts` (ny): `ECON_CASES` kobler CASE-001/002/003 til `GOLDEN_CASES` og `OBSERVED_RUNS` (samme objekter, ikke kopier); `OFFICIAL_STATED_LOCK` (låst); `MEROVO_DEFAULT_EXPECTED` (B, transport 8 000); `FX_ROLES_SCENARIO`; `FIXTURE_FX`; `OPEN_ITEMS`.
- `tests/fixtures/econ-arithmetic.ts` (ny): eksakt orakel (bigint-rasjonale tall), kun for test.
- `tests/fixtures/tax-calculator-observations.ts` (utvidet): `sum` per prisversjon (observert «Sum»/«Totalpris»).
- `tests/econ-golden-fixtures.test.ts` (ny, 20 tester) og `docs/econ/golden-fixtures.md`.

## 3. Hva testene dekker
**A:** lås av oppgitte offisielle verdier (feiler hvis de endres); ingen verified-status på kjøretøydata; A1-aritmetikk (kjøpesum = EUR × 10,6709, mva. = 25 % av grunnlag, EV minus 300 000, total); råverdier og at andre avrundingskonvensjoner (ned/opp) ikke stemmer med de oppgitte verdiene — uten likhetstilfeller (U-013 forblir åpent); avgiftsmotoren (uendret) gir de oppgitte avgiftstotalene og delingen, med **estimatstatus** (udokumentert forhandlervekt); observerte prisversjoner holdt adskilt; observert sumidentitet og mva.-regularitet uten avrunding; antakelser (CO₂-metode, elbil uten observert CO₂) bevart.
**B:** transport 8 000 (`assumed-default`) og alle seks forventninger per case mot orakelet; kontantbehov uavhengig av mva.-tilstand; `recoverable`/`non_recoverable`/`unknown` (unknown ⇒ `valueNok: null` og to merkede scenarier, ingen oppdiktet kost); A → B-delta (+10 000 kontantbehov; +8 000 / +10 000 økonomisk kost); transport 0 reproduserer offisiell total; B endrer ikke A; dealer-overstyrt transport; CASE-002 er betinget av elbilfritaket (effekten synlig: 18 666 mot 93 666); kurs-roller (syntetisk tollkurs, adskilt fra anskaffelseskurs); åpne punkter eksplisitt.

## 4. Merknader og begrensninger
- B-forventningene er aritmetikk utledet fra A-verdier og ECON-001-regler (E1P/E1X der angitt) — **ikke nye offisielle referanser**.
- Mva.-avrunding: «nærmeste hele krone, halvt opp» er en fixture-konvensjon. Alternativene «ned» og «opp» er utelukket av de oppgitte verdiene, men half-up mot half-even er ikke avgjort (ingen likhet) — U-013 overtas av ECON-004.
- Transport er antatt å inngå i tollverdien; forsikring er 0 (ikke oppgitt). Tollkurs (U-008) er ikke avklart; fixturene bruker samme fixturekurs for begge roller, bortsett fra det syntetiske rolle-scenarioet.
- Orakelet er uavhengig av fremtidig domenekode: ECON-004 skal sammenlignes mot fixturenes *literale forventninger*, ikke mot orakelet.

## 5. Kontroller
`npx vitest run` — 35 filer, 801 tester bestått (781 + 20 nye); `npm run typecheck` rent; lint rent for de endrede/nye filene; `node docs/tax/check-docs.mjs` OK. Uavhengig kryssjekk av råverdier med Python `Decimal` (2 689 248,2053; 366 662,7949; 411 491,2458; mva. 16 665,75 / 102 872,75). Ikke kjørt: build, e2e, DB.

## 6. Blokkeringer
Ingen som hindrer REVIEW. Åpent for ECON-004: U-013, U-003, U-008, R-IMP-VAT-003 (anvendelse), R-IMP-VAT-002/R-DED-001 (E1P).

## 7. Review-belegg, godkjenning og avslutning (2026-10-19)
**Review:** `reviews/ECON-003-review-398710a.md` (lagt inn uendret; SHA-256 `88f47831fb0ff9d5bd3a636064f516739f62cbc8dfc7ac83015cb353c3b37853`): ingen blokkerende funn; alle seks kontrollpunkter bekreftet; 30 manifestoppføringer verifisert; de sju avgiftsmotorfilene er byte-identiske med 5967fc2; `repro/decimal-check.py` (43 sammenligninger) og 161 egne kontroller bestod. Reviewer har ikke kjørt Vitest, typecheck, lint, check-docs, build, e2e eller DB; de 801 testene er utviklerens resultat. Begrensning notert av reviewer: felles forfatterskap for literaler og orakel (proveniens); låsetestene er regresjonsvern, ikke primærkildebevis.
**Godkjenning (Christian):** ECON-003 er godkjent som avgrenset fixture- og aritmetikkleveranse. Skillet mellom *observerte referanser* (OBSERVED_RUNS), *historisk oppgitte tall* (`stated_not_documented`) og *syntetiske Merovo-scenarier* (B, inkl. syntetisk tollkurs) er bevart. **Godkjenningen omfatter ikke produksjonsregler for MVA, valutakurs eller fradragsrett**; fixture-konvensjoner (half-up-avrunding, fritak, forsikring = 0, transport i tollverdien) er testforutsetninger, ikke vedtatte regler.
**Akseptkrav:** gyldne fixturer for tre caser (A observert/oppgitt, B Merovo-scenario) ✔ · aritmetikktester (kurs, avrunding, mva., sum, kontantbehov, økonomisk kost, kurs-roller, `unknown`) ✔ · lås av oppgitte verdier ✔ · uavhengig review uten blokkerende funn ✔ · kontroller grønne (801 tester) ✔ · ingen endring i beregningskode ✔.
**Videreført til ECON-004 (åpent, ikke løst):** U-013 (mva.-avrunding; half-up vs half-even er ikke avgjort, fravær av x,5 er ingen kilde for tie-policy); U-003 (MVA-kildenes årgang); U-008 (tollkurs); R-IMP-VAT-002 (grunnlag/forsikring, E1P); R-IMP-VAT-003 (elbilfritak, anvendelse og tilfeller omkring grensen); R-DED-001 (fradragsrett, E1P). Fra reviewen: negative beløp, generelle produksjonsgrenser og andre regelregimer er ikke verifisert; +10 000 i kontantbehov gjelder bare disse tre scenarioene og er ikke en universell regel for 8 000 i transport; ECON-004 skal ikke kopiere fixture-konvensjoner til produksjon eller omtale dem som vedtatte regler, og skal hente kildeavklaring før autoritativ produksjonsberegning. A-oppgitt blir ikke dokumentert offisiell referanse av at aritmetikken stemmer.
**ECON-004** er ikke startet.

**Sluttstatus: DONE (avgrenset fixture-/aritmetikkleveranse).**


---

# ECON-003-2 — anslått innkjøpskostnad til Norge i søkeresultatene (23.10.2026)

**Merking.** Id-en «ECON-003» er brukt én gang tidligere (gyldne fixturer og aritmetikktester, DONE ved `398710a`; §1–§7 over, uendret). Denne leveransen — å løfte innkjøpsøkonomi frem i resultatflyten — merkes **ECON-003-2** i review og backlog, på samme måte som DATA-002D-2. Filnavnet `reviews/ECON-003.md` er beholdt og historikken er ikke skrevet om; denne delen er lagt til nederst.
**Status: pre-implementasjon (§A–§F committet FØR kode).** Resultat, tester og gjenstående legges til i §G–§K etter implementasjonen. Startpunkt: `origin/main` = `faee6d3` (ECON-002 og DATA-002D-2 er merget). Grenen `claude/charming-cannon-zwevp6` er restartet fra den.

## A. Hva som faktisk finnes og hva forhandleren ser i dag (lest, ikke antatt)
Økonomikjernen er **allerede koblet inn** i resultatflyten (ECON-004/005/006): annonse → `assessEconomics` (rettighetskontroll → adapter → `calculateEconomics` med registerprofilen → 005a-mapper) → `toDisplayEconomics` (rettighetsgrensen) → `DisplayItem.economics` (`EconomicsView`) → `EconomicsNote`/`EconomicsExplanation`. Beregningen er rent deterministisk og uavhengig av UI/provider.
| Flate | I dag |
|---|---|
| Resultatkort (`ResultCard`) | Ett kompakt avsnitt: «Anslått innkjøpskostnad til Norge: <overskrift>» + «Dette er ikke en budsjettvurdering». Overskriften er `Estimat — ikke validert: X kr`, `Minst X kr (ufullstendig)`, «Scenarier — fradragsstatus er ukjent» eller «Ikke beregnet». Ingen nedbrytning, ingen årsak til «ikke beregnet». Over den står en fast tekst: «Innkjøpskostnad til Norge er ikke beregnet …». |
| Detaljside | Full `EconomicsExplanation`: «Brutto utlegg» og «Økonomisk kostnad» (med scenarier ved ukjent fradragsstatus), nedbrytningstabell, forutsetninger (begge kurser), usikkerhet, manglende felt med lenker til forhandlerskjemaet. Korrekt og forklarende, men teknisk («brutto utlegg», «økonomisk kostnad», «ikke godkjent for validering»). |
**Dataflyt som avgjør hva som kan vises.** Adapteren er bevisst konservativ: drivlinje, avgiftsvekt, CO₂-metode, norsk registreringsdato, akseptdato, kurser (anskaffelses- og tollkurs, begge `dealer_entered`), transport/forsikring og fradrag/mva.-håndtering kommer **bare** fra forhandlerens bekreftede input (eller firmaprofilen) — annonsens drivstoff brukes ikke, annonsevekt blir `reference_listing`, og transportstandard settes ikke. Det finnes **ingen** kurskilde i systemet (ingen live-kurs, ingen standardkurs). Uten bekreftet forhandlerinput gir en annonse derfor «Ikke beregnet» — korrekt fail-safe-oppførsel, men uten forklaring på kortet.

## B. Funn som påvirker oppdraget
1. **Den offentlige BMW iX3-demoen viser i dag ikke noe tall** (uten forhandlerinput: «Ikke beregnet»). Den syntetiske råposten har netto EUR 36 950 (type NET, belegg «Exportpreis netto»), effekt og første registrering, men **verken vekt, CO₂, brutto 43 970, kurs eller drivlinjegrunnlag** (råformatet kan ikke oppgi dem; kandidatadapteren utleder ikke slikt fra fritekst).
2. **Referansetallene i oppdraget finnes ikke i repoet.** Søk etter 2 260 kg, 18 058, 435 558, 445 558, 394 000 og 43 970 gir ingen treff i kode, fixturer eller dokumenter (bare netto 36 950 og 03/2024 finnes). Jeg kan derfor ikke «gjenskape» dem fra eksisterende konfigurasjon; jeg kjører i stedet den ekte motoren på iX3-inputene fra oppdraget i en test og rapporterer avviket åpent (se §H).
3. **Demoens transport 8 000 NOK (ekskl. mva.) er en søke-kostnadslinje**, ikke motorinput. Eksisterende 005a-policy behandler `excl`-linjer som `unsupported` («mva.-grunnlag ekskl.: brutto ukjent») — de teller ikke i noen total. Motorens transport kommer bare fra forhandlerskjemaet. Å endre den policyen er en regelendring og ligger utenfor dette oppdraget; jeg endrer den ikke.
4. **Kortet motsier seg selv når et estimat finnes**: den faste teksten sier «Innkjøpskostnad til Norge er ikke beregnet» rett over «Estimat — ikke validert: X kr».
5. **Kontrakten mot eksisterende tester:** overskriften `economics-headline`, `data-economics-*`-attributtene og etikettene (`Estimat — ikke validert` m.fl.) er hevdet av vitest og av e2e-skriptene `econ006`/`econ006d`. De kan ikke erstattes uten å bryte fundamentet jeg skal bevare.
6. **Intern terminologi i dagens visning** («ikke validert», «reglene er ikke godkjent for validering») ligger i den eksisterende forklaringen. Jeg rører ikke eksisterende forklaringstekster; den nye sammendragsflaten bruker vanlig språk.

## C. Hva som mangler
En **forhandlervennlig sammendragsflate**: kjøpesum → engangsavgift → mva. → transport (bare hvis oppgitt) → estimert total til Norge, på kort (kompakt) og detalj (fullere), med kurs (begge roller, adskilt), kort forklaring og tydelig «mangler»-tilstand med årsak i klartekst. Alt dette finnes allerede som data i `EconomicsView` (+ `Explanation.breakdown`, `assumptions.fx`, `missing`); det mangler en presentasjonsmodell og komponent.

## D. Foreslått minimal implementasjon
1. **Presentasjonsmodell (ren, domenelag):** `toAcquisitionSummary(view: EconomicsView): AcquisitionSummary` i `src/domain/search-economics/`. Bare en avledning av eksisterende visningsmodell — **ingen** avgifts-, mva.- eller kursberegning, ingen kall til kjernen. Tilstander: `estimate` (total kjent), `partial` (bare delsum > 0, tydelig merket, aldri «total»), `unavailable` (ikke beregnet, med årsak og manglende felt), `hidden` (rettighet ikke gitt). Linjer: kjøpesum, engangsavgift (inkl. vrakpant), mva., transport, øvrige poster, hver med tilstand (`known`/`unknown`); ukjent vises aldri som 0. Kurs: `acquisition` og `customs` adskilt. Totalen er motorens `importCashRequirement` («brutto utlegg» = Skatteetatens «sum»), ikke økonomisk kostnad.
2. **Tekster** i `src/lib/search-labels.ts` (norsk, som resten av UI): «Estimert total til Norge», «Kjøpesum», «Engangsavgift», «MVA», «Transport», «Estimert innkjøpskostnad til Norge», og klarspråk-årsaker. Ingen «Minst 0 kr», ingen «0 kr» som plassholder, ingen intern terminologi.
3. **Komponent** `AcquisitionSummary` (`compact` for kort, full for detalj). Kortet: primærlinje (estimert total) + én sekundærlinje (kjøpesum · engangsavgift · mva. · transport, bare kjente) eller ikke-beregnet-årsak. Detalj: tabell med linjer, kurser, «hva mangler» med lenke til det eksisterende forhandlerskjemaet. Komponenten mottar kun `AcquisitionSummary` (ingen beregning i JSX).
4. **Integrasjon:** `ResultCard` og detaljsiden. Den eksisterende `EconomicsNote` (overskrift, attributter, etiketter, forklaring) beholdes uendret for kontraktsstabilitet; sammendraget legges til som primærflate over den. Den motstridende fasttekst-notisen på kortet byttes mot en kortere, ikke-motstridende variant **bare når** et beløp vises; ellers uendret.
5. **Ikke endret:** `src/domain/economics`, `src/domain/tax`, adapter, mapper, `assessEconomics`, rettighetsgrensen, kurslogikk, 005a-kostnadslinjepolicy, migrasjoner.

## E. Tolkninger og beslutninger (flagget, ikke avgjort av kilde)
- «Estimated total into Norway» = motorens brutto utlegg (kjøpesum + avgifter + import-mva. + oppgitte kostnader), uavhengig av fradragsrett. Økonomisk kostnad (mva.-fradrag) vises fortsatt bare i den eksisterende detaljforklaringen.
- Engangsavgift vist = `one_off_tax` + `scrappage_deposit` (Skatteetatens «Avgift» inkluderer vrakpant 2 400); summeres bare når begge er kjente heltall, ellers vises avgiften som ukjent. Ren addisjon av motorens egne rader.
- Alt vises som «estimert»; ingenting merkes eksakt eller offisielt.
- UI-språket er norsk; oppdragets engelske nøkkelord er brukt som begrep, ikke som visningstekst.

## F. Migrasjon, sikkerhet, bakoverkompatibilitet
Ingen migrasjon, ingen nye miljøvariabler, ingen nye data. Presentasjonsmodellen leser bare `EconomicsView`, som allerede har passert rettighetsgrensen (DATA-002D-2-lasting uendret); `unavailable` bærer aldri tall og gir ingen sammendragstall. Ingen rå leverandør-id eller kjerneinternt går inn i modellen. Risiko: moderat bredde i eksisterende tester (kort/detalj-rendering) — mitigert ved å beholde `EconomicsNote` uendret og ved å kjøre hele suiten og e2e-skriptene.
**Åpent spørsmål til produkteier (blokkerer ikke):** skal den offentlige iX3-demoen vise tall uten at forhandleren fyller skjemaet? Det krever en eksplisitt, merket syntetisk «demo-forhandlerinput» som omgår dagens eksplisitte bekreftelse — en arkitekturbeslutning jeg ikke tar her. Jeg bygger den eksisterende veien (skjema → tall) og viser tydelig hva som mangler til den.
