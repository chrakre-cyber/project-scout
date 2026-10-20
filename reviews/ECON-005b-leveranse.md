# ECON-005b — rettigheter for avledet økonomiberegning (leveranse til review)

**Status: REVIEW (005b). ECON-005c–d er ikke startet. Migrasjonen er IKKE anvendt i hostet miljø** (kun lokal/isolert PostgreSQL). Ingen UI-, server-, provider-endring; ingen endring av økonomiflagg, `classifyBudget`, avgiftsmotor (`src/domain/economics`, `src/domain/tax`) eller avrundingspolicy. Forrige skive: `reviews/ECON-005a-avslutning.md` (DONE innen levert omfang).

## Modell (plan § 3)
To adskilte rettigheter i den eksisterende rettighetsprofilen, begge **default nei**:
- **Beregning per kildefelt** — `allow_derived_economics` (DB jsonb, nøyaktig nøklene `price`, `registration`, `specs`) / `ProviderRightsProfile.derivedEconomics.allow`. Dette er de kildefeltene økonomiberegningen leser (innkjøpspris; første registrering; drivstoff/CO₂/vekt m.m.). Øvrige felt (tittel, km, tekst, selger, bilder …) kan aldri brukes (ukjent felt ⇒ nei).
- **Visning** — `display_derived_economics` (DB boolean) / `derivedEconomics.display`. Visning krever i tillegg (a) beregningsrett for alle brukte felt, og (b) gjeldende `display`-rett for hvert *rå* felt visningen avslører (`reveals`, f.eks. `price`).

Regler (fail-closed, speilet i TS og SQL): ingen profil / utkast / trukket / utløpt / ikke begynt / ugyldig ⇒ nei, med årsak (`economicsDecision`: `unknown_provider|not_verified|revoked|expired|not_started|invalid_profile|no_fields|field_not_granted|display_not_granted|reveal_not_granted`). Tom/null feltliste ⇒ nei. Matching- og visningsrett gir ikke beregningsrett, og omvendt. Ugyldig `derivedEconomics` (manglende/ekstra nøkkel, ikke-boolsk, visning uten noe tillatt felt) gjør *hele* profilen ugyldig ⇒ alt avslås. Rettigheten er en del av `canonicalPermissions`, så endring på plass oppdages som endret avtrykk.

## Syntetisk demo — og et avvik å ta stilling til
`synthetic-demo` v1 settes **eksplisitt** til alle tre felt + visning = true (TS: `SYNTHETIC_RIGHTS_PROFILE`; DB: backfill `where provider='synthetic-demo' and version=1 and environment='synthetic'`). Sandbox/live får ingenting automatisk; ingen slik profil finnes. **Avvik fra «ny versjon»:** demoprofilen oppdateres *på plass* (v1) i stedet for som v2, etter samme begrunnelse som DATA-002B: en ny verifisert versjon ville forkortet v1 og gjort eksisterende kjøringer usynlige via DEC-028-synlighetsregelen (`rights_profile_active`). Etter migrasjonen er de nye kolonnene uforanderlige (vakttriggeren dekker dem), så retten kan bare endres ved en ny versjon. Sier du at demoen skal være v2, må v1-forkortelsen og dens virkning på `search_runs` vurderes først.

## Migrasjon `supabase/migrations/20261021090000_econ005b_derived_economics_rights.sql` (additiv)
Ny valideringsfunksjon `private.economics_rights_map_valid`; kolonnene `allow_derived_economics jsonb not null default {alle false}` og `display_derived_economics boolean not null default false`; constraints (gyldig feltkart; visning krever minst ett tillatt felt); backfill av syntetisk demo; `rights_profiles_guard()` erstattet med samme logikk **pluss** de to kolonnene i immutabilitetssjekken; `private.can_derive_economics(provider, at, fields[])` og `private.can_display_economics(provider, at, fields[], reveals[])` (SECURITY DEFINER, `search_path=''`, execute **revoked** fra public/anon/authenticated/service_role). Ingen endring av tabeller utenom rettighetstabellen, RLS, kjøringstriggere, purge, synlighet eller `no_delete`-vakten. Ingen avledede tall lagres (E9).

