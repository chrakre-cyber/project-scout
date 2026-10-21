# CI-001 — kjøringsrapport: Actions-kjøring 39623552258 (21.10.2026)

**CI-001 forblir REVIEW.** Rapporten er skrevet av utvikler fra det sanerte jobbsammendraget i den offentlige loggen; kjøringen er ikke uavhengig reviewet. Ingen kode, tester, regler eller forventninger er endret som følge av resultatet.

| | |
|---|---|
| Lenke | <https://github.com/chrakre-cyber/project-scout/actions/runs/39623552258> |
| Full kjørt commit | `5de9e5efe6e70fc75d3f8e89fee855b240ff5b94` (identisk med reviewet FIX6-pakke `0781275` bortsett fra dokumentasjon: `DECISIONS.md`, `MVP_BACKLOG.md`, `reviews/`) |
| Utløst | `workflow_dispatch` fra `claude/wonderful-bardeen-yussx3` (workflowfilen er den på grenen; ingen endring på `main`) |
| Varighet / utfall | ca. 12 min; jobb **failure** (exit 1 fordi samlet resultat ikke er PASS) |
| Samlet | **IKKE FULLT BESTÅTT — på grunn av J3 (L5a DELVIS)** |

## Kontrollresultater
| Kontroll | Resultat | Merknad |
|---|---|---|
| L1 | BESTÅTT | 12 migrasjoner fra tom database, PostgreSQL 17.11 |
| L2 | BESTÅTT | 50 PASS, 0 FAIL |
| L3a (stakk, ekte Auth/PostgREST) | HOPPET OVER (ikke bestått) | 542 tester: 536 bestått, **0 feilet**, 6 hoppet over. De seks er de **kjente** oppgraderingstestene som krever isolert klynge; de regnes ikke som bestått i L3a |
| L3b (separat PostgreSQL-klynge, **ikke Supabase**) | BESTÅTT | de samme seks: 6 av 6 kjørt og bestått |
| L3 samlet | BESTÅTT | L3a uten feil og uten uventede hopp + L3b 6/6 (de seks hoppene er dekket separat av L3b) |
| L4a (API, ekte GoTrue) | BESTÅTT | 11 av 11 |
| L4b (nettleser, modus ekte) | BESTÅTT | 12 OK, 0 FEIL, 0 HOPPET |
| **L6** (firmaskille via ekte PostgREST) | **BESTÅTT** | **14 av 14, med de reviewede forventningene; ingen tester feiler** |
| L7 | BESTÅTT | 21 PASS, 0 FAIL, 0 SKIP |
| L5a econ006 (nettleser, modus ekte) | **DELVIS** | 93 OK, 0 FEIL, **1 HOPPET = J3** |
| L5b econ006d (nettleser, modus ekte) | BESTÅTT | 26 OK, 0 FEIL, 0 HOPPET |
| L5 samlet | **DELVIS** | L5a delvis, L5b bestått |

**De to tidligere L6-feilene** (`dealer_economics_profiles`, kjøringene 39596080162 og 39603111353) består nå uten svekkede forventninger: positiv PATCH filtrert på eget firma gir forventet 200 og oppdatert rad, og forsøket på å flytte Bs profil (filter på Bs rad, payload `dealership_id` = A) gir forventet 403/42501 med begge profiler uendret. Dette fremgår av at testene består; diagnostikken skriver bare for feilede tester, så det finnes ingen operasjonsliste fra denne kjøringen.

## Begrensninger
- **Årsaken til de tidligere 400/21000-avvisningene er ikke bekreftet.** At de filtrerte kallene fungerer, viser at det var de ufiltrerte kallene som ble avvist, ikke hvilken komponent som avviste dem eller om safeupdate er aktiv.
- **J3 er fortsatt hoppet** (ingen forespørselslogg i ekte modus); L6 (databasen avviser feltet) er en annen påstand og erstatter den ikke. L5 kan ikke bli PASS før J3 er verifisert i ekte modus.
- Rapporten bygger på sanert logg; originalloggen er ikke uavhengig bekreftet. Én enkeltobservasjon av varighet er ikke en garanti.
- Ikke dekket: hosted Supabase (Trinn H), L3c (utsatt), pilotklarhet. Økonomiflagg `false`, E7 utsatt, E8 åpent.
