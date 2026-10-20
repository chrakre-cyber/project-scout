# ECON-005a — rene mapperfunksjoner til CostAssessment og visningsstatus (leveranse)

**Status: REVIEW (005a). ECON-005b–d er ikke startet.** Omfang etter den gjennomgåtte planen (`docs/econ/ECON-005-implementeringsplan.md`, § 0b–0c, § 6): bare rene funksjoner. **Ingen** databaseendring, UI-integrasjon, providerendring, endring av økonomiflagg (alle `false`), `classifyBudget`, ECON-004-kjernen, avgiftsmotor, fixturer eller avrundingspolicy. E7 og E8 er utsatt; ingen ekstra funksjoner. Produktregel: estimater, nedre grenser, scenarier og ukjente kostnader gir aldri positive budsjettutfall, `isFullHit` eller varsler.

## Hva er levert (alt nytt; ingen eksisterende fil endret)
`src/domain/search-economics/` (ren domenekode; importerer bare `@/domain/*` og relative filer):
- **`to-cost-assessment.ts`** — `toCostAssessment({ result, spec, candidate, now, profileRef, rightsLimit, sourceDataLimit, extraLimits?, lineScopes? })` → `MappingOutcome { class, assessment | null, lines, reasons, validUntil, bindingLimit }`; `computeValidUntil` (P3).
- **`cost-lines.ts`** — `treatCostLines` (P1/P4): eksplisitt behandling av hver kostnadslinje.
- **`display-status.ts`** — `toEconomicsDisplayStatus({ result, outcome, rights: { canDerive, canDisplay } })`.
- **`types.ts`**, **`index.ts`**.
Test: `tests/economics-005a-mapping.test.ts` (24 tester).

## Mapping (klasse → CostAssessment → classifyBudget)
| Økonomikjernen | `MappingOutcome.class` | `CostAssessment` | `classifyBudget` |
|---|---|---|---|
| `validated` + kontantbehov `value` + alle linjer behandlet (uoppnåelig med registerprofilen) | `complete_validated` | `complete_validated` | positiv/negativ status |
| `estimate` + `value` + alle linjer behandlet | `unvalidated` | `unvalidated` | `not_calculated` (`assessment_not_validated`) |
| `incomplete`/nedre grense/scenarier, eller ubehandlet linje | `incomplete` | `incomplete` (total = laveste kjente) | `not_calculated` (`assessment_incomplete`) |
| `blocked`, kontantbehov `not_calculated` (inkl. B1 akseptdato utenfor 2026), varebil, uspesifisert scenario, ugyldig profilref/kandidat | `not_calculated` | `null` | `no_assessment` |
| gyldighet utløpt (≤ `now`) | `stale` | `null` | `no_assessment` |
Total = kontantbehov (brutto utlegg, ECON-001 §8.1) × 100 + telte linjer (øre). Kandidat-id og revisjon, `costBasisOf(spec)`, profilreferanse og scenario kopieres/bindes slik at `classifyBudget`s eksisterende kontroller (mismatch, `cost_basis_changed`, scenario, foreldet) gjelder uendret.

## Plan-presiseringene
- **P1 transportlinje:** en eksisterende `transport`/`insurance`-linje mappes aldri automatisk; standard `unconfirmed` ⇒ `unmapped_unknown_scope`. Bekreftet omfang (`to_border`/`after_border`/`split`/`other`) mappes til kjernens komponent og telles ikke på nytt; komponenten må finnes (ellers `unsupported: mapped_component_missing`), `split` må summere til linjens beløp, og ugyldig omfang for typen er `unsupported`.
- **P3 validUntil:** minimum av `now + 24 t`, rettighetsprofil, kildedata (begge obligatoriske parametere), dokumentert regelperiode (eksklusiv slutt 2027-01-01), tollkursens `validTo` (+1 døgn) og øvrige grenser; uleselig grense ⇒ `not_calculated` (aldri «ingen grense»); utløpt ⇒ `stale`/ingen vurdering.
- **P4 kostnadslinjer:** hver linje får nøyaktig én behandling: `not_included`, `unknown_amount`, `unsupported` (valuta ≠ NOK, ukjent mva.-grunnlag), `mapped_to_input`, `unmapped_unknown_scope`, `added_to_total`. Ingen linje forsvinner eller blir 0. En ubekreftet linje telles i total bare når kjernens tilsvarende komponent er ukjent eller uttrykkelig 0 (ellers mulig dobbelttelling ⇒ listes, telles ikke; en nedre grense må ikke dobbelttelle). Ikke fullt behandlede linjer dekkes ikke (`coveredCostLineIds`) og gjør vurderingen `incomplete`.