## Tester
- `tests/economics-005b-rights.test.ts` (30): default nei (fixture, sandbox/live, ukjent leverandør); matrise beregning × visning × prisvisningsrett; feltbegrensninger (alle undermengder, ukjente/prototype-nøkler, tom liste); profilgyldighet (utkast, trukket, utløpt eksklusiv slutt til ms, ikke begynt, seks typer ugyldig profil, versjonsoppløsning); avtrykk.
- `tests/db/econ005b-rights.test.ts` (24): migrasjon/default/NOT NULL; ugyldige feltkart (5); visning uten felt; immutabilitet (3 endringer + utkast + synthetic-demo etter migrasjon + revoke/forkorting virker fortsatt); SQL-funksjoner fail-closed; **ingen execute for anon/authenticated/service_role**, og `SET ROLE authenticated/anon` får 42501 på funksjon, tabell og skriving (ordinær rolle, ikke service-role); **differensialtest TS ↔ SQL**: 10 profilkonfigurasjoner × 5 tidspunkter × 10 feltsett × 7 reveal-sett (> 1 500 sammenlignede beslutninger, avledet og vist) + tilbakekalt + versjonsoverstyring + felles nøkler/standard; **oppgraderingstest** i scratch-database: legacy verifiserte live-/sandbox-profiler med full visning/matching får ingenting, bare `synthetic-demo` v1 får true.
- `tests/db/qa-catalog.test.ts`: whitelist over SECURITY DEFINER og execute-vakt utvidet med de to nye funksjonene (forventet endring).
- `tests/fixtures/rights-profiles.ts`: `derivedEconomics` default nei i `profile()` og i sandbox-eksemplet.
- Mutasjonskontroll (DB): vakt-trigger uten nye kolonner (6 feil, begge retninger), default true (3), reveal-sjekk fjernet (2), visningsbit fjernet (1), koherens-constraint fjernet (1), execute gitt til authenticated (2), backfill på alle profiler (1, fanges bare av oppgraderingstesten). Overlevende: fjernet `f not in (price,registration,specs)`-test er ekvivalent (ukjent nøkkel gir null ⇒ false uansett; beholdt som dyp forsvarslinje). TS: tom feltliste tillatt (1), revealkontroll fjernet (9), visningsbit fjernet (1), koherenssjekk fjernet (2).

## Kontroller (utviklerens, ikke uavhengig review)
| Kontroll | Resultat |
|---|---|
| `vitest run` (hele) | 1 142 tester, 50 filer, alle grønne (1 112 før 005b) |
| `tsc --noEmit`, `eslint .` | ingen feil, ingen advarsler |
| `node docs/tax/check-docs.mjs` | OK |
| DB-tester i isolert PostgreSQL 16 (`scripts/test-db-isolated.sh`) | `econ005b-rights` 24/24; `rights-profile-model` + `qa-catalog` grønne (73 i de tre filene); oppgraderingsøyeblikksbilde (SEARCH-005-sjekken) OK |
| Hele DB-suiten i isolert klynge | 143 bestått, **12 feil, 247 hoppet over — identisk med baseline uten 005b** (12 feil/247 hoppet over: Auth/PostgREST finnes ikke i den isolerte klyngen; `signIn`-avhengige filer og `qa-limit` kan ikke kjøres her). Baseline: 120 bestått |

**Ikke kjørt:** DB-/RLS-tester som krever lokal Supabase (Auth + PostgREST; Docker er ikke tilgjengelig her) — dvs. `rls`, `agents`, `search-runs`, `qa-isolation`, `qa-validation`, `rights-retention`, `qa-limit`; `qa:migrations`, `qa:secrets`, build, e2e. Migrasjonen er ikke anvendt i noe hostet miljø. Ingen uavhengig review av 005b ennå.

## Begrensninger / videre
Ingen kode bruker rettighetene ennå (server-orkestrering er 005c; visning 005d). TS-profilen lastes ikke fra DB i runtime (registeret er fortsatt kun den syntetiske profilen). «Visning» er én boolean (granularitet senere, plan § 3). Neste: uavhengig review av 005b; deretter Christians beslutning om 005c.
