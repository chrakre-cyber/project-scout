# Datamodell — logisk spesifikasjon

03.10.2026. Utvikler lager versjonerte SQL-migrasjoner for dette oppdraget; denne filen inneholder ikke kjørbar SQL. MVP har én membership per bruker, men egen membership-tabell gjør tilgang tydelig.

## Entiteter

| Tabell | Nøkkelfelt | Integritetskrav |
|---|---|---|
| dealerships | id UUID, name, settings, created_at | Firmainnstillinger er private |
| dealership_members | user_id FK til Auth, dealership_id FK | user_id unik i MVP; membership settes av kontrollert serverprosess |
| search_agents | id, dealership_id, name, filters JSONB, assumptions JSONB, active, version, last_success_at | Filtre valideres; maks 10 aktive per firma atomisk; version øker ved endring |
| listings | id, source, source_listing_id, original_url, first_seen_at, last_seen_at, source_modified_at, current_revision_id, availability_status | Unique(source, source_listing_id); «ny i Scout» skilles fra kildeopprettelsesdato |
| listing_revisions | id, listing_id, content_hash, normalized_data, observed_at, rights_version | Unique(listing_id, content_hash); kildepresisjon og prisgrunnlag beholdes |
| vehicles | id, listing_id, revision_id, normalized_specs | Normalisert bil per kildeannonse/revision; ingen usikker cross-market VIN-dedup i MVP |
| opportunities | id, dealership_id, agent_id, listing_id, current_calculation_id, match_status, evaluation_status | Unique(agent_id, listing_id); composite FK hindrer at agent tilhører annet firma |
| calculations | id, opportunity_id, dealership_id, agent_version, listing_revision_id, input_snapshot, output_snapshot, rule_version, created_at | Immutable; money/enheter, skatteprofil, kurs, transport og warnings i snapshot |
| listing_analyses | id, listing_revision_id, prompt_version, model_version, analysis, status, created_at | Deles kun i avtalt behandlingsscope; cache nøkkel inkluderer tenant hvis rettigheter krever det |
| search_runs | id, dealership_id, agent_id, status, checkpoint_before, checkpoint_after, counts, error_code, started_at, finished_at | Ny checkpoint bare ved fullført lagring; truncation og feil beholdes |
| notifications | id, dealership_id, agent_id, listing_id, calculation_id, notification_type, recipient, state, idempotency_key, provider_message_id, attempts | Unik initial-key per agent/annonse; pending/sending/sent/failed/delivery_unknown |
| agent_locks | agent_id, lease_until, run_id | Atomic lease og expiry; ingen overlapping av samme agent |
| rule_sets | id, profile, valid_from, valid_to, version, source_refs, config, validation_status | Uvalidert/utløpt profil kan ikke gi pilotmargin |

Auth-provider eier brukeridentitet. Ikke lag en separat passordtabell. Firmaets norske salgspris og margin lagres på agent/kalkyle; de er aldri globale egenskaper ved bilen.

## Penger, datoer og forutsetninger

Penger lagres som heltall i minste valutaenhet eller presis decimal, med eksplisitt valuta. Velg én representasjon i migrasjonen. Ikke bruk binært floating point for avgiftsberegning. JSON-snapshots representerer beløp presist som integer/string i samme avtalte format.

UTC for timestamps; vis Europe/Oslo i UI. Førsteregistrering lagres med kildens dato-/måned-/årspresisjon. Dato for planlagt norsk registrering er eget inputfelt.

`assumptions` inneholder: retail med price basis, minimum bidrag, klargjøringsreserve med mva.-basis, skatteprofil, kurs-ID/dato, transportprofil, forsikring og eventuelle manuelt bekreftede avgiftsinput. Schema valideres server-side før lagring.

## Tilgang

- dealership, membership, agent, opportunity, calculations, runs og notifications: RLS for eget firma, ingen direkte browsertilgang til jobblåser eller outbox-mottakere.
- membership kan ikke endres fritt av en innlogget kunde.
- globally cached listings er serverstyrt. Browser får kun annonser via autoriserte opportunities eller eksplisitt godkjent søk, med felter som avtalen tillater.
- analyser deles bare når vilkår/personvern tillater det; minst mulig selgerkontaktdata sendes til LLM.
- composite forhold mellom agent, opportunity, calculation og notification valideres i DB eller tilsvarende sterke constraints; ikke bare i UI.

