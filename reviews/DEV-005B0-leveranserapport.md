# DEV-005B0 — Provider Rights & Retention Foundation: leveranserapport

Dato: 08.10.2026 · Branch: `claude/wonderful-bardeen-yussx3` · Status: **DEV-005B0 READY FOR REVIEW** (ikke DONE) · DEV-005B: **BLOCKED** (uendret)

## 1. Sammendrag
Et provider-uavhengig fundament for lagringsrettigheter og retensjon er på plass (DEC-028), og søkeresultater skrives nå av en betrodd serverside-vei i stedet for av brukerens egen sesjon (DEC-029, lukker FU-005-1). Ingen ekstern kilde er koblet til, ingen credentials er lagt i repoet, ingen global `listings`/`listing_revisions`, ingen n8n og ingen ekstern scheduler. `synthetic-demo` er migrert til en eksplisitt profil (v1, 7 dagers test-retensjon), så DEV-005A virker som før.

## 2. Migrasjon
`supabase/migrations/20261008090000_dev005b0_rights_retention.sql` (ingen eksisterende migrasjon er endret):
- Rolle `scout_ingest` (NOLOGIN, NOINHERIT, ikke superuser, ikke BYPASSRLS, 30 s `statement_timeout`).
- `private.provider_rights_profiles` + vakttrigger (uforanderlighet, ingen overlapp av verifiserte profiler) + `private.rights_profile_in_force`.
- Seed av profilen `synthetic-demo` v1.
- Nye kolonner `rights_profile_id`/`rights_profile_version`/`expires_at` på `search_runs` og `rights_profile_version`/`expires_at` på `search_run_results`, med backfill og `NOT NULL`. Ny feilkode `rights_blocked`.
- Erstattede triggere (`search_runs_before_insert`, `search_runs_before_update`, `search_run_results_before_insert`) med rettighetskontroll, utløpskontroll og datatypehåndheving.
- Fem funksjoner for den betrodde veien + purge. Fjernet brukerens INSERT på resultater og UPDATE på kjøringer (kolonnerettigheter og policyer). Select-policyene krever `expires_at > now()`.
- Oppgradering kontrollert fra DEV-005-schema med eksisterende kjøringer/resultater (scenario 2d i `scripts/qa-upgrade-check.sh`): data uendret, backfill korrekt, schema identisk med ren oppbygging.

## 3. Arkitekturvalg
- **Policy er data:** versjonert profil per provider; hver lagret rad bærer profilversjon og `expires_at`. Default-deny.
- **Fail closed to ganger:** serveren projiserer resultatet gjennom profilen (`src/domain/rights.ts`, `applyStoragePolicy`, merker `withheld`), og databasen avviser alt utenfor profilen (hvitelistet snapshot-skjema).
- **Betrodd skrivevei uten service-role:** en begrenset databaserolle med kun fem SECURITY DEFINER-funksjoner (ikke Supabase service-role, ingen RLS-omgåelse, ingen tabellrettigheter). Appen kobler til via `pg` i én server-only modul. Alternativer vurdert: *service-role-nøkkel* (for bred), *autentisert RPC* (kan kalles av enhver bruker med eget token, så det er ikke «betrodd»), *signert token generert av DB* (kan hentes av samme bruker). Å skille «server» fra «bruker» krever en hemmelighet bare serveren har, så en minimal ny hemmelighet (passord for `scout_ingest`) er uunngåelig; den er begrenset og ikke i git.
- **Tenant-sjekk i databasen:** brukerens start av kjøring er uendret (identisk 42501 for fremmed/ukjent agent, før rettighetssjekk). De betrodde funksjonene tar forventet firma-ID og avviser fremmed/avsluttet kjøring.

