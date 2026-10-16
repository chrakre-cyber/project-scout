# DATA-002B — leverandørenes rettighetsprofil (lagring + visning + bruk) (16.10.2026)

**Status: REVIEW** (implementert og testet; ikke DONE før Codex-review). Vurderingen (§1–4) ble committet før implementasjon; «Resultat» er lagt til etterpå. Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `4bfa680`, rent arbeidstre. Ingen ekstern leverandør kobles til, ingen credentials, ingen live data, ingen bilder, ingen VIN, ingen TAX-/auth-/tenant-/deployendring.

## 1. Vurdering av DEV-005B0 (det vi skal gjenbruke)
**Finnes (migrasjon `20261008090000`/`20261009090000`, DEC-028/029):** `private.provider_rights_profiles` — versjonert per `provider` (`unique (provider, version)`), `status` (`draft|verified|revoked`), `effective_from`/`effective_to` (eksklusiv slutt, kan bare forkortes), `retention_seconds` (0 = ingen persistent lagring), lagringsrett per datatype (`allow_price/specs/text/images/seller_data`), `source_ref` (påkrevd), `verified_by/at`. Vakttrigger `rights_profiles_guard`: profiler uforanderlige (kun `status → revoked` og forkorting av `effective_to`), trukket kan ikke gjenopprettes, bare én verifisert profil kan gjelde per provider om gangen. `private.rights_profile_in_force(provider, at)` gir profilen som gjelder (verifisert og innenfor perioden). Hver lagret rad bærer `rights_profile_version` og `expires_at` (kappet ved `effective_to`); RLS skjuler utløpte/trukne; `purge_expired_search_runs` sletter; default-deny uten verifisert profil. TS-siden: `src/domain/rights.ts` (`applyStoragePolicy`, `StoragePolicy`). Synthetic-demo har en verifisert profil v1 (7 dager, test-retensjon).
**Mangler for en samlet modell:** (a) `environment` (synthetic/sandbox/live); (b) visningsrett per felt (DATA-002A har dem bare som kode); (c) *bruk til matching* som egen rett; (d) cache-varighet og historikkretensjon; (e) gjenbruk på tvers av kunder, re-evaluering mot flere søk, varsler; (f) geografi; (g) attribusjons- og dypelenkekrav; (h) oppførsel ved tilbakekalling; (i) leverandørnavn for visning. I dag finnes to adskilte «rettighetssystemer» (DB-profil for lagring; kode-policy for visning) — det skal bli ett.

## 2. Beslutning: utvid, ikke dupliser
- **DB:** én ny, additiv migrasjon som *utvider* `private.provider_rights_profiles` (nye kolonner med default-deny, validering, utvidet vakttrigger). Ingen ny tabell. Eksisterende `retention_seconds`/`allow_*` er *lagringsretten* og beholdes uendret (ingen endring av RLS, triggere for kjøringer, purge eller betrodd skriveveg). `synthetic-demo` v1 backfylles **in place** (ikke ny versjon): en ny verifisert versjon ville krevd å forkorte v1, og da ville eksisterende kjøringer bli skjult av synlighetsregelen i DEC-028.
- **Kode:** ett domenemodul `src/domain/provider-rights.ts` (rent) med `ProviderRightsProfile` (speiler DB-raden), `resolveRights` (default-deny; ukjent/utløpt/trukket/ikke begynt/ikke verifisert/ugyldig ⇒ ingenting tillatt), `toDisplayPolicy` (DATA-002A-grensen *konsumerer* profilen), `matching`-rettigheter og `retentionExpiresAt`. DATA-002A sin hardkodede syntetiske policy avledes fra profilen (ingen duplikat). `src/domain/rights.ts` (lagringsprojeksjon) er uendret og kobles ikke om her.
- **Matching vs visning:** to separate feltkart i profilen: `display` («kan vises») og `matching` («kan brukes internt til vurdering»). Ingen universell antakelse: begge defaulter til *nei*; en leverandør kan tillate matching uten visning, eller omvendt (visning uten matching er en mulig, men merkelig profil og er lov). Matching-nekt gir at feltet nulles før vurdering (ukjent ⇒ «må kontrolleres», aldri oppdiktet). Nekt av matching på selve tittelen (merke/modell) gjør annonsen uvurderbar og den teller som ikke vurdert.
- **Profilversjon følger resultatet:** `DisplayableListing.policy.profileVersion` (DATA-002A) settes fra profilen; ukjent kilde gir versjon 0.
- **Mobile.de:** kun en *fixture/eksempel* `mobile-sandbox` i tester, status `draft`, alle rettigheter nei, ikke registrert i noen kjøretidsregister. Ingen `mobile-live`-profil.

