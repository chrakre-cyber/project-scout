# DEV-004 — leveranserapport

Dato: 06.10.2026 · Branch: `claude/wonderful-bardeen-yussx3` · Status: REVIEW (ikke DONE)

## Leveranse

En innlogget bruker kan, innenfor eget firma:
- opprette en agent (`/agents/new`),
- redigere alle søkekriterier og økonomiforutsetninger (`/agents/<id>`),
- se valideringsfeil per felt,
- se hva som mangler før aktivering,
- aktivere, pause og reaktivere agenten,
- finne samme tilstand igjen etter reload.

Validering skjer på serveren (domeneregler) og håndheves av databasen med CHECK-constraints, slik at heller ikke direkte API-kall med egen sesjon kan omgå den. Grensen på 10 aktive er fortsatt databasens trigger fra DEV-002.

UI-et sier tydelig at «aktiv» ikke betyr at automatisk søk eller live mobile.de-data er i gang (DEV-005).

## Grunnlag og tolkning

- **SPRINT_1_HANDOFF DEV-004:** navn, «minst merke/modell eller avklart bredere filter», retail-input med eksplisitt prisgrunnlag, positivt minimum bidrag, reserve, active-status, versjon øker, maks 10 atomisk.
- **PRODUCT_SPEC §4:** feltene merke, modell/variant, alder, km, gir, drivstoff, karosseri, land og prisramme; salgspris, prisgrunnlag, reserve og minimum bidrag i kroner.
- **IMPORT_ENGINE_SPEC «Inputs»:** retail eksplisitt inkl./ekskl. mva. og registreringsavgifter; reserve med mva.-basis.
- **Motstrid/avgrensning:** DATABASE_SCHEMA nevner også skatteprofil, kurs, transport og forsikring i `assumptions`. Disse krever motorer og datakilder som ikke finnes (DEV-007/009), så de kreves ikke og lagres ikke nå (DEC-024).
- **Prisramme:** modelleres som maks annonsepris (eksisterende `maxPrice`). Minstepris finnes ikke i modellen og er ikke lagt til.

## Felt som kan redigeres

| Del | Felt | Tomt betyr |
|---|---|---|
| Agent | navn (påkrevd, 1–120) | — |
| Søkekriterier | merke, modell, variant, årsmodell fra/til, maks km, drivstoff, gir, karosseri, land, maks annonsepris + valuta | «alle» |
| Bredt søk | «Jeg vil bevisst søke på tvers av merker» (bare relevant uten merke) | ikke bekreftet |
| Økonomi (NOK) | forventet norsk salgspris; inkl./ekskl. mva.; inkl./ekskl. registreringsavgifter; minimum ønsket bidrag; klargjøringsreserve; mva.-basis for reserve | «ikke oppgitt» |

## Valideringsregler (server og database)

| Regel | Detalj |
|---|---|
| Navn | 1–120 tegn |
| Merke, modell, variant | 1–60 tegn; modell krever merke; variant krever modell |
| Årsmodell | heltall 1900 – inneværende år + 1 (databasen: 1900–2100); fra ≤ til |
| Maks km | heltall 1–2 000 000. 0 avvises, fordi det ikke er et meningsfullt filter |
| Drivstoff, gir, karosseri, land | faste lister; ukjente verdier avvises; duplikater slås sammen (server) eller avvises (database) |
| Maks annonsepris | > 0 i støttet valuta (DEC-018); krever valgt valuta; ingen omregning; høyst 2 desimaler |
| Salgspris, minimum bidrag | NOK > 0 |
| Reserve | NOK ≥ 0 |
| Prisgrunnlag og mva.-basis | faste verdier eller ikke oppgitt |
| Penger | DEC-020 (tekst ved databasegrensen, ≤ 2^53-1 øre); norsk inntasting («399 900», «1 250,50») regnes eksakt |
| Ignorerte felt | firma-ID, active, version og andre ukjente felt i skjemaet leses ikke |

## Krav for aktivering (DEC-024)

1. Gyldig agent (alle regler over).
2. Merke satt, eller avklart bredt søk (DEC-023).
3. Forventet salgspris og begge prisgrunnlag oppgitt.
4. Minimum bidrag oppgitt (> 0).
5. Klargjøringsreserve (0 er lov) og mva.-basis oppgitt.
6. Under 10 aktive i firmaet (databasetrigger).

Mangler vises på agentkortet, og «Aktiver» er deaktivert til kravene er oppfylt. Serveren sjekker kravene, og databasen avviser uansett (`search_agents_ready_when_active`).

## R7 — «avklart bredere filter» (DEC-023, lukket)

