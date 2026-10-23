# PILOT-003 — Herde kuratert offentlig demo mot utløp

Dato: 2026-10-23 · Basis: `main` f8f105e (PILOT-002 merget) · Kode-commit: `148d9ac` · Kun demoherding; ingen endring i leverandørrettigheter, økonomiformler, FX eller live-data.

## 1. Rotårsak (verifisert i kode og i appen)

Lagene som ble gjennomgått:

| Lag | Utløper? | Rolle |
|---|---|---|
| Syntetisk observasjonstid (`lastSeenAt`) | Nei, i seg selv | Fornyes til et 48 t-vindu før `SYNTHETIC_DEFAULT_EPOCH` (2026-10-21T06:50Z). |
| Rettighetsprofilens lagring (`SYNTHETIC_RIGHTS_PROFILE`: `retentionSeconds` 604 800 = 7 døgn, `validUntil` null) | Gir tallet 7 døgn | Brukes til å beregne kildedatagrensen. |
| **Kildedatagrensen i `assessEconomics`** (`src/server/search-economics.ts`): `sourceDataLimit = lastSeenAt + retention` | **Ja — dette er årsaken** | Inngår i `computeValidUntil`; når nå ≥ grensen blir klassen `stale` (`validity_exhausted:source_data`) ⇒ UI «Beregningen er utløpt: kildedataene er for gamle». Med observasjoner opp til 2026-10-21 treffer det **ca. 27.–28. oktober**. |
| Avgiftsprofilens dokumenterte periode (`DOCUMENTED_RULE_PERIOD` slutt 2026-12-31 ⇒ grense 2027-01-01) | Ja, men senere | Ekte regelgrense. |
| Teknisk tak (now + 24 t), kursens gyldighet (demoinput: 14 døgn fra beregningsdato) | Rullerende | Utløper aldri av seg selv for demoen. |
| Demo-fixturen (`demoDealerInput`) | Nei | Datoer følger beregningstidspunktet. |

Demobilen ble altså «gammel» bare fordi den behandles som en leverandørobservasjon med 7 døgns holdbarhet, selv om den er en fast kuratert syntetisk post.

## 2. Valgt demo-policy: `curated_public_demo_static`

- Ny modul `src/server/curated-demo.ts` (avhengighetsfri; flyttet hit for å unngå sirkulær import): `DEMO_VEHICLE`, `isCuratedDemoVehicle` (uendret logikk), `CURATED_DEMO_VALIDITY_POLICY` og `sourceDataValidityLimit(listing, rights, defaultUntilIso)`.
- `assessEconomics` kaller `sourceDataValidityLimit` i stedet for å bygge `{label:"source_data", untilExclusive}` selv. For den kuraterte demobilen blir grensen `{label:"curated_public_demo_static", untilExclusive:null}` (ingen slutt for DENNE grensen); alle andre får nøyaktig det samme som før.
- Ingen observasjonstider flyttes, ingen «falske ferske observasjoner», ingen global konstant endret.

**Hvorfor den ikke kan påvirke live/provider-data:** policyen utløses bare når `isCuratedDemoVehicle` er sann: rettighetsprofil i kraft, miljø `synthetic`, leverandør-id `synthetic-demo`, kilde `synthetic-demo`, annonse-id `dix3-001`, proveniens `synthetic`, og annonsens egne fakta (BMW iX3 Inspiring, 03/2024, netto EUR 36 950) stemmer. Leverandør-, sandbox- og live-annonser, og en annonse som bare ser ut som demobilen, avvises på kilde/proveniens/profil/fakta (testet). En arkitekturtest låser at policyen bare refereres i `curated-demo.ts`, `demo-economics.ts`, `search-display.ts` og `search-economics.ts`, og ikke i `provider-rights.ts`.

## 3. Avgiftsprofilens utløp (egen behandling)

Uendret og synlig: `DOCUMENTED_RULE_PERIOD = 2026-01-01…2026-12-31`. Demoen beregner med akseptdato = beregningsdagen, så **fra og med 2027-01-01 er demoøkonomien «ikke beregnet» (lukket)** — verifisert i test og nettleser. Ingenting forlenger skattereglenes gyldighet.
**Operasjonell oppdatering som kreves før 2027-01-01:** ny/oppdatert avgiftsprofil og dokumentert periode for 2027 (kilder, virkningsdato, versjon og uavhengig referanse jf. CLAUDE.md pkt. 5), eller bevisst avvikling/oppdatering av demoen.

## 4. Endrede filer

Kode: `src/server/curated-demo.ts` (ny), `src/server/demo-economics.ts` (re-eksporterer; flyttet predikat), `src/server/search-economics.ts` (én linje), `src/providers/marketplace/synthetic/epoch.ts` (kommentar).
Tester: `tests/pilot-003-demo-validity.test.ts` (ny, 12 tester); `tests/econ-003-demo-fixture.test.ts` og `tests/pilot-002-economics-coherence.test.ts` oppdatert (de kodet det gamle observasjonsutløpet for demoen; nå testes utløpt avgiftsprofil i stedet).
Docs: `DECISIONS.md` (runde 97), `MVP_BACKLOG.md`, `TEST_PLAN.md`, dette dokumentet.