## Implementert i DEV-002

Migrasjon `supabase/migrations/20261005090000_dev002_tenancy_and_agents.sql` lager `dealerships`, `dealership_members` og `search_agents`. Øvrige tabeller lages i oppgavene som tar dem i bruk (DEC-022).

- **Nøkler og constraints:** `dealership_members.user_id` er primærnøkkel (én membership per bruker) med FK til `auth.users`. `search_agents` har `unique (id, dealership_id)` for senere sammensatte FK-er. Navn har lengdegrense, JSON-feltene må være objekter, og penger i JSON må ha formatet i DEC-020.
- **Triggere:** `version` settes til 1 ved opprettelse og økes ved endring av navn, filtre, forutsetninger eller aktiv-status. `dealership_id` kan ikke endres. Maks 10 aktive per firma håndheves i trigger med radlås på firmaet (atomisk under samtidighet).
- **RLS:** aktivert på alle tre tabellene. `authenticated` kan lese eget firma og eget medlemskap, og lese, opprette og endre agenter i eget firma (kolonnevise rettigheter; ikke `version`, `last_success_at` eller tidsstempler, ingen DELETE). `anon` har ingen tilgang. Medlemskap og firma kan ikke skrives fra klienten.
- **Administrasjon:** `private.admin_create_dealership(name)` og `private.admin_add_member(email, dealership_id)` kan bare kjøres av databaseeier. Skjemaet `private` er ikke eksponert i API-et.
- **Gjenoppretting/rollback:** Migrasjonen er ny og har ingen pilotdata. Rollback i testmiljø: `drop table public.search_agents, public.dealership_members, public.dealerships; drop schema private cascade;`. Destruktiv rollback mot ekte data krever egen beslutning (se under).

## Implementert i DEV-004

Migrasjon `supabase/migrations/20261006090000_dev004_agent_validation.sql`:

- **`search_agents_filters_valid`:** kjente nøkler; merke/modell/variant 1–60 tegn (modell krever merke, variant krever modell); år 1900–2100 og fra ≤ til (serveren bruker inneværende år + 1 som øvre grense); maks km 1–2 000 000; drivstoff/gir/karosseri/land fra faste lister uten duplikater; maks pris i DEC-020-format og støttet valuta (DEC-018); `broadSearchConfirmed` boolsk.
- **`search_agents_assumptions_valid`:** `retail` (`expectedRetailTotal` NOK > 0, `priceBasis.vat` og `priceBasis.registrationTaxes` = included/excluded), `minimumContribution` (NOK > 0) og `preparationReserve` (`amount` NOK ≥ 0, `vatBasis` = ex_vat/incl_vat). Alle kan være null (ikke oppgitt).
- **`search_agents_ready_when_active`:** `active` krever aktiveringskravene i DEC-023/024. Funksjonene er NULL-sikre, fordi en CHECK som gir NULL ellers regnes som bestått.
- **Oppgradering:** eksisterende DEV-002-agenter beholdes. En aktiv agent uten komplette krav pauses før constraintet legges til (kontrollert lokalt fra DEV-002-data).
- DEV-002s `search_agents_money_format` er erstattet av sjekkene over. RLS, kolonnerettigheter og grensen på 10 aktive er uendret.

## Implementert i QA-001-FIX

Migrasjon `supabase/migrations/20261006100000_qa001_fix_active_limit_trigger.sql` erstatter `private.enforce_active_agent_limit()` (DEV-002-migrasjonen er uendret):

- **F1 (P1) tenantsjekk først:** når `auth.uid()` er satt og firmaet på raden ikke er brukerens, avvises forsøket med `42501` og samme melding som RLS, før noe telles eller låses. Svaret er dermed identisk uansett hvor mange aktive agenter et fremmed firma har, og forsøket tar ikke lås på det firmaet. Direkte databasekall uten bruker (eier/serverjobb) påvirkes ikke og får grensen som før.
- **F2 (P2) isolasjonsnivå:** aktivering avvises eksplisitt under REPEATABLE READ (`0A000`). READ COMMITTED og SERIALIZABLE er uendret. Se DEC-025. Kommentaren i DEV-002-migrasjonen om serialiseringsfeil under REPEATABLE READ var feil.
- Rettigheter og `search_path` på funksjonen er uendret.

