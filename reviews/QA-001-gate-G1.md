# QA-001 — Gate G1

Dato: 06.10.2026 · Branch: `claude/wonderful-bardeen-yussx3` · Kontrollert commit: `055b162` (DEV-004) + QA-filer i denne leveransen

**Gate G1: PASS** — ingen åpne P0 eller P1. Tre åpne P2-funn (F1–F3) og tre P3 anbefales rettet i en liten oppfølging før DEV-005 går videre mot ekte data. Se «Gate-konklusjon» for hva som er avhengig av din vurdering.

**QA-001 står som REVIEW, ikke DONE.** QA er utført av samme verktøy (Claude Code) som skrev DEV-001–004, i samme sesjon. Det er ikke en kontrollør uten tilknytning til implementasjonen (CLAUDE.md pkt. 15). Jeg har derfor skrevet testene som angrep, ikke som bekreftelse, og bevist at de kan feile (se «Testmutasjoner»). Endelig godkjenning av gaten ligger hos produkteier.

## 1. Scope

Gate-definisjonen i repoet (ROADMAP G1; MVP_BACKLOG QA-001; TEST_PLAN «Agentflyt» og «Firmatilgang»): login, agent opprett/rediger/pause, 10-grense og firmatilgang kontrollert; isolasjon og agentgrense dokumentert; feil lukket. Ingen motstrid mellom dokumentene.

Kontrollert: tenant-/firmaisolasjon, RLS og autorisasjon, maks 10 aktive (atomisk), agentvalidering og aktivering, databaseconstraints, penge-/bigint-grensen (R5), optimistic locking, migrasjonskjede (ren og oppgradering), demomodus og DEV-003-regresjon, secrets, regresjon DEV-001–004.

Ikke kontrollert (utenfor scope eller ikke mulig): hostet Supabase (se pkt. 14), gjenoppretting fra backup (QA-004), ytelse/last, andre nettlesere enn Chromium, Auth-rategrenser og passordregler på hostet prosjekt, Realtime/Storage-konfigurasjon på hostet prosjekt.

## 2. Testmiljø

| Del | Versjon |
|---|---|
| Node / npm | 22.22.0 / 10.9.4 |
| Next.js / React / TypeScript | 16.3.8 / 19.3.0 / 5.9.3 |
| Supabase CLI | 2.119.0 |
| Lokal stack (Docker 29.6.2) | Postgres 17.11.0.002, GoTrue v2.197.0, PostgREST v16.4, Kong 2.8.1. Studio, Storage, Realtime og Edge Functions er slått av |
| Nettleser | Chromium 1194 via Playwright 1.56.1 |
| Data | Syntetisk. Testbrukere med tilfeldige passord opprettes og slettes av testene. To syntetiske seed-firma |

Alt er kjørt mot lokal stack. `assertLocal()` stopper DB-testene mot ikke-lokale verter. Ingen service-role-nøkkel er brukt: oppsett skjer som databaseeier (tilsvarer prosjekteiers SQL-editor), og alle tilgangspåstander som ordinære innloggede brukere via Auth + Data API.

## 3. Tester faktisk kjørt

Endelig kjøring fra ren database (`db reset`), på uendret kode etter at mutasjonene var gjenopprettet:

| Kontroll | Resultat |
|---|---|
| `npm run typecheck` | 0 feil |
| `npm run lint` | 0 advarsler |
| `npm test` (enhet, 9 filer) | **105/105** |
| `npm run test:db` (6 filer) | **195 bestått + 2 forventede feil** (`it.fails`-vakter for F1 og F2) = 197 |
| `npm run qa:migrations` | **17/17** kontroller |
| Nettleser e2e `dev002-auth` | 11/11 |
| Nettleser e2e `dev004-agents` | 23/23 |
| Nettleser e2e `qa001-app-paths` | 19 OK + 7 kjente F4-treff (se F3) |
| `npm run qa:secrets` | 21/21, ingen funn |
| `npm run qa:demo` | 23/23 |
| `npm run build` | OK |

Nye QA-filer: `tests/db/qa-{isolation,limit,validation,catalog}.test.ts` (137 tester), `tests/architecture.test.ts` (10), `tests/e2e/qa001-app-paths.e2e.mjs`, `scripts/qa-{upgrade-check,secret-scan,demo-mode}.sh`.

