# SEARCH-005 — verifisering av gjeldende søkeintegrasjon før DEV-006B (16.10.2026)

**Status: REVIEW.** Ingen kode endret. Grunnlag: kode på `118c813` (lest), `reviews/SEARCH-005.md` og kjørte kontroller i denne sesjonen. Bare det som er sjekket mot kode eller kjørt står som fastslått; resten er merket «etter rapport».

## 1. Hva SEARCH-005 endret i normal brukerflyt
- Ny hovedmenylenke «Nye søk» (`SiteNav.tsx`) og lenke «Nye søk (utkast)» på `/agents`. Ellers uendret: `/agents`, `/dashboard`, kjøringer, `/opportunities` er urørt (bare `agents/page.tsx` fikk lenken).
- Ny flate `/searches` (egen layout, Merovo-profil, merke «Demo · utkast»). Den nye søkemodellen (`search-v2`) brukes **bare** der; den gamle agentflyten (`AgentForm`, `search_agents`, `search-pipeline`) kjører uendret ved siden av.
- Nytt søk er et **utkast** (`search_drafts`), ikke en agent: ingen aktivering, ingen kjøring, ingen varsling, ikke mot grensen på ti. Det finnes **ingen kobling** mellom utkast og agent.

## 2. Skjermer/komponenter som bruker nytt skjema/modell
`/searches` (oversikt), `/searches/new`, `/searches/[id]` (rediger), `/searches/[id]/preview` og `.../preview/[listingId]`; komponenter `SearchForm`, `SpecSummary`, `ResultCard`, `Explanation`; server `search-form.ts`, `search-drafts.ts`, `search-preview.ts`. Ingen eksisterende skjerm bruker den nye modellen.

## 3. Opprette, lagre, åpne på nytt, redigere
Ja, med belegg: nettleserflyt 61/61 (kjørt i dag, **mot emulator**) dekker opprett → lagre → åpne → endre → lagre, konflikt mellom to faner og feil som beholder brukerens tekst; `tests/db/search-drafts.test.ts` 65/65 (kjørt i dag, isolert PG, shim). Sletting av utkast finnes ikke. Utkast kan ikke aktiveres eller gjøres om til agent.

## 4. Eksisterende agenter/søk bevart
- Kode: ingen eksisterende tabell, migrasjon eller agentside endret (migrasjon `20261015…` er append-only; `agents/page.tsx` fikk kun en lenke). Etter rapport: md5-øyeblikksbilde før/etter migrasjon uendret (ikke gjentatt i dag).
- **Ikke verifisert i dag:** `agents`, `rls`, `qa-limit`, `qa-isolation`, `qa-validation`, `search-runs`, `rights-retention` (krever Supabase Auth; ikke kjørbare her). Bevaringen er altså påvist i kode og via rapportert øyeblikksbilde, ikke ved levende regresjonskjøring.
- Gamle agenters filtre/budsjett migreres ikke til nye utkast (bevisst). Det finnes dermed to parallelle søkebegreper i appen (agent vs. utkast).

## 5. Må-ha vs. ønskelig
Korrekt i domenet (`evaluation.ts`): krav («must») gir `excluded` ved kjent brudd (forrang), `needs_review` ved ukjent, ellers `match`; ønsker («nice») er fulfilled/not_fulfilled/unknown og påvirker **aldri** status. Skjemaet krever uttrykkelig prioritet per farge/materiale/utstyr (ingen stille standard). Ønsker blir aldri hardfilter (provider får tomt søk). Testet i `search-v2*.test.ts` og `search-005-form.test.ts`. Grunnleggende bilkrav (merke, modell, år, km, seter, karosseri m.m.) er alltid krav; det finnes ingen måte å gjøre dem ønskelige på – i tråd med spesifikasjonen så langt jeg kan se, men verdt å bekrefte mot MEROVO_SEARCH_SPEC før DEV-006B.

