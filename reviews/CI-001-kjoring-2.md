# CI-001 — resultat av Actions-kjøring 39596080162 og årsaksvurdering av to L6-feil (til uavhengig review, 21.10.2026)

**CI-001 forblir REVIEW.** Ingen ny Actions-kjøring er startet. Ingen endring på `main`, ingen innstillinger, ingen hosted migrasjon/deploy. Ingen tilgangsregler (RLS, grants, triggere, migrasjoner) og ingen testforventninger er endret. L3c utsatt, økonomiflagg `false`, E7 utsatt, E8 åpent.

## 1. Registrert resultat
Kjøring: <https://github.com/chrakre-cyber/project-scout/actions/runs/39596080162> · full commit `2cbd356779c18b2a73451d70fd7e29de941eac07` (kode/test/konfig/workflow identisk med reviewet 247af27; kun dokumentasjon forskjellig) · `workflow_dispatch` fra `claude/wonderful-bardeen-yussx3` · ca. 12 min · conclusion **failure** · samlet **IKKE FULLT BESTÅTT**. Kilde: sanert jobbsammendrag i den offentlige loggen. Kjøringen har ikke vært uavhengig reviewet.

| Gruppe | Kontroll | Utfall |
|---|---|---|
| **Bestått (ekte lokal Supabase i runner)** | L1 (12 migrasjoner fra tom DB) | BESTÅTT |
| | L2 (50 PASS, 0 FAIL) | BESTÅTT |
| | L3b (6/6, separat PostgreSQL-klynge, **ikke Supabase**) | BESTÅTT |
| | L4a (11/11, ekte GoTrue) | BESTÅTT |
| | L4b (12 OK, 0 FEIL, 0 HOPPET, modus: ekte) | BESTÅTT |
| | L5b (26 OK, modus: ekte) | BESTÅTT |
| | L7 (21 PASS, 0 FAIL, 0 SKIP) | BESTÅTT |
| **Nye feil (2 tester)** | L6 `dealer_economics_profiles`: «eget firma: POST, GET, PATCH; duplikat gir 409 (23505)» | **FEILET** |
| | L6 `dealer_economics_profiles`: «på tvers av firma: B ser/endrer ikke As profil; falsk dealership_id avvises; ingen kan slette; databasen er uendret» | **FEILET** |
| | Følger: L6 = 12/14 (FEILET); L3a = 542 tester, 534 bestått, **2 feilet**, 6 hoppet (de samme to; ikke fire); L3 samlet FEILET | |
| **Kjent delvis dekning** | L5a econ006: 93 OK, 0 FEIL, **1 HOPPET = J3** (ingen forespørselslogg i ekte modus) ⇒ DELVIS; L5 samlet DELVIS | forventet, uendret; API-dekning (L6) erstatter ikke J3 |

De to feilene er **nye** og **ikke relatert til J3**. Antallet feilede tester er to, selv om de vises i både L3a og L6. L3a «6 hoppet» er de seks oppgraderingstestene (dekket av L3b), uendret fra første kjøring.

## 2. Årsaksvurdering (ikke bekreftet mot ekte stakk)
**Status: sannsynlig årsak identifisert, men ikke bekreftet.** Den sanerte loggen oppgir bare testnavn, ikke operasjon/status/kode. Ekte Supabase-stakk kan ikke kjøres i sandboxen (images kan ikke hentes).

**Funn ved kodelesing.** De to feilende testene inneholder de **eneste to PATCH-kallene uten filter** i hele `tests/db/` (`rest("PATCH", "dealer_economics_profiles", …)` uten `?…`): `upd` (test 1, forventet 200) og `move` (test 2, forventet 403 / 42501). Alle andre PATCH/DELETE i L4a/L6 har filter (`?id=eq.…`, `?dealership_id=eq.…`). Appen selv bruker alltid `.eq("dealership_id", …)` (`src/server/dealer-economics-store.ts:70`), så dette er en egenskap ved testene, ikke ved appen.

**Hypotese H1 (uten WHERE avvises av API-laget):** hvis Supabase-stakken har `pg-safeupdate` (Supabase dokumenterer den som valgfri utvidelse som aktiveres per rolle; dette er ikke verifisert for lokal stakk), gir PATCH uten filter avvisning (HTTP 400, SQLSTATE `21000`, «UPDATE requires a WHERE clause») før RLS eller triggere er involvert. Dette ville gjort `upd` (forventet 200) og `move` (forventet 403/42501) feil, og kun disse. Det er **en testkonstruksjon som ikke er forenlig med stakken, ikke en RLS-feil**. En avvisning er ikke automatisk et RLS-brudd.