## 3. Filer som endres
Ny: `supabase/migrations/20261016090000_data002b_rights_profile_model.sql`, `src/domain/provider-rights.ts`, `tests/provider-rights.test.ts`, `tests/db/rights-profile-model.test.ts`, `tests/fixtures/rights-profiles.ts`.
Endret: `src/domain/display-policy.ts` (policy/profil-avledning flyttes; nytt felt `providerListingId`), `src/server/search-display.ts` (profil → visning og matching), `src/server/search-preview.ts` (valgfri `prepare`-krok før vurdering), tester fra DATA-002A (importer), `tests/architecture.test.ts`, `DATABASE_SCHEMA.md`, `DECISIONS.md`, `MVP_BACKLOG.md`, `reviews/DATA-002B.md`.
Ikke endret: DEV-005B0-triggere/RLS/purge/betrodd skriveveg, søkemodellen, adaptere, providere, auth/tenant, deploy.

## 4. Tester som legges til
Domene (`provider-rights.test.ts`): gyldig profil; utløpt; trukket; ikke begynt; ikke verifisert (draft); ukjent provider; validering av ugyldige profiler; visning nektet men matching tillatt; begge nektet; matching tillatt men visning nektet end-to-end gjennom `previewForDisplay`; retensjonsutløp (kappet ved `validUntil`, 0 = ingen lagring); profilversjon-propagering; geografi (ukjent land ved restriksjon ⇒ nei); synthetic-demo-regresjon; mobile-sandbox-fixture gir ingen rettigheter. DB (`rights-profile-model.test.ts`, mot isolert PostgreSQL): migrasjonen anvendes, syntetisk v1 er backfylt, nye constraints (feltkart, miljø, attribusjon, historikk ≤ lagring), vakttriggeren beskytter nye kolonner, default-deny for nye profiler. Arkitektur: ingen duplikat rettighetsmodell, policymodulene er rent domene.

## 5. Resultat

### 5.1 Hvordan DEV-005B0 ble gjenbrukt
Samme tabell (`private.provider_rights_profiles`), samme vakttrigger (utvidet, ikke erstattet), samme `rights_profile_in_force`, samme versjon/utløp/purge/RLS/betrodd skriveveg — ingenting av dette er endret. Lagringsretten (`retention_seconds`, `allow_*`) er uendret og er fortsatt det kjøringene håndhever. Visningsretten fra DATA-002A er ikke lenger et eget regelverk: `SYNTHETIC_DISPLAY_POLICY` og `policyForSource` er nå **avledet** av profilen (`toDisplayPolicy`). `src/domain/rights.ts` (`applyStoragePolicy`) er uendret. En arkitekturtest hindrer et parallelt regelverk (display-policy kjenner ingen leverandør; profiler finnes bare i `provider-rights.ts`).

