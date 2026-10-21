# ECON-005 og ECON-006 — avgrenset avslutning (21.10.2026)

Christian aksepterer **avgrenset avslutning av ECON-005 og ECON-006 innen avtalt estimat-/scenariomfang**:

- **ECON-005: DONE innen avgrenset omfang** — «v1 uten `EconomicTarget`»; E7 utsatt (B2); E8 åpent, utsatt arbeid (B3).
- **ECON-006: DONE innen avgrenset omfang** (DoD § 7 i `docs/econ/ECON-006-implementeringsplan.md`, 006a–d med dokumenterte begrensninger); foreslåtte tillegg (E7, historikk, sammenligning, eksport, FX-tjeneste m.fl.) er utenfor.

Belegg: `ECON-005a–d-avslutning.md`, `DATA-002D-avslutning.md`, `ECON-006a–d-avslutning.md`, `ECON-005-006-avstemming-2.md`. Reviewers og utviklerens kontroller er holdt adskilt i hver avslutningsrapport.

## Fortsatt åpne, nødvendige pilotkontroller
- **Ekte Supabase lokalt (L1–L7)** og **hosted testprosjekt (H1–H4)** (`docs/econ/forslag-supabase-kontroll.md`): Auth/JWT, PostgREST-semantikk og -feilkoder, RLS som ordinær bruker, tre uanvendte migrasjoner. Ikke utført; emulatorresultater er aldri Supabase-bekreftelse.
- Godkjente økonomiregler/parametere (flagg `false`; U-013 m.fl.), port (a) før partnerdemo, CI med gyldne fixturer (port g).

## Det avslutningen IKKE er
Ikke pilotklarhet. Ikke godkjenning av regler eller parametere. Ikke tillatelse til hosted migrasjon, deploy eller betalt tjeneste. Økonomiflaggene er `false`.
