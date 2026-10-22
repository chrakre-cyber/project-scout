# DATA-002D — `rights_field_map_valid` skal alltid gi true/false (til review)

**Status: REVIEW. Ny additiv migrasjon `supabase/migrations/20261022090000_data002d_rights_field_map_validator.sql`; den historiske DATA-002B-migrasjonen er uendret. Ikke anvendt i hostet miljø.** Uendret: økonomiflagg, beregningsmotor (`src/domain/economics`, `tax`, `search-economics`, `search-v2`), UI, providere, `src/server`. 005c er ikke startet.

## Funnet (fra ECON-005b-reviewen; bekreftet med DB-kjøring)
`private.rights_field_map_valid('{}')` returnerer SQL NULL (`array_agg` over ingen nøkler er NULL; `NULL = array[...]` er NULL). CHECK godtar NULL, så `display_fields = '{}'` og `matching_fields = '{}'` kunne lagres (verifisert: insert lyktes i isolert PostgreSQL 16 på 612ccc2). TypeScript (`validateProfile`) regner slike kart som ugyldige ⇒ DB og TS var uenige. Ikke et bypass av økonomirettigheter: et tomt kart gir ingen `true`-felt, og beslutningsfunksjonene leser `->> felt` (manglende ⇒ false). TS-validatoren kastet i tillegg et unntak (ikke et funn) for `display`/`matching` = `null`; den er gjort total.

## Migrasjonen
1. **Kartlegging før innstramming:** en DO-blokk teller eksisterende rader der `display_fields` eller `matching_fields` ikke er `true`-gyldige. Finnes slike, **stopper migrasjonen** med `data002d_invalid_existing_rows` og en liste `provider@vN (display_fields UGYLDIG|ok, matching_fields UGYLDIG|ok)`. Ingen rettigheter fylles inn, ingen rad endres, og profilvakttriggeren omgås ikke; eier må avklare raden (ny profilversjon eller dokumentert fjerning) før migrasjonen kan anvendes. I standard- og demodatabasen finnes ingen slike rader (bare `synthetic-demo` v1, gyldig).
2. `create or replace function private.rights_field_map_valid` — total: `CASE` for NULL/ikke-objekt ⇒ false, `coalesce(array_agg, tom liste)` slik at `{}` ⇒ false, ytre `coalesce(..., false)`. Samme 13 nøkler, `immutable`, tom `search_path`, privilegier uendret (create or replace beholder dem).
3. Constraintene `provider_rights_profiles_display_valid` og `_matching_valid` erstattet med `... is true`. Ingen annen constraint, trigger, RLS eller guard er berørt.

## Tester
`tests/db/data002d-field-map.test.ts` (64) + `tests/provider-rights.test.ts` (+9 TS):
- validatoren direkte for 17 former (tomt/ikke-objekt/ufullstendig/ekstra nøkkel/ikke-boolsk/null/tall/objekt-verdi ⇒ nøyaktig `false`; alle false/alle true/blandet ⇒ `true`) og `null`-argument ⇒ `false`; immutable/search_path/ingen execute for anon, authenticated, service_role, public;
- `display_fields` og `matching_fields` hver for seg: alle ugyldige former avvises med 23514 uten rad igjen; gyldige godtas og returneres uendret; UPDATE til `{}` avvises; constraintdefinisjonene inneholder `IS TRUE`;
- default-deny: ny profil har alle felt false i begge kart og er ikke i kraft; `synthetic-demo` v1 speiler fortsatt TS-profilen;
- samsvar med TypeScript: for hvert kart og begge feltkart lagrer databasen nøyaktig når `validateProfile` regner kartet som gyldig; TS er total for `null`, liste, primitiv, tomt, ufullstendig, ekstra nøkkel og ikke-boolsk;
- oppgradering (scratch-database med eldre rader): gyldige eksisterende rader ⇒ migrasjonen går gjennom og tabellinnholdet er **uendret (md5 over alle rader)**, `{}` avvises etterpå; ugyldig eksisterende rad (display, matching, begge) ⇒ migrasjonen stopper med `legacy-bad@v1`, ingen rad endres og funksjonen er uendret; meldingen nevner bare ugyldige rader og skiller display/matching.

## Før / etter
| | Før (uten DATA-002D) | Etter |
|---|---|---|
| `tests/db/data002d-field-map.test.ts` | 10 feiler, 55 består (tomt kart gir NULL/lagres; ingen IS TRUE; ingen kartlegging) | **64 består** |
| TS-validator med `display = null` | kaster unntak | gir funn `display` |
| Relevante DB-filer (`data002d`, `econ005b-rights`, `econ005b-empty-map-review`, `rights-profile-model`, `qa-catalog`) | — | grønne; oppgraderingsøyeblikksbildet (SEARCH-005-sjekken) OK |
| Hele DB-suiten, isolert klynge | 152 bestått, 12 feil, 247 hoppet over | 216 bestått, **12 feil, 247 hoppet over (uendret, Auth/PostgREST mangler)** |
| `vitest run` (hele) | 1 146 | **1 155 grønne** (50 filer); `tsc`, `eslint .`, `check-docs` rene |

Mutasjonskontroll (migrasjonskopier via `MIGRATIONS_DIR`): kartlegging fjernet (4 feil), kartlegging uten matching (1), `CASE` uten ikke-objekt (18), display-constraint `is not false` (1), matching-constraint fjernet (16), nøkkelsett uten `title` (migrasjonen feiler på gyldige rader ⇒ alle tester feiler).

## Begrensninger
Kjørt: vitest (hele), tsc, eslint, check-docs, DB-tester i isolert PostgreSQL 16 (ikke Supabase). Ikke kjørt: Supabase-avhengige DB-filer, `qa:migrations`, `qa:secrets`, build, e2e, hosted migrasjon. Ingen uavhengig review ennå. Migrasjonen krever at eksisterende miljøer først er kontrollert med kartleggingen (den stopper selv ved ugyldige rader).
