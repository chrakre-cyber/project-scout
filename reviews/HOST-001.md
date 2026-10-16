# HOST-001 — beredskap for lukket Merovo partnerdemo (`demo.merovo.eu`) (16.10.2026)

**Verdikt: READY TO DEPLOY TO STAGING** (kodemessig, uten kodeendringer) — **men IKKE klar for ekstern tilgang**. Ingen kode er endret, ingenting er deployet, ingen konto er opprettet, ingen DNS er endret, ingen nøkler er lest eller skrevet inn her. Vurderingen bygger på repoet og lokale kontroller i denne sesjonen; påstander om hostingleverandørens funksjoner er fra generell kunnskap og **ikke verifisert live** (ingen nettverkstilgang til leverandører herfra) — bekreft ved kontoopprettelse.

## 1. Dagens beredskap
| Punkt | Funn |
|---|---|
| Branch / HEAD | `claude/wonderful-bardeen-yussx3` / `a74f71a`; arbeidstreet rent (før denne rapporten) |
| Next.js / React | Next **16.3.8**, React 19.3.0, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117.2, `pg` 8.23.1 |
| Node | `.nvmrc` 22, `engines.node >= 20.9.0` |
| Build / start | `npm run build` (`next build`), `npm start` (`next start`); bygger uten Supabase-variabler |
| Statisk eller server? | **Krever Node-/serverruntime.** Bare `/` og `/_not-found` er statiske; alle andre ruter er dynamiske (`ƒ`), pluss `Proxy (Middleware)` (`src/proxy.ts`, fornyer Supabase-sesjonen). Ingen `output: export` er mulig. |
| Server-side kjøring | Server-actions: `login/actions.ts` (`signIn`/`signOut`) og `searches/actions.ts` (lagring) i partnerflyten; `agents/**`-actions finnes (blokkert, se 4). Forhåndsvisning og detalj er `force-dynamic` og kjører den syntetiske provideren i prosessen. |
| Filsystem | Ingen skriving og ingen filleser i `src/` (søk etter `fs`, `readFile`, `writeFile`, `process.cwd` ga ingen treff). Ingen lokal persistens; all lagring går til Supabase. Skrift og logo ligger i `public/brand/` (statisk). Ingen eksterne bilder/fonter (`remotePatterns: []`, `unoptimized`). |
| Lokale avhengigheter som hindrer sky | Ingen. Docker/lokal Supabase brukes bare i test. `pg`-driveren brukes kun av den betrodde skriveveien (`trusted-ingest.ts`, server-only) som gamle agentkjøringer bruker; `/searches` bruker bare Supabase-klienten med brukerens sesjon (verifisert i `search-drafts.ts`/`session.ts`). |
| Indeksering | Rotmetadata har `robots: noindex, nofollow`. |

## 2. Hostinganbefaling
**Anbefalt: Vercel (managed Next.js).** Passer fordi appen er standard Next 16 med serverkomponenter, server-actions og proxy (alle støttes), uten egne servere, med enkel miljøvariabelstyring, preview-deployments per branch og innebygd TLS. README nevner allerede Vercel for `SCOUT_INGEST_DATABASE_URL`.
- **Egendefinert domene `demo.merovo.eu`:** støttes (domene legges til i prosjektet).
- **Preview/staging:** ja — hver branch/commit får egen preview-URL; produksjon kan holdes separat. Previews er som standard beskyttet bak leverandørens innlogging (bekreft innstillingen).
- **Viktige begrensninger:** (a) velg funksjonsregion nær Supabase-prosjektets region (standard kan være USA → unødvendig latens og dataflyt; sett EU-region); (b) gratisplanen er etter min kunnskap for ikke-kommersiell bruk — en partnerdemo for et firma krever sannsynligvis betalt plan; sjekk gjeldende vilkår før oppsett (ikke gjort her; ingen kjøp skal foretas som bieffekt); (c) miljøvariabler som starter med `NEXT_PUBLIC_` blir innlemmet i nettleser-bundelen ved bygging.
- Alternativer (Netlify, Cloudflare, egen Node-container) er mulige, men gir mer oppsett uten gevinst for denne appen.