### 5.2 Skjemaendringer og migrasjonsimplikasjoner
Én ny, **additiv** migrasjon: `supabase/migrations/20261016090000_data002b_rights_profile_model.sql` (ikke anvendt hosted — det gjøres av Christian; se under).
- Ny funksjon `private.rights_field_map_valid(jsonb)` (ingen rettigheter for anon/authenticated/service_role).
- Nye kolonner på `provider_rights_profiles` (alle default-deny): `environment` (påkrevd; `synthetic|sandbox|live`), `provider_name`, `display_fields`, `matching_fields` (13 nøkler, alle boolske), `cache_seconds`, `history_retention_seconds` (≤ lagringstid), `multi_customer_reuse`, `re_evaluation_allowed`, `alerts_allowed`, `geography_unrestricted`, `allowed_countries`, `attribution_required`, `attribution_text`, `deep_link_required`, `on_revocation`.
- Nye constraints (miljø, feltkart, historikk ≤ lagring, ISO-land, geografi-konsistens, leverandørnavn, attribusjonstekst/leverandørnavn for verifisert profil).
- `rights_profiles_guard` er erstattet (`create or replace`) med samme regler + de nye kolonnene som uforanderlige.
- **Backfill:** `synthetic-demo` v1 oppdateres *in place* (miljø `synthetic`, alle felt visbare/matchbare unntatt bilder, attribusjon, gjenbruk). Ingen ny verifisert versjon (den ville krevd å forkorte v1 og skjult eksisterende kjøringer). Ingen annen profil finnes; om en ukjent rad fantes ville den fått miljø `live` uten rettigheter.
- **Ingen endring** i `search_runs`/`search_run_results`, RLS, kjøringstriggere, purge eller betrodd skriveveg. Oppgraderingsøyeblikksbildet i `test-db-isolated.sh` (agenter, kjøringer, constraints, triggere, policyer, rettigheter, funksjoner) er identisk før og etter SEARCH-005-migrasjonen med den nye migrasjonen anvendt.
- **Hosted:** migrasjonen må anvendes på det hostede prosjektet (`supabase db push`/SQL-editor) *før* kode som leser profilene fra databasen tas i bruk. Dagens kjøretid leser **ikke** profiler fra databasen (bruker den kodede syntetiske profilen), så appen virker uten migrasjonen; migrasjonen er likevel nødvendig for å holde DB og kode i samsvar. Den er idempotent-sikker bare i den forstand at den ikke kan kjøres to ganger (kolonner finnes) — kjør den én gang.

### 5.3 Modell (kode)
`src/domain/provider-rights.ts`: `ProviderRightsProfile` (leverandør-id, miljø, versjon, gyldig fra/til, status, kilde, verifisering, leverandørnavn, `display`, `matching`, `storage{retention, cache, history, storable}`, `usage{multiCustomerReuse, reEvaluation, alerts}`, `geography`, `attribution`, `deepLinkRequired`, `onRevocation`); `validateProfile` (speiler DB); `resolveRights` (default-deny; ukjent/ikke verifisert/trukket/ikke begynt/utløpt/ugyldig ⇒ ingenting, med årsak og profilversjon, 0 uten profil); `toDisplayPolicy`; `restrictForMatching`; `retentionExpiresAt`/`isWithinRetention`; `geographyAllows`; `SYNTHETIC_RIGHTS_PROFILE` (speiler DB-raden) og `REGISTERED_PROFILES` (kun syntetisk).
Visningsnøkler: `seller_identity` → `sellerType`, `provider_identity` → `providerName`, `source_url` → `sourceUrl`, `listing_id` → ny `providerListingId` i `DisplayableListing`, `listing_dates` → `listingDates`. `images` finnes som profilrett, men modellen har ingen bilder (ingen bildestøtte lagt til).
`search-display.ts` bruker profilen både til visning (`applyDisplayPolicy`) og til matching (`prepare` før kandidatadapteren). `search-preview.ts` fikk en valgfri `prepare`-krok.

### 5.4 Svar på spørsmålet fra DATA-002A: kan et felt brukes til matching hvis det ikke kan vises?
**Ikke besvart universelt — modellert som to separate rettigheter** (`matching_fields` ≠ `display_fields`), begge default-nei, og avgjort per leverandør av avtalen. Teknisk: (a) visning nektet + matching tillatt ⇒ vurderingen er uendret, men alle felt vises som «vises ikke»; (b) matching nektet for et felt ⇒ feltet er *ukjent* i vurderingen (kravet blir «må kontrolleres», aldri bestått/brudd og aldri oppdiktet); (c) matching nektet for tittel ⇒ annonsen kan ikke vurderes; (d) begge nektet ⇒ intet vises, intet vurderes. Gjenstår et *avtalespørsmål* som profilen bare kan uttrykke, ikke avgjøre: om en forklaring/status avledet av et felt som ikke kan vises, selv er «visning» av feltet. I dag viser forklaringene bare status og årsakskode (aldri verdi); en avtale som forbyr også det må føre til at feltet settes som ikke-matchbart.