## Avvik fra planen (begrunnet)
1. **Plassering:** planen nevner `src/domain/economics/to-cost-assessment.ts`, men den eksisterende arkitekturtesten i `economics-core.test.ts` forbyr importer utenfor `@/domain/tax` i `src/domain/economics/`. For ikke å endre den forventningen ligger mapperen i en egen domenemappe (`src/domain/search-economics/`) som importerer både økonomikjernen og søkemodellen.
2. **Rettigheter** kommer inn som ferdige booleans (`canDerive`, `canDisplay`); selve oppslaget og `allow_/display_derived_economics` bygges i 005b.
3. **Ikke i 005a:** forhandlerinput-binding (P2), rettighetsoppslag, orkestrering/adapter, DB, UI-tekster (`labelKey` er faste nøkler; tekstene eies av 005d), E7/E8.

## Tester og kontroller
- **Statusmatrise** mot `classifyBudget` (validated → `within_budget`; estimat/nedre grense/scenarier/blokkert/B1/varebil/uspesifisert → ikke positiv); kandidat-/revisjons-/kostnadsgrunnlagsbinding.
- **Egenskapstest** over 18 økonomivarianter (ukjent dato/transport/forsikring/fradrag/håndtering, udokumentert utenlandsk mva., ukjent provisjonsrolle/-betaling/-vilkår, ukjent betalingskostnad/toll, uklassifisert importavgift, assumed default, 2025/2027-dato) × 5 spesifikasjoner (uten linjer, ukjent beløp, ubekreftet transport, utenlandsk valuta, ukjent mva.-grunnlag) med enormt budsjett: **under registerprofilen er `complete_validated`, `within_budget`/`within_deviation` og `isFullHit` aldri mulig**; med syntetisk godkjent profil er positiv status mulig bare når kjernen er `validated`, kontantbehovet er en verdi og alle linjer er behandlet (og minst én kombinasjon er positiv, så porten ikke bare er stengt).
- **Kostnadslinjer** (12 påstander): behandlinger, ubekreftet omfang, overlapp, bekreftet omfang, split, ugyldig omfang, ukjent beløp/valuta/mva.-grunnlag, øvrige linjer én gang, ikke-inkluderte synlige.
- **validUntil** (5), **visningsstatus/rettigheter** (4), **arkitektur** (ingen float/klokke/utenfor-domene-importer).
- **Mutasjonskontroll** (midlertidig, ikke committet): estimat→complete_validated ⇒ 5 feiler; ubehandlet/ufullstendig→complete ⇒ 7; rettighetsgrense ignorert ⇒ 3; ubekreftet linje alltid telt ⇒ 1; ukjent beløp som 0 ⇒ 3; original ⇒ 24 består.
- **Utviklerens kontroller (ikke uavhengig):** `npx vitest run` 46 filer / **1 009 tester**; `tsc` og `eslint .` (ingen advarsler) og `check-docs` exit 0 (`developer-checks/` i pakken). Ingen eksisterende fil er endret siden `cd80a89` (`git status`: bare nye filer). Uavhengig review gjenstår.

## Videre (ikke startet)
005b: rettighetsutvidelse (DB). 005c: adapter/orkestrering/forhandlerinput-binding (P2). 005d: visningsmodell og faste tekster. Hver skive stoppes for review.
