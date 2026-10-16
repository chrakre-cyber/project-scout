# TAX-001D — eksternt verifiserte kilder anvendt · rapport (16.10.2026)

**Status: REVIEW. TAX-grunnlaget er IKKE DONE.** Kun dokumentasjon; ingen kode, app, UI, DB, auth eller deploy er endret. Ingen ny websøking. Kalkulatoren er ikke kjørt.

## Før endring: hva pakken kunne lukke / ikke lukke
Lukket: U-004 (gruppe b), U-007, U-001 (delvis), import-mva. sats/grunnlag/tollverdi-sammensetning, bruksfradragets generelle form og at alternativ beregning er bindende, R-DED-001 for videresalg, SVV-kodeverk (ett eksempel), tysk 19 %/§ 4/§ 6/§ 25a. Forble blokkert: kalkulator/klasse 1, gruppe a og vektsatser, satser før 1.9.2026, forskrift §§ 2-3/3-1/3-3, U-002, U-005, U-006, U-008, vrakpant × bruksfradrag, frakt/gebyr/forhandlerdeklarasjon, innførselsanvendelse av elbilregelen, listing-spesifikke fakta.

## Evidensmodell
Nytt nivå **E1X** = eksternt verifisert av Christian/Codex, gitt som sammendrag, ikke lest av Claude, ingen kildefil/hash. Det er ikke E1. Guarden for godkjent parameter og DONE er **uendret** (krever E1, klasse 1, uttrykkelig godkjenning; DONE krever godkjente parametere og klasse 1 per profil).

## Resultat
| | Før (TAX-001C) | Nå |
|---|---|---|
| Regler E1 / E1P / E1X / E2 | 4 / 13 / 0 / 13 (30) | **4 / 13 / 5 / 9 (31)** |
| Godkjente implementasjonsparametere | 0 | **0** |
| Klasse 1 | 0 | **0** |
| Kilder | 32 | 42 (11 nye E1X, T15/T17 oppgradert E2→E1X, T07 fikk eksternbekreftelse ved siden av E1) |
| Tilfeller (k1/k2/k3/k4) | 0/10/38/54 | 0/10/42/56 |
Oppgraderte regler (E2→E1X): R-OTA-012, R-IMP-VAT-003, R-FOR-001, R-FOR-002, ny R-FOR-005. E1P-regler som fikk E1X-funn og beholdt nivå: R-OTA-001/002/008/009/010, R-IMP-VAT-001/002, R-DED-001.

## Datosensitivitet
Gruppe b CO2 (450/600/1 200) er lagt inn som **datert parameter** `DP-CO2-B-2026-09-01` (fra 2026-09-01, før = UKJENT → `not_calculated`). `check-docs.mjs` krever fra-dato, stigende bånd, evidens og eksplisitt «før fra-datoen ukjent», og forbyr godkjenning. Datovakt-tilfeller `C4-VER-B-0831/0901`. Ikke avgjort: styrende hendelse (registrering/innførsel) og trinnvis/marginal beregning.

## Konflikter
Løst: U-004 (gruppe b), U-007. Delvis: U-001. Uløst: U-002, U-003, U-005, U-006, U-008 (se `TAX-001D-evidence-status.md`).

## Kontroller faktisk kjørt
`node docs/tax/check-docs.mjs --pack <kildepakke>`: OK. Negative prøver (6 av 6 feilet som ønsket): E1X-kilde med lesedato, E1X-funn på ikke-E1X-kilde, datert parameter uten «før = ukjent», forsøk på å godkjenne datert E1P-parameter, feil elbil-mva.-aritmetikk, DONE uten parametere/klasse 1. Ingen kode-/appkontroller (ingen kode endret).

## Filer
`docs/tax/{sources,rules,references}.json`, `TAX-001A-rules.md` (generert), `TAX-001D-evidence-status.md`, `check-docs.mjs`, `reviews/TAX-001D.md`, `MVP_BACKLOG.md`. `profiles.json` uendret.