**Støtte (ikke bevis).** Mot en ekte PostgREST 12.2.12-binær foran isolert PostgreSQL (uten safeupdate, uten GoTrue) består alle 14 L6-tester og 3 L4a-tokentester (17 bestått, 8 hoppet) — kjørt i dag. Når jeg i en **simulering** (kastet etter bruk, ikke innsjekket) lar proxyen avvise PATCH/DELETE uten filter med 400/`21000`, feiler **nøyaktig de to testene**, de øvrige 12 L6 og L4a består — samme mønster som i Actions (12/14). Simuleringen viser at hypotesen er konsistent med observasjonen, ikke at safeupdate faktisk er aktiv.

**Følger feil 2 av at test 1 ikke fullførte oppsettet?** Nei, ikke etter dette sporet:
- Test 2 trenger at begge firmaene har en profil (opprettes av test 1 via to POST). Kjørt alene feiler test 2 (verifisert lokalt: «expected [] to deeply equal [Array(1)]»), så avhengigheten finnes.
- Test 1 sin PATCH er siste operasjon; POST A, POST B, duplikat og GET kommer før. Under H1 er oppsettet altså ferdig når test 1 feiler (simulert sporing: POST 201, POST 201, POST 409/23505, GET 200, PATCH 400/21000), og test 2 feiler på sin **egen** ufiltrerte PATCH (operasjon 6, etter at GET/PATCH/POST-påstandene før den holdt).
- Hvis derimot test 1 hadde feilet **før** B sin POST (f.eks. tidlig POST), ville test 2 feilet som følgefeil. Det kan loggen ikke utelukke — derfor diagnostikken under.

**Andre mulige årsaker som ikke er utelukket** (må skilles av diagnostikken): forskjell mellom stakkens PostgREST-versjon og 12.2.12 (statuskoder/Prefer), `auth.uid()`/claims-oppførsel i ekte GoTrue-JWT, rettighets-/triggeroppsett som avviker i stakkens `public`-skjema, dataforurensning fra parallelle testfiler (GET forventer nøyaktig én rad per firma). Ingen av disse er verifisert.

## 3. Diagnostikkendring (til review) — ingen ny kjøring
- `tests/db/rest-isolation.test.ts`: `rest()` registrerer per kall bare **metode, tabellnavn (før `?`), HTTP-status og kode** (kode kun hvis SQLSTATE `[0-9A-Z]{5}` eller `PGRSTnnn`, ellers `-`). Ved feilet test skrives sporet til filen i `SCOUT_L6_DIAG_FILE`; uten variabelen eller uten feil skjer ingenting (verifisert: ingen fil ved bestått kjøring). **Ingen påstand er endret.**
- `scripts/ci-supabase-local.sh`: setter `SCOUT_L6_DIAG_FILE="$W/l6-diag.txt"` bare for L3a-kjøringen (privat katalog).
- `scripts/ci/evaluate.mjs`: `parseL6Diag` slipper bare linjer som følger formatet **nøyaktig**, hører til en **feilet fastlåst test** og har tabell `[a-z_]+`; maks 40 linjer per test. Fritekst, ekstra felt, spørringsdeler, URL-er, tokens, ukjente testnavn og tester som ikke feilet forkastes. Diagnostikk kan ikke endre status (FAIL forblir FAIL, PASS forblir PASS).
- Rapporten viser testnavn og linjer som `#5 PATCH dealer_economics_profiles → HTTP 400, kode 21000`. **Forventet** verdi står ikke i linjene; den leses av testkoden (for de to testene: `upd` 200; `move` 403/42501; øvrige som i navnet). Ingen rå responser, payload, filterverdier, cookies, tokens, credentials eller tilkoblingsadresser kan passere.
- Tester: `tests/ci-l6-diag.test.ts` (9) og en justering av den statiske rammetesten (`tests/ci-workflow.test.ts`: tillater akkurat denne `run`-linjen med miljøvariabelen; ellers uendret).

## 4. Kontroller kjørt
`npx vitest run`: 87 filer / **1 929 tester bestått** (før diagnostikk: 1 920) · `tsc --noEmit` exit 0 · `eslint` exit 0 · `qa-secret-scan.sh`: INGEN FUNN · PostgREST-binærharness (IKKE Supabase): 17 bestått, 8 hoppet · simulering som beskrevet. Emulert orkestrering (`scripts/test-ci-orchestrator-offline.sh`, IKKE Supabase): alle kontroller bestått. Ikke kjørt: ekte Supabase, Actions, nettleser.

## 5. Videre (venter på beslutning)
1. Review av diagnostikkendringen.
2. Etter separat autorisasjon: én ny kjøring. Diagnostikken viser da operasjon/status/kode for de to testene.
3. **Rettelse først etter dokumentert årsak:** hvis H1 bekreftes, er riktig tiltak å gi PATCH et filter (`?dealership_id=eq.<eget firma>`) i de to kallene — en testendring som beholder intensjonen («eget firma kan endre; ingen annen kan flytte rad»). Det er **ikke gjort** og krever din beslutning, siden det endrer testkoden. Ingen RLS-endring er indisert av dagens belegg.
