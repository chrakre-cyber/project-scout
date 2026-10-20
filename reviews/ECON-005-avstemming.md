# ECON-005 — avstemming mot akseptkravene (20.10.2026)

**Konklusjon: ECON-005 som helhet er IKKE DONE.** Delleveransene 005a–d er hver akseptert som DONE innen sitt avgrensede omfang, og motoren fra søk til vurdering og visning er på plass og testet i vitest. Men flere akseptkrav i planen og i ECON-001 er enten utsatt ved beslutning, ikke levert (brukerflate for forhandleropplysninger) eller ikke testet i integrasjon/nettleser. Denne rapporten sorterer dem; den endrer ingen status ut over å registrere 005d, og den godkjenner ingen regler (økonomiflaggene er `false`).

## 1. Hva akseptkravene er (kilder)
- **A.** Backlog-raden ECON-005: «Søkeintegrasjon: `EconomicTarget`, `CostAssessment`, rettighetene `allow_derived_economics`/`display_derived_economics` (DB)». DONE krever hele akseptkravet (backlog-regel); review-belegg (CLAUDE.md pkt 15).
- **B.** ECON-001 oppgavetabell: «`EconomicTarget` på søk (utvider `BudgetSpec`), `to-cost-assessment`, `classifyBudget` får ekte vurdering; rettigheter …; DB: spec-JSON-skjema + to profilkolonner; UI: liten».
- **C.** Implementeringsplanen (`docs/econ/ECON-005-implementeringsplan.md`): mål (§ 0), produktretning (§ 0b), presiseringer P1–P4 (§ 0c), tester 1–9 (§ 5), skiver 005a–d (§ 6: 005c «adapter + server-orkestrering + forhandlerinput (skjema-validering, ev. tabell med RLS)», UI «liten»), beslutninger E1–E9 (§ 7).
- **D.** ECON-001 § 15.7: porter før landed cost vises i ekstern partnerdemo (a)–(h).

## 2. Levert funksjonalitet (med belegg)
| Krav | Status | Belegg (testfiler / rapport) |
|---|---|---|
| `CostAssessment`-mapping, `validUntil` = minimum av grenser (P3), eksplisitt behandling av alle kostnadslinjer, ingen dobbelttelling (P1/P4) | **Levert, testet** | 005a: `economics-005a-*` (mapping, fix-coverage, tie/review-regresjoner); DONE `reviews/ECON-005a-avslutning.md` |
| Rettigheter `allow_derived_economics` (per felt) og `display_derived_economics`, default nei, immutabilitet, TS↔SQL-samsvar, DB-migrasjon | **Levert, testet** (DB-tester kun i isolert PostgreSQL) | 005b: `economics-005b-rights`, `db/econ005b-rights`, `db/data002d-field-map`; DONE `…005b-avslutning.md`, `…DATA-002D-avslutning.md` |
| Ren adapter annonse+søk+forhandlerinput → `EconomicsInput`; ingen oppgradering av annonsepåstander; ukjent forblir ukjent; kurser som estimat | **Levert, testet** | 005c: `economics-005c-adapter/-dealer-input/-server/-fix-coverage` |
| Serverorkestrering med rettighetskontroll før feltbruk; kontrollert paring annonse↔kandidat; foreldelse (P2); forhandlerinput bundet til firma/søk/kandidat/revisjon; lagring av bare forhandlerinput (to tabeller, firmabundet RLS) | **Levert, testet** (RLS i isolert PostgreSQL, ikke Supabase/PostgREST) | 005c: `db/econ005c-dealer-inputs`, `economics-005c-dealer-store`; DONE `…005c-avslutning.md` |
| Visning gjennom rettighetsgrensen med faste etiketter, uniform «unavailable», ingen tall uten rett | **Levert, testet** (markup, ikke nettleser) | 005d: `economics-005d-*`; DONE `…005d-avslutning.md` |
| Ingen positive budsjettutfall/varsler fra estimat, nedre grense, scenarier eller ukjent; ingen lagring av avledede tall; flagg false | **Levert, testet** | 005a/c/d (alle varianter: `not_calculated`, `isFullHit` false, `positiveBudgetEligible` false); skannet: ingen skriveoperasjoner i visningslagene |

