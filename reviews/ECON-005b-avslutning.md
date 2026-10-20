# ECON-005b — avslutning: DONE innen levert omfang

**Christians aksept (20.10.2026):** ECON-005b er DONE innen levert omfang: rettighetsmodell for avledet økonomiberegning (beregning per kildefelt + egen visningsrett, default nei), additiv migrasjon `20261021090000` og tester. **ECON-005 som helhet er ikke DONE** (005c–d ikke startet). Migrasjonen er ikke anvendt i hostet miljø; økonomiflagg, beregningsmotor, avrunding, `classifyBudget`, UI og providere er uendret.

## Belegg
**Uavhengige reviewere (reviewers kontroller):**
1. `reviews/ECON-005b-review-75ff199.md` — ett P2 (tomt økonomikart ga NULL i validatoren). 97 manifestoppføringer, 199 tester (30 rettighets-, 125 005a-, 44 core). Reviewer hadde ikke PostgreSQL; funnet var basert på kode og treverdilogikk.
2. `reviews/ECON-005b-re-review-612ccc2.md` — P2 lukket ved kodegjennomgang, støttet av utviklerens DB-reproduksjon; ingen nye blokkerende funn. 20 manifestoppføringer, 201 tester kjørt i en reviewkopi uten de to `canonicalPermissions`-formattestene (`@/server/public-ids` fulgte ikke med; disse to testene er utviklerens belegg). **Reviewer har ikke kjørt PostgreSQL, de 81 DB-testene, full suite, check-docs, qa-skript, build, e2e eller hosted migrasjon.**

**Utviklerens kontroller (separat belegg, ikke review):** `reviews/ECON-005b-leveranse.md` (75ff199) og `reviews/ECON-005b-retting.md` (612ccc2): `vitest` 1 146 grønne, `tsc`/`eslint`/`check-docs`; DB-tester i isolert PostgreSQL 16 (81 relevante grønne, DB-reproduksjon av funnet før retting og grønn etter); **hele isolerte DB-suiten har 12 feil og 247 hoppede tester (Auth/PostgREST finnes ikke i den klyngen) — den er ikke en grønn full DB-suite.**

## Dokumenterte begrensninger (beholdt)
Supabase-avhengige DB-filer (`rls`, `agents`, `search-runs`, `qa-isolation`, `qa-validation`, `rights-retention`, `qa-limit`), `qa:migrations`, `qa:secrets`, build og e2e er ikke kjørt. Migrasjonen er rettet på plass fordi den bare er anvendt i isolerte testklynger; skulle den være anvendt i et delt miljø, må utrulling håndteres separat. Engangsbackfillen av `synthetic-demo` v1 er akseptert; ingen generell adgang til å utvide verifiserte profiler. Nytt `canonicalPermissions`-format endrer avtrykket (eldre proveniens ⇒ `rights_changed`, ikke omskrevet).

## Gjenstår
005c (adapter/server/forhandlerinput) og 005d (visning) — ikke startet. Forutsetning før hosted rettighetsutrulling: DATA-002D (`reviews/DATA-002D-retting.md`, til review).
