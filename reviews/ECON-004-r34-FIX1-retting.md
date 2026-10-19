# ECON-004 runde 34 FIX1 — rettingsrapport (review av afdc9f0)

**Status: REVIEW. Ikke parametergodkjenning.** Økonomiflaggene er `false`; ECON-003-forventningene (`tests/fixtures/*`, `git status` tom), ECON-002 (`src/domain/tax`, uendret) og avrundingspolicyen er uendret; ingen ny juridisk avrundingsregel; ECON-005 ikke startet. Reviewrapporten: `ECON-004-runde34-review-afdc9f0.md` (to P2).

## P2-1 — rasjonale tellere eksportert som NOK
**Årsak:** `customsValueNok`, `commissionInCustomsValueNok`, `customsDuty.nok` og `importVatBaseNok` ble bygget som `Rat.n` uten nevner. Beløpsparseren godtar desimaler, så en post som `3.1` ble eksportert som `31` (tollverdi `1080031`), toll `2.4` som `12`, grunnlag `540012`; mva. ble samtidig regnet på de rasjonale verdiene.
**Retting (`landed-cost.ts`):** alle desimalposter som inngår i tollverdi, grunnlag eller kostnad — provisjon, betalingskostnader, eksplisitt tollavgift, klimagassavgift og `importLevies` — avrundes **én gang til hele NOK med den eksisterende, uttrykkelige policyen** (`round()`; likhet ⇒ nedre grense og kandidater, `roundingTies`). Samme avrundede tall brukes i kostnaden og i grunnlaget, så det ikke blir dobbelttelling eller avvik. Resultatfeltene går gjennom `wholeNok()`, som kaster en intern feil hvis en brøk noen gang skulle nå dem. Typekommentarene «Hele NOK» er presisert til «desimaler tillatt, avrundes». Alternativene «returner eksakt» og «avvis desimaler» ble ikke valgt fordi eksisterende poster (transport, forsikring, øvrige) allerede avrundes slik; ingen ny avrundingsregel innføres.
**Konkret:** provisjon 3,1 ⇒ 3 (tollverdi 108 003, grunnlag 108 003, mva. 27 001); toll 2,4 ⇒ 2 (grunnlag 108 002; mva. 27 000,5 er likhet ⇒ nedre grense under uavklart policy); klimagass 2,4 + importavgift 2,4 i grunnlaget ⇒ 108 004.

## P2-2 — provisjon inkludert i prisen
**Årsak:** grenen `paidSeparatelyFromPrice === false` ga bare en advarsel for innkjøpsprovisjon/ukjent rolle og beholdt hele kjøpesummen som tollverdi, uten å påvirke `customsComplete`/`importVat.status`/eksakthet. Resultatet var `validated` selv om en dokumentert innkjøpsprovisjon kan skilles ut (§ 6-11 (1) e, T88) og gi tollverdi 105 000 / mva. 26 250.
**Retting:** ny valgfri `CommissionInput.deductionConditionsMet` (bare relevant når provisjonen er i prisen):
- **salgs-/meglerprovisjon i prisen:** er prisen; ingen utskilling (løst, 108 000).
- **innkjøpsprovisjon, `true`:** skilles ut av tollverdien (105 000 → mva. 26 250); anskaffelseskostnaden uendret (100 000; bare mva. −750); estimatårsak `purchase_commission_deduction_unverified` (vilkårene er ikke verifisert av kjernen).
- **innkjøpsprovisjon `false`:** ingen utskilling (løst).
- **utelatt/`null`, eller ukjent rolle (uansett vilkår = true):** uavklart ⇒ `commission_in_price_deduction_unresolved`, `incomplete`, `customsValueNok = null`, mva. og totaler `lower_bound` regnet på **laveste mulige tollverdi** (alt skilt ut: 105 000 → 26 250). Det høyeste beløpet (27 000) merkes ikke lenger som nedre grense; nedre grensen er verifisert ≤ begge fullføringene (testet også for totalene). Mva. er monoton i tollverdien (også med elbilfritak), så laveste tollverdi gir gyldig nedre grense.
- Skilt beløp større enn kjøpesummen blokkeres (`invalid_classification`); ugyldig vilkårsverdi blokkeres.

## Regresjonstester — fanger feilene før rettingen
`tests/economics-round34-fix1.test.ts` (15 tester). Kjørt mot koden i `afdc9f0` (`git stash` av `src/domain/economics`): **9 feiler, 6 består** (kontrollcase og løste tilfeller). Før-resultater: provisjon 3,1 ⇒ `31n` (forventet 3n); toll 2,4 ⇒ `{ nok: 12n }`; grunnlag `540024n` (forventet 108 004n); invariant 3,1/2,4/1,2 ⇒ `972031n`; innkjøpsprovisjon i pris ⇒ `validated` (forventet `incomplete`); ukjent rolle ⇒ `validated`; utskilling ⇒ 108 000 (forventet 105 000). Etter rettingen: 15/15 består. Kontrollcasen viser at basisinputen er `validated` med syntetisk godkjent profil, så feilene ikke skyldes en stengt validerings­port.
Én eldre test (`economics-round34-implementation`) som låste «innkjøpsprovisjon i prisen = bare advarsel» er endret til den nye, uavklarte oppførselen (nedre grense 26 250) — avvik forklart av P2-2.

## Kontroller kjørt
`npx vitest run`: 41 filer / 939 tester bestått (før: 40 / 924); `npx tsc --noEmit`, `npx eslint .` og `node docs/tax/check-docs.mjs` uten feil. Ikke kjørt: build, e2e, DB.

## Uendret / ikke gjort
Flagg false; ECON-003-literaler, ECON-002, avrundingspolicy (`UNCONFIRMED_HALF_UP`) og registerets parametergodkjenninger uendret; ingen nye produktgrenser. Beslutningspunkt: om `deductionConditionsMet` skal komme fra et strukturert dokumentasjonsfelt i UI senere (nå en påstand fra kallet).