## 3. Planens tester 1–9 (§ 5)
| # | Krav | Status |
|---|---|---|
| 1 | Mapping-matrise; registerprofil gir aldri `complete_validated`; syntetisk godkjent profil ⇒ `complete_validated` | **Dekket** av opplistede varianter og syntetisk testprofil (005a). *Ikke* som generert property-test (planen nevner «property over genererte input») — liten svakhet |
| 2 | Ingen positiv fra usikkerhet + streng-/snapshottest mot labels | **Dekket** (005a/005c/005d, inkl. label-snapshot og skann for positivt språk) |
| 3 | Dobbelttelling og foreldelse (kostnadsgrunnlag, revisjon, scenario, valuta, `validUntil`) | **Dekket** (005a, 005c) |
| 4 | Adapter: `listing_claim`, brutto/ukjent pris, `foreignVat`, ukjent ≠ 0, varebil, ingen `Math`/float | **Dekket** (005c-adapter, kildeskann) |
| 5 | Rettighetsmatrise, utløpt/revidert/ukjent/utkast, prisavsløring, DB: default nei, guard, differensialtest, RLS med ordinær bruker, ingen lekkasje mellom firma | **Dekket** i vitest og isolert PostgreSQL (`SET ROLE authenticated/anon`). **Ikke kjørt mot Supabase Auth/PostgREST** |
| 6 | Varsler: `usage.alerts=false`, nedre grense under budsjett utløser ingen varsel | **Ikke relevant ennå**: det finnes ingen varselmodul (kun rettighetsflagget `alerts`). Indirekte dekket (`isFullHit`/budsjettstatus aldri positiv). Må testes når en varselmodul finnes |
| 7 | B1 (akseptdato utenfor dokumentert vindu ⇒ `incomplete`) videreføres til visning | **Delvis**: B1 er testet i kjernen og i mapperen (005a); ikke eksplisitt gjennom `DisplayItem.economics` (årsakstekst finnes). Lite gap |
| 8 | **E2E (syntetisk):** søk → kandidat → forhandlerinput → kostnadsvurdering → visning for **tre profiler** + ukjent profil + manglende rett | **Ikke oppfylt.** Vitest-integrasjon via `previewForDisplay` finnes, men (i) bare dieselprofilen (PB-DIE) går gjennom 005-lagene (BEV/PHEV bare i kjernetester), (ii) ingen nettleser-e2e for økonomi, (iii) forhandlerinput kan ikke legges inn i appen |
| 9 | Regresjon: ECON-003/004-settet og `classifyBudget` uendret | **Dekket** (hele suiten grønn; berørte filer uendret) |

## 4. Utsatt ved beslutning (ikke feil)
- **E8 `EconomicTarget` (`maxLandedCostNok`, headroom)** — planen: «Utsett; v1 = budsjettsum + komponentvisning». Backlog-raden og ECON-001-tabellen nevner fortsatt `EconomicTarget`/spec-JSON-skjema: **omfanget er endret uten at raden er endret**. CLAUDE.md pkt 14 krever at det ikke gjøres stille → forslag: ECON-005-raden får ordlyd «(v1: uten `EconomicTarget`, E8 utsatt)», og E8 registreres som eget backlog-element etter Christians bekreftelse. Ingen spec-JSON-endring eller migrasjon for dette er gjort.
- **E7** «kjent kostnad overstiger allerede øvre grense» som display-felt (aldri filter/varsel) — utsatt; planen tillater levering i 005d eller ECON-006. Ikke levert.
- Utenfor ECON-005 per plan: ECON-007 (vekt/homologering), ECON-008 (FX-tjeneste), ECON-009 (benchmark).

## 5. Manglende brukerflate (nødvendig for at funksjonaliteten kan brukes)
- **Forhandleropplysninger har ingen brukerflate.** `confirmDealerInput`, `saveDealerProfile` og `createDealerEconomicsStore` har ingen kallere i appen (ingen server action, skjema eller side). Planens 005c-rad har «UI: liten» (skjema-validering); den delen er ikke levert. Konsekvens: i appen er forhandlerinput alltid «ingen», så kjernen gir «Minst … (ufullstendig)»/«Ikke beregnet» — estimater (med dokumentert drivlinje, vekt, CO₂, datoer, kurs) kan i dag bare nås i tester.
- Ingen forklaring/nedbrytning (hører til ECON-006, opprinnelig omfang).
- Ingen visning av «hva mangler for å beregne» koblet til inntasting.

