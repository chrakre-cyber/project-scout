# DEV-001 — leveranserapport og selvreview

Dato: 03.10.2026 · Branch: `claude/wonderful-bardeen-yussx3` · Implementasjonscommit: `9801e1a` · Reviewrettinger: se egen seksjon nederst · Status: REVIEW (ikke DONE)

## Leveranse

Lokalt kjørbar Next.js-app med tre visninger og tydelig demo-banner på alle sider:

- `/dashboard`: åtte syntetiske bilkort, statusfelt (siste søk «aldri kjørt», margin «ikke beregnet») og filter per demo-agent (`?agent=<id>`). `/` sender videre hit.
- `/agents`: tre demo-agenter (to aktive, én pauset) med filtre og syntetiske kalkyleforutsetninger. Kun lesing. «Opprett agent» er inaktiv med forklaring.
- `/opportunities/<id>`: pris med valuta og prisgrunnlag/belegg, spesifikasjoner, selger, kilde, alle kostlinjer som «ikke beregnet», avgiftsstatus «ingen validert skatteprofil, marginvarsel blokkert», inaktiv «Åpne demoannonse». Ukjent ID gir 404.

Ukjent = `null` → «ikke oppgitt». Førsteregistrering beholder presisjon (dato/måned/år). Miles regnes ikke stille om til km. Ingen login, ingen secrets, ingen nettverkskall, ingen eksterne bilder eller fonter.

## Starte og bygge

Krav: Node.js ≥ 20.9 (testet med 22.22.0, npm 10.9.4). Ingen miljøvariabler trengs.

```bash
npm ci                           # installasjon fra package-lock.json
npm run dev                      # http://localhost:3000
npm run build && npm run start   # produksjonsbygg, http://localhost:3000
npm run check                    # typecheck + lint + tester + build
```

Versjoner (låst i `package-lock.json`): Next.js 16.3.8, React 19.3.0, TypeScript 5.9.3, Tailwind CSS 4.3.3, ESLint 9.39.5 + eslint-config-next 16.3.8, Vitest 5.0.3.

## Endrede filer (commit 9801e1a)

- Prosjektoppsett: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `.gitignore`, `.nvmrc`
- Domene: `src/domain/types.ts` (bare typer: Money, PriceBasis, FirstRegistration, NormalizedListing, SearchAgent m.m.)
- Demodata: `src/demo/fixtures.ts`, `src/demo/repository.ts`
- Visning: `src/lib/format.ts`, `src/components/{DemoBanner,SiteNav,CarPlaceholder,ListingCard}.tsx`
- Sider: `src/app/{layout,page,not-found}.tsx`, `src/app/globals.css`, `src/app/dashboard/page.tsx`, `src/app/agents/page.tsx`, `src/app/opportunities/[id]/page.tsx`
- Tester: `tests/demo-fixtures.test.ts`, `tests/format.test.ts`
- Docs: `README.md` (startinstruks), `MVP_BACKLOG.md` (DEV-001 → REVIEW, logg), `DECISIONS.md` (DEC-017: penger som heltall i minste enhet + valuta)

I reviewcommiten: denne rapporten og `.env.example` (tom, ingen verdier).

## Kontroller som faktisk er kjørt

| Kontroll | Resultat |
|---|---|
| `rm -rf node_modules .next && npm ci && npm run build` | OK |
| `npm run check` (tsc, eslint, vitest, next build) | OK. 13/13 tester |
| `next start` + HTTP-røyktest | `/` 307→`/dashboard`; `/dashboard`, `?agent=agent-demo-b` (3 kort), `/agents`, `/opportunities/demo-001`, `/opportunities/demo-008` gir 200 med banner; `/opportunities/finnes-ikke` gir 404 |
| Playwright (Chromium) desktop 1280 px og mobil 390 px | Klikkflyt dashboard → bil → Mine agenter → «Vis 3 treff» gir 3 kort; 0 konsollfeil; ingen horisontal scroll |
| `npm run dev` (gjort i review) | `/dashboard`, `/agents`, `/opportunities/demo-003` gir 200 med banner |
| Ukjent og dobbel `?agent=` (gjort i review) | Viser 0 kort og «Fant ingen demo-agent» |

Testene dekker feilmodi, ikke dekorasjon: ingen URL-er/mobile.de-referanser i data, alt merket syntetisk, ukjent lagres ikke som 0, presisjon dikes ikke opp, miles beholdes, ukjent valuta gir ikke gjettede desimaler, agentreferanser er gyldige.