## 5. Tester (faktisk kjørt)

| Kontroll | Resultat |
|---|---|
| `tests/pilot-003-demo-validity.test.ts` | 12/12 OK |
| Full `vitest run` | 100 filer / 2 292 tester OK |
| `tsc --noEmit`, `eslint .`, `next build` | OK |
| `docs/tax/check-docs.mjs` | OK |
| `npm run qa:demo` | alle PASS |

Dekning av kravene: (1) demoøkonomien finnes ved klokker 23.10., 29.10., 20.11. og 31.12.2026 (ekte pipeline, fornyet epoke) — alle etter det gamle utløpet bortsett fra den første; (2) samme 484 214 – 559 214 kr og samme linjer (424 925 / 18 058 / 8 000), samme observasjonstid; (3) generisk syntetisk annonse går fortsatt `stale`/`source_data` etter 7 døgn; (4) sandbox/leverandør/live og «ser ut som demobilen» får ordinær kildegrense (`source_data`); (5) rettighetsprofilens lagringstid og `retentionExpiresAt`/`isWithinRetention` uendret; (6) 2027-01-01 og senere: ingen estimat/scenarier; (7) `TRANSIENT_FRESH_MS`, 604 800 s, epoke, 48 t-vindu og `DOCUMENTED_RULE_PERIOD` uendret. **Mutasjonssjekk:** uten koblingen i `assessEconomics` feiler 5 tester; med policyen påført alle annonser feiler de to «generisk/leverandør»-testene.
**Nettleser-e2e mot dokumentert `main`-baseline (kjørt etter PILOT-003, commit `17fa854`):**

| Suite | PILOT-003 | `main`-baseline (PILOT-002-koden, samme dag) | Sammenligning |
|---|---|---|---|
| `search005` | 77/77 OK | 77/77 OK | identisk |
| `econ006` | 86/94, 8 feil | 86/94, 8 feil | **identisk feilsett** (full feillinje inkl. detaljtekst) |
| `econ006d` | 23/26, 3 feil | 23/26, 3 feil | **identisk feilsett** (full feillinje inkl. detaljtekst) |

Feilene er de kjente kalenderfølsomme (J3 ×3, J6, J7, J9 PHEV, avrundingslikhet, preview ×2 i `econ006`; J5 ×2 og B1 i `econ006d`) — ingen nye deterministiske feil, ingen endring i leverandør-/sandbox-/live- eller generisk syntetisk atferd. Baselineloggene er kjørt på PILOT-002-koden (identisk med `main` f8f105e, som bare legger til merge-commit). Den tidligere observerte flakete sjekken «alle action-svar … >10 svar» dukket ikke opp.

## 6. Nettleserverifisering (ekte app, PILOT-001-driveren)

Serverens klokke ble flyttet frem med et preload-skript utenfor repoet (`Date.now`/`new Date()` + N døgn; kun for `next start`-instansen, ikke en del av appen). Samme build, samme data.
- **Klokke 2026-12-02 (+40 d, langt etter 27.–28. okt):** BMW iX3-demoen viser fortsatt «Demo-estimat 484 214 – 559 214 kr» i resultatlisten og detaljsiden (nedbrytning, «transport … oppgitt separat», forutsetninger notert 2026-12-02); 0 «Minst», 0 «ikke beregnet»-påstand ved siden av beløp; generiske annonser uten input uendret «ikke beregnet»; 0 JS-/konsollfeil.
- **Klokke 2027-01-31 (+100 d, etter avgiftsprofilen):** ingen estimat for noen annonse; demobilen viser «Estimert innkjøpskostnad til Norge: ikke beregnet» (lukket), 0 «Minst», ingen «Estimert total»; 0 feil.

## 7. Gjenstående operasjonelle datoer/avhengigheter

- **2026-12-31 / 2027-01-01:** avgiftsprofil og dokumentert periode må oppdateres (se §3) — ellers lukket «ikke beregnet».
- Demoens syntetiske kurs 11,50 (`docs/tax/demo-series.json`) er en fast demokurs; den utløper ikke, men er ikke en markedskurs og må bevisst vurderes ved eventuell oppdatering av demoen.
- Epokemerkingen «Syntetisk generert 21.10.2026» står uendret (observasjonene er ikke flyttet). Demoen skal fortsatt bevisst oppdateres/avvikles.
- Generiske syntetiske annonser og alle ekte kilder utløper som før (7 døgn / 5 min / profilens regler).
- Live leverandørtilgang er fortsatt ikke godkjent (uendret).

## 8. Klar for PR?

Ja, for review: alle kjørte kontroller grønne, policyen er isolert og dokumentert, og avgiftsgrensen er bevart. e2e-suitene er kjørt og matcher `main`-baseline (se §5).