## 3. Miljøvariabler (ingen verdier gjengitt)
| Variabel | Kategori | Trengs for partnerdemo? | Merknad |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | A + C (offentlig, bygges inn) | **Ja** | Hosted Supabase-prosjektets URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | A + C (offentlig, bygges inn) | **Ja** | **Kun publishable/anon-nøkkel.** Aldri service-role/secret. |
| `SCOUT_ENABLE_LEGACY_ROUTES` | D (utvikling), bygg-tid | **Nei — la den være helt udefinert** | Se 4 |
| `SCOUT_INGEST_DATABASE_URL` | B (server-only hemmelighet) | **Nei** | Brukes bare av gamle agentkjøringer (blokkert). Sett den ikke; da kan ingen søkekjøring starte (ønsket) og ingen DB-passord ligger i hostingmiljøet. |
| `SCOUT_SYNTHETIC_FAILURE` | D (kun demo-/feilsimulering) | **Nei — må ikke være satt** | Hvis satt, simulerer alle forhåndsvisninger kildefeil. |
Appkoden leser ingen andre variabler (håndhevet av `tests/architecture.test.ts`); ingen service-role-nøkkel finnes eller brukes i repoet (secret-skann ingen funn). Ingen hemmeligheter skal i git eller inn i denne rapporten. Hvis Supabase-variablene mangler, viser `/login` «Innlogging er ikke satt opp i dette miljøet.» (trygg feilmodus). Lokal `.env.local` er gitignorert og ble ikke lest.

## 4. Isolasjon av gamle ruter
- Med `SCOUT_ENABLE_LEGACY_ROUTES` **udefinert** er `/dashboard`, `/agents/**` og `/opportunities/**` blokkert (307 → `/login`), også for POST; `/` → `/login`; ukjente URL-er gir Merovo-«ikke funnet». Verifisert i denne sesjonen mot en ekte bygging (`scripts/qa-partner-mode.sh`, DEV-006G) og re-bekreftet nå på en standardbygging.
- **Flagget er bygg-tid** (redirects ligger i routes-manifestet). Operasjonell konsekvens: det er **byggemiljøet** som avgjør. Å sette flagget kun ved oppstart åpner ikke gamle ruter — målt nå: standardbygging startet med flagget satt gir fortsatt 307 → `/login` for `/dashboard`, `/agents`, `/opportunities/demo-001`. Omvendt åpner en bygging med flagget satt gamle ruter selv om det fjernes senere. **Regel: definer aldri variabelen i noe Vercel-miljø (Production, Preview, Development) som brukes til bygging.** Rotlayouten leser den også ved render av dynamiske sider; satt kun ved kjøring gir den bare en skjult del av sidens data (ikke synlig UI, ikke tilgang) — en feilkonfigurasjon man bør unngå.
- Restrisiko (uendret): legacy server-actions ligger fortsatt i bygget; de håndhever selv sesjon/firma/RLS.

## 5. Krav til hostet Supabase (ingenting er endret)
- **Auth:** e-post/passord aktivert. **Slå av åpen registrering** («Allow new users to sign up»). Lokal `config.toml` har minimum passordlengde 12 — sett tilsvarende (≥ 12) i hosted prosjekt.
- **Redirect-URL-er / Site URL:** appen bruker passordinnlogging uten e-postlenker, OAuth eller magic links, så ingen redirect-URL brukes i flyten. Sett likevel **Site URL = `https://demo.merovo.eu`** og legg både `https://demo.merovo.eu` og stagingens URL i tillatte redirect-URL-er, slik at invitasjons-/gjenopprettings-e-poster fra dashboardet ikke peker til feil adresse. **Manuell innstilling før smoke-test.**
- **Migrasjoner:** alle 7 i `supabase/migrations/` må være anvendt på det hostede prosjektet, inkludert `20261015090000_search005_search_drafts.sql` (tabellen `search_drafts` som `/searches` bruker). **Ikke kjør `seed.sql` mot hostet prosjekt.** Rapporten kan ikke bekrefte hosted migrasjonsstatus; Christian må sjekke (`supabase migration list` / SQL-editor).
- **RLS-forutsetninger:** all tilgang skjer som brukerens `authenticated`-rolle; firma settes av databasen fra `dealership_members` (aldri fra klient); ingen service-role. `search_drafts` har RLS for eget firma, ingen delete.
- **Brukere/firma:** `private.admin_create_dealership(navn)` og `private.admin_add_member(epost, firma-id)` kjøres av prosjekteier i SQL-editoren (eksekverbare kun av eier).
- **Ikke nødvendig for partnerdemoen:** `scout_ingest`-rollen/passordet, `purge:expired`, seed.
- **Manuelt før hostet smoke-test:** (1) migrasjonsstatus, (2) registrering av, (3) passordlengde, (4) Site URL/redirect-URL-er, (5) publishable key + URL kopieres til hostingens miljø (aldri service-role), (6) bekreft prosjektets region (personvern/latens).