## Implementert i DEV-005A

**Omfang:** dette er DEV-005A (manuelle søkekjøringer med tenant-isolerte snapshots). Delt ingestion (`listings`, `listing_revisions`, dedup på tvers av kjøringer, sjekkpunkter, `agent_locks`) er **DEV-005B**, status **BLOCKED** på BUS-002 / OPEN-001 / OPEN-002, og er ikke implementert.

Migrasjon `supabase/migrations/20261007090000_dev005_search_runs.sql` (DEC-026). Nye tabeller: `search_runs` og `search_run_results`, begge med RLS, ingen DELETE, ingen UPDATE på resultater.

- **`search_runs`:** `id`, `dealership_id` (utledet av agenten), `agent_id` (+ sammensatt FK `(agent_id, dealership_id)`), `agent_version`, `requested_agent_version`, `request_token` (unik per agent), `provider`, `status` (running/completed/failed), `criteria_snapshot` (agentnavn, filtre og forutsetninger slik de var), `counts` (validerte tellere), `error_code` (fast liste, aldri rå feiltekst), `started_at`, `finished_at`, `created_at`. Delvis unik indeks: én `running` per agent.
- **`search_run_results`:** `search_run_id` (+ sammensatt FK med `dealership_id`), `source`, `source_listing_id`, `content_hash`, `rank`, `match_status` (match/needs_review), `unknown_criteria`, `listing_snapshot` (minimalt utdrag), `created_at`. Unik `(search_run_id, source, source_listing_id)` og `(search_run_id, rank)`.
- **Triggere (SECURITY DEFINER, `search_path=''`):** `search_runs_before_insert` (tenantsjekk først, aktiv/klar/versjon, stale-opprydding, utleder firma/versjon/snapshot), `search_runs_before_update` (bare running → completed/failed, uforanderlige kolonner, tellerkonsistens), `search_run_results_before_insert` (tenantsjekk, kjøringen må pågå).
- **Rettigheter:** klienten kan bare sette `agent_id`, `request_token`, `requested_agent_version`, `provider` ved opprettelse og `status`, `counts`, `error_code` ved avslutning.
- **Avvik fra den logiske modellen:** ingen delt `listings`/`listing_revisions`, ingen `agent_locks` og ingen sjekkpunktkolonner (`last_checkpoint`) — **DEV-005B (BLOCKED)**, ikke bare «utsatt»: den logiske modellen over er fortsatt målbildet for ingestion. Tidspunkt for avslutning heter `finished_at`.
- **Resultatintegritet (midlertidig):** `authenticated` har INSERT på `search_run_results` og kan sette `completed` på egne kjøringer. Radene er derfor *ikke autoritative* og skal ikke mates inn i automatiske varsler, beregninger eller eksterne handlinger. Krav FU-005-1: før live ingestion/nedstrøms automatikk skal bare en betrodd server-side vei kunne opprette og ferdigstille resultater (DEC-026).
- **Historisk annonselenke:** resultatet viser lagret utdrag (autoritativt for hva kjøringen så); «Se annonse» åpner nåværende syntetiske annonse, ikke lagret revisjon. Revisjonsbevisst navigasjon: DEV-005B.
- **Oppgradering:** kontrollert fra DEV-004 + QA-001-FIX-schema med eksisterende agentdata (`scripts/qa-upgrade-check.sh`, scenario 2c): agentdata byte-for-byte uendret, schema identisk med ren oppbygging.

## Implementert i DEV-005B0

Migrasjon `supabase/migrations/20261008090000_dev005b0_rights_retention.sql` (DEC-028, DEC-029). Ingen global `listings`/`listing_revisions` (DEV-005B er fortsatt BLOCKED), ingen ekstern kilde.

