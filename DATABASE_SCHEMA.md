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

## Migrasjons- og kontrollkrav

DEV-002 skal levere migrasjoner, syntetisk seed for to firmaer og test av lese/skrive-isolasjon. Aktiv-agentgrensen må kontrolleres under samtidige opprettelser. Alle migrasjoner dokumenteres med rollback/gjenopprettingsplan; destruktiv sletting av reelle pilotdata krever egen beslutning.

Retensjon av råannonse/bilder bestemmes av BUS-002. Man kan lagre revisionshash og nødvendige beregningssnapshot uten å anta rett til å bygge ubegrenset historisk annonsearkiv. Sletting av kundekonto krever håndtering av varsler, forutsetninger og personopplysninger etter avklart policy.
