# CI-001 — kjøringsrapport: Actions-kjøring 39629190050 (21.10.2026)

**CI-001 forblir REVIEW (ikke DONE).** Ingen ny kjøring, ingen implementeringsendring, ingen endring på `main`, GitHub-innstillinger, hosted miljø eller deploy. L3c utsatt, økonomiflagg `false`, E7 utsatt, E8 åpent. Rapporten er utviklerens, fra det sanerte jobbsammendraget i den offentlige loggen; kjøringen er ikke uavhengig reviewet.

| | |
|---|---|
| Lenke | <https://github.com/chrakre-cyber/project-scout/actions/runs/39629190050> |
| Full kjørt commit | `c2dd683136181100e010e889412f46fc76151112` (identisk med reviewet FIX7-pakke `ca15928` bortsett fra dokumentasjon) |
| Utløst | `workflow_dispatch` fra `claude/wonderful-bardeen-yussx3` |
| Utfall | jobb **success**; **Samlet: PASS** — alle åtte kontroller (L1, L2, L3, L4a, L4b, L5, L6, L7) |
| Varighet | ca. 11,5 min (enkeltobservasjon, ikke garanti) |
| Reviewgrunnlag | `reviews/CI-001-forste-samlede-pass/` (sanert sammendrag, metadata, manifest) |

**Hva dette er:** den **første samlede PASS for den utvidede pakken med alle åtte kontroller**. Den tidligere, mindre kontrollpakken (L1, L2, L3, L7; kjøring 39578387230, commit `7ff3bbd`) hadde også samlet PASS. Dette er lokal Supabase i en container på en GitHub-runner — ikke hosted, ikke pilotgodkjenning.

## Direkte rapportert (fra den sanerte loggen)
| Kontroll | Utfall |
|---|---|
| L1 (12 migrasjoner fra tom DB; PostgreSQL 17.11; gotrue v2.197.0, kong 2.8.1, postgres 17.11.0.002, postgrest v16.4) | BESTÅTT |
| L2 (50 PASS, 0 FAIL) | BESTÅTT |
| L3a (stakk): 542 tester, 536 bestått, 0 feilet, **6 hoppet** | HOPPET OVER (ikke bestått) |
| L3b (separat PostgreSQL-klynge, **ikke Supabase**): 6 av 6 | BESTÅTT |
| L3 samlet | BESTÅTT |
| L4a (11/11, ekte GoTrue/PostgREST, API-nivå) | BESTÅTT |
| L4b (12 OK, 0 FEIL, 0 HOPPET, modus ekte) | BESTÅTT |
| L5a econ006: 94 OK, 0 FEIL, 0 HOPPET av 93 faste sjekker (modus ekte) | BESTÅTT |
| L5b econ006d: 26 OK, 0 FEIL, 0 HOPPET (modus ekte) | BESTÅTT |
| L5 samlet | BESTÅTT |
| L6 (14/14) | BESTÅTT |
| L7 (21 PASS, 0 FAIL, 0 SKIP) | BESTÅTT |
De seks hoppene i L3a er de samme kjente oppgraderingstestene som krever isolert klynge; de regnes ikke som bestått i L3a og dekkes **separat** av L3b (ikke Supabase). L3c er utsatt. L5a: 94 OK = 93 faste sjekker (J3 inkludert) + én av to valgfrie varianter; samme antall linjer som tidligere ekte kjøringer.

## Slutninger (ikke direkte rapportert)
- **J3 ble faktisk utført gjennom observatøren:** loggen sier at L5a er PASS uten hoppede sjekker. J3 er en av de 93 faste, og i ekte modus finnes bare observatør-grenen (ingen `skip`). Hvor mange skrivekall observatøren så, skrives ikke ut når sjekken er OK.
- **Observatørproxyen brukes bare i econ006/L5a.** L4b (l4-browser) og L5b (econ006d) går **ikke** gjennom proxyen og er selvstendige nettleserbelegg mot ekte lokal Supabase. At L5a består, støtter at den testede flyten (innlogging, økt, lagring) fungerte gjennom proxyen; det er ikke en separat måling av CORS, og CORS-adferd generelt er **ikke** verifisert — bare at de testede flytene fungerte.
- **De to tidligere L6-feilene** (ufiltrert PATCH, 400/21000) er ikke lenger til stede etter at kallene ble filtrert. Årsaken til den tidligere avvisningen er fortsatt **ubekreftet**.
- `partialInReal` for J3 ligger fortsatt i planen og hindrer ikke PASS når J3 er OK (evaluator uendret).

## Begrensninger
- Én kjøring: ingen vurdering av stabilitet over tid (rate limit-venting, image-henting, runner-image-endringer, tid).
- Originalloggen er ikke uavhengig bekreftet (reviewer fikk HTTP 403 på jobblogg-API-et); ingen funn i det sanerte sammendraget beviser ikke at hele originalloggen er uten sensitive data — skille mellom reviewet lekkasjevern, L7-utfall og faktisk logginnsyn gjelder; dette er utviklerens gjengivelse av den sanerte rapporten. Metadata om tokenrettigheter for akkurat denne kjøringen er ikke gjengitt fra loggtoppen.
- Workflowfilen på `main` er den eldre kopien; kjøringen brukte grenens versjon. Ingenting er merget.
- Ikke dekket: hosted Supabase (H1–H4), L3c, pilotklarhet, regel-/parametergodkjenning.