- **Merke alene er nok.** Modell og variant er valgfrie og betyr da «alle».
- **Uten merke** kreves både (a) uttrykkelig bekreftelse og (b) minst ett annet strukturert kriterium: år, km, drivstoff, gir, karosseri, land eller pris.
- **«Alle» på alt kan aldri aktiveres**, heller ikke med bekreftelse.
- Bekreftelsen lagres ikke når merke er satt, så et senere fjernet merke krever ny bekreftelse.
- Tomme filtre betyr bare «alle» og tolkes aldri som et mer presist valg.

## Pause og reaktivering

Pause setter `active = false` og sletter ingenting. Agenten vises fortsatt og kan redigeres, også til et ufullstendig utkast. Den kan aktiveres igjen når kravene er oppfylt. Versjonen øker ved hver endring (redigering, aktivering, pause).

En aktiv agent kan redigeres, men ikke lagres ufullstendig. Brukeren får en melding om å fullføre eller pause først. Samtidige endringer stoppes med versjonskontroll: lagring krever samme versjon som skjemaet ble lastet med.

## Grensen på 10 aktive

- **UI:** viser «X av maks 10 aktive». Ved forsøk på den 11. aktiveringen vises «Maks 10 aktive agenter per firma er nådd. Pause en annen agent først.»
- **Database:** DEV-002-triggeren (radlås på firma) er uendret og autoritativ. Det finnes ingen telling i klienten.

## Firmakontekst og RLS

- RLS, kolonnerettigheter og firmaavledning fra DEV-002 er uendret.
- Alle nye endringsveier (oppdater, aktiver, pause) går via brukerens sesjon med `.eq("dealership_id", firma fra membership)` og RLS.
- `dealership_id` kan ikke oppdateres (kolonnerettighet + trigger).
- Ingen service-role i appflyten.

## Endrede filer

- **Nye:**
  - Kode: `src/domain/agent-validation.ts`, `src/server/agent-form.ts`, `src/app/agents/{actions.ts,messages.ts}`, `src/app/agents/new/page.tsx`, `src/app/agents/[id]/page.tsx`, `src/components/AgentForm.tsx`
  - Migrasjon: `supabase/migrations/20261006090000_dev004_agent_validation.sql`
  - Tester: `tests/fixtures/agent-setups.ts`, `tests/agent-form.test.ts`, `tests/agent-setups.test.ts`, `tests/db/agents.test.ts`, `tests/e2e/dev004-agents.e2e.mjs`
  - `reviews/DEV-004-leveranserapport.md`
- **Endret:**
  - Domene og server: `src/domain/types.ts` (variant, strukturert retail/reserve, `broadSearchConfirmed`), `src/server/agent-records.ts`, `src/server/agents.ts`
  - UI og visning: `src/app/agents/page.tsx`, `src/app/opportunities/[id]/page.tsx`, `src/lib/format.ts`, `src/demo/fixtures.ts`
  - Provider: `src/providers/marketplace/synthetic/provider.ts` (variantfilter)
  - Tester: `tests/agent-records.test.ts`, `tests/provider.test.ts`, `tests/db/{harness.ts,rls.test.ts}` (komplette agenter der testene aktiverer), `tests/e2e/dev002-auth.e2e.mjs` (ny opprettelsesflyt)
  - Docs: `DATABASE_SCHEMA.md`, `DECISIONS.md` (DEC-023, DEC-024), `MVP_BACKLOG.md`, `reviews/DEV-001-leveranserapport.md`

## Kontroller som faktisk er kjørt

Alle mot **lokal** Supabase (Docker; samme oppsett som DEV-002). Ikke kjørt mot hostet prosjekt.

| Kontroll | Resultat |
|---|---|
| `npm run typecheck`, `npm run lint` | OK, 0 advarsler |
| `npm test` | 95/95 (8 filer). Nye: skjematolking/grenseverdier, de 10 oppsettene, mapping, variantfilter |
| `npm run build` | OK |
| `npx supabase db reset` (begge migrasjoner fra tom DB) | OK |
| Oppgradering: DB på DEV-002-versjon med DEV-002-data → `supabase migration up` | OK. UI-agent fra DEV-002 beholdt (v1, gyldig). Aktiv agent uten krav pauset |
| `npm run test:db` | 60/60 (18 DEV-002 + 42 DEV-004) |
| Mutasjon: fjernet `search_agents_ready_when_active` | 6 DB-tester røde. Gjenopprettet → 60/60 |
| Feil funnet og rettet under testing | `agent_ready` ga NULL når `broadSearchConfirmed` manglet, og CHECK godtok da en ubekreftet bred agent som aktiv. Rettet med `coalesce`; valideringsfunksjonene er også gjort NULL-sikre |
| Nettleser e2e DEV-004 (`tests/e2e/dev004-agents.e2e.mjs`) | 23/23, 0 sidefeil |
| Nettleser e2e DEV-002 (regresjon, oppdatert til ny opprettelsesflyt) | 11/11 |

