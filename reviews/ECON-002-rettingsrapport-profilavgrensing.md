# ECON-002 — rettingsrapport: profilavgrensing (siste P2-punkt)

**Status: REVIEW.** Beslutning (Christian, 2026-10-19): godkjent runtime avgrenses til de tre validerte personbilprofilene **PB-DIE, PB-BEV og PB-PHEV**. Ingen nye referanser er skaffet; ingen satser, vektpolicy, datofølsomhet, eksisterende blokkeringer eller regelgodkjenninger er endret. ECON-003/004 er ikke startet.

## Problem (fra §28.4)
`classifyPowertrain` ga `ice` for bensin, diesel og ikke-ladbar hybrid, og klasse 1-dekning var et globalt antall (3). Bensin og HEV kunne derfor få `approved` ved å arve dieselens dekning.

## Retting
- **Normalisert teknisk input** (`PropulsionInput`): `combustionFuel` (`diesel` | `petrol` | `other` | null) og `hybridization` (`none` | `non_chargeable_hybrid` | null). Kreves for stempeldrevet, ikke-ladbar bil; ikke relevant for elbil (PB-BEV) og ladbar hybrid (PB-PHEV). Skillet utledes aldri fra markedsføringsnavn; `listing_claim` blokkerer som før.
- **Profilvalg og blokkering** (`calculate.ts`): diesel + `none` → PB-DIE; elbil → PB-BEV; ladbar hybrid → PB-PHEV. Alt annet for ikke-ladbar, stempeldrevet bil: `vehicle_profile_unsupported` (bensin, annet drivstoff, ikke-ladbar hybrid) eller `vehicle_profile_unknown` (null/manglende felt). Blokkerte resultater har ingen `finalClaim`, total eller `validation`, og blokkeringen gjelder også med en ikke-godkjent profilkopi.
- **Klasse 1 per profil:** `TaxProfile.vehicleProfiles` (PB-DIE ← C1-GR-20261018-03, PB-BEV ← -02, PB-PHEV ← -01). `approved` krever dekning > 0 for *denne* kjøretøyprofilen. `validation` har nå `vehicleProfile`, `class1References` (for profilen; var globalt) og `engineProfileClass1References` (totalt, informasjon).
- **Register:** `profiles.json` markerer PB-BEN og PB-HEV som utenfor støttet omfang; profilens `openItems` oppdatert. Test holder `vehicleProfiles` lik klasse 1-tilfellene i `references.json` per `profileId`.
- **Testinput/fixtures** er utvidet med de nye feltene (golden: PHEV = bensin-PHEV, EV, diesel); totalene er uendret.

## Åpent og avgrenset
- PB-PHEV dekkes av én klasse 1 (bensin-PHEV); drivstoff skilles ikke ut for ladbar hybrid (egen profil, ikke undertype). Diesel-PHEV har ingen egen referanse; dette er ikke avgrenset i denne leveransen.
- Bensin og HEV kan gjeninnføres bare med egen klasse 1-referanse og ny godkjenning (ikke gjort).
- Varebiler (VB-*) er som før blokkert av klassesperren.

## Tester
Ny `tests/tax-vehicle-profiles.test.ts` (16 tester): støttede profiler approved med profildekning 1; bensin, HEV (alle drivstoff) og annet drivstoff blokkert; ukjent/manglende undertype blokkert; blokkering uavhengig av profilgodkjenning; navn/etiketter påvirker ikke; elbil/ladbar hybrid uavhengig av feltene; tom dekning for én profil påvirker bare den; register ↔ profil-dekning; PB-BEN/PB-HEV uten klasse 1; vekt-/dato-estimat, NEDC/20 år/dag 29–31-blokkering og totalene uendret. Eksisterende tester er oppdatert for de nye feltene og per-profil-dekning.

## Kontroller
`npx vitest run` — 34 filer, 781 tester bestått; `npm run typecheck` og lint rene; `node docs/tax/check-docs.mjs` OK. Ikke kjørt: build, e2e, DB.
