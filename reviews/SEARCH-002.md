# SEARCH-002 — regler og feltmodell bak Merovos nye søk · leveranserapport

Status: **REVIEW** (ikke DONE). Utfører Claude Code, kontrollør Codex. Ingen neste oppgave startet.

## 0. Utgangspunkt

- Branch `claude/wonderful-bardeen-yussx3`, base-commit **97812ee** (SEARCH-001A-UI-FIX1), arbeidstreet rent før start.
- Les: AGENTS.md, CLAUDE.md, README.md, PRODUCT_SPEC.md, ARCHITECTURE.md, DATABASE_SCHEMA.md, DECISIONS.md, MVP_BACKLOG.md, IMPORT_ENGINE_SPEC.md, MEROVO_SEARCH_SPEC.md (fra pakken), produktnotatene og Codex-reviewen av FIX1.
- Ikke berørt: `src/domain/{types,matching,…}.ts`, `AgentFilters`, `AgentAssumptions`, `evaluateListing`, prototypen (`prototypes/merovo-search/`), database/migrasjoner, UI, server, providers, Christians lokale appkopi. Ingen nye pakker.
- Den ikke-blokkerende P3-merknaden fra FIX1-reviewen (advarsel ved import av v1-effekt) er **ikke** rørt; den ligger til separat oppfølging.

## 1. Dokumentsynkronisering (selektiv, historikk bevart)

`reference-current-local/` er sammenholdt med repoet fil for fil. For `DECISIONS.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md` og `IMPORT_ENGINE_SPEC.md` var forskjellen **kun tillegg** (0 fjernede linjer; verifisert med diff), så tilleggene er overført ordrett:

| Fil | Overført |
|---|---|
| `DECISIONS.md` | DEC-030 (vedlagt tekst, ikke konstruert) |
| `PRODUCT_SPEC.md` | note øverst + «Produktendring 15.10.2026» |
| `ARCHITECTURE.md` | «Planlagt utvidelse 15.10.2026» |
| `DATABASE_SCHEMA.md` | «Planlagt modellendring 15.10.2026» |
| `IMPORT_ENGINE_SPEC.md` | «Tillegg 15.10.2026 — budsjettmodell» |
| `MEROVO_SEARCH_SPEC.md` | ny fil (v1.0, SPEC-SEARCH-001) |
| `MVP_BACKLOG.md` | **ikke** erstattet (referansen mangler repoets SEARCH-001A-UI-rader). Kun nye avsnitt lagt til: «Sikkerhetsoppfølging 15.10.2026» (QA-DEP-001, QA-SEARCH-001) og «SPEC-SEARCH-001» |
| `AI_TEAM_ROLES.md` | identisk, uendret |

I tillegg ført av denne oppgaven: ny **DEC-031** (arbeidsbeslutning), backlogg-rad og loggpost for SEARCH-002. Avstemming mot Christians lokale appkopi (Windows-sti, «Utløper senest») er ikke gjort og ikke løst av dokumentene alene — den må gjøres før DB-/UI-integrasjon.

## 2. Endrede filer

Nye: `src/domain/search-v2/{types,validation,serialization,evaluation,budget,mapping,catalog,factory}.ts`, `tests/search-v2.test.ts`, `tests/fixtures/search-v2.ts`, `MEROVO_SEARCH_SPEC.md`, denne rapporten. Endrede: de fem dokumentene over, `DECISIONS.md` (DEC-031), `MVP_BACKLOG.md`.

## 3. Krav → implementasjon → testbelegg

