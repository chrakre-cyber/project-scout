# DEV-006E — Merovo partner login experience (16.10.2026)

**Status: REVIEW** (ikke DONE). Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `1f07c1f`, rent arbeidstre. Kode-commit: se «Commit» nederst.

## 1. Vurdering (før koding)
- Partner møtte: `/login` (Project Scout-topp, gult banner, slate-stil, tittel «Logg inn — Project Scout»), deretter etter innlogging **`/agents`** (gammel flate) – ikke `/searches`. Innlogget bruker på `/login` ble sendt til `/agents`. Sign-out → `/login`. `/` → `/dashboard`. Ingen registrering/glemt passord finnes. «Ikke konfigurert»-meldingen nevnte miljøvariabelnavn. Global `not-found` har gammel stil og lenke til `/dashboard`.
- Auth-logikk kunne forbli urørt; redirect-målet var det eneste atferdspunktet (godkjent som egen liten endring, se 3).

## 2. Filer endret
Ny: `src/app/login/layout.tsx`, `src/app/searches/not-found.tsx`, `reviews/DEV-006E.md`, `reviews/DEV-006E/*.png`.
Endret: `src/app/login/page.tsx` (markup/tekst + redirect-mål), `src/app/login/actions.ts` (kun redirect-mål etter suksess), `src/components/AppChrome.tsx` (skipper det gamle skallet også for `/login`), `tests/e2e/search005.e2e.mjs`, `MVP_BACKLOG.md`.
Ikke endret: global `src/app/not-found.tsx`, `/` → `/dashboard`, `/agents`, `/dashboard`, `/opportunities`, `signOut`, `src/server/**`, `src/lib/supabase/**`, `src/proxy.ts`, migrasjoner.

## 3. Redirect-oppførsel (eksplisitt, godkjent endring)
| Situasjon | Før | Etter |
|---|---|---|
| Vellykket innlogging (`signIn`) | `/agents` | **`/searches`** |
| Allerede innlogget (`member` eller `no_membership`) besøker `/login` | `/agents` | **`/searches`** |
| Mislykket innlogging | `/login?error=1` | uendret |
| Sign-out | `/login` | uendret |
| `/` | `/dashboard` | uendret |
| Supabase ikke konfigurert (`signIn`) | `/login` | uendret |
Merk: en bruker uten firmatilknytning (`no_membership`) sendes nå til `/searches`, som viser sin eksisterende melding om at firmakonto kreves (siden er uendret; den lenker til `/login`, som igjen viser `/searches` — ingen redirect-løkke, men meldingen er upresis for den gruppen).

## 4. Auth uendret
Innloggingsmetode (`signInWithPassword`), e-post-trimming, passordhåndtering, felles feilmelding, Supabase-klient/konfigurasjon, sesjonslogikk (`session.ts`, `proxy.ts`), tenancy, RLS og tillatelser er **uendret** (`git diff` av `src/server`, `src/lib`, `src/proxy.ts`, `supabase/` er tom; i `actions.ts` er eneste endring linjen `redirect("/agents")` → `redirect("/searches")`). Skjemaets feltnavn (`email`, `password`), `autoComplete`-verdier og `action={signIn}` er bevart (e2e-sjekket).

## 5. Designendringer
Merovo-skall for `/login`: logo (eksisterende filer), skoggrønn merkelinje «Local demand. European supply.», krem/papir-bakgrunn, Figtree, terrakotta kun der det trengs (fokusfarge), kort med grønn toppkant, 44 px-knapper. Støttetekst (rolig, ikke advarsel): «Privat partnerdemo. Tilgang gis av Merovo; det finnes ingen åpen registrering.» «Ikke konfigurert» viser nå «Innlogging er ikke satt opp i dette miljøet.» uten variabelnavn. Ingen Project Scout-merkevare, gult banner, AI-/markedsplass-/live-påstander, leverandørlogoer eller partnerskapsantydninger. Under `/searches/**` gir ukjent id/ingen tilgang nå en Merovo-«Fant ikke siden» (kort, med lenke til `/searches`) via segmentets `not-found.tsx`; den globale siden er uendret.

## 6. Skjermbilder (`reviews/DEV-006E/`)
Nye for DEV-006E: `16-login` (desktop), `17-login-feil` (desktop, felles feilmelding), `18-mobil-login` (390 px), `19-ikke-funnet` (Merovo not-found). Resten er regenerert søkeflyt (01–15) fra samme kjøring.

## 7. Tester faktisk kjørt
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | uten feil |
| `npx vitest run` | 24 filer, **556 / 556** bestått |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **emulator** + isolert PG, ikke Supabase) | **74 / 74** (67 + 7 nye: redirect etter innlogging, redirect fra `/login` når innlogget, Merovo-login uten Project Scout/gult banner/variabelnavn, uendrede feltnavn, feil passord, mobil uten horisontal rulling, Merovo-not-found) |
Ikke kjørt: DB-/RLS-suitene mot Supabase, isolerte DB-tester og mutasjonstester (ingen DB-/sikkerhetskode endret); manuell test mot ekte Supabase Auth.

## 8. Kjente begrensninger
- Etter innlogging er partneren i Merovo-flaten, men `/agents`, `/dashboard`, `/opportunities` og `/` har fortsatt gammel stil og er fortsatt tilgjengelige via URL (utenfor scope).
- Tilstanden «ikke konfigurert» er ikke fotografert (testmiljøet har Supabase-variabler); teksten er kodet og gjennomgått, ikke testet visuelt.
- Ukjente URL-er utenfor segmentet (f.eks. `/searches/a/b/c`) faller til den globale Project Scout-lignende not-found-siden, som er bevisst uendret.
- Bruker uten firma (`no_membership`) får en upresis melding på `/searches` (se 3).
- Ikke testet mot ekte Supabase Auth, i Safari/Firefox eller med skjermleser.
- Ingen ekte leverandørdata er aktivert; kun syntetiske data.
