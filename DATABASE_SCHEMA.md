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

## Migrasjons- og kontrollkrav

DEV-002 skal levere migrasjoner, syntetisk seed for to firmaer og test av lese/skrive-isolasjon. Aktiv-agentgrensen må kontrolleres under samtidige opprettelser. Alle migrasjoner dokumenteres med rollback/gjenopprettingsplan; destruktiv sletting av reelle pilotdata krever egen beslutning.

Retensjon av råannonse/bilder bestemmes av BUS-002. Man kan lagre revisionshash og nødvendige beregningssnapshot uten å anta rett til å bygge ubegrenset historisk annonsearkiv. Sletting av kundekonto krever håndtering av varsler, forutsetninger og personopplysninger etter avklart policy.