## 6. Partnerkontoer (minimum trygt oppsett)
- **Én personlig konto per ekstern person** (individuelt identifiserbar; ingen delte passord). Opprettes av prosjekteier i Supabase Auth-dashboardet (Add user, auto-confirm) med sterkt, generert engangspassord levert utenfor appen (ikke i e-post med brukernavn, ikke i chat/git), og be brukeren bytte når en endringsflyt finnes (finnes ikke i appen i dag — se nedenfor).
- **Tilknytning:** hver bruker kobles til et firma med `admin_add_member`. **Anbefaling: ett eget demofirma per ekstern organisasjon** (flere brukere fra samme organisasjon kan dele firma og dermed se hverandres utkast), slik at ulike partnere aldri deler data. Bruk tydelige demofirmanavn (f.eks. «Demo – <organisasjon>»).
- **10-agent-regelen:** påvirker ikke partnerdemoen — nye søk er utkast og er ikke agenter. Gamle agenter er blokkert i demoen.
- **Bruker uten firma:** `/login` sender til `/searches`, som viser meldingen om at firmakonto kreves (siden er ellers uten data). Ingen data eksponeres (RLS), men meldingen er upresis og har en «Logg inn»-lenke. **Opprett aldri en konto uten firmatilknytning til en partner.**
- Appen har ingen «glemt passord»/bytt passord; tilbakestilling må gjøres av eier i dashboardet.

## 7. Domene `demo.merovo.eu`
- **DNS:** sannsynligvis en **CNAME** for `demo` mot verten Vercel oppgir i domeneinnstillingene (alternativt A-record til oppgitt adresse). Eksakt verdi vises av hosten når domenet legges til — ikke gjettet her.
- **Hvor:** hos den som administrerer DNS for `merovo.eu` (registrar eller DNS-leverandør); Christian må gjøre endringen.
- **TLS:** utstedes og fornyes automatisk av anbefalt host når DNS peker riktig.
- **Anbefaling:** først deploy til hostens midlertidige URL (staging/preview), kjør hele smoke-testen der, **deretter** legg til domenet/DNS. Husk å legge den endelige URL-en i Supabase Site URL/redirect-liste.

## 8. Hostet smoke-test (sjekkliste)
Forutsetninger: Supabase-trinn i punkt 5 gjort; to demofirma (X, Y) og to personkontoer (A i X, B i Y); build uten `SCOUT_ENABLE_LEGACY_ROUTES`, `SCOUT_INGEST_DATABASE_URL`, `SCOUT_SYNTHETIC_FAILURE`.

**Partner A (første gang)**
1. Åpne rot-URL-en → sendes til `/login` (Merovo-stil, «Local demand. European supply.», «Privat partnerdemo …», ingen «Project Scout»).
2. Feil passord → felles feilmelding, ingen innlogging.
3. Logg inn → lander på `/searches` i Merovo-skall med fast etikett «Syntetiske demodata – ikke ekte leverandørdata».
4. Opprett nytt søk (f.eks. «Demosøk som gir treff (BMW 3-serie)») → lagre → melding om lagring, versjon 1.
5. Åpne på nytt fra listen → verdiene er bevart; endre en verdi → lagre → versjon 2.
6. «Prøv med demodata» → grupper «Oppfyller kravene / Må kontrolleres / Oppfyller ikke kravene», hvorfor-vist, krav-/ønskesammendrag, etikett på hvert kort.
7. Åpne «Se detaljer» → detalj med kjede etterspørsel → … → selger (ikke tilkoblet) og «ikke beregnet» for innkjøpskostnad.
8. Logg ut → `/login`. Logg inn igjen → utkastet finnes fortsatt (versjon 2).

**Isolasjon av gamle ruter** (anonym og innlogget): 9. `/dashboard` → `/login` (innlogget: videre til `/searches`), ingen Project Scout. 10. `/agents` og `/agents/<id>` likeså. 11. `/opportunities/demo-001` likeså. 12. `/finnes-ikke` → Merovo «Fant ikke siden» med lenke til `/login`; ingen gult banner.

