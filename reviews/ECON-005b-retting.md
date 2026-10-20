# ECON-005b — rettingsrapport (review av 75ff199, ett P2)

**Status: ECON-005b forblir REVIEW. 005c er ikke startet. Migrasjonen er ikke anvendt i hostet miljø.** Review: `reviews/ECON-005b-review-75ff199.md`. Endret: `supabase/migrations/20261021090000_econ005b_derived_economics_rights.sql` (migrasjonen er ikke anvendt noe sted utenom isolerte testklynger, så den er rettet på plass i stedet for å legge en korrigerende migrasjon oppå en uutgitt), tester og dokumentasjon. Uendret: økonomiflagg, `classifyBudget`, avgiftsmotor, avrunding, UI, providere, `src/domain/economics`.

## Funnet — bekreftet med DB-kjøring før retting
Kjørt mot 75ff199-migrasjonen i isolert PostgreSQL 16: `economics_rights_map_valid('{}')` returnerer **NULL**; `insert ... allow_derived_economics = '{}'` lykkes med både `display_derived_economics` false og true (rad lagret med `{}`). Reviewerens tre tester feilet (3/3). Øvrige ugyldige former (`null`, `[]`, `[true]`, `"x"`, `5`, ufullstendig objekt) ga false og ble avvist.

## Retting
- Validatoren er **total**: `CASE` returnerer false for `NULL` og ikke-objekter (nøkkelfunksjonen kalles bare på objekter), nøkkelsettet sammenlignes via `coalesce(array_agg(...), tom liste)` slik at tomt objekt gir false, hele uttrykket er pakket i `coalesce(..., false)`.
- Constrainten bruker i tillegg `... is true` (NULL kan aldri slippe gjennom en framtidig endring av funksjonen).
- Ingen annen kontroll er svekket; øvrige ugyldige former avvises som før.

## Tester
- `tests/db/econ005b-empty-map-review.test.ts` (reviewerens 3 tester, uendret).
- `tests/db/econ005b-rights.test.ts` (+8): direkte returverdi (16 JSON-former, nøyaktig `true`/`false`, aldri NULL; også `null`-argument); `{}` avvises med 23514 for display false og true (også som verifisert profil, og ingen `{}`-rad finnes etterpå); UPDATE til `{}` avvises; **samsvar SQL ↔ TypeScript** for 13 kartformer × display false/true (SQL-validator, `validateProfile` og faktisk DB-lagring er enige).
- `tests/economics-005b-rights.test.ts` (+4): TS avviser tomt kart med display false og true (hele profilen ugyldig); canonicalPermissions-format (se under).

## Før / etter
| | Før (75ff199-migrasjon) | Etter |
|---|---|---|
| Reviewerens 3 tester | 3 feiler | 3 består |
| Nye DB-tester (inkl. reviewerens, 32 i de to filene) | 7 feiler, 25 består | 32 består |
| `econ005b-rights` + `empty-map` + `rights-profile-model` + `qa-catalog` | — | 81 består; oppgraderingsøyeblikksbilde OK |
| Hele DB-suiten i isolert klynge | 143 bestått, 12 feil, 247 hoppet over | 152 bestått, **12 feil, 247 hoppet over (uendret; Auth/PostgREST finnes ikke i den klyngen)** |
| `vitest run` (hele) | 1 142 | **1 146 består** (50 filer) |
| `tsc`, `eslint .`, `check-docs` | — | rene |

Mutasjonskontroll av rettingen: uten ikke-objekt-grenen (`jsonb_typeof`) feiler 3 tester. Tre mutanter overlever fordi de er forsvarslag som overlapper (inner coalesce, ytre coalesce, `is true`): hvert enkelt fjernet dekkes av de to andre; alle tre fjernet reproduserer det opprinnelige funnet (7 feil, kjørt som 75ff199-migrasjonen).

## Presiseringer fra review
- **Backfill av `synthetic-demo` v1 er en dokumentert engangs-migreringsbeslutning** (godtatt av Christian), avgrenset med `provider='synthetic-demo' and version=1 and environment='synthetic'`. Det er ingen generell adgang til å utvide verifiserte profiler på plass: andre profiler er default-deny, og etter migrasjonen er begge kolonner uforanderlige (vakttriggeren); videre endring krever ny versjon.
- **`canonicalPermissions` har fått et nytt felt (`derivedEconomics`), så profilavtrykket (digest) endres for alle profiler.** Proveniens bygget med det gamle avtrykket vil derfor evalueres som `rights_changed` selv om rettighetene i praksis er uendret og uten v2. Dette er bevisst og er **ikke** omgått: eldre proveniens/digester skrives ikke om. Testet (`rights_changed` for gammelt format, `valid` for nytt). Proveniens er transient/server-intern i dag (ingen lagring av avtrykk), så det finnes ingen eldre persistert proveniens som berøres; konsekvensen gjelder bare in-memory proveniens bygget før en deploy.

## Separat funn utenfor 005b (ikke rettet her)
Samme feil finnes i det eldre `private.rights_field_map_valid` (DATA-002B): `display_fields`/`matching_fields` = `'{}'` godtas av databasen (verifisert), mens TS regner kartet som ugyldig. Endring krever en ny migrasjon som berører eksisterende rettighetsvalidering, så den er ikke gjort i denne rettingen; foreslått som egen oppgave. Ingen bypass av økonomirettigheter (beslutningsfunksjonene leser bare `->> felt` og gir false for manglende nøkler).

## Begrensninger
Kjørt: vitest (hele), tsc, eslint, check-docs, DB-tester i isolert PostgreSQL. Ikke kjørt: Supabase-avhengige DB-filer (Auth/PostgREST), qa:*, build, e2e. Ingen uavhengig review av rettingen ennå.
