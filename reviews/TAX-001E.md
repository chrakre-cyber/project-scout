# TAX-001E — lukking av eksternt verifiserte konflikter · rapport (16.10.2026)

**Status: REVIEW. TAX-grunnlaget er IKKE DONE.** Kun dokumentasjon og dokumentkontroll. Ingen kode, app, UI, DB, auth eller deploy endret. Ingen ny websøking. Kalkulatoren ikke kjørt.

## Forventede lukkinger før endring
U-004 (A/B skilt), U-006 (2 130,70/kg), U-001 så langt gruppe b-endringen 2026-09-01 dokumenterer. U-005 innsnevret men åpen (10 % vektfradrag-motsigelsen er ikke adressert; ×1,24 er NEDC-faktor). U-002/U-003/U-008 åpne. U-007 var allerede lukket.

## Resultat
Se `docs/tax/TAX-001E-evidence-status.md` for tall, A/B-datotabell og konflikttabell. Alle nye fakta er E1X; ingen E1X→E1 (ingen kildefil/hash). Ingen klasse 1-referanser. Ukjent forblir ukjent: gruppe b vektsats fra 2026-09-01, alle satser før 2026-01-01.

## Endringer i valideringen (`check-docs.mjs`)
- E1X-funn kan bygge på E1-kilde med `externalVerification`.
- Datoerte parametere: `afterTo` kreves når `to` er satt; «dekket av DP-…» må peke på tilstøtende parameter (til + 1 dag = fra) i samme serie; gruppe-b-regel kan ikke ha gruppe-a-parameter og omvendt; vektparametere krever `thresholdKg`+`rate`; `state` på uløste konflikter må være open/closed.

## Negative tester (kjørt på kopier av docs/tax)
Gruppe b-parameter i gruppe a → feil; til-dato uten afterTo → feil; hull i serien → feil; vektsats 0 → feil; ugyldig U-state → feil; datert parameter markert godkjent → feil; foundationStatus DONE uten grunnlag → feil; E1X-regel uten funn → feil. Hovedkjøring `node docs/tax/check-docs.mjs --pack /tmp/claude-0/pk` → OK.

## Begrensninger
Ingen E1X er verifisert av Claude. Nettverkspolicy blokkerer primærkilder. Ingen godkjent parameter, ingen klasse 1.