- **`private.provider_rights_profiles`** (utenfor Data API; RLS på, ingen rettigheter for anon/authenticated/service_role): `provider`, `version` (unik per provider), `status` (draft/verified/revoked), `effective_from`/`effective_to` (eksklusiv slutt), `retention_seconds` (0–10 år; 0 = ingen persistent lagring), `allow_price`/`allow_specs`/`allow_text`/`allow_images`/`allow_seller_data`, `source_ref` (påkrevd), `verified_by`/`verified_at` (påkrevd for verified). Vakttrigger: profiler er uforanderlige (kun status → revoked og forkorting av `effective_to`), en trukket profil kan ikke gjenopprettes, og verifiserte profiler for samme provider kan ikke overlappe. Profiler forvaltes av eier via SQL (som `admin_*`); det finnes ingen brukerflate.
- **`private.rights_profile_in_force(provider, at)`**: verifisert profil innenfor virkningsperioden, ellers ingen rad (default-deny).
- **`search_runs`** får `rights_profile_id` (FK, restrict), `rights_profile_version`, `expires_at` (alle NOT NULL, satt av databasen ved start: `expires_at = start + profilens retensjon`). **`search_run_results`** får `rights_profile_version` og `expires_at` (arvet fra kjøringen). Ny feilkode `rights_blocked`.
- **Start blokkeres** (`23514`) med `search_run_rights_profile_missing` (ingen verifisert/trukket profil), `search_run_rights_profile_expired` (utløpt, trukket eller ikke i kraft) eller `search_run_rights_storage_not_allowed` (retensjon 0). Tenantsjekken (identisk 42501 for fremmed/ukjent agent) kommer fortsatt først, og en blokkert start har ingen bivirkninger.
- **Lagring av resultater** krever at kjøringens profil fortsatt gjelder og at kjøringen ikke har utløpt; snapshot-nøkler er hvitelistet (`base` + `text` kun med `allow_text`, `images` kun med `allow_images`), og pris/spesifikasjoner/selgerfelt må være `null` hvis profilen ikke tillater dem (`search_run_rights_data_type_not_allowed`). `completed` krever at profilen fortsatt gjelder; `failed` kan alltid settes.
- **RLS:** select-policyene krever `expires_at > now()` (utløpte rader er usynlige umiddelbart). INSERT-policy for resultater og UPDATE-policy for kjøringer er fjernet, og kolonnerettighetene for dette er trukket: brukere kan starte kjøringer, ikke skrive resultater eller avslutte dem.
- **Betrodd skrivevei** (rolle `scout_ingest`, NOLOGIN i migrasjonen): `private.trusted_run_policy`, `trusted_store_results` (1–500 rader), `trusted_complete_run`, `trusted_fail_run` (alle med forventet firma-ID, avviser fremmed/avsluttet kjøring med `P0002`) og `private.purge_expired_search_runs(batch 1–5000)` (avbryter utløpte hengende kjøringer, sletter utløpte avsluttede kjøringer med resultater; idempotent; kalles manuelt inntil videre). Bare `scout_ingest` har EXECUTE; rollen har ingen tabellrettigheter, ikke BYPASSRLS og 30 s `statement_timeout`.
- **Backfill/oppgradering:** eksisterende kjøringer/resultater får profil v1 og `expires_at = created_at + 7 dager` (kontrollert i `scripts/qa-upgrade-check.sh`, scenario 2d: data byte-for-byte uendret, schema identisk med ren oppbygging). Eksisterende syntetiske rader eldre enn 7 dager blir dermed utløpt (usynlige) ved migrering og slettet av neste purge.
- **Ikke gjort:** periodisk kjøring av purge (ingen scheduler); gjenvisning/varsler/LLM-flagg i profilen (kommer med de funksjonene); bildelagring; profilforvaltning i UI.

## Migrasjons- og kontrollkrav

DEV-002 skal levere migrasjoner, syntetisk seed for to firmaer og test av lese/skrive-isolasjon. Aktiv-agentgrensen må kontrolleres under samtidige opprettelser. Alle migrasjoner dokumenteres med rollback/gjenopprettingsplan; destruktiv sletting av reelle pilotdata krever egen beslutning.

Retensjon av råannonse/bilder bestemmes av BUS-002. Man kan lagre revisionshash og nødvendige beregningssnapshot uten å anta rett til å bygge ubegrenset historisk annonsearkiv. Sletting av kundekonto krever håndtering av varsler, forutsetninger og personopplysninger etter avklart policy.