## 4. RLS og rettigheter
- Brukere: kan starte kjøring, lese egne (ikke utløpte) kjøringer/resultater. Kan ikke sette inn resultater, ikke sette status/tellere/feilkode/`expires_at` (alle gir `42501`; testet for A→B og B→A, anon, og uten medlemskap).
- `private.provider_rights_profiles`: RLS på, ingen rettigheter for anon/authenticated/service_role/PUBLIC, utenfor Data API.
- Bare `scout_ingest` (og eieren) kan kjøre de betrodde funksjonene; `anon`, `authenticated`, `service_role` og PUBLIC kan det ikke (katalogtest). `scout_ingest` kan ikke lese tabeller eller kjøre andre private funksjoner (testet).
- QA-katalogtestene er oppdatert (8 policyer, kolonnerettigheter, SECURITY DEFINER-liste, rolleattributter, utløpskolonner).

## 5. Betrodd skrivevei (flyt)
1. Bruker (egen sesjon) starter kjøring → trigger velger gjeldende profil, setter `expires_at` og snapshot. Forhåndssjekk: er den betrodde veien konfigurert og nåbar? Hvis ikke opprettes ingen kjøring («midlertidig utilgjengelig»).
2. Server leser kjøringens policy (`trusted_run_policy`), henter fra provider, matcher i domenet, projiserer gjennom policyen.
3. Server lagrer i biter på 250 (`trusted_store_results`) og avslutter (`trusted_complete_run` / `trusted_fail_run`). Feil → `failed` (også `rights_blocked` hvis profilen utløp underveis).
4. Brukerens sesjon leser den ferdige kjøringen. `SCOUT_INGEST_DATABASE_URL` leses bare i `src/server/trusted-ingest.ts` (arkitekturtest).

## 6. Retensjonslogikk
- `expires_at = starttid + profilens retensjon`; alle resultater arver kjøringens. Profil mangler/utkast/utløpt/trukket/ikke i kraft/retensjon 0 ⇒ start blokkeres uten bivirkninger. Profil utløper midt i kjøringen ⇒ lagring og fullføring nektes (feilmerking tillatt).
- Utløpte rader er usynlige for brukere umiddelbart (RLS) og slettes av `private.purge_expired_search_runs(batch)` (idempotent, batch 1–5000, avbryter utløpte hengende kjøringer først, sletter resultater før kjøringer, tvers av firma). Kalles via `npm run purge:expired`; **ingen periodisk kjøring er satt opp**.
- Brukerflate: kjøringssiden viser «Slettes automatisk» og profilversjon; tilbakeholdte felt vises som «lagres ikke (rettighetsprofil)», skilt fra «ikke oppgitt».

## 7. Tester faktisk kjørt (ren database, `supabase db reset`)
| Kontroll | Resultat |
|---|---|
| `tsc --noEmit`, `eslint .` | rent |
| Enhetstester (`vitest run`) | 152/152 (nye: `rights` 5; `search-pipeline` +1; arkitektur +1 for `pg`/hemmelighet-grenser) |
| DB/RLS (`npm run test:db`) | 273/273 (nye: `rights-retention` 37; `search-runs` omskrevet til betrodd vei; katalog +1) |
| e2e DEV-005 | 36/36, kjørt gjentatte ganger |
| e2e DEV-002 / DEV-004 / QA-001 | 11 / 22 / 26 |
| Migrasjonskjede (`qa:migrations`) | 44/44 kontroller (ren oppbygging, DEV-002→, DEV-004→, QA-001-FIX→, **DEV-005→DEV-005B0 med data (2d)**, atomisk feil, schema identisk) |
| Secret-skann | ingen funn |
| Demomodus (`qa:demo`) | alle kontroller bestått |
| Produksjonsbygg | OK |
| Mutasjoner (lokal DB, ikke committet) | 13 av 13 oppdaget (se under) |