| Krav (oppdragets punkt) | Implementasjon | Testbelegg (`tests/search-v2.test.ts`) |
|---|---|---|
| L1 Bilidentitet, modellår ≠ førstegangsreg., ukjent ≠ usatt | `VehicleIdentity`, `Requirements.modelYear/firstRegistration`; usatt = `null`/`[]`, ukjent = `null` på `CandidateV2` | «modellår og registreringsår blandes aldri», «tom spec … match» |
| L1 Krav (år, reg. m/presisjon, km, seter, karosseri, drivstoff, gir, hjuldrift) | `Requirements`; hjuldrift/farge m.fl. som egne kandidatfelt (`CandidateV2`) | seter 6/7/8, km-grenser, ELLER/OG-test, førstegangsreg. (4 tester, skuddår) |
| L1 Farge/interiør/utstyr med must/nice | `PrioritizedList` (én prioritet pr. liste), `EquipmentCriterion` (pr. element) | «ønsker (nice)», farge som ønske |
| L1 Budsjett + kostnadsforutsetninger | `BudgetSpec`, `CostLine` (valuta adskilt, `amountMinor` bigint eller `null`, mva.-grunnlag, includedInBudget); ingen retail/minimumsbidrag | «bevarer ukjent EUR-beløp, eksplisitt 0…», GLS-test |
| L1 Planlagt norsk registrering | `PlannedRegistration.requested` passenger/van/unspecified, adskilt fra `CandidateV2.currentCategory` og fra `CostAssessment.registrationScenario`; ombygging/godkjenning = `CostKind` conversion/approval | «planlagt registrering blandes ikke med karosserifilter», «valg av varebil alene endrer aldri total» |
| L1 Pengeverdier eksakt, grense for domenetall | `bigint` internt; JSON-streng ≤ 2^53-1 (DEC-020); validering avviser JSON-tall/negative/over grensen | ugyldig beløp-tester, «store beløp … 2^53-1» |
| L1 Injiserbar katalog-/kapasitetskontrakt | `SearchCatalog`, `SourceCapabilities`, `staticCatalog`, `criteriaSourceCannotSupply`; ingen API-kall | «kildekapasitet», fritekstvariant-test |
| L1 Mappingtabell for ALLE prototypekriterier | `mapping.ts` (`PROTOTYPE_MAPPING`, 46 felt/grupper/budsjettrader, tabell under) | «mappingtabell mot prototypens faktiske feltkatalog» (leser `data.js` kun i testen) |
| L1 Ikke-støttede felt avvises | `strict()` i `specFromJson` gir `criterion_not_supported` for kjente, ikke-støttede prototypefelt (også som utstyrsnøkkel) | «avviser prototypekriterier uten implementert semantikk» |
| L2 Validering, versjon, ukjente nøkler/enheter, merke/modell, intervaller, duplikater, prioriteter, tekst som data | `validateSpec` + `specFromJson` | 12 valideringstester (se `describe("validering…")`) |
| L2 Én ren konvertering, tapsfri | `specToJson` / `specFromJson`; modellversjon 1, `merovo.search-model` | 5 rundturtester (ukjent EUR, 0, fri variant, must/nice, datopresisjon, varebil, 2^53-1, ingen delte referanser) |
| L2 Ugyldig input endres ikke, ingen delvis tilstand | alltid `Result` med `issues`, ingen `value` ved feil; bygger nye objekter | «ugyldig inndata endres ikke…» (dypfrosset inndata) |
| L3 excluded / needs_review / match, forklaring per kriterium | `evaluateCandidate` → `VehicleEvaluation.criteria[]` med status+grunn | «kravvurdering…» (7 tester) |
| L3 «nice» påvirker aldri status; forklarbare ønsker | `wishes {fulfilled, notFulfilled, unknown}` | «ønsker (nice)», parsammenligning a/b/c |
| L3 Utstyr: ukjent ≠ mangler; pakker beviser ikke utstyr | `equipmentVerdict`: bekreftet fravær eller `listComplete` kreves | «utstyr: ukjent er ikke mangler» |
| L4 Øvre grense i øre/bp, ned-avrunding; 750 000→825 000 | `upperLimitMinor` (BigInt) | 750 000/825 000, ett øre under/over, 100,01 kr + 12,34 % = 112,35 kr, MAX×2 |
| L4 Kostnadslinjer øker ikke grensen | `upperLimitMinor` leser ikke `costs` | «kostnadslinjer … øker aldri» (med og uten avvik) |
| L4 Klassifisering krever NOK/basis/scenario/validert/ikke foreldet | `classifyBudget`, `CostAssessment`, `now` injisert | 7 `not_calculated`-tester (manglende, ugyldig, uvalidert, foreldet inkl. grense, valuta, basis, scenario, inkluderte kostnader) |
| L4 Pris opphever aldri kravbrudd | `combineAssessment.isFullHit` | «pris opphever aldri kravbrudd» |

## 4. Mappingtabell (prototypens kriterier → søkemodell v1)

**Støttet nå:** `brand`, `model` (krever merke), `variant` (fritekst under gyldig modell), `modelYear`, `firstReg` (år/måned/dato), `mileage` (maks km), `body`, `seats`, `fuel`, `gear`, `drive` (nytt kandidatfelt), `extColor`, `intColor`, `material` (liste + én prioritet), utstyrsgruppene `parking`, `driving`, `seats`, `interior_other` (boolsk, pr. element, nøkler fra injisert katalog), budsjett (`amount`, `deviation`, `costs`).

**Planlagt senere (avvises nå):** `packages`, `doors`, `power`, `displacement`, `cylinders`, `weight`, `consumption`, `euro`, `sliding`, `extFinish`, `towbar`, `trailerBraked`, `trailerUnbraked`, `noseWeight`, `cruise`, `climate`, `newUsed`, `damage`, `service`, `warranty`, `certification`, `owners`, `prevUse`, `inspection`, `seller`, `country`, `vat`, `adAge` — hver med begrunnelse i `mapping.ts` (typisk: regel/semantikk ikke vedtatt, eller krever kildekatalog).

**Ikke relevant for matching:** `freeText` (bekrefter ingen strukturerte krav).

