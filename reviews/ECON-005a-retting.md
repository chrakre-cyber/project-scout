# ECON-005a — rettingsrapport etter review av e1c6ad0 (to P2)

**Status: ECON-005a forblir REVIEW. 005b–d er ikke startet.** Review: `reviews/ECON-005a-review-e1c6ad0.md` (to P2). Endret produksjonskode: bare `src/domain/search-economics/cost-lines.ts`. Uendret (diff tom): `src/domain/economics`, `src/domain/search-v2` (`classifyBudget`), `src/domain/tax`, `src/domain/provider-rights.ts`, `supabase`, `src/server`, `src/components`, `src/app`, `src/providers`, `tests/fixtures`. Økonomiflaggene er fortsatt `false`; ingen avrundingsregel, mva.-regel eller parameter er endret eller godkjent.

## P2-1 — `vatBasis = excl` regnet som avklart
**Retting:** en inkludert linje med kjent NOK-beløp og `vatBasis === "excl"` får `treatment: "unsupported"`, `reason: "vat_basis_excl_gross_unknown"`, `counted: false`. Sjekken kommer før omfangsmappingen, så den gjelder også `transport`/`insurance` (også når omfanget er bekreftet eller `other`). Beløpet bevares i linjen. Mapperen gir da `incomplete`, linjen står ikke i `coveredCostLineIds`, og `classifyBudget` gir `not_calculated`. Eksklusivt beløp teller bevisst ikke som nedre grense i totalen: ingen ny mva.-regel for tillegg innføres i denne skiven, og en senere uttrykkelig mapping til brutto budsjettbeløp må komme som egen avgrenset endring. `incl` og `none` er uendret. Linjer med `includedInBudget = false` er fortsatt `not_included` og blokkerer ikke.

## P2-2 — 99-øre-toleranse
**Retting:** `ROUNDING_TOLERANCE_ORE` og den ensidige `>=`-kontrollen er fjernet. `covers(komponentNok, beløpØre)` krever nå at komponenten er nøyaktig linjens beløp avrundet til nærmeste hele krone: rest < 50 øre ⇒ ned, > 50 ⇒ opp, nøyaktig 50 ⇒ begge kandidater (half_up, half_even og uavklart policy ligger alle innenfor). 0,99 NOK dekkes dermed bare av 1 NOK, aldri av 0. Ukjent komponent (`null`) dekker aldri; negativt beløp dekkes ikke. Gjelder `to_border`, `after_border`, forsikring og begge deler av `split` (hver del mot sin komponent; summen må fortsatt være lik linjens beløp ⇒ ellers `split_sum_mismatch`). Ikke-dekket ⇒ `unsupported / mapped_component_missing` ⇒ `incomplete`.
**Bevisst innstramming:** en komponent som er *større* enn linjens beløp (f.eks. kjernen har 8 000 NOK, linjen 5 000 NOK) ble tidligere akseptert; den regnes nå som uavklart, fordi mappingen da ikke er eksplisitt (komponenten kan være summen av flere kilder). Ingen eksisterende juridisk avrundingsregel er endret; kjernens avrunding er urørt.

## Tester
- `tests/economics-005a-review-regressions.test.ts` (reviewerens 2 tester; kopiert, kun ubrukte importer/konstanter fjernet etter ESLint-advarsler — assertions uendret).
- `tests/economics-005a-fix-coverage.test.ts` (55 nye tester): transport og forsikring × {uavklart, half_up, half_even} × {0,49; 0,50; 0,51; 0,99; 1,50; 2,50; 8 000 NOK} mot kjernens faktiske komponent; feil komponent (for høy/lav, `null`, større enn linjen); split (byttede deler, 0,99-del mot 0, summefeil); `excl` på custom/preparation/conversion/approval/travel/transport/insurance; `excl` + annen dekket linje; `incl`/`none` positivkontroll (complete_validated, total 468 723 NOK + linjer); `excl` utelatt fra budsjettet; ende-til-ende med `classifyBudget`. Kjerneresultater er ekte `calculateEconomics`-kjøringer; forventede hele-NOK-verdier er håndregnet (uavklart policy viser på 1,50 NOK komponenten 2 — samme som half_even — mens totalen forblir nedre grense; dekningen aksepterer begge tie-kandidater).

## Før / etter
| Kontroll | Før (e1c6ad0-kode) | Etter |
|---|---|---|
| Reviewerens 2 tester | 2 feiler (complete_validated) | 2 består |
| Nye 55 + reviewerens 2 (57) | 34 feiler, 23 består | 57 består |
| `economics-005a-*` totalt (24 + 57) | — | 81 består |
| Full suite | 1 009 (utviklerens tall før retting) | **1 066 består** (48 filer) |
| `tsc --noEmit` | — | ingen feil |
| `eslint .` | — | 0 feil, 0 advarsler (advarsler i reviewerfilen fjernet) |

«Før» for de 55 nye testene er kjørt ved å midlertidig stashe kun `src/domain/search-economics` til e1c6ad0-versjonen. Konkret før-resultat: `custom` 1 000 NOK `excl` ⇒ `complete_validated` med 469 723 NOK; transport 99 øre mot komponent 0 ⇒ `complete_validated`.

## Mutasjonskontroll (midlertidige mutanter, tilbakestilt)
| Mutant | Testfeil |
|---|---|
| Toleransen `+99` gjeninnført | 26 |
| `excl`-vakten fjernet | 8 |
| Tie gir bare øvre kandidat | 8 |
| Tie behandles som «ned» (`<= 50`) | 10 |

## Begrensninger
Kjørt: vitest (hele suiten), `tsc --noEmit`, `eslint .`. Ikke kjørt: build, e2e, DB, `qa:*`. `excl`-linjer gir foreløpig bare `incomplete`; ingen brutto-mapping finnes (kommer eventuelt i en senere skive etter eget vedtak). Uavhengig re-review av rettingen er ikke utført. Neste: re-review av denne rettingen; deretter, etter Christians beslutning, 005b.
