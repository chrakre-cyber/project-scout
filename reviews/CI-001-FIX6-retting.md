# CI-001-FIX6 — filter på de to ufiltrerte PATCH-kallene i L6 `dealer_economics_profiles` (til uavhengig review, 21.10.2026)

**CI-001 forblir REVIEW.** Stoppet før ny Actions-kjøring. Ingen endring av RLS, grants, migrasjoner eller appkode (`git diff supabase src` er tom); ingen endring på `main`, innstillinger, hosted miljø eller deploy. **J3 forblir DELVIS** (L5a/L5 DELVIS). L3c utsatt, økonomiflagg `false`, E7 utsatt, E8 åpent.

## Registrert først
`reviews/CI-001-kjoring-3-underlagsreview.md`: ingen nye blokkerende funn i dokumentgrunnlaget; anbefaler akkurat denne avgrensede testrettingen. Bevart: reviewen kjørte ingen database, nettleser eller Actions, originalloggen er ikke hentet eller uavhengig bekreftet; 400/21000 bekrefter ikke hvilken komponent som avviser eller at safeupdate er aktiv, og «ikke RLS-avvisning» skal leses snevert (responsen prøver ikke den forventede grant-/RLS-påstanden); ikke trekk slutninger om intern evalueringsrekkefølge fra statuskoden alene.

## Retting (kun `tests/db/rest-isolation.test.ts`; testnavn og fastlåst identitet uendret)
1. **Positiv test («eget firma …»):** PATCH filtrert på eget firma `?dealership_id=eq.${firmA}` (slik appen gjør). Forventning uendret: **200**. Skjerpet kontroll av oppdatert profil: nøyaktig én rad, `dealership_id` = A, `updated_by` = bruker A, `deduction` = `recoverable`; i databasen er A oppdatert og **B uendret** (`unknown`).
2. **Flyttetest («på tvers av firma …»):** PATCH filtrert på **Bs egen rad** `?dealership_id=eq.${firmB}`, payload fortsatt `{ dealership_id: firmA }`. Forventning uendret: **403 / 42501**. Nytt til slutt: begge firmaers profiler (nøkkel, payload, `updated_by`, `created_at`, `updated_at`) er identiske med øyeblikksbildet tatt før operasjonene; den eksisterende kontrollen av A beholdt.
3. **400/21000 er ikke godtatt noe sted**; ingen forventning er utvidet eller svekket.

## Før / etter og kontroller (alt IKKE Supabase der det er markert)
| Kontroll | Resultat |
|---|---|
| Ekte Supabase-stakk (Actions 39603111353, a8fe61f) | **før:** begge testene feilet (ufiltrert PATCH 400/21000). **Etter: ikke kjørt** |
| Ekte PostgREST 12.2.12-binær + isolert PostgreSQL (ikke Supabase, ikke GoTrue), `scripts/test-rest-isolation-offline.sh` | 17 bestått, 8 hoppet (alle 14 L6 + 3 L4a-token) — også før retting |
| Mutasjon M2 (migrasjon midlertidig utvidet med `grant update (dealership_id) … to authenticated`; tilbakestilt) | flyttetesten **feiler** («expected [400,'23514'] to equal [403,'42501']»): endret/åpnet kolonnerettighet oppdages; (en annen kontroll i databasen avviser da likevel flyttingen med 23514 — dybdevern, og testen krever uansett 403/42501) |
| Mutasjon M3 (positiv PATCH filtrert på B) | positiv test **feiler** |
| Mutasjon M1 (flyttetest filtrert på A i stedet for B) | **består fortsatt** i denne PostgREST/PostgreSQL-oppsettet: kolonnerettigheten avvises uavhengig av hvilke rader filteret treffer. M1 skiller altså ikke; B-filteret er likevel brukt som bestilt (det prøver kolonnerettigheten på en rad B faktisk kan se, uavhengig av om en bestemt stakk evaluerer rettigheter før radsynlighet) — ikke en påstand om evalueringsrekkefølge |
| `npx vitest run` | 87 filer / **1 929 tester bestått** |
| `tsc --noEmit` / `eslint` / `qa-secret-scan.sh` | exit 0 / exit 0 / INGEN FUNN |

## Begrensninger
- **Rettingen er ikke bekreftet mot ekte Supabase-stakk.** Om filtrert PATCH som B med `dealership_id`-payload gir 403/42501 der (og om en eventuell «krever WHERE»-regel er årsaken til forrige avvisning) vet vi først etter en ny autorisert kjøring. Skulle stakken gi noe annet enn 403/42501, rapporteres det uten å svekke forventningen.
- Årsaken til 400/21000 forblir **ubekreftet** (meldingstekst/komponent ikke registrert; statuskode alene beviser ikke safeupdate eller intern evalueringsrekkefølge).
- Diagnostikken fra 7e3e549 er uendret og beholdt, slik at neste kjøring viser operasjon/status/kode også for de rettede kallene.

## Neste oppgave
Re-review av FIX6; deretter, etter din separate autorisasjon, én ny manuell kjøring.
