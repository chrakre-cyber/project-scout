# ECON-006c — avslutning (20.10.2026)

**ECON-006c er DONE som avgrenset testleveranse** (Christians aksept): nettleserforløp for forhandlerskjema, firmaprofil, lagring og gjenåpning, diesel/PHEV/BEV, manglende opplysninger, utløpt kurs, foreldet bekreftelse, rettighetsavslag, firmaskille, rå identitet og fravær av positive budsjettutfall — utført mot den bygde appen med Auth/PostgREST-**emulator** og isolert PostgreSQL. Dette er **ikke** en bekreftelse av ekte Supabase-integrasjon, ikke pilotgodkjenning, og ikke DONE for ECON-005 eller ECON-006 som helhet. Økonomiflaggene er `false`.

## Utviklerens kjøring (ikke review)
`bash scripts/test-e2e-econ006.sh`: 88/88 sjekker (`reviews/ECON-006c/e2e-resultat.txt`, `e2e-run-green.log`), mutasjonskjøring som fanger to injiserte feil, 18 skjermbilder. Utviklerens vitest 70 filer / 1 633 tester, `tsc`, `eslint`, `check-docs`, `npm run build`, `qa:secrets`, `qa:demo`.

## Reviewerens egne kontroller (`reviews/ECON-006c-review-b2f57b2.md`)
Manifest 615/615; **68 filer / 1 507 tester består** (de to kildeavhengige filene `tax-engine` og `economics-source-driven` ikke kjørt — primærkilder utelatt); `tsc` og `eslint` består; **148 filer under `src/` er byte-identiske med dfeff44** (ingen ny produksjonskode i 006c); gjennomgang av e2e-skript, emulator, referansearitmetikk, logger og stikkprøver av skjermbilder. **Reviewer har IKKE kjørt nettleserskriptet** (krever isolert PostgreSQL og nettleseroppsett som ikke fantes i reviewøkten) og har ikke kjørt build, `check-docs`, `qa:*`, PostgreSQL, Supabase/PostgREST/GoTrue, hosted migrasjon eller deploy. Utviklerens 88/88 og 1 633 tester er derfor ikke selv bekreftet av reviewer.

## Begrensninger som følger avslutningen
1. Ekte Supabase (Auth/JWT, PostgREST-semantikk og -feilkoder, migrert hosted miljø) er **ikke** kontrollert — separat, nødvendig kontrollpunkt før pilot (`docs/econ/forslag-supabase-kontroll.md`).
2. Hovedløpet bruker en testkopi med friske observasjonstidspunkt; den uendrede demoen feiler lukket (utløpt kildedata siden 11.10.2026). Utløpskontrollen skal ikke svekkes (`docs/econ/forslag-demodata-fornyelse.md`).
3. Endret revisjon og endrede rettigheter er **simulert** i testdatabasen (midlertidig avslått trigger), ikke gjennom faktisk endring av leverandørdata/rettighetsprofil i appen; domenetester supplerer.
4. Ikke prøvd i nettleser: øvrige rettighetsvarianter, forfalsket server-action-POST ved nektet rett, andre nettlesere, ekte mobil, skjermleser.
5. Datoer er relative til kjøredato, beregningsomfanget er 2026.