DB-testene for DEV-004 dekker:
- paritet domene↔database for de 10 oppsettene,
- 18 ugyldige filter-nyttelaster og 8 ugyldige forutsetnings-nyttelaster via direkte API (alle 23514 med riktig constraint),
- reserve 0 og DEV-002-format gyldig,
- ufullstendig/bred agent kan ikke aktiveres,
- aktiv kan ikke redigeres til ufullstendig; pause → redigering → reaktivering; versjon,
- 9→10 OK, 11. avvist, pause frigjør plass,
- A kan ikke aktivere, pause eller redigere Bs agent; firma-ID kan ikke byttes.

E2e DEV-004 dekker:
- ugyldig skjema gir feltfeil, og verdiene beholdes,
- gyldig agent lagres som ikke aktiv,
- bredt søk uten bekreftelse blokkeres; med bekreftelse er det klart,
- aktivering, reload, redigering av aktiv agent, avvist ufullstendig lagring, pause og reaktivering,
- 10/10 i UI og avvist 11. med melding, pause gir plass,
- manipulert id/firma-ID for redigering og aktivering avvises,
- B ser ikke As agenter og får 404 på As redigeringsside,
- dashboard og USD-detaljside (regresjon); skjema uten horisontal scroll på mobil.

## De 10 representative agentoppsettene (`tests/fixtures/agent-setups.ts`)

| # | Oppsett | Validering | Aktivering | Treff i syntetisk kilde | DB enig |
|---|---|---|---|---:|---|
| S01 | Smalt: VW Golf Variant, år, km, drivstoff, gir, karosseri, land, maks 35 000 EUR | gyldig | klar | 1 | ja |
| S02 | Bare merke (BMW) | gyldig | klar | 9 | ja |
| S03 | Avklart bredt: uten merke, bekreftet, SUV + elbil + DE | gyldig | klar | 10 | ja |
| S04 | Bredt uten bekreftelse (SUV) | gyldig | blokkert: bekreftelse mangler | 37 | ja |
| S05 | Bekreftet, men «alle» på alt | gyldig | blokkert: minst ett kriterium | 109 | ja |
| S06 | Grenser: år 2024–2024, 1 km, 0,01 EUR/NOK, reserve 0 kr | gyldig | klar | 0 | ja |
| S07 | Største trygge beløp (90 071 992 547 409,91 kr) | gyldig | klar | 8 | ja |
| S08 | Ukjente forutsetninger (prisgrunnlag, reserve) | gyldig | blokkert: 4 mangler listet | 1 | ja |
| S09 | Maks pris i CHF, retail ekskl. registreringsavgifter | gyldig | klar | 4 | ja |
| S10 | Ugyldig: år snudd, modell uten merke, 0 km, ukjent drivstoff, USD, 3 desimaler, 0 kr bidrag | avvist på 7 felt | — | — | ja (direkte API avvist) |

Treff er bare en strukturkontroll mot den syntetiske provideren (DEV-003), ikke et agentsøk.

## Kjente begrensninger og videreførte punkter

- **Ikke testet mot hostet Supabase.** Migrasjonen `20261006090000_dev004_agent_validation.sql` må kjøres der (`supabase db push`). Den pauser eventuelle aktive agenter uten komplette krav, og antallet vises som NOTICE.
- **Skatteprofil, kurs, transport, forsikring og planlagt registreringsdato** er ikke med (DEV-007/009).
- **Minstepris** i prisramme finnes ikke i modellen.
- **Myke preferanser** (f.eks. farge) og fritekst (DEV-015) er ikke med.
- **Status:** «Ikke aktiv» skiller ikke mellom «aldri aktivert» og «pauset». Modellen har bare `active`.
- **Agentsøk:** dashboardets agentfilter bruker fortsatt demo-agentene. Agentsøk og search-runs kommer i DEV-005.
- **Landlisten** (13 europeiske land) er et UI-/valideringsvalg, ikke en liste over tilkoblede kilder.
- **R9** (`npm audit` i dev-verktøy) står fortsatt åpent.

## Neste oppgave

Uavhengig review av DEV-004 og kjøring av migrasjonen mot hostet prosjekt. Deretter QA-001 (Gate G1: isolasjon og agentgrense; kontrollene ligger i `tests/db/` og `tests/e2e/`), og så DEV-005 (ingestion).
