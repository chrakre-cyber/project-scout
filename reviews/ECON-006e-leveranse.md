# ECON-006e — fornyelse av syntetiske demodata (levert til uavhengig review, 21.10.2026)

**Task:** ECON-006e (demodatafornyelse etter forslaget, `docs/econ/forslag-demodata-fornyelse.md` med avvikene øverst). Status: DONE innen levert omfang etter review og dokumentkontroll (`reviews/ECON-006e-avslutning.md`). Ikke pilotklarhet, ingen regel-/parametergodkjenning. Økonomiflagg `false`, E7 utsatt, E8 åpent. Ingen hosted migrasjon, deploy, CI-oppsett eller Supabase-implementering.

## Brukerutfall
- Den uendrede appen kan igjen beregne økonomi på demodata: observasjonstidene simuleres 0–48 t før en eksplisitt epoke (standard `SYNTHETIC_DEFAULT_EPOCH = 2026-10-21T06:50:00Z`, valgfri server-only `SCOUT_SYNTHETIC_EPOCH`).
- Søkeskallet viser «Syntetisk generert <dato> — ikke hentet fra leverandør» ved siden av den uendrede «Syntetiske demodata – ikke ekte leverandørdata». Vises ikke når epoken er ugyldig.
- Data utløper som før: 5–7 døgn etter epoken (oppbevaring 604 800 s, uendret kontroll). Ingen rullering.

## Reviewens presiseringer
1. **Epoke ≤ nå, ingen toleranse/justering.** Eksakt nåtid godtas, +1 s avvises; ugyldig/fremtidig epoke ⇒ alle kall feiler `unavailable` («Kilden kunne ikke leses»), ingen fallback, ikke mellomlagret.
2. **Innhold, `sourceModifiedAt` og revisjonskontrakten bevart.** Bare `observed` fornyes. Kandidat-id og revisjon for alle annonser er identiske med baseline tatt FØR endringen (`tests/fixtures/synthetic-identity-baseline.json`, 100+ annonser).

## Endrede filer (kode)
`src/providers/marketplace/synthetic/epoch.ts` (ny: validering, gulv, monoton BigInt-avbildning, merketekst; eneste leser av `SCOUT_SYNTHETIC_EPOCH`), `synthetic/provider.ts` (epoke ved konstruksjon, feiler lukket), `synthetic/normalize.ts` (proveniensmerking; utenfor revisjonsgrunnlaget), `marketplace/index.ts` (ugyldig provider mellomlagres ikke), `src/server/synthetic-label.ts` (ny), `src/app/searches/layout.tsx` (merking, `dynamic = "force-dynamic"`). Ingen endring i økonomi, avgift, avrunding, `classifyBudget`, rettighetsprofil, kandidatadapter eller migrasjoner.
Tester/skript: `tests/synthetic-epoch.test.ts` (19, ny), `tests/fixtures/synthetic-identity-baseline.json`, `tests/architecture.test.ts` (ny miljøvariabel, bare lest i `epoch.ts`), fire eksisterende tester festet til faste datoer med `records: syntheticRawListings`, e2e-skript uten `fresh_observations` (patchen fjernet), `tests/e2e/support/synthetic-epoch.mjs`.
Docs: `FIXTURES.md` § Fornyelse (rutine), README, `.env.example`, TEST_PLAN, forslagsdokumentet, DECISIONS runde 59, MVP_BACKLOG.

## Kontroller (faktisk kjørt av utvikler — ikke review)
- `npx vitest run`: 72 filer / 1 664 tester består. `tsc --noEmit` og `eslint .` uten feil.
- Nettleser, UENDRET app (`SCOUT_SYNTHETIC_EPOCH = nå − 1 t`): `bash scripts/test-e2e-econ006.sh` **94/94** (tidligere 88 + 6 nye) og `bash scripts/test-e2e-econ006d.sh` **26/26**; belegg i `reviews/ECON-006e/`. Nye løp mot samme bygg: utløpt epoke (8 d) ⇒ «kildedataene er for gamle»; fremtidig epoke og «i morgen» ⇒ «Kilden kunne ikke leses»; uten variabel ⇒ standardepoken (forventning utledet fra konstanten, ingen tidsbombe); merkingen synlig.
- `npm run build`, `qa:secrets` (ingen funn; lokal Supabase kjørte ikke ⇒ nøkkelsammenligning hoppet over), `qa:demo`, `scripts/qa-partner-mode.sh` bestått. `check-docs` ble ikke kjørt i denne leveransen. KORRIGERT 21.10.2026: kontrollen finnes som `node docs/tax/check-docs.mjs` (ikke som npm-skript) og er kjørt i fullt repo etter reviewen: bestått, se `reviews/ECON-006e-avslutning.md`.
- Emulator ≠ Supabase; rettighetsavslag kjøres fortsatt mot midlertidige testkopier.

## Begrensninger
1. Standardepoken er en fast konstant: den utløper (siste brukbare ca. 28.10.2026) og må fornyes bevisst eller overstyres; det er ønsket.
2. Spredningen i observasjonstidene er komprimert til 48 t (rekkefølgen bevart); `firstSeenAt` er derfor ikke lenger uker før `lastSeenAt`.
3. Den eldre `Date.now`-baserte klokken i testene er uendret; fire tester bruker uforandret fixturedata med gammel injisert klokke.
4. Ekte Supabase (L1–L7) og hosted (H1–H4) er fortsatt åpne, nødvendige pilotkontroller.

## Neste oppgave
Uavhengig review av ECON-006e; deretter Christians beslutning om Supabase-kontrollene (Trinn L/H).