Feil funnet og rettet under DEV-001: ukjent `?agent=` viste alle kort; pauset agent ble vist «(pauset) (pauset)».

## Selvreview: funn (beskrevet, ikke rettet)

Reviewet er gjort av samme verktøy som implementerte. Det erstatter ikke et uavhengig review.

| # | Alvor | Funn | Forslag |
|---|---|---|---|
| R1 | P1 for DEV-003 | `formatMoney` kaster feil for valuta utenfor listen (NOK, EUR, SEK, DKK, CHF, GBP, PLN), f.eks. USD. Én annonse i ukjent valuta gir dermed feilside for hele dashboardet. DEV-003 krever ulike valutaer. | Vis beløpet med valutakode og «visning ikke støttet» i stedet for å kaste, eller hent desimaler fra `Intl`. Legg til test med USD i DEV-003. |
| R2 | P2 | Når `next dev` kjøres av en AI-agent, legger Next.js 16 selv til en «nextjs-agent-rules»-blokk i `AGENTS.md` (bekreftet i `node_modules/next/dist/server/lib/generate-agent-files.js`). Det endrer en styringsfil uten at noen har bestemt det. Ikke committet. | Sett `agentRules: false` i `next.config.ts` eller bestem bevisst å godta blokken. |
| R3 | P2 | `demo-005` har `basis: "gross"` uten belegg, men UI-etiketten sier «iflg. annonsen». Det er en påstand uten kilde. | Gi fixturen belegg, eller sett basis til `unknown`. Vurder etikett som skiller «oppgitt med belegg» fra «uten belegg». |
| R4 | P2 | Statusfeltet «Ny i Scout (demo)» teller alle annonser i visningen, ikke nye annonser. | Endre etiketten til «Annonser i visningen». |
| R5 | P2 | Kommentaren i `formatMoney` sier «heltallsdivisjon», men koden bruker flyttallsdivisjon (bare for visning, så det er ufarlig). DEC-017 anbefaler `bigint` i DB, mens TS bruker `number`. | Rett kommentaren. DEV-002 må avgjøre konvertering bigint → TS (number med grensekontroll, eller string). |
| R6 | P2 | `ListingPrice` mangler felt for mva.-opplysninger (f.eks. oppgitt sats) fra ARCHITECTURE-kontrakten, og `NormalizedListing` mangler `lastSeenAt`. | Utvides i DEV-003 sammen med provider-kontrakten. |
| R7 | Info | Demo-agent A og B har verken merke eller modell. DEV-004 krever «minst merke/modell eller avklart bredere filter». | Ingen endring i demo. DEV-004 må definere hva et «avklart bredere filter» er. |
| R8 | Info | README, CLAUDE.md og AGENTS.md lenker til `docs/`, `planning/`, `prompts/` og `templates/`, men filene ligger flatt i roten. | Christian bestemmer: flytt filene eller rett lenkene. |
| R9 | Info | `npm audit`: 5 «high»-funn (micromatch via eslint-config-next). Gjelder bare lint-verktøy under utvikling, ikke appen. | Følg med på oppdatering av eslint-config-next. |

Kontrollert uten funn: ingen secrets eller `.env` i git; ingen eksterne nettverkskall, bilder eller fonter ved build/kjøring; demo-banner i felles layout (alle ruter); ingen mobile.de-lenker; ingen marginpåstander (alle kost- og bidragsfelt viser «ikke beregnet»); domenelaget importerer ikke UI, provider eller LLM; `noindex` er satt.

## Kjente begrensninger

- Ingen lagring, login eller firmaisolasjon (DEV-002/DEV-004). Demo-agenter kan ikke opprettes eller endres.
- Koblingen agent → annonse er håndplukket i fixturene, ikke matching (DEV-010).
- Ingen kost-, avgifts-, bidrags- eller scoreberegning (DEV-007–DEV-010) og ingen annonseanalyse (DEV-011).
- Ikke deployet (SET-003). Kun testet i Chromium.

## Neste oppgave

1. Uavhengig review av DEV-001. Avgjør R1–R5. R1 bør rettes senest i DEV-003.
2. DEV-003: MarketplaceProvider + ≥100 syntetiske fixturer.
3. DEV-002 venter på at Christian oppretter Supabase-prosjektet (SET-002).