### 5.5 Tester som er lagt til
- `tests/provider-rights.test.ts` (25): gyldig profil og visningspolicy; utløpt, trukket, ikke begynt, utkast, ugyldig (3 varianter) ⇒ ingenting tillatt, med årsak og versjon; ukjent leverandør (versjon 0); flere versjoner; validering; **visning nektet/matching tillatt** (identisk vurdering, ingen verdier i utdata); matching nektet for ett felt (blir «må kontrolleres», aldri brudd); **begge nektet**; tittel-matching nektet; `restrictForMatching`; profilversjon-propagering (liste og detalj); profil som utløper mellom kall; **retensjonsutløp** (kappet ved profilens slutt, 0 = ingen lagring, trukket skjuler umiddelbart); geografi; synthetic-demo-regresjon; `mobile-sandbox`-eksempelet er et utkast uten rettigheter, ikke registrert, og gir ingenting selv om det settes til «verifisert».
- `tests/db/rights-profile-model.test.ts` (27, mot isolert PostgreSQL 16): backfill speiler TS-profilen; default-deny for nye profiler; 11 constraint-avvisninger; attribusjon/leverandørnavn for verifisert profil; uforanderlighet av 9 nye kolonner; tilbakekalling og forkortet periode fortsatt tillatt; trukket gjelder ikke; ingen overlapp.
- `tests/architecture.test.ts` (+3): én rettighetsmodell, ingen kjøretidsregistrert ekte profil, visning og matching går via profilen.
- DATA-002A-testene er tilpasset (importer; `providerListingId`) uten å svekke grensen.

### 5.6 Kontroller faktisk kjørt
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | uten feil |
| `npx vitest run` | **28 filer, 611 / 611** bestått (583 før + 28 nye) |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| `bash scripts/test-db-isolated.sh tests/db/search-drafts.test.ts tests/db/qa-catalog.test.ts tests/db/rights-profile-model.test.ts` (isolert PG 16 + shim, **ikke Supabase**) | **110 / 110**; «OPPGRADERING OK» (eksisterende data/skjema uendret) |
| `bash scripts/test-db-mutations.sh` | alle 6 bevisste feil oppdaget (M1–M6) |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **emulator**) | **76 / 76** |
| `bash scripts/qa-partner-mode.sh`, `bash scripts/qa-demo-mode.sh` | alle kontroller bestått |
**Ikke kjørt:** DB-/RLS-suitene som krever Supabase Auth (`agents`, `rls`, `qa-*`, `search-runs`, `rights-retention`) og eldre e2e-skript mot faktisk Supabase; migrasjonen er ikke anvendt på det hostede prosjektet.

### 5.7 Gjenstående blokkere før sandbox-integrasjon (DATA-003)
1. **Skriftlige sandbox-vilkår** er ikke lest/registrert; uten dem kan ingen `mobile-sandbox`-profil bli `verified` (eksemplet er et utkast uten rettigheter).
2. **Profiler lastes ikke fra databasen:** kjøretiden bruker bare den kodede syntetiske profilen. Det trengs en trygg, server-only leseveg (f.eks. `scout_ingest`-funksjon) som laster verifiserte profiler, og en synkronisering mellom DB-profil og kodet profil.
3. **Håndheving mangler** for felt som i dag bare er modell: cache, historikk, gjenbruk på tvers av kunder, re-evaluering, varsler, geografi, attribusjon/dypelenke i UI, `on_revocation`-purge for visningsdata.
4. **Hosted migrasjon** må anvendes og DB-/RLS-suitene kjøres mot faktisk Supabase.
5. **DATA-002C (proveniens)** — hentetid, profilversjon og utløp må følge hvert ekte resultat (versjonen følger visningsmodellen allerede).
6. Avtalespørsmål: matching vs visning (5.4), avledede data, multi-kunde.
7. Gjenstående rå-datavei fra DATA-002A (eldre flate og ruter utenfor `/searches`) er uendret.

### 5.8 Status
**DATA-002B = REVIEW.** Ingen ekstern leverandør er koblet til, ingen credentials brukt, ingen live data, ingen bilder, ingen VIN, TAX/auth/tenant/deploy uendret.
