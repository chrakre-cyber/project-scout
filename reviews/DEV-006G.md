# DEV-006G — isolere gamle Project Scout-ruter fra ekstern partnerdemo (16.10.2026)

**Status: REVIEW** (implementert etter godkjenning; ikke DONE: se begrensninger). Ingenting er deployet. Vurderingen under er uendret fra før implementasjonen. Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `dbac6a4`, rent arbeidstre.

## Vurdering

### 1–2. Tilgjengelighet i dag (lest i kode)
| Rute | Offentlig / beskyttet | Hva en ukjent besøkende ser |
|---|---|---|
| `/dashboard` | **Offentlig** (ingen sesjonssjekk) | Gammelt Project Scout-skall med gult banner og 24 syntetiske annonser per side, filter per demo-agent |
| `/opportunities/[id]` | **Offentlig** (kun `notFound()` ved ukjent id) | Detaljside for syntetisk annonse i gammel stil |
| `/agents` | **Offentlig i demomodus**, ellers delvis: uten firma (`ctx.status !== "member"`) vises *demo-agenter*; innlogget medlem ser firmaets egne agenter og kan opprette/aktivere/kjøre | Gammelt skall; for medlemmer: ekte (syntetisk-datert) agentdata fra Supabase |
| `/agents/new`, `/agents/[id]`, `/agents/[id]/runs`, `/agents/[id]/runs/[runId]` | **Auth-beskyttet** (ikke-medlem redirectes til `/agents`) | For medlemmer: redigering, kjøringer, resultater i gammel stil |
| server-actions i `agents/actions.ts` og `agents/[id]/runs/actions.ts` | beskyttet av egen sesjons-/RLS-sjekk | — |
| Global `not-found` (ukjente URL-er utenfor `/searches`) | offentlig | Gammel tekst + lenke «Til dashboard» |
Dvs. en partner som kjenner eller gjetter en URL ser gammel UI uten innlogging (`/dashboard`, `/opportunities/*`, `/agents`), og en innlogget partner-bruker kan administrere agenter og starte kjøringer i gammel flate.

### 3. Minste trygge mekanisme
**Omdirigering i `next.config.ts` (`redirects()`), betinget av en miljøvariabel.** Når legacy er avslått, sendes `/dashboard`, `/agents`, `/agents/:path*` og `/opportunities/:path*` (midlertidig, 307) til `/searches`. Fordeler:
- Ingen kjøretidskode, ingen endring i `proxy.ts`, sesjon, auth, RLS eller sider. Redirects i `next.config` evalueres før proxy, og gjelder alle HTTP-metoder (blokkerer også POST til de stiene).
- Gamle sider og alt legacy-kode forblir i repoet, urørt.
- Anonym partner ender på `/searches` (Merovo-skall, nøytral «du må logge inn»-melding med lenke til `/login`); innlogget partner ender på søkeoversikten. Ingen gammel UI vises.
Ulempe/begrensning: `next.config` leses ved **bygg** (redirects ligger i routes-manifestet), så variabelen må være satt når den hostede demoen bygges. Det er ikke en kjøretidsbryter.

### 4. Kan legacy beholdes i koden, men skjules i partnermodus?
Ja. Ingen fil slettes. Med variabelen satt for internt bruk (`npm run dev`, interne tester) er gamle ruter uendret tilgjengelige.

### 5. Filer som vil endres
- `next.config.ts`: `redirects()` (ca. 15 linjer)
- `tests/legacy-isolation.test.ts` (ny): enhetstest på config-funksjonen (blokkert som standard, åpen med flagg; dekker `/dashboard`, `/agents`, `/agents/x/runs/y`, `/opportunities/x`; ingen redirect på `/searches`, `/login`, `/`)
- `scripts/qa-partner-mode.sh` (ny): bygger med partnermodus, starter, verifiserer med `curl` at de fire stiene gir 307 → `/searches`, at `/login` og `/searches` fungerer, og at ingen svar inneholder «Project Scout»; stopper serveren. Ingen Supabase nødvendig.
- `.env.example`, `README.md`: dokumenterer variabelen
- Skript/runnere som tester gamle ruter og dermed må sette flagget hvis du velger «avslått som standard» (se beslutning A): `scripts/qa-demo-mode.sh`, `scripts/test-e2e-search005.sh` (sjekken på `/agents`-siden i e2e-skriptet) og dokumentasjon for de fire eldre Supabase-e2e-skriptene.
- `reviews/DEV-006G.md`, `MVP_BACKLOG.md`
Ikke endret: auth/session/RLS/tenancy, `proxy.ts`, legacy-sider og -actions, providere/rettigheter, TAX, global `not-found`.

### 6. Finnes det allerede et flagg?
**Nei.** Eneste miljøvariabler som leses i appen er Supabase-URL og -nøkkel, `SCOUT_INGEST_DATABASE_URL` og `SCOUT_SYNTHETIC_FAILURE`; ingen skiller partnerdemo fra intern utvikling. Det trengs én boolsk variabel. Siden den leses i `next.config.ts` (utenfor `src/`), påvirkes ikke arkitekturtestens regel om hvilke variabler appkoden leser.

## Godkjenning og implementasjon
Godkjent: A sikker som standard (`SCOUT_ENABLE_LEGACY_ROUTES=1` kreves for å åpne gamle ruter); B mål `/login`; C global not-found endres nå; D skript tilpasses, `tests/legacy-isolation.test.ts` og `scripts/qa-partner-mode.sh` legges til.