Feil jeg selv gjorde underveis i QA-leveransen (ikke produktfeil): en typefeil i min egen testfil som fikk `npm run build` til å feile, og som jeg først ikke så fordi jeg skjulte build-utdata; verdiløse sjekker i demo-skriptet (en tom «ok» = «ok»-sjekk, og en portsjekk via `ss`, som ikke finnes i miljøet og derfor alltid ga «ledig»). Alle er rettet, og skriptene har nå sjekker som kan feile.

## 4. Resultater i korte trekk

Alle gate-kriteriene er oppfylt (pkt. 13). Fire ting krevde nærmere ettersyn og ga funn: sidekanal i grensetriggeren (F1), grensen under REPEATABLE READ (F2), HTTP 500 på spørringsparametre (F3) og mindre paritetsforskjeller (F4). Ingen av dem gir lesing eller skriving av andre firmas rader.

## 5. Tenant-/RLS-resultater

Symmetrisk A→B og B→A (`qa-isolation.test.ts`, 18 tester, og e2e). Alle bestått:

- A leser egne firmaopplysninger, medlemskap og agenter.
- A kan ikke lese Bs agent: ikke via ID, ID-liste, `neq`, `or`-filtertriks, `limit`, telling, eller embeds fra tre retninger (members→dealerships, dealerships→agents, agents→dealerships).
- A kan ikke endre, aktivere eller pause Bs agent (enkelt, bulk). Bs data er byte-for-byte uendret (full radsammenligning før/etter).
- A kan ikke flytte egen agent til B, opprette agent for B (enkelt, batch, upsert), eller slette.
- Medlemskap og firma kan ikke opprettes, endres eller slettes av bruker.
- Manipulasjon: `user_metadata` med firma-ID og `role: service_role` gir ingen tilgang. Forfalsket JWT (endret `sub`), usignert (`alg: none`) og avkortet signatur gir 401. Private skjema og `admin_*`/`my_dealership_ids` kan ikke nås via Data API (`PGRST106`).
- Anon: 42501 på alle tabeller, ingen tabeller i OpenAPI-oversikten. Bruker uten medlemskap: tomme resultater, 42501 ved opprettelse.
- Sesjon: etter utlogging avvises tokenet av `auth.getUser` (som appen bruker), og gamle cookies gir anonym visning i appen.
- App- og serverstier (e2e): anonym direkteadgang til `/agents/new` og `/agents/<uuid>` omdirigeres uten datalekkasje. A→B og B→A via URL gir 404. Manipulert opprettelse med `id` satt til Bs agent, og skjult `dealership_id`/`active`/`version`, påvirker ikke B og gir agent i eget firma, ikke aktiv, v1.
- **RLS er den autoritative grensen:** med *all* applikasjonsfiltrering på firma fjernet (mutasjon A2) var begge e2e-skriptene fortsatt grønne.
- Katalogen (`qa-catalog`): RLS på alle tabeller (vakt for fremtidige), ingen views/funksjoner i `public`, anon/PUBLIC uten rettigheter, nøyaktig forventede tabell- og kolonnerettigheter for `authenticated`, bare fem policyer (alle `authenticated`, ingen `true`, ingen JWT-metadata), alle `private`-funksjoner med fast `search_path`, bare to `SECURITY DEFINER`, `admin_*` ikke kjørbare av noen rolle utenom eier.

## 6. Grensen på 10 aktive

Alle bestått (`qa-limit.test.ts` + DEV-002/004-testene):

- 9→10 virker. 11. avvises (insert og update). Pause frigjør plass. Reaktivering virker.
- **Batch i ett kall:** 11 aktive rader i én INSERT og 11 pausede i én UPDATE gir 23514 og 0 endrede rader (setningen rulles tilbake). Dette var ikke dekket tidligere.
- Bred UPDATE mot alle firmaets agenter overskrider ikke. Upsert kan ikke brukes (ingen UPDATE-rett på `dealership_id`).
- **Samtidighet:** 24 samtidige aktiveringer fra 4 sesjoner (2 brukere i samme firma), 3 runder, gir nøyaktig 10 og 14 avvisninger. Blandet INSERT+UPDATE mot siste plasser gir 10. To firma aktiverer 10 hver samtidig uten å blokkere hverandre. Pause og aktivering i samme øyeblikk holder seg ≤ 10.
- **Transaksjonsisolasjon, to transaksjoner om siste plass:** READ COMMITTED (standard for Data API) → 10. SERIALIZABLE → serialiseringsfeil 40001, 10. **REPEATABLE READ → 11 (funn F2).**
- Grensen er håndhevet i databasen. Ingen telling i klienten er autoritativ. Uten radlåsen (mutasjon M10) feiler samtidighetstestene.