## 6. Ukjent/null
Bevart: tom km/beløp → `null` (ikke 0); 0 er eksplisitt 0; ukjent EUR beholdes; modellår utledes aldri av førstegangsregistrering; manglende annonseopplysning → `unknown`/`needs_review`; budsjettstatus er alltid «ikke beregnet» (`classifyBudget(…, null)`), ingen kandidat kan bli fullt treff. Ingen avgiftsavhengig kjøretidsatferd; TAX-status urørt.

## 7. Syntetisk lager
Trygt og merket: forhåndsvisningen bruker bare `SyntheticMarketplaceProvider` via `getMarketplaceProvider()` (ingen nettverk), siden sier «Demo mot syntetiske annonser … lagres ikke», layout har «Demo · utkast», ingen kilde-URL-lenker, annonseprisen merkes «ikke total innkjøpskostnad», dekning/avkorting og «Demokilden kan ikke oppgi …» vises. Merknad: `SCOUT_SYNTHETIC_FAILURE` kan simulere kildefeil via miljøvariabel (eksisterende, ikke SEARCH-005).

## 8. Provider-rettigheter
- Agentflyten: uendret; lagring skjer via betrodd skrivevei med `StoragePolicy` og DB-trigger (DEV-005B0), som ikke er rørt. Rettighetstestene (`tests/rights.test.ts` enhet kjørt i dag; `rights-retention` DB **ikke kjørt**).
- Nye søk: **ingen rettighets- eller retention-sjekk finnes i forhåndsvisningen** (`search-preview.ts` refererer verken `rights` eller `StoragePolicy`). Det er akseptabelt nå fordi (a) kilden er syntetisk og (b) ingenting lagres (resultater beregnes per forespørsel, utkastet inneholder kun egen spesifikasjon, ingen kildeutdrag). Men **ved en ekte provider vil forhåndsvisningen vise leverandørdata uten at visningsrettighet er sjekket** — må løses før en ekte kilde kobles til nye søk (krav til DEV-006B+).

## 9. Testdekning i dag
`tests/search-005-form.test.ts` (29), `tests/codex-search005-review.test.ts` (2), `tests/db/search-drafts.test.ts` (16 definisjoner / 65 kjøringer), `tests/db/qa-catalog.test.ts` (oppdatert), `tests/e2e/search005.e2e.mjs` (61 sjekker), `scripts/test-db-mutations.sh` (6 mutasjoner, ikke kjørt i dag), arkitekturvakt i `architecture.test.ts`; underliggende `search-v2*`, `search-candidate-adapter`, `search-prototype-adapter*`. Kjørt i dag: vitest 547/547, typecheck, lint, e2e 61/61, search-drafts 65/65.

## 10. Mangler mot milepælen «nytt søk og lagring»
1. Ingen kontroll mot faktisk Supabase (GoTrue/PostgREST); `npm run test:db` for alle suiter, inkl. ny migrasjon, gjenstår.
2. Ingen aktivering av nytt søk (kobling til agent/grense på ti/scheduler) – utkast kan ikke bli agent.
3. Ingen sletting/arkivering, kvote eller rate-limit på utkast.
4. Ingen resultatlagring/historikk (bevisst; krever rettighetsprofil og utløp).
5. Ingen visningsrettighetskontroll for ekte provider (se 8).
6. Ingen avgiftsmotor → ingen total innkjøpskostnad og ingen budsjettstatus (bevisst).
7. To parallelle søkebegreper (agent vs. utkast) uten migreringsvei.
8. Demokatalog er et utvalg (7 merker); ikke testet i Safari/Firefox/skjermleser; PG 16 mot Supabase 17.
9. Hosting/tilgangskontroll for partnerdemo ikke gjort.

## Konklusjon
Integrasjonen er konsistent og trygg som **demo av nye søk med lagrede utkast** og bryter ikke det jeg kan kontrollere i eksisterende flyt. Siden RLS/10-agenter/rettighets-DB-suitene ikke er kjørt mot Supabase, og punkt 2 og 5 må avklares, er statusen **REVIEW** (ikke DONE, ikke BLOCKED). Ingen fikser implementert.
