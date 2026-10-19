# ECON-004 runde 34 FIX2 — rettingsrapport (review av 33d2fb9)

**Status: REVIEW. Ikke parametergodkjenning.** Økonomiflaggene er `false`; avrundingsspørsmålet (U-013) er fortsatt åpent og ingen policy er valgt eller godkjent; ECON-003 (`tests/fixtures/*`) og ECON-002 (`src/domain/tax`) er uendret (`git status` tom); ECON-005 er ikke startet. Reviewrapporten: `ECON-004-r34-FIX1-review-33d2fb9.md` (ett P2).

## Funnet
`round()` velger laveste kandidat ved avrundingslikhet under uavklart policy. For tillegg er det en trygg nedre grense; for **fradrag** (provisjon som skilles ut av tollverdien) er det motsatt: mindre fradrag ⇒ høyere tollverdi og mva. Reviewens tilfelle (kjøpesum 100 001, transport 8 000, tre innkjøpsprovisjoner à 2,5 i prisen, vilkår bekreftet): ubekreftet policy ga fradrag 6, tollverdi 107 995, mva. 26 999 og brutto 468 723 som «nedre grense», mens half_up gir fradrag 9, tollverdi 107 992, mva. 26 998 og brutto 468 722 — nedre grensen oversteg en støttet fullføring med 1 kr (og økonomisk kost ved `non_recoverable`).

## Retting (`landed-cost.ts`)
- Nytt `wholeDeduction()`: ved likhet og uavklart policy returneres begge støttede kandidater (half_up/half_even). **Fradragets bidrag til en nedre grense er den høyeste kandidaten per post** (størst fradrag ⇒ laveste tollverdi ⇒ laveste mva.). Likhet markeres som før (`roundingTies`, `tieHit` ⇒ `lower_bound`, aldri validated). Under en uttrykkelig policy gir `value` det entydige tallet.
- Gjelder både bekreftet utskilling (`deductionConditionsMet = true`) og uavklart adgang (nedre grense = alt skilt ut, høyeste kandidater). Tillegg/kostnader (separat provisjon, betalingskostnader, toll, avgifter) bruker uendret laveste kandidat.
- Mva. er monoton i tollverdien, så laveste mulige tollverdi gir laveste mulige mva., brutto og økonomisk kost; per-post-maksimum er en øvre omslutning av alle støttede policyer, dermed gyldig uten å velge policy.
- Kontrollen «fradrag > kjøpesum» bruker laveste kandidat, så en lovlig fullføring blokkeres ikke fordi bare den høyeste kandidaten overskrider prisen. Rundingsloggen oppgir at høyeste kandidat er brukt for fradrag. Provisjonsbeløp som ikke brukes (salgsprovisjon i prisen, ukjent betaling) avrundes ikke og logger ikke likhet.
- Ingen ny rettslig avrundingsregel; `UNCONFIRMED_HALF_UP`, tie-regelen og fixture-literalene er uendret.

## Regresjonstester — `tests/economics-round34-fix2.test.ts` (14 tester)
- **Reviewens reproduksjon** (tre à 2,5, bekreftet): half_up 107 992/26 998/468 722; half_even 107 995/26 999/468 723; uavklart policy ⇒ nedre grense 26 998 / 468 722 / 468 722 (tett: lik laveste fullføring).
- **Invariant** `nedre grense ≤ enhver støttet fullføring` for mva., brutto total og økonomisk kost, for både `non_recoverable` og `recoverable`, i fem oppsett: tre bekreftede; tre uavklarte; blandet bekreftet/uavklart/ukjent rolle (4 poster med likhet); fradrag med likhet + separat salgs-/innkjøpsprovisjon med likhet + salgsprovisjon i prisen + uavklart; kontroll uten likhet. Fullføringene er alle kombinasjoner av «skilt ut»/«ikke skilt ut» for hver uavklart post × både half_up og half_even (opptil 16 per oppsett).
- Tilfellet der høyeste kandidat alene overskrider kjøpesummen blokkeres ikke.
**Før rettingen** (kjørt mot 33d2fb9 ved `git stash` av `src/domain/economics`): **9 feiler, 5 består** — bl.a. «nedre grense 26 999 > fullføring 26 998» og tollverdi 8 001 i stedet for 8 000. **Etter:** 14/14 består.

## Kontroller kjørt
`npx vitest run`: 42 filer / 953 tester bestått (før: 41 / 939); `npx tsc --noEmit`, `npx eslint .`, `node docs/tax/check-docs.mjs` uten feil. Ikke kjørt: build, e2e, DB.

## Sluttmatrise (ECON-004, status REVIEW; ingenting er godkjent)
| Punkt | Status | Merknad |
|---|---|---|
| Elbilgrense mot tollverdi, `vehicle_price_only` fjernet | **Ferdig** (implementert, testet) | restpunkt under «blokkerer» |
| Ordinær tollsats 0 med dekningskrav; toll > 0 i grunnlaget | **Ferdig** | tollendringer etter 1.1.2026 ikke lest |
| Engangsavgift utenfor, klimagass/importavgifter/registreringsgebyr skilt | **Ferdig** | engangsavgift = rettsanvendelse |
| Provisjon (innkjøp/salg/ukjent), betalingskostnader, utenlandsk mva. | **Ferdig** | |
| Hele-NOK-representasjon (FIX1) og nedre grenser for fradrag (FIX2) | **Ferdig** | |
| Avrunding U-013 (enhet/metode per importberegning og rapportering) | **Blokkerer godkjenning** (`roundingApproved`) | åpent; ingen policy valgt |
| `vatRulesApproved`: registrert importør (sammenstilling), lasting/håndtering/salgsprovisjon i elbilgrensen, tolltariffendringer 2026, klimagass i grunnlaget | **Blokkerer godkjenning** | |
| `customsFxRuleApproved`: suspensjonspublisering, aksept i praksis | **Blokkerer godkjenning** | datainnhenting; estimat ved ukjent suspensjon |
| `deductionRuleApproved`: fradrag/salgsvare-dokumentasjon, uttak | **Blokkerer godkjenning** | ingen hjemmel for eget «salgsvarebevis» |
| Produktomfang 3.9.–31.12.2026 (forslag; ikke håndhevet i runtime) | **Blokkerer godkjenning** | krever din beslutning + review |
| Nyere XSD, sats/elbilfritak etter 2026, varebil/87.04, demobil-/uttakslivssyklus | **Kan utsettes** | utenfor støttet omfang |
| § 6-11 (1) e strukturert vilkårsdokumentasjon, bank-/valutagebyr i «pris», renter (§ 6-11 d), UI-felt for `foreignVat`/`commission` | **Kan utsettes** | fanget av ukjent/estimat til videre |