**Adapter (senere, ikke bygget):** se doc-kommentaren øverst i `mapping.ts` (7 punkter: bare `supported_now`-rader overføres; øvrige utfylte felter returneres som eksplisitt «ikke støttet»; enheter oversettes; farge/materiale-prioritet må komme uttrykkelig fra brukeren; planlagt registrering utledes aldri; resultatet valideres mot injisert katalog).

## 5. Bevisste valg Codex bør vurdere

1. **Prioritet kun på utstyr og farge-/interiørlister.** Identitet, intervaller og karosseri/drivstoff/gir/hjuldrift er alltid absolutte (MEROVO_SEARCH_SPEC §4-standard). En liste har én felles prioritet, fordi «må ha» og «ønskelig» på ulike alternativer i én ELLER-liste ikke har en veldefinert betydning.
2. **Variant** sammenlignes som delstreng uten hensyn til store/små bokstaver (som DEC-027), men er aldri avhengig av en forslagsliste.
3. **Ekstra kontrakter i `classifyBudget`** utover oppdragets minimum: vurderingen må dekke alle `includedInBudget`-linjer (`coveredCostLineIds`) og en inkludert linje kan ikke ha ukjent beløp. Begrunnelse: ellers kunne en total uten ombyggingskostnaden gi positiv status. Strengere enn påkrevd; kan fjernes hvis Codex mener det er scope-utvidelse.
4. **Foreldet** = `now >= validUntil`. `now` injiseres (domenet leser ikke klokken).
5. **Prisavvik 0 bp** er gyldig (lik budsjettet); `null` betyr avslått. Avvik uten budsjett er gyldig i utkast (klassifisering gir `no_budget`).
6. **Ny kandidattype `CandidateV2`** i stedet for å utvide `NormalizedListing` (dagens annonsetype er uendret). Mapping fra kildetekst til katalognøkler er en senere adapter.
7. **Registreringsscenario på vurderingen** er `passenger|van`; søk med `unspecified` gir `scenario_unspecified` (aldri en gjettet profil).

## 6. Kontroller faktisk kjørt

- `npx vitest run tests/search-v2.test.ts`: **65/65**.
- Hele repoet: `tsc --noEmit` uten feil, `eslint .` uten feil/advarsler, `vitest run` **297/297** (16 filer; var 232 i 15 filer før denne oppgaven, +65 nye), `scripts/qa-secret-scan.sh` «INGEN FUNN», `npm run build` OK. `tests/architecture.test.ts` (domenelaget importerer ingen UI/Supabase/React/Next) består med de nye filene.
- Ingen DB-test, reset, purge, hosted handling, nettverk eller nettleserkjøring (ingen UI endret).
- **Mutasjonsprøving** (manuelt skript, én endring av gangen mot `src/domain/search-v2/`): 53 anvendte mutasjoner, 49 drept ved første kjøring. Fire overlevde: «kostnader øker grensen når avvik er avslått», «negativt kostnadsbeløp» (begge fikk en ny test og er nå drept), og to som er **ekvivalente** fordi samme regel kontrolleres to ganger (prioritetsverdi og 2^53-1-grense sjekkes både i parseren og i `validateSpec`). Drept blant annet: ≤→<, avrunding opp, foreldelsesgrense, hver `not_calculated`-gren, kostnadslinjer som øker grensen, pris som overstyrer kravbrudd, ukjent slår kjent brudd, «nice» påvirker status, fravær av omtale = mangler, fullstendig liste ignorert, modellår utledet av registreringsår, presisjonsavgjørelse fra/til, varebil som karosserifilter, variant krever liste, ukjent versjon godtatt, null→0 / 0→null / valuta tapt / scenario tapt / presisjon tapt / prioritet tapt ved eksport, manglende nøkkel godtatt, delvis resultat ved feil. Skriptet er ikke en del av repoet.

## 7. Avgrensninger og begrensninger

- Modellen er **frakoblet**: ingen lagring, migrasjon, RLS, server-validering, UI eller kobling til dagens agenter. «Nye typer alene betyr ikke at funksjonen er aktiv.»
- Ingen avgifts-/mva.-beregning, FX, verdsetting eller avgiftsprofil. `CostAssessment` er et grensesnitt for et fremtidig lag (COST-001/TAX); testene bruker tydelig syntetiske vurderinger (`SYNTHETIC-TEST-PROFILE-NOT-A-TAX-REFERENCE`). Ingen påstand om at en bil kan godkjennes som varebil.
- Katalogen i testene er en fixture, ikke en produksjonsfasit. Ingen API-kall.
- Eksisterende appmodell og prototype er urørt; avstemming mot Christians lokale kode gjenstår før integrasjon.
- Ingen scoremodell; `wishes` gir bare utfallsgrupper (rangering er et senere valg).

## 8. Neste mulige oppgave (ikke startet)

SEARCH-001B (versjonert lagring, server-/DB-validering, kandidatadapter og matching mot denne modellen, kontrollert overgang) — krever først avstemming av kodeforskjell mot Christians lokale kopi. Parallelt og uavhengig: P3-oppfølging av v1-effektadvarselen i prototypen.
