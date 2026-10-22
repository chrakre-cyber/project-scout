# ECON-004 FIX3 — rettingsrapport (konsolidert review av dc97f04)

**Status: REVIEW. Ikke parametergodkjenning.** Økonomiflaggene er `false`; B1 (`validity.ts` og vakten i `landed-cost.ts`), ECON-002 (`src/domain/tax`), ECON-003-fixturer og avrundingspolicy er uendret; ingen eksisterende test eller forventning er endret; ECON-005 er ikke startet. Reviewrapport: `ECON-004-konsolidert-review-dc97f04.md` (B1 uten funn; ett P2). Den konsoliderte reviewen gjenbrukes; ingen ny plan- eller kilderunde.

## Funnet
Grenen `paidSeparatelyFromPrice === null` markerte input som uavklart og utelot en mulig tilleggskostnad, men tok ikke hensyn til at provisjonen kan være en innkjøpsprovisjon som allerede ligger i kjøpesummen og kan skilles ut av tollverdien (§ 6-11 (1) e). Mva.-grensen ble da for høy. Reviewerens tall (diesel, 100 000 NOK, transport 8 000, innkjøpsprovisjon 3 000, vilkår `true`, syntetisk godkjent profil/half-up):

| Betaling | Mva. | Brutto | Økonomisk kost (non_recoverable) |
|---|---:|---:|---:|
| Ukjent — **før** (`dc97f04`) | **27 000 lower_bound** | **468 723 lower_bound** | **468 723 lower_bound** |
| Ukjent — **etter** | **26 250 lower_bound** | **467 973 lower_bound** | **467 973 lower_bound** |
| I prisen (`false`) | 26 250 | 467 973 | 467 973 |
| Separat (`true`) | 27 000 | 471 723 | 471 723 |
Før lå grensen 750 kr over den støttede fullføringen «i prisen». Ved `recoverable` var også mva.-grensen feil.

## Retting (`landed-cost.ts`, +12/−1 linjer)
Ved ukjent betalingsmåte er de støttede fullføringene «separat» (kostnad + eventuell salgsprovisjon i tollverdien) og «i prisen» (ingen tilleggskostnad; innkjøpsprovisjon kan skilles ut). Den laveste fullføringen for *alle* tre mål samtidig er «i prisen og skilt ut». Grenen bruker derfor samme mekanisme som uavklart utskilling (FIX1/FIX2): for en post som ikke er salgs-/meglerprovisjon og der vilkåret ikke er oppgitt som ikke oppfylt, legges beløpet til «mulig utskilling» med **høyeste avrundingskandidat** (størst fradrag ⇒ laveste tollverdi) og inngår i kontrollen mot kjøpesummen. Kostnaden utelates fortsatt fra nedre grense (ingen dobbelttelling, ingen bekreftet inkludering); posten forblir `commission_price_inclusion_unknown`/`incomplete`, aldri validated. Salgsprovisjon med ukjent betaling kan ikke skilles ut ⇒ grensen er uendret. Vilkår oppgitt ikke oppfylt ⇒ ingen mulig utskilling. Ukjent rolle: utskilling forblir mulig (rolle kan være innkjøpsprovisjon). Beløp større enn kjøpesummen blokkeres (`invalid_classification`) også ved ukjent betalingsmåte. En trygg beløpsgrense kunne beregnes, så `not_calculated`-kontrakten var ikke nødvendig.

## Tester
- **Reviewerens to tester** (uendret, `tests/economics-consolidated-review-regressions.test.ts`): feilet før (recoverable og non_recoverable), består etter.
- **`tests/economics-round34-fix3.test.ts`** (13 tester): tallene over; recoverable; salgsprovisjon; vilkår ikke oppfylt / ukjent rolle; ingen validated og ingen dobbelttelling; blokkering; og **invarianten** nedre grense (mva., brutto, økonomisk kost) ≤ enhver støttet fullføring — **alle 27 kombinasjoner av rolle × betaling × vilkår for ett element** (beløp 3 000, 2,5, 0,5, 3 000,5), **alle 27 × 27 for to samtidige elementer** (3 000/1 500 og likhetsbeløp 2,5/2,5), **400 deterministiske tre-elementers kombinasjoner med avrundingslikhet**, begge fradragsstatuser, fullføringer under både half_up og half_even, ukjent rolle, uavklarte vilkår (`undefined`/`null` ⇒ oppfylt/ikke oppfylt) og ukjent betaling; samt samtidige ukjente av ulike typer (provisjonsbetaling + betalingskostnadens art + utenlandsk mva.-dokumentasjon).
- **Før-/etter:** mot koden i `dc97f04` feiler **11 av 14** av de to filene (fix3 hadde da 12 tester; de 3 som bestod var salgsprovisjonstilfellet og de to ett-element-sveipene med beløp 2,5 og 0,5, der utfallet tilfeldigvis ikke ga brudd — sveipene med 3 000 og 3 000,5 feilet) — fullt utdrag i `before-after/before-dc97f04.txt`; etter rettingen består alle (15 tester i de to filene). Full suite etter: **45 filer / 985 tester**, `tsc`, `eslint`, `check-docs` exit 0. Før (`dc97f04`): 43 / 970.
- En meningsløs hjelpepåstand i min første testutkast (recoverable-økonomisk kost) ble fjernet før første kjøring; testen påstår nå bare mva. 26 250 og brutto 467 973.

## Ikke endret
B1-vakten og dens 18 tester; ECON-002/003; flagg; avrundingspolicy (`UNCONFIRMED_HALF_UP`); alle eksisterende forventninger. Ingen funksjonsutvidelse.

## Utviklerens kontroller (ikke uavhengig)
Se `before-after/` i pakken. Uavhengig kontroll gjenstår: reviewer bør kjøre sin egen sammenligning for ukjent betalingsmåte, ukjent rolle og uavklarte vilkår, og full suite.
