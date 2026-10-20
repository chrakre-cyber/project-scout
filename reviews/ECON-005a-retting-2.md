# ECON-005a — rettingsrapport 2 (re-review av 651f309)

**Status: ECON-005a forblir REVIEW; 005b ikke startet.** Review: `reviews/ECON-005a-re-review-651f309.md` (P2-1 lukket; ett restpunkt i P2-2). Produksjonskode endret: bare `roundingCandidates()` i `src/domain/search-economics/cost-lines.ts`. `excl`-rettingen, ECON-004, økonomiflagg (false), `classifyBudget`, DB, UI og providere er uendret.

## Retting
Ved nøyaktig 50 øre ga funksjonen alltid `[q, q+1]`. Støttede policyer: half_up ⇒ alltid q+1; half_even ⇒ partall. Kandidatsett: **oddetalls-q ⇒ {q+1}; partalls-q ⇒ {q, q+1}** (0,50 ⇒ {0,1}; 1,50 ⇒ {2}; 2,50 ⇒ {2,3}; 3,50 ⇒ {4}; 8 001,50 ⇒ {8 002}). Under 50 øre ned, over 50 opp (uendret). Ingen ny policy, kjernen er urørt. Tidligere formulering «50 øre ⇒ begge kandidater» i `ECON-005a-retting.md` er presisert av dette.

## Tester
- `tests/economics-005a-tie-review-regressions.test.ts` (reviewerens 2 tester, uendret).
- Nye i `tests/economics-005a-fix-coverage.test.ts`: for 0,50 / 1,50 / 2,50 / 3,50 / 8 001,50 NOK: (a) kjernen gir under alle tre policyer bare komponenter i det håndregnede settet; (b) komponentene q−1…q+2 mot transport og forsikring, dekket kun i settet; (c) samme for split (tie-delen mot sin komponent, i begge rekkefølger, med en 1,00 NOK-del); (d) ende-til-ende 1,50 mot 1 ⇒ `incomplete`/`not_calculated`, mot 2 ⇒ `complete_validated` (syntetisk godkjent profil).

## Før / etter
| | Før (651f309-kode) | Etter |
|---|---|---|
| Reviewerens 2 + nye tie-tester (101 i de to filene) | 9 feiler | alle består |
| `economics-005a-*` totalt | — | 127 består |
| Full suite | 1 066 | **1 112 består** (49 filer) |
| `tsc`, `eslint .` (0 advarsler), `check-docs.mjs` | — | OK |

Mutanter: tie alltid `[q,q+1]` ⇒ 9 feil; paritet snudd ⇒ 21 feil.

## Begrensninger
Kjørt: vitest (hele), tsc, eslint, check-docs. Ikke kjørt: build, e2e, DB. Ingen uavhengig review av denne rettingen. Neste: re-review; deretter Christians beslutning om 005b.