## 7. Valideringsresultater

- **Differensialtest (400 seedede utkast):** domenevalideringen og databasen sendes samme utkast. Resultat: 99 gyldige (57 aktiverbare, 42 blokkerte), 283 ugyldige, 18 i den dokumenterte årsgapet. Databasen var enig i *hvert* tilfelle om gyldighet og aktivering. Ingen annen feilkode enn 23514 for ugyldig input. Testen har dekningsvakter, og en første versjon feilet vakten (alle utkast ugyldige) før jeg rebalanserte generatoren.
- **`NULL` i `broadSearchConfirmed` er lukket og kan ikke omgås via direkte API:** nøkkel mangler, JSON null, `false`, streng «true», tall 1 og objekt avvises som aktiv. `true` med ett kriterium godtas. Bekreftet uten kriterium, og med NULL-kriterier, avvises. Funksjonene `agent_ready`/`agent_filters_valid`/`agent_assumptions_valid` returnerer aldri NULL for 100 kombinasjoner av søppelinput. Å gjeninnføre feilen (M13) gir røde tester.
- Gyldig smal, bare merke, bekreftet bred med kriterium, bred uten bekreftelse, «alle» på alt, snudde årsintervaller, ugyldig km, ugyldig valuta, null/ukjent, manglende økonomi (9 varianter), reserve 0 kr: alle dekket og i samsvar mellom server og database.

## 8. Migrasjonsresultater

`npm run qa:migrations` (17 kontroller):

- Ren oppbygging: begge migrasjoner anvendes i rekkefølge, seed gir 2 firma/0 brukere/0 agenter, RLS på alle tabeller. Ingen manuelle dashboard-endringer er nødvendige.
- **Oppgradering fra DEV-002 med agentdata:** UI-agent og agent med pris i DEV-002-format beholdes uendret (pauset, v1). Aktive agenter uten krav pauses (versjon øker). Ingen slettes. **Schema etter oppgradering er identisk med ren oppbygging** (`pg_dump`, 842 linjer, bortsett fra pg_dumps tilfeldige `\restrict`-token).
- **Feilscenario:** DEV-002-data som bryter DEV-004-reglene stopper migrasjonen atomisk uten delvis anvendelse (ingen nye funksjoner, DEV-002-constraint intakt, migrasjonen ikke registrert, data uendret). Se F5.
- Databasen kan resettes og bygges opp igjen reproduserbart (kjørt mange ganger).

## 9. Secret scan

`npm run qa:secrets` (21 kontroller, ingen funn). Dekker: `.env.local`/`.env` gitignorert og aldri i historikken, `.env.example` uten verdier, mønstersøk i sporede filer, **hele git-historikken (alle commits og grener)**, untracked filer, rapporter, `.next/static` og `.next/server`, og ordsøk etter `service_role`/`sb_secret` i `src/` og klientbundle. Søker også etter de **faktiske lokale nøkkelverdiene** (secret key, service-role-nøkkel, JWT-secret, anon- og publishable-nøkkel) i sporede filer, historikk og build, uten å skrive dem ut. Mobile.de-credentials: ingen. Skriptene sender ikke ut verdier.

Publishable-nøkkelen (offentlig av design) finnes i serverbundelen, men ikke i klientbundelen og ikke i git. Scriptene mine hadde to egne treff (selvtreff i skannemønsteret og et hardkodet lokalt standardpassord i `qa-upgrade-check.sh`), rettet ved at tilkoblingen nå utledes fra `supabase status`. Kanarifiler med falske verdier ble fanget på alle seks plasseringer og fjernet.

## 10. Regresjonsstatus DEV-001–004