## Retting etter review (04.10.2026)

Oppdrag: rett funnene 1–5 fra review uten å utvide scope. Ingen nye funksjoner eller integrasjoner. DEV-002/DEV-003 er ikke startet.

| Funn | Utfall | Endring |
|---|---|---|
| R2: Next.js skriver i AGENTS.md | Rettet | `agentRules: false` i `next.config.ts` (toppnivå-innstilling i Next 16.3.8, bekreftet i `config-schema.js`). Kontroll: `next dev` kjørt av AI-agent på nytt; SHA-256 av `AGENTS.md` og `CLAUDE.md` er identisk før og etter. |
| R3: prisgrunnlag uten belegg | Rettet | `demo-005` (brutto uten belegg) → `unknown`/`null`. `demo-004` («MwSt. ausweisbar» sier ikke om prisen er inkl. mva.) → `unknown`/`null`. Etiketten «iflg. annonsen» er fjernet. Ny `formatPriceBasis()` viser «prisgrunnlag ukjent» hvis brutto/netto mangler belegg, ellers «oppgitt som brutto/netto i annonsen — ikke kontrollert». Ingen utledning av fradragsrett. |
| R4: «Ny i Scout» | Rettet | Dashboardfeltet heter «Annonser i visningen» med merknaden «Syntetiske demoannonser, ikke nye siden forrige kjøring». Tidspunktet på kort og detaljside heter «Først sett i Scout (syntetisk)», som er det `firstSeenAt` faktisk betyr. |
| R8: brutte dokumentlenker | Rettet | Stiprefiksene `docs/`, `planning/`, `prompts/` og `templates/` er fjernet der målfilen ligger i roten: `README.md`, `START_HER.md`, `PILOT_PLAN.md`, `AI_TEAM_ROLES.md`, `CLAUDE.md`, `AGENTS.md`. Ingen filer er flyttet. I `CLAUDE.md`/`AGENTS.md` er bare stiene i første linje endret; reglene er uendret og filene er fortsatt identiske. Alle relative markdown-lenker er kontrollert mot filsystemet. |
| R1: valuta | Videreført til DEV-003 | Ingen konkret feil i DEV-001: alle demoannonser bruker EUR og alle agentbeløp NOK, som begge støttes. Krasjet oppstår først med valuta utenfor listen, og det kommer med DEV-003-fixturer. Krav til DEV-003: annonser i ustøttet valuta skal ikke gi feilside; legg til test med f.eks. USD. |

Ikke en del av dette oppdraget, fortsatt åpne: R5 (kommentar «heltallsdivisjon» og bigint↔number før DEV-002), R6 (felt for mva.-opplysninger og `lastSeenAt` i DEV-003), R7 (bredere filter i DEV-004), R9 (npm audit, kun dev-verktøy).

### Kontroller kjørt etter retting

| Kontroll | Resultat |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK |
| `npm test` | 16/16 bestått (3 nye: belegg-invariant for fixturer, brutto/netto uten belegg → ukjent, belegg → «ikke kontrollert») |
| `npm run build` | OK, 13 statiske sider |
| `next dev` + HTTP | `/dashboard`, `/agents`, `/opportunities/demo-004`, `/opportunities/demo-005` gir 200 med banner; «prisgrunnlag ukjent» vises; 0 forekomster av «iflg. annonsen» og «Ny i Scout»; «Annonser i visningen» vises |
| AGENTS.md/CLAUDE.md etter `next dev` | Uendret (sammenlignet med SHA-256) |

Ikke kjørt på nytt etter retting: `npm ci` fra ren tilstand, Playwright-klikkflyt og skjermbilder. Avhengighetene og lockfilen er uendret.

## Oppfølging i DEV-003 (05.10.2026)

R1 (valuta) og R6 (mva.-felt og `lastSeenAt`) er løst i DEV-003. Se `reviews/DEV-003-leveranserapport.md`. DEV-001 er satt til DONE etter godkjenning oppgitt av Christian.

## Oppfølging i DEV-002 (05.10.2026)

R5 (bigint/number og kommentaren om «heltallsdivisjon») er løst i DEV-002: penger er tekst ved databasegrensen, grensen er 2^53-1, og visning skjer uten flyttall (DEC-020). Se `reviews/DEV-002-leveranserapport.md`.
