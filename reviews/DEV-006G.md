# DEV-006G — isolere gamle Project Scout-ruter fra ekstern partnerdemo (16.10.2026)

**Status: assessment gjennomført, venter på godkjenning.** Ingen kode er endret og ingenting er deployet. Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `dbac6a4`, rent arbeidstre.

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

## Beslutninger jeg trenger
**A. Standardverdi (viktigst).**
- *Anbefalt, «avslått som standard» (fail-closed):* legacy er blokkert med mindre `SCOUT_ENABLE_LEGACY_ROUTES=1` er satt. Hosting for partnerdemoen trenger ingen ekstra variabel, og en glemt innstilling eksponerer ikke gammel UI. Kostnad: interne kjøringer av gamle sider (lokal `npm run dev`, `qa-demo-mode.sh`, `/agents`-sjekken i search005-e2e og de eldre Supabase-e2e-skriptene) må sette flagget; jeg oppdaterer de skriptene jeg kan kjøre og dokumenterer resten.
- *Alternativ, «åpen som standard» (fail-open):* `SCOUT_PARTNER_DEMO=1` blokkerer. Mindre endring i skript, men hvis variabelen glemmes ved bygging av den hostede demoen, er den gamle UI-en åpen.
**B. Mål for omdirigering:** `/searches` (anbefalt) eller `/login`.
**C. Global not-found:** foreslår fortsatt uendret. Under blokkering lenker «Til dashboard» til `/dashboard`, som da sender videre til `/searches`; den gamle teksten kan likevel sees på ukjente URL-er (f.eks. `/foo`). Vil du ha en Merovo-variant, er det en separat, liten oppgave.

## Kjente begrensninger ved løsningen (skal ikke anses som løst)
1. **Bygg-tid:** variabelen må være riktig ved bygging; den kan ikke endres uten ny bygging.
2. **Server-actions:** blokkeringen stopper navigasjon og POST til de gamle stiene, men en server-action er en ID i appens bygg; en bruker som på annen måte kjenner action-ID-en kunne i teorien POSTe til en tillatt sti. De gamle actions håndhever selv sesjon, firma og RLS (DEV-004/005), så dette gir ikke økt tilgang, men det er ikke fysisk fjernet. Fullstendig fjerning krever å utelate legacy fra bygget (egen, større oppgave).
3. Global `not-found` og rotmetadata («Project Scout — demo») kan fortsatt vises ved ukjente URL-er.
4. Hosting, brukerinvitasjon og tilgangskontroll er fortsatt ikke gjort. Ingen deploy.
5. Supabase-DB-suitene og de eldre Supabase-e2e-skriptene er fortsatt ikke kjørt mot faktisk Supabase.

## Forespørsel
Godkjenn A (standardverdi), B (mål) og C (not-found uendret), så implementerer jeg kun dette, kjører typecheck/lint/enhetstester/build/e2e og `qa-partner-mode.sh`, og oppdaterer rapporten med endelig status og commit-hash.