| Oppgave | Status | Belegg |
|---|---|---|
| DEV-001 | Grønn | Demo uten Supabase: banner, 24 kort, detaljside, «ikke beregnet», inaktiv demoannonse (`qa:demo`) |
| DEV-002 | Grønn | 18 DB-tester + e2e 11/11 |
| DEV-003 | Grønn | 15 providertester + normalisering + e2e/`qa:demo`: dashboard, detaljside, USD uten krasj, «først sett» merket syntetisk, simulert kildefeil vises uten krasj. `architecture.test.ts`: provider-abstraksjonen bevart, ingen mobile.de-adapter, ingen live-påstander (alle omtaler er negasjoner) |
| DEV-004 | Grønn | 42 DB-tester + e2e 23/23 + 10 agentoppsett (S01–S10) |

`architecture.test.ts` (10 tester) vokter modulgrenser: domene uten UI/provider/server/Supabase, provider uten UI/server, UI bruker annonser bare via provider-kontrakten, `@supabase/*` bare i `src/lib/supabase` og `src/proxy.ts`, klientkomponenter uten servermoduler, bare tre miljøvariabler lest og ingen hemmelige.

## 11. Funn med severity

Ingen P0. Ingen P1.

### F1 — P2 — Sidekanal på tvers av firma via grensetriggeren (DEV-002)

Triggeren `enforce_active_agent_limit` er `SECURITY DEFINER` og kjører **før** RLS `WITH CHECK`. En bruker i firma A som kjenner Bs firma-UUID kan sette inn en agent med `dealership_id = B` og `active = true`. Svaret er `23514 active_agent_limit` hvis B har 10 aktive agenter, og `42501` ellers. Dermed kan A lese «B har 10 aktive agenter». Ingen rader leses eller skrives, og angriperen trenger en UUID som ikke vises noe sted for andre firma.

- **Reproduksjon:** bruker i A: `insert into search_agents (dealership_id=<B>, name, filters, assumptions, active=true)`. Mot B med 10 aktive: 23514. Mot B med færre: 42501. Mot ukjent firma: 42501. Vakt: `qa-limit.test.ts` «A får samme feil …» (`it.fails`).
- **Hvorfor P2 og ikke P1/P0:** én bit avledet informasjon, krever en UUID angriperen ikke kan gjette, ingen radtilgang. Rubrikkens P0 («cross-tenant read») og P1 («sikkerhetsregel kan omgås») kan leses strengt slik at dette teller. Se «Gate-konklusjon».
- **Rettelse (validert lokalt, ikke committet):** i triggeren, før telling og lås, avvis med 42501 når `auth.uid()` er satt og firmaet ikke er brukerens. Direkte databasekall uten bruker påvirkes ikke. Med rettelsen anvendt ble alle 195 øvrige DB-tester grønne, og kun F1-vakten ble rød (som den skal). Ferdig SQL: se «Foreslått retting». Krever ny migrasjon som du må kjøre på hostet prosjekt.

### F2 — P2 (latent) — Grensen kan overskrides under REPEATABLE READ (DEV-002)

Telling i triggeren bruker transaksjonens eldre snapshot. To REPEATABLE READ-transaksjoner om siste plass ender med **11** aktive (verifisert). READ COMMITTED og SERIALIZABLE holder 10. Kommentaren i DEV-002-migrasjonen («under REPEATABLE READ … serialiseringsfeil») er feil.

- **Ikke nåbart for ordinære brukere:** Data API kjører READ COMMITTED, og ingen rolle har konfigurert annen isolasjon (kontrollert i `qa-catalog`). Det blir relevant hvis serverkode (DEV-005+) kjører aktivering med direkte tilkobling og høyere isolasjon.
- **Anbefalt:** en vakt i triggeren som avviser aktivering når `transaction_isolation = 'repeatable read'`, og retting av kommentaren. Vakt i testene: `it.fails` i `qa-limit.test.ts`.

### F3 — P2 (lav praktisk risiko) — HTTP 500 på spørringsparametre (DEV-004)

`/agents?error=__proto__` (også `constructor`, `toString`, `hasOwnProperty`) og `?msg=__proto__|constructor|toString` gir 500 for innlogget bruker. Meldingsoppslaget `AGENT_MESSAGES[error]` treffer `Object.prototype`, og React kan ikke vise funksjon/objekt. Bare brukerens egen side, ingen datalekkasje, men en lenke kan gi en innlogget bruker feilside.

