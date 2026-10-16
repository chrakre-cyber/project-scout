# DEV-006D — Merovo partner-demo design (16.10.2026)

**Status: REVIEW** (ikke DONE). Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `80b2921`, rent arbeidstre. Kode-commit: se «Commit» nederst.

## Eksplisitte erklæringer
- **Kun syntetiske data er aktivert.** Ingen ekte leverandør, scraping eller live kilde. Intern kilde-id er fortsatt `synthetic-demo`.
- **Ingen ekte leverandørintegrasjon, partnerskap, live lager, beregnet innkjøpskostnad, automatiske transaksjoner eller selgerkontakt antydes.** Flytstripen er merket som illustrasjon av modellen, og hvert trinn sier hva som faktisk gjelder i demoen («syntetiske annonser», «ikke tilkoblet»).
- Visningsrettigheter for ekte leverandørdata er fortsatt ikke implementert (uendret krav fra DEV-006C: ingen ekte data før det er bygget).
- Ingen endring av matchlogikk, domenemodell, adaptere, providere, agentmodell, DB, migrasjoner, auth, RLS, rettighetsarkitektur, TAX eller deploy. Ingen ny avhengighet. `/agents`, `/dashboard`, `/opportunities` er uendret (de beholder Project Scout-skallet og det gule banneret).

## Filer endret
Ny: `src/components/AppChrome.tsx`, `src/components/merovo/{FlowStrip,MerovoAccount,MerovoNav,StatusBadge}.tsx`, `reviews/DEV-006D.md`, `reviews/DEV-006D/*.png`.
Endret: `src/app/layout.tsx`, `src/app/searches/{layout,page}.tsx`, `src/app/searches/new/page.tsx`, `src/app/searches/[id]/page.tsx`, `src/app/searches/[id]/preview/page.tsx`, `src/app/searches/[id]/preview/[listingId]/page.tsx`, `src/components/CarPlaceholder.tsx`, `src/components/search/{ResultCard,Explanation,SpecSummary}.tsx`, `tests/architecture.test.ts` (to nye ren-navigasjons-klientkomponenter lagt til i listen over tillatte; importreglene for dem gjelder fortsatt), `tests/e2e/search005.e2e.mjs`, `MVP_BACKLOG.md`.
`SearchForm.tsx`, `search-explain.ts` og all serverkode er urørt.

## Designendringer
- **Eget Merovo-skall på `/searches/**`:** `AppChrome` (klient, `usePathname`) viser Project Scout-topp og gult banner kun utenfor `/searches`. `DemoBanner` ligger fortsatt i rotlayouten (arkitekturtest). I Merovo-skallet: topplinje med logo, navigasjon **bare «Søk» og «Nytt søk»** (ingen lenker til Mine agenter/Dashboard), innloggingsstatus og utlogging (samme server-handling), mørk skoggrønn merkelinje med «**Local demand. European supply.**» (uoversatt) og forklaringen «Forhandlere vet hvilke biler kundene vil ha. Merovo finner dem i Europa.», og en **alltid synlig etikett «Syntetiske demodata – ikke ekte leverandørdata»** som erstatter det gule banneret.
- **Flytstripe** (oversikt og resultat): Forhandlerens etterspørsel → Merovo søker → Kildeannonse → Selger, med demo-tekst per trinn og notis om at ingen live kilder/avtaler/handel finnes. Detaljsiden har en tilsvarende kjede for den aktuelle bilen.
- **Hierarki i resultater:** kundens behov (SpecSummary med «Kundens behov») → statustellere med ikon + tekst → grupper → kort med tittel + status → **«Hvorfor vist» først** (terrakotta kantlinje) + krav-/ønskesammendrag → forklaring → fakta → **annonsepris tydelig adskilt** («Annonsepris (ikke innkjøpskostnad)», sandboks med «ikke beregnet») → alltid synlig syntetisk-etikett per kort.
- **Statuser med ikon og tekst:** ✓ Oppfyller kravene (grønn), ◐ Må kontrolleres (ravgul, ikke feilrød; gruppeteksten sier «Dette er ikke feil»), ✕ Oppfyller ikke kravene (dempet terrakotta på sand).
- **Krav og ønsker adskilt:** krav (forest kantlinje, «må ha»: ✓ / ✕ rød / ◐ «Må kontrolleres») og ønsker (sandlinje, «utelukker aldri»: ✓ / «–» dempet «Ikke oppfylt» / «?» dempet «Ikke oppgitt»). Ukjent ønske ser aldri ut som feil.
- **Bilillustrasjon** i Merovo-palett (skog, sand, terrakotta, krem), fortsatt merket «Illustrasjon». `CarPlaceholder` får `variant="merovo"` som bare søkeflyten bruker; øvrige sider er uendret.
- Touch-mål ≥ 44 px på nye knapper/lenker; tittelmetadata «— Merovo demo».

## Skjermbilder (`reviews/DEV-006D/`)
Desktop 1280 px: `01-oversikt-tom`, `02-skjema-gls-eksempel`, `03-valideringsfeil`, `04-lagret-sok-gls`, `05-resultat-gls`, `06-resultat-demofixtur`, `07-ekskluderte-med-forklaring`, `08-detalj`, `09-konflikt`, `10-kildefeil`, `11-skjema-tomt`, `14-fix1-kostnadsvalg-feil`. Mobil 390 px: `12-mobil-skjema`, `13-mobil-resultat`, `15-mobil-oversikt`. (Tatt av nettleserflyten mot emulator med syntetiske data.)

## Tester faktisk kjørt
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | uten feil |
| `npx vitest run` | 24 filer, **556 / 556** bestått |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **emulator** + isolert PG, ikke Supabase) | **67 / 67** (64 + 3 nye DEV-006D-sjekker: Merovo-skall uten Project Scout-topp/gult banner med tagline og etikett, navigasjon begrenset til Søk/Nytt søk, flytstripe) |
Ikke kjørt: DB-/RLS-suitene mot Supabase, isolerte DB-tester og mutasjonstester (ingen DB-/sikkerhetskode endret). Ingen påstand om at de er kjørt på nytt.

## Kjente begrensninger
- «Logg inn» fører til den eksisterende innloggingssiden (gammel stil); den ligger utenfor scope. Etter innlogging omdirigeres brukeren som før.
- Rotlayoutens skallinnhold evalueres på serveren også for `/searches`, men vises ikke.
- Ikke testet i Safari/Firefox/skjermleser; ikke fargekontrastmålt med verktøy (kombinasjonene er hentet fra eksisterende tokens). Visuell vurdering baseres på skjermbildene.
- Prototypens ønskede merkevareuttrykk er tolket fra eksisterende tokens, logo og skrifttype; ingen ny designfil er brukt.
- Emulatorbasert nettlesertest er ikke ekte Supabase Auth.

## Commit
Kode-commit: `3c2b577`.