Mutasjoner som ga røde tester: fjernet rettighetssjekk ved start; fjernet profil-/utløpssjekk ved lagring; fjernet datatype-hviteliste; fjernet prisforbud; brukere gis INSERT på resultater (grant + policy); brukere gis UPDATE av status/tellere; EXECUTE gitt til `authenticated`; purge sletter pågående kjøringer; fullføring uten profilsjekk; `scout_ingest` gis SELECT; feil retensjonsberegning; select-policy uten `expires_at`; `scout_ingest` gis BYPASSRLS.

## 8. Regresjon
Hele batteriet ble kjørt på nytt fra ren database i én sammenhengende kjøring. Alle eksisterende QA-/RLS-/tenant-tester (QA-001, QA-001-FIX F1/F2/F3, DEV-002/004/005A) er grønne. Eksisterende DB-tester for DEV-005A er flyttet til å skrive resultater via den betrodde veien (de bevarer hver påstand; påstander om at brukere *kan* skrive er erstattet av at de *ikke* kan).

## 9. Endrede filer
Nye: migrasjonen, `src/domain/rights.ts`, `src/server/trusted-ingest.ts`, `scripts/{setup-local-ingest-role.sh,purge-expired.mjs}`, `tests/rights.test.ts`, `tests/db/rights-retention.test.ts`, denne rapporten. Endret: `src/server/{search-runs,search-pipeline}.ts`, `src/domain/search-run.ts` (nullable spesifikasjoner, `withheld`, ny feilkode), `src/app/agents/[id]/runs/**`, `src/lib/format.ts`, `package.json`/`package-lock.json` (`pg` er nå en runtime-avhengighet), `.env.example`, `scripts/qa-upgrade-check.sh`, tester (`architecture`, `search-pipeline`, `db/{harness,qa-catalog,search-runs}`, `e2e/dev005`), DECISIONS (DEC-028/029), DATABASE_SCHEMA, ARCHITECTURE, README, MVP_BACKLOG, BUS-002_DECISION_SUPPORT.

## 10. Begrensninger og åpne punkter
- **Hosted er ikke utprøvd.** Eier må anvende migrasjonen, sette passord på `scout_ingest` (`alter role … login password …`) og legge `SCOUT_INGEST_DATABASE_URL` i server-only miljø. Om Supabase-poolerens transaksjonsmodus godtar rollen og parameteriserte kall er ikke kontrollert; det må inn i hosted smoke-test.
- **Nytt hemmelighetskrav** (passordet) og en kompromittert tilkoblingsstreng gir skrivetilgang til kjøringsresultater (ikke lesing av tabeller eller andre rettigheter).
- **Purge kjøres ikke automatisk.** Utløpte rader er usynlige, men tar plass til purge kjøres (DEV-013).
- Profiler forvaltes av eier via SQL; ingen UI. Én profil gjelder per provider om gangen. `search_runs.provider` er fortsatt begrenset til `synthetic-demo` (ny provider krever migrasjon).
- Retensjon 0 («ingen lagring») blokkerer i dag søk helt; en transient modus uten lagring (modell A) er ikke bygget.
- Treffstatus/rang (avledede data) lagres uavhengig av profilen; om de kan beholdes etter providerens retensjon må avklares per avtale.
- Eksisterende syntetiske rader eldre enn 7 dager blir utløpt (usynlige) ved migrering.
- Ikke gjort (utenfor scope): DEV-005B, ekte provider, bilder/tekstlagring, gjenvisning/varsel/LLM-flagg, periodisk purge, n8n.

## 11. Beslutninger
DEC-028 (provider-spesifikk, rettighetsstyrt lagring; godkjent av Christian 08.10.2026) og DEC-029 (betrodd skrivevei via `scout_ingest`). DEC-026s resultatintegritet-begrensning er markert løst.

## 12. Status
- **DEV-005B0: READY FOR REVIEW** (ikke DONE; uavhengig kontroll og hosted smoke-test gjenstår).
- **DEV-005B: BLOCKED** på provider-avklaringer (BUS-002, OPEN-001/002) og DEV-005B0-review. Ikke påbegynt.
- Commit-hash oppgis i chat-svaret.
