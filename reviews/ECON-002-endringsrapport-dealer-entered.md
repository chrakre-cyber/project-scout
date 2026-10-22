# ECON-002 — endringsrapport: policy for forhandleroppgitt vekt (`dealer_entered`)

**Status: REVIEW.** Policybeslutning av Christian, 19.10.2026. Dette er **ikke** parametergodkjenning. Ingen satser, regler, beregningsresultater, sensitivitet eller blokkeringer er endret. ECON-003/004 er ikke startet. De to P2-funnene er lukket etter uavhengig rettingsreview; denne endringen bygger på dem.

## Policy
**Forhandleroppgitt vekt uten dokumentert grunnlag gir et estimat, ikke et godkjent avgiftsbeløp.** Det er *grunnlaget*, ikke inntastingsmåten, som avgjør:

| `norwegianTaxWeight.basis` | Betydning | Resultat |
|---|---|---|
| `eu_type_approval_minimum_mass`, `vehicle_register` | verdi med dokumentert grunnlag i typegodkjenning (minimumsvekt) eller kjøretøyregister — også når den er lagt inn manuelt | kan være `resolved` / approved (med godkjent profil, klasse 1, E1 og øvrig entydig input) |
| `dealer_entered` | forhandleroppgitt vekt uten dokumentert grunnlag | **estimat**, årsak `weight_dealer_entered_undocumented` |
| `reference_listing`, `unverified` | referanse/ukjent grunnlag (ECON-001 §11) | **estimat**, årsak `weight_reference_only` (uendret) |

Den som legger inn en vekt med dokumentert grunnlag skal angi den dokumenterte basisen (`eu_type_approval_minimum_mass` / `vehicle_register`), ikke `dealer_entered`.

## Endring
- `calculate.ts`: `dealer_entered` er nå estimatårsak (`weight_dealer_entered_undocumented`) via én tabell over udokumenterte vektgrunnlag. Advarselen `weight_basis_not_verified` er uendret.
- `inputResolution = "estimate"` med årsaken; `status`/`finalClaim.validation.status` kan aldri bli `approved`/`calculated` på dette grunnlaget, selv med godkjent profil (`profileApproved` forblir eget signal).
- **Vektkomponentene** (`general_weight`, `combustion_weight`) er merket `estimate: { reasons }` på komponenten; beløpet er beholdt. CO₂-komponenten merkes ikke (uavhengig av vekten). Samlet beløp er markert via `validation`.
- `types.ts`: `EstimateReason` utvidet; `TaxComponent.estimate?`; dokumentert policy i kommentaren til `WeightBasis`.

## Konsekvens for eksisterende data
Golden cases og kalkulatorreferansene bruker `dealer_entered`; deres totaler (529 069 / 16 748 / 333 723) og klasse 1-registreringene er uendret (klasse 1 gjelder kalkulatorens resultat for de oppgitte inputene, ikke motorens approved-status). Med en godkjent syntetisk profil er motorresultatet for disse inputene nå estimat; det endrer ikke dagens produksjonsprofil (`approved: false`).

## Tester
`tests/econ-002-review-regressions.test.ts`: testen som forventet at `dealer_entered` ikke gir estimat er erstattet; nye tester for estimat med egen årsak og uendret beløp, komponentmerking (inkl. elbil), at dokumentert basis (typegodkjenning/register) kan være approved, og kombinasjon med datofølsom måned. `tests/tax-calculator-observations.test.ts`: testinputene gir estimat med godkjent syntetisk profil, totalene uendret.

## Kontroller
`npx vitest run` — 33 filer, 761 tester bestått (758 før + 3 netto nye); `npm run typecheck` rent; lint rent for `src/domain/tax` og de endrede testene; `node docs/tax/check-docs.mjs` OK. Ikke kjørt: build, e2e, DB.