## 6. Integrasjon som ikke er testet
- `dealer-economics-store.ts` (inkl. `listInputs`, upsert-oppførsel 23505→update) **mot ekte Supabase/PostgREST** — bare typesjekket/kildeskannet; tabellene er testet direkte i PostgreSQL.
- Supabase-avhengige DB-filer (`rls`, `agents`, `search-runs`, `qa-isolation`, `qa-validation`, `rights-retention`, `qa-limit`) er ikke kjørt (Auth/PostgREST mangler i den isolerte klyngen: 12 feil/247 hoppet over i hele suiten — ikke en grønn full DB-suite).
- Kjørende app og nettleser-e2e for økonomiflyten; sidene `preview` og `preview/[listingId]` er ikke åpnet i nettleser med økonomi (markup testet med `renderToStaticMarkup`).
- Tre ikke-anvendte migrasjoner (`20261021090000` ECON-005b, `20261022090000` DATA-002D, `20261023090000` ECON-005c): ingen hosted utrulling godkjent; DATA-002D-kartleggingen må kjøres mot hvert mål.
- Ytelse: paring (kandidatadapter) og økonomi per annonse i listen er ikke målt for ekte datamengder.
- Reviewers kontrollbegrensning: kildeavhengige testfiler (`tax-engine`, `economics-source-driven`) er ikke kjørt av reviewer i 005c/005d-pakkene.

## 7. Porter før ekstern partnerdemo (ECON-001 § 15.7)
| Port | Status |
|---|---|
| (a) Avgiftsmotor validert for viste profiler (E1-parametere godkjent + klasse 1) | **Ikke oppfylt** — `vatRulesApproved`, `roundingApproved`, `customsFxRuleApproved`, `deductionRuleApproved` er `false`; ECON-004-restpunkter (U-013, U-008, D1–D9) åpne. Derfor kan ingen `validated`/positiv budsjettstatus oppstå |
| (b) FX-kilde og dato vist for begge roller | **Ikke oppfylt i visning** (kilde/dato finnes i kjernen, ikke i `EconomicsView`) → ECON-006 |
| (c) Alle forutsetninger vist og merket (transport, forventet norsk registreringsdato, fradragsstatus `unknown` ⇒ ingen enkelt tall) | **Delvis** (forutsetningskoder, defaulted dato og scenarier vises; ikke strukturert/forklart) → ECON-006 |
| (d) Ukjent/«ikke beregnet» for ikke støttede profiler | **Oppfylt** (varebil/uspesifisert, ukjent drivlinje) |
| (e) «estimat — ikke rådgivning» + syntetisk-etikett | **Delvis** («Estimat — ikke validert», demo-banner finnes; «ikke rådgivning»-ordlyd mangler) → ECON-006 |
| (f) Rettighetskontroll for avledede tall per kilde | **Oppfylt** (005b–d) |
| (g) Testet mot gyldne fixturer i CI | **Delvis**: gyldne fixturer ligger i suiten (`econ-golden-fixtures`, `economics-*`), men repoet har ingen CI-konfigurasjon (kjøres via `npm run test`) |
| (h) Uavhengig review | **Oppfylt** for 005a–d (se avslutningsrapportene) |
Inntil (a) er oppfylt gjelder: ingen partnerdemo med landed cost som beslutningsgrunnlag; ingen positive utfall.

## 8. Anbefalt disposisjon
1. **ECON-005 forblir REVIEW (ikke DONE).** Akseptkravene som mangler er: brukerflate for forhandleropplysninger (plan 005c-UI), planens test 8 (e2e/tre profiler), samt en uttrykkelig beslutning om E8/E7 i raden.
2. Foreslått fordeling (til Christians beslutning): (i) E8 og E7 → egne, merkede backlog-elementer (utsatt, ikke feil); (ii) forhandleropplysnings-flaten og e2e flyttes inn som uttrykkelig delmål i ECON-006 (se planen § 2B/§ 6) — eller som «ECON-005e» hvis ECON-006 skal holdes til ren forklaring; (iii) integrasjonskontroller (Supabase/PostgREST, nettleser, hosted migrasjoner) samles i et eget kontrollpunkt før noen partnerdemo.
3. ECON-005 kan settes til «DONE innen avgrenset omfang (backend- og visningsgrense)» først når Christian uttrykkelig aksepterer at brukerflate for forhandlerinput og e2e ligger i ECON-006, og raden er omformulert (E8). Inntil da: REVIEW.