- **Rettelse (validert lokalt, ikke committet):** `Object.hasOwn(...)` på begge oppslag i `src/app/agents/page.tsx`. Med den ble alle 7 treff «FIKSET» i e2e. Vakt: «KJENT F4»-merking i `qa001-app-paths.e2e.mjs` (merket skifter til «FIKSET» når rettet).

### F4 — P3 — Databasen er mer tillatende enn serveren i noen kanttilfeller

Aldri strengere (som ville vært et funksjonelt problem), og aldri svakere for aktiveringskravene.
- Årsmodell 2028–2100 godtas av databasen (serveren: høyst inneværende år + 1). Dokumentert i DEC-024.
- Navn som bare består av NBSP/tab godtas av databasens `btrim` (bare mellomrom); serveren avviser. Gir et «usynlig» navn ved direkte API-kall.
- Null-tegn (`\u0000`) i tekst avvises av databasen med annen feilkode (22P05/22021) enn de andre, og appen viser da den generelle «Lagring feilet».

### F5 — P3 — Oppgradering kan stoppes av eldre data (DEV-004)

Migrasjonen stopper (atomisk, uten delvis anvendelse) hvis DEV-002-agenter har JSON som bryter DEV-004-reglene, f.eks. `preparationReserve` lagret som beløpsobjekt. UI i DEV-002 skrev bare `{}`, og hostet prosjekt er allerede oppgradert (verifisert av produkteier). Kun informasjon for eventuelle andre miljøer.

### F6 — P3 — Hygiene

- `npm audit`: **0 sårbarheter i produksjonsavhengigheter.** 5 «high» i lint-verktøyet (`eslint-config-next` → `braces`), kun utvikling. Dette er R9 fra DEV-001 og kan lukkes som akseptert risiko.
- `vitest.config.ts`/`vitest.db.config.ts` skriver «ESM syntax in a file loaded as CommonJS». Ufarlig; unngås med `"type": "module"` eller `.mts`.
- Backloggen hadde fortsatt DEV-004 som REVIEW (oppdatert i denne leveransen).

### Observasjoner (ikke funn)
- `service_role` har full tilgang til tabellene (Supabase-standard, omgår RLS). Den finnes ikke i appen, og skannet bekrefter det.
- Alle medlemmer av et firma deler agentene (ingen eierskap per bruker). Dette følger av DATABASE_SCHEMA.
- Data API-tokens (JWT) er statiske til de utløper (standard 1 time). Appens server-validering (`getUser`) avviser tilbakekalte sesjoner (testet). At Data API selv godtar gamle tokens til utløp er ikke testet.

## 12. Eventuelle blockers

Ingen blockers for lokal gate. Hosted: se pkt. 14.

## 13. Gate-konklusjon

| Kriterium | Resultat |
|---|---|
| Alle kritiske RLS-/tenanttester består | Ja (18 + 60 + 15 DB-tester, e2e). Se F1 for en sidekanal uten radtilgang |
| 10-grensen er atomisk og verifisert | Ja for alle nåbare stier (batch, samtidighet, flere sesjoner/brukere, READ COMMITTED, SERIALIZABLE). Latent for REPEATABLE READ (F2) |
| Agentvalidering kan ikke omgås | Ja (differensialtest 400 + NULL-tester + 100 funksjonskombinasjoner) |
| Migrasjonskjeden er reproduserbar | Ja (ren, oppgradering, atomisk feil, schema-likhet) |
| Ingen kritiske regresjoner | Ja |
| Ingen secrets eksponert | Ja (21 kontroller, hele historikken) |
| DEV-001–004 grønne | Ja |

**G1 PASS — DEV-005 kan starte.** Forutsetninger og forbehold:

1. **Din vurdering av F1.** Jeg har klassifisert F1 som P2. Hvis du leser rubrikken strengt (cross-tenant lesing, om enn én bit), er F1 P1 og gaten **FAIL** til rettelsen er migrert. Rettelsen er validert og liten.
2. Jeg anbefaler å rette F1–F3 i én liten oppfølging (forslag i backloggen) før DEV-005 introduserer serverjobber og ekte data.
3. QA er utført av samme verktøy som skrev koden; endelig godkjenning hos produkteier.

## 14. Hostet Supabase

