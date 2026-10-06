# DEV-005 — leveranserapport

Dato: 07.10.2026 · Branch: `claude/wonderful-bardeen-yussx3` · Status: **DEV-005 READY FOR REVIEW** (ikke DONE; venter på uavhengig kontroll og eventuell hosted smoke-test)

## 1. Task-ID
DEV-005 — manuell, deterministisk søkekjøring for aktiv agent mot den syntetiske `MarketplaceProvider`, med lagret kjøring og resultater.

## 2. Sammendrag og avvik (rapportert før scope-utvidelse)
En innlogget bruker kan åpne en aktiv agent → «Søkekjøringer» → «Kjør søk». Serveren leser kriteriene, kaller providere, matcher i domenet, lagrer kjøringen med kriteriesnapshot og resultater, og viser tidspunkt, status, antall og treff. Kjøringen og resultatene finnes etter reload.

**Avvik fra backlogg-teksten** («Ingestion, stable kilde-ID, revisjoner, pagination og run-logg; samme annonse gir ikke duplikat»): repoets backlogg beskriver delt ingestion med annonse-/revisjonstabeller. Det krever skriving til delte (ikke-tenant) tabeller, dvs. service-role/serverjobb som oppdraget forbyr i normal appflyt, og avklarte rettigheter til å lagre kildedata (OPEN-001/002). Jeg har derfor levert per-firma snapshot-modellen fra oppdraget (DEC-026) og **utsatt** `listings`, `listing_revisions`, `agent_locks` og sjekkpunktkolonner. Kildens stabile ID, paginering (sider, grense, avkorting) og duplikatfjerning innen en kjøring er med; duplikatfjerning *mellom* kjøringer (felles annonsekatalog) er ikke.

## 3. Arkitekturvalg
- **Domene** (`src/domain/matching.ts`, `search-run.ts`): matching, rangering, snapshot-projeksjon, kanonisk JSON. Rent, ingen I/O.
- **Provider**: uendret kontrakt; den syntetiske providerens grovfilter delegerer til domenets `evaluateListing` (DEC-027). Ingen ny provider.
- **Server** (`src/server/search-pipeline.ts`, `search-runs.ts`): provider injiseres; tidsavbrudd (10 s), retry med eksponentiell backoff + jitter (3 forsøk, bare rate_limit/timeout/unavailable), sidegrense (30), validering av providersvar → `malformed_data`, ukjente unntak → `internal` uten tekst; SHA-256 av resultatutdrag.
- **Database**: tabeller, constraints og triggere for tenant, status, idempotens og tellerkonsistens. Ingen matching/domenelogikk i SQL/RPC.
- **UI**: `/agents/[id]/runs`, `/agents/[id]/runs/[runId]`, `RunButton` (klientkomponent, kun `useFormStatus`), lenke fra agentkortet.

## 4. Databaseendringer / migrasjon
Ny migrasjon `supabase/migrations/20261007090000_dev005_search_runs.sql` (ingen eksisterende migrasjon endret). Detaljer i `DATABASE_SCHEMA.md` («Implementert i DEV-005»).

## 5. Søkekjøringsmodell
`search_runs`: agent-ID, agentversjon, forespurt versjon, request_token, provider, status (running/completed/failed), `criteria_snapshot` (utledet av databasen fra agenten: navn, filtre, forutsetninger inkl. salgspris, mva.-grunnlag, avgiftsgrunnlag, minimumsbidrag, reserve), validerte tellere, feilkode, `started_at`/`finished_at`. `search_run_results`: kilde, kilde-ID, rang, treffstatus, ukjente kriterier, hash og minimalt utdrag (ingen annonsetekst/selgerby). Ingen kost-, avgifts-, margin- eller verdiberegning.

## 6. Matching
Kjent avvik → ekskludert; ukjent verdi for satt kriterium → «må kontrolleres»; ellers treff. Merke, modell (likhet), variant (delstreng), årsmodell fra/til, maks km (miles eksakt), drivstoff, girkasse, karosseri, land, maks annonsepris (samme valuta; annen/ustøttet valuta eller manglende pris = ukjent, ingen omregning). Rangering: treff før «må kontrolleres», så nyest først-sett, så kilde-ID.

## 7. Idempotens og samtidighet
Engangstoken per skjema (`unique (agent_id, request_token)`) + delvis unik indeks (én `running` per agent) + selvhelbredelse av kjøringer som henger over 5 min (`failed/abandoned`). Dobbeltklikk gir én kjøring (e2e), 20 samtidige starter gir én (DB-test). Dokumentert i DEC-026.

## 8. RLS / tenant-isolasjon
RLS på begge tabeller; ingen DELETE, ingen UPDATE på resultater; klienten kan ikke sette firma, versjon, snapshot, status ved opprettelse eller tidspunkter. Fremmed og ukjent agent/kjøring gir identisk `42501` (også for avsluttet fremmed kjøring) — ingen sidekanal. Sammensatte FK-er gir siste forsvarslinje. Anon og bruker uten medlemskap blokkert. Ingen service-role.