### 1. Filer endret
Ny: `src/lib/legacy-routes.ts`, `tests/legacy-isolation.test.ts`, `scripts/qa-partner-mode.sh`.
Endret: `next.config.ts` (`redirects()`), `src/app/not-found.tsx` (Merovo), `src/app/layout.tsx` (gammel topp/banner kun når flagget er `1`; rotmetadata «Merovo demo»), `src/components/AppChrome.tsx` (`chrome === null` → ingen gammel topp), `tests/architecture.test.ts` (miljøvariabelallowlisten har fått `SCOUT_ENABLE_LEGACY_ROUTES`), `scripts/qa-demo-mode.sh` og `tests/e2e/search005.e2e.mjs` (setter flagget eksplisitt fordi de bevisst tester eldre ruter), `.env.example`, `README.md`, `MVP_BACKLOG.md`, denne rapporten.
Ikke endret: eldre sider og actions (ingenting slettet), `proxy.ts`, auth/sesjon/Supabase-konfigurasjon, tenancy, RLS, rettigheter, søkelogikk, TAX. Ingen sesjonslogikk i `next.config`.

### 2. Oppførsel med flagget AV (standard; variabelen mangler, er tom eller ≠ `1`)
Verifisert mot en ekte bygging uten Supabase (`qa-partner-mode.sh`, fase A):
| Forespørsel | Resultat |
|---|---|
| GET `/dashboard` (også med query), `/agents`, `/agents/new`, `/agents/<id>`, `/agents/<id>/runs`, `/agents/a/runs/b`, `/opportunities/demo-001`, `/opportunities/<ukjent>` | **307 → `/login`** (query-strengen videresendes av Next; `/login` leser bare `error`) |
| POST `/agents`, POST `/dashboard` | **307 → `/login`** |
| GET `/` | 307 → `/login` |
| `/login` | 200, Merovo-skall, ingen «Project Scout», ingen «DEMO —»-banner |
| `/searches`, `/searches/new`, `/searches/<ukjent>` (anonym) | uendret: 200, Merovo-skall, ingen «Project Scout» |
| Ukjent URL (`/finnes-ikke-i-demoen`) | 404 med Merovo-ikke-funnet |
Innlogget bruker som treffer en blokkert rute går `→ /login → /searches` via den eksisterende regelen i `/login` (ikke testet mot ekte innlogging her; selve regelen er dekket av e2e fra DEV-006E/F).

### 3. Oppførsel med flagget PÅ (`SCOUT_ENABLE_LEGACY_ROUTES=1` ved bygging)
`qa-partner-mode.sh`, fase B: `/dashboard` 200 med eldre Project Scout-flate, `/agents` 200, `/opportunities/demo-001` 200, `/agents/new` som før (307 for anonym), `/` → `/login`, `/login` og `/searches` uendret (200, Merovo). Den eldre toppen og det gule banneret returnerer kun i denne modusen.

### 4. Global not-found
`src/app/not-found.tsx` er nå Merovo: logo, «Local demand. European supply.», «Fant ikke siden» og lenke til `/login`. Ingen Project Scout-tekst, ingen «dashboard»-lenke, ingen gult banner, ingen ny logikk. Med flagget PÅ vises den under den eldre toppen (for intern bruk). `/searches/**` har fortsatt sin egen variant.

### 5. Tester faktisk kjørt
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | uten feil |
| `npx vitest run` | 25 filer, **561 / 561** bestått (556 + 5 nye i `legacy-isolation.test.ts`) |
| `npm run build` (standard, flagg av) | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **emulator** + isolert PG; flagget satt eksplisitt i skriptets bygg) | **76 / 76** |
| `bash scripts/qa-partner-mode.sh` (to byggefaser, ingen Supabase) | alle kontroller bestått (første kjøring hadde én for streng forventning til query-strengen; rettet i skriptet, ikke i koden) |
| `bash scripts/qa-demo-mode.sh` (med flagget satt eksplisitt) | alle kontroller bestått |

### 6. Supabase-avhengige kontroller IKKE kjørt
`tests/e2e/dev002-auth`, `dev004-agents`, `qa001-app-paths`, `dev005-search-runs` (oppdatert i DEV-006F; **kjøring av dem krever nå også at appen bygges med `SCOUT_ENABLE_LEGACY_ROUTES=1`**, siden de åpner `/agents`; dette er ikke lagt inn i dem fordi de ikke bygger appen selv), samt DB-/RLS-suitene (`npm run test:db`) og mutasjonstestene. Ingen påstand om at de består.

### 7. Kjente begrensninger
1. Flagget leses **ved bygging** (redirects ligger i routes-manifestet; rotlayouten leses ved bygging for statiske sider). En endring krever ny bygging. For `next dev` gjelder verdien ved oppstart.
2. Server-actions fra de eldre sidene ligger fortsatt i bygget. Stiene deres er blokkert og de håndhever selv sesjon, firma og RLS, men de er ikke fysisk fjernet. Full fjerning krever en egen oppgave (utelate legacy fra bygget).
3. Query-strengen videresendes ved omdirigering (f.eks. `/dashboard?error=1` → `/login?error=1` viser innloggingsfeilen). Kosmetisk; ingen tilgangskonsekvens.
4. Ukjente URL-er utenfor `/searches` og de blokkerte stiene gir 404 med Merovo-side; `/opportunities` uten id (ingen side) blir også 404 Merovo.
5. Hosting, domene, brukerinvitasjon og tilgangskontroll er ikke gjort; ingen deploy. Ingen ekte leverandørdata; kun syntetiske data.
6. Ikke testet mot ekte Supabase Auth eller i Safari/Firefox/skjermleser.

## Commit
Kode-commit: `d35653d`.