**Hosted smoke test — externally verified by product owner.** Innlogging, firma, opprettelse, redigering, aktivering, pause og reaktivering inkludert at tilstanden består etter reload, er verifisert manuelt av produkteier. Jeg har ikke hosted credentials, har ikke forsøkt å få tak i dem og har ikke kjørt noe mot hostet prosjekt. Ingen av resultatene over er hosted-resultater. Rettelse F1 krever at migrasjonen kjøres på hostet prosjekt.

## Testmutasjoner

Midlertidige mutasjoner, alle gjenopprettet (`db reset` / `git checkout`) og **ikke committet**. Hver mutasjon ga røde tester, bortsett fra A2, som med hensikt skulle forbli grønn:

| # | Mutasjon | Røde tester |
|---|---|---|
| M01 | SELECT-policy på `search_agents` åpen | 9 |
| M02 | UPDATE-policy åpen | 1 (katalogtesten) — atferden er maskert av SELECT-policyen, se under |
| M02b | SELECT- og UPDATE-policy begge åpne | 13, inkludert «kan ikke endre, aktivere eller pause» og «data uendret» |
| M03 | INSERT-policy åpen | 12 |
| M04 | SELECT-policy på `dealerships` åpen | 9 |
| M05 | `my_dealership_ids()` returnerer alle firma | 17 |
| M06 | RLS slått av på `search_agents` | 18 |
| M07 | UPDATE-rett på `dealership_id` gitt til `authenticated` | 4 |
| M08 | SELECT gitt til `anon` | 3 |
| M09 | Aktiv-trigger droppet | 11 |
| M10 | Grensetrigger uten firmalås | 3 (samtidighet) |
| M11 | Grense 11 i stedet for 10 | 10 |
| M12 | Aktiveringskrav (`ready`-constraint) droppet | 13 |
| M13 | NULL-feilen gjeninnført i `agent_ready` | 3 |
| M14 | Filter-constraint droppet | 38 |
| M15 | Pengegrense: 2^53 godtas | 5 |
| M16 | Versjon-/firmabytte-trigger droppet | 2 |
| A1 | App: versjonskontroll fjernet i `updateAgent` | e2e avbrøt (ingen konfliktmelding) |
| A2 | App: all firmafiltrering fjernet, bare RLS | **e2e fortsatt grønn** (bevis for at RLS er autoritativ) |
| Kanari | Arkitektur: seks regelbrudd (Supabase i komponent, servermodul i klient, synthetic i UI, UI i domene, mobile-de-mappe, live-tekst) | 6 røde |
| Kanari | Secret-skann: falske nøkler i seks plasseringer | 6 røde |

M02/M01 viser forsvar i dybden: hver av SELECT- og UPDATE-policyene alene maskerer en svekkelse av den andre, fordi Postgres krever SELECT-synlighet for `UPDATE … WHERE`. Katalogtesten fanger policyene direkte, og atferdstestene fanger det når begge svekkes.

## Foreslått retting (ikke committet)

**F1** — ny migrasjon som erstatter `private.enforce_active_agent_limit()` med samme funksjon der dette settes inn rett etter de to tidlige `return`-linjene og før `perform 1 from public.dealerships …`:

```sql
if (select auth.uid()) is not null and new.dealership_id not in (select private.my_dealership_ids()) then
  raise exception 'new row violates row-level security policy for table "search_agents"' using errcode = '42501';
end if;
```

**F2** — i samme funksjon, først: `if current_setting('transaction_isolation') = 'repeatable read' then raise exception 'active_agent_limit krever read committed eller serializable'; end if;`. Ikke validert (kun F1 og F3 er validert).

**F3** — i `src/app/agents/page.tsx`: bruk `Object.hasOwn(AGENT_MESSAGES, error)` og `Object.hasOwn(SUCCESS_MESSAGES, msg)` før oppslag.

Når rettelsene er gjort: fjern `.fails` fra F1- og F2-vaktene og «known»-merkingen for F4/F3 i e2e.

## Kommandoer for å gjenta

```bash
npx supabase start && npx supabase db reset
npm run typecheck && npm run lint && npm test && npm run test:db
npm run qa:migrations && npm run qa:secrets && npm run qa:demo
# e2e (bygg med .env.local mot lokal stack, `next start -p 3100`):
PW=<playwright> PG=$PWD/node_modules/pg DB_URL=<lokal DB_URL> node tests/e2e/qa001-app-paths.e2e.mjs
```