## 9. UI-endringer
Knapp «Kjør søk» (deaktivert for inaktiv agent; viser «Søker …» under kjøring), historikk, kjøringsside med status/tidspunkter/tellere/kriterier/resultater (paginert, 50 per side), «må kontrolleres» med hvilke kriterier som er ukjente, lenke til eksisterende annonsevisning, tydelig «syntetiske demodata — ikke live». Teksten på `/agents` og aktiveringsmeldingen ble endret fra «automatisk søk ikke koblet til (DEV-005)» til «manuelt søk mot syntetisk kilde; automatisk søk finnes ikke» (e2e fra DEV-004 oppdatert tilsvarende).

## 10. Feilhåndtering
Provider-feil → `failed` med fast feilkode (aldri rå tekst) og norsk melding; kjøringen blir aldri stående som `running` (best-effort markering + 5-min-opprydding). Agent ikke funnet/fremmed → «Fant ikke agenten i ditt firma»; inaktiv; ikke lenger klar; foreldet agentversjon; allerede pågående; tomt resultat; ugyldig providersvar (`malformed_data`); dobbeltforespørsel. Ingen rå DB-feil eller stacktrace i UI.

## 11. Tester faktisk kjørt (fra ren database etter `supabase db reset`)
| Kontroll | Resultat |
|---|---|
| `tsc --noEmit`, `eslint .` | rent |
| Enhetstester (`vitest run`) | 145/145 (nye: `matching` 10, `search-run-domain` 6, `search-pipeline` 10) |
| DB/RLS (`npm run test:db`) | 235/235 (nye: `search-runs` 32; QA-katalogtester utvidet til 5 tabeller, 10 policyer, nye funksjoner/triggere/rettigheter) |
| e2e DEV-005 (`tests/e2e/dev005-search-runs.e2e.mjs`) | 27/27, kjørt flere ganger |
| Migrasjonskjede (`npm run qa:migrations`) | 33/33: ren oppbygging, DEV-002→, DEV-004→, **QA-001-FIX-tilstand → DEV-005 med bevart agentdata (nytt scenario 2c)**, atomisk feil, schema identisk |
| Secret-skann | ingen funn |
| Demomodus (`npm run qa:demo`) | alle kontroller bestått |
| Produksjonsbygg (`npm run build`) | OK, nye ruter med |
| Mutasjoner (lokal DB/domene, ikke committet) | 8 mutasjoner ga røde tester: fjernet tenantbegrensning i kjøringsinnsetting (M1), droppet én-pågående-indeks (M2), fjernet tellerkonsistens (M3), prisfilter uten valutasjekk (M4), fjernet aktiv-sjekk (M5), fjernet tenantbegrensning i resultat-trigger (M6 — **ble først ikke oppdaget** fordi RLS tok samme feil; test for avsluttet fremmed kjøring lagt til, deretter rød), fjernet stale-opprydding (M7), DELETE på resultater (M8) |

## 12. Regresjon
DEV-001–004, QA-001 og QA-001-FIX-testene (inkl. F1/F2/F3-regresjoner, katalog-, isolasjons-, arkitektur- og limit-testene) er grønne. e2e: DEV-002 11/11, DEV-004 22/22, QA-001 app-stier 26/26. `architecture.test.ts` oppdatert for den nye klientkomponenten `RunButton`.

## 13. Endrede filer
Nye: migrasjonen, `src/domain/{matching,search-run}.ts`, `src/server/{search-pipeline,search-runs}.ts`, `src/app/agents/[id]/runs/**`, `src/components/RunButton.tsx`, `tests/{matching,search-run-domain,search-pipeline}.test.ts`, `tests/db/search-runs.test.ts`, `tests/e2e/dev005-search-runs.e2e.mjs`, denne rapporten. Endret: syntetisk provider (delegerer filter), `src/lib/format.ts`, `src/app/agents/{page.tsx,messages.ts}`, `tests/db/{harness,qa-catalog}.test.ts`, `tests/architecture.test.ts`, `tests/e2e/dev004-agents.e2e.mjs` (tekst), `scripts/qa-upgrade-check.sh`, DECISIONS, DATABASE_SCHEMA, ARCHITECTURE, README, MVP_BACKLOG.

## 14. Nye beslutninger
DEC-026 (søkekjøringsmodell, snapshot, idempotens, statusmodell, avvik) og DEC-027 (matching i domenet, ukjent-policy).

## 15. Begrensninger / utsatt
- Ingen delt annonsekatalog/revisjoner/ingestion (se punkt 2), ingen scheduler/cron/n8n, ingen e-post, ingen kost/margin/avgift/verdi, ingen mobile.de.
- Resultatrader skrives med brukerens egen sesjon: en bruker kan forfalske *egne* resultater (ikke andres). Server-/jobbskriving med egen rolle hører til ingestion/DEV-013.
- Resultater avkortes ved 2 000 rader per kjøring (merket `truncated`); provider-sidegrense 30.
- Kjøringen skjer synkront i serverhandlingen (ingen kø); «Pågår»-visning vises bare ved reload dersom en annen fane/forespørsel kjører samtidig.
- Hosted smoke-test av ny migrasjon er **ikke** utført (kun lokal Supabase). Migrasjonen må anvendes hosted av eier.

## 16. Commit og branch
Branch `claude/wonderful-bardeen-yussx3`; commit-hash oppgis i chat-svaret (en rapport kan ikke inneholde sin egen hash).

## 17. Status
**DEV-005 READY FOR REVIEW.** Ikke markert DONE. Neste: uavhengig review + hosted smoke-test; deretter DEV-006 (blokkert av BUS-002) eller avklaring av ingestion-modell (OPEN-001/002).