**Tenant-isolasjon** (to nettlesere/profiler): 13. B logger inn → ser ikke A sine utkast. 14. B lager et søk → A ser det ikke. 15. B åpner A sin utkast-URL (`/searches/<A-id>`) → Merovo «Fant ikke siden». 16. A åpner B sin tilsvarende URL → samme.

**Sannferdighet:** 17. Etiketten «Syntetiske demodata – ikke ekte leverandørdata» er synlig på `/searches`, forhåndsvisning, detalj og hvert resultatkort (den vises ikke på `/login`, som ikke viser data; teksten der sier «Privat partnerdemo»). 18. Ingen tekst påstår live-leverandør, partnerskap, lager eller beregnet innkjøpskostnad; annonsepris er merket «ikke innkjøpskostnad». 19. Sidens kilde/Network viser ingen nøkkel utover publishable key; ingen kall til andre domener enn appen og Supabase. 20. Svar-hodene inneholder ikke `X-Powered-By`.
Dokumenter resultatet med skjermbilder; ikke del legitimasjon i rapporten.

## 9. Klassifisering av funn
| Kategori | Funn |
|---|---|
| **BLOCKER BEFORE DEPLOY** | Ingen funnet i koden. |
| **REQUIRED DURING DEPLOY** | Sett kun `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; definer ikke `SCOUT_ENABLE_LEGACY_ROUTES`, `SCOUT_INGEST_DATABASE_URL`, `SCOUT_SYNTHETIC_FAILURE`. Velg EU-funksjonsregion. Bekreft passende plan/vilkår. Start på midlertidig URL; legg til DNS først etter smoke-test. Bruk publishable key, aldri service-role. |
| **REQUIRED BEFORE hosted smoke test (Supabase, manuelt)** | Alle 7 migrasjoner anvendt (særlig `search_drafts`); åpen registrering av; passordlengde ≥ 12; Site URL/redirect-URL-er; to testfirma og to personkontoer med firmatilknytning. |
| **REQUIRED BEFORE EXTERNAL ACCESS** | (1) Codex-review av DEV-006A–G (alt står i REVIEW). (2) `npm run test:db` og de eldre e2e-skriptene er **aldri kjørt mot faktisk Supabase i denne økten** — RLS/tenant-isolasjon må verifiseres (lokal Supabase med Docker, eller den hostede smoke-testen over som minimum, helst begge). (3) Smoke-testen bestått uten avvik. (4) Individuelle kontoer med korrekt firmatilknytning; ingen kontoer uten firma. (5) Avklar og dokumenter Supabase-regionen og enkel informasjon til partnere om at e-postadresse lagres (personvern) og at data er syntetiske. (6) Partnervilkår/NDA etter Christians vurdering. |
| **LATER / NON-BLOCKING** | Passordbytte/«glemt passord»; upresis melding for bruker uten firma på `/searches`; fysisk fjerning av legacy-kode/actions fra bygget; sikkerhetshoder (CSP m.m.); egen rate-limiting utover Supabase Auth sin; overvåking/feillogging; kvote og sletting av utkast; kontrastmåling/ tilgjengelighetstest og nettlesermatrise; resultatlagring og visningsrettigheter før noen ekte leverandørdata kobles til (ikke del av dette scope: **ingen ekte leverandørdata må kobles til flyten**). |

## 10. Verdikt
**READY TO DEPLOY TO STAGING** — ingen kodeendring er nødvendig for en privat staging-deploy på en midlertidig URL med syntetiske data, forutsatt at Supabase-forutsetningene (punkt 5) og miljøvariabelreglene (punkt 3) følges. **Ikke klar for ekstern tilgang** før kravene under «REQUIRED BEFORE EXTERNAL ACCESS» er oppfylt; særlig verifisert tenant-isolasjon mot faktisk Supabase og Codex-review.

## Kontroller kjørt i denne oppgaven
`npm run build` (route-oversikt), `git status`/`rev-parse`, søk i `src/` etter filsystem- og miljøbruk, målt oppførsel av bygg-tid-flagget (standardbygging startet med flagget satt gir fortsatt 307 → `/login` for `/dashboard`, `/agents`, `/opportunities/demo-001`). Ingen tester mot Supabase, ingen deploy, ingen kontoer, ingen DNS.
