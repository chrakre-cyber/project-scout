# ECON-002 — rettingsrapport for Codex-review av a42a30b (to P2-funn)

**Status: REVIEW.** Ingen satser endret, ingen parametere godkjent, ECON-003/004 ikke startet. Profilen `NO-OTA-2026-A-PB` er fortsatt `approved: false`; funnene oppsto i den planlagte tilstanden etter profilgodkjenning og er rettet før en eventuell godkjenning.

## Årsak (felles for begge funn)
`approved` i `calculate.ts` så bare på profilgodkjenning, klasse 1-antall og regelnivå. Det blandet **godkjent regelgrunnlag** med **godkjent resultat for de konkrete inputene**.

## Retting
`ValidationStatus` (på toppnivå og i `finalClaim.validation`) har nå to adskilte signaler:
- `profileApproved`: regelprofilen er godkjent (uendret betydning).
- `inputResolution` (`resolved` | `estimate`) og `estimateReasons`: kvaliteten/entydigheten i inputene.

`status: "approved"` (og resultatstatus `calculated`) krever profil godkjent **og** klasse 1 **og** alle anvendte regler E1 **og** `inputResolution = "resolved"`. Ellers er resultatet `calculated_unverified` / `estimate_not_approved`, med beløp, advarsler og `monthSensitivity` bevart.

| Funn | Årsakskode | Når | Effekt |
|---|---|---|---|
| 1. Referansevekt | `weight_reference_only` | vektgrunnlag `reference_listing` eller `unverified` | estimat; beløp og `weight_basis_not_verified` bevart; aldri approved |
| 2. Datofølsomt punktbeløp | `first_registration_date_sensitive` | bare måned kjent og ulike mulige dager gir ulikt krav (`monthSensitivity` finnes) | estimat; punktbeløpet (466 253 i eksempelet; alternativ 475 719) er ikke godkjent sluttkrav |

Bevisst ikke endret: (a) bare måned som gir samme beløp for alle mulige dager blokkeres/nedgraderes ikke; (b) `dealer_entered` vekt er ikke likestilt med `reference_listing` (advarsel som før, ingen estimatårsak) — **policy som bør bekreftes i neste review**, siden ECON-001 §11 bare definerer «reference-only»; (c) ingen advarsel er gjort om til blokkering; (d) forhandleroppgitt drivlinje er uendret.

## Tester
`tests/econ-002-review-regressions.test.ts`: Codex' to regresjonstester uendret (de feilet på a42a30b) + utvidelser: entydig input får fortsatt approved; referanse-/ukjent vekt gir estimat med bevart beløp og advarsel; `dealer_entered` er ikke referansevekt; måned med sensitivitet gir estimat; måned uten sensitivitet er resolved; begge årsaker; uten profilgodkjenning er `profileApproved` false. Eksisterende tester er urørt.

## Kontroller kjørt etter retting
`npx vitest run` — 33 filer, 758 tester bestått (750 før + 8 nye); `npm run typecheck` rent; lint rent for `src/domain/tax` og skattetestene; `node docs/tax/check-docs.mjs` OK. Ikke kjørt: build, e2e, DB.

## Effekt for konsumenter
Les `validation.status` (eller `status === "calculated"`) for «godkjent beløp»; les `validation.profileApproved` for regelgrunnlaget og `validation.inputResolution`/`estimateReasons` for hvorfor et beløp er et estimat. Dagens produksjonsprofil er ikke godkjent, så ingen eksisterende resultat endrer status; de tre klasse 1-referansene og totalene (529 069 / 16 748 / 333 723) er uendret.
