# DEV-006F — forberedelse av lukket partnerdemo-hosting (16.10.2026)

**Status: REVIEW** (implementert etter godkjenning; ikke DONE, se «Blokkerer ekstern partnertilgang»). Ingenting er deployet. Vurderingen under er uendret fra før implementasjonen. Startpunkt: branch `claude/wonderful-bardeen-yussx3`, HEAD `80b8d5d`, rent arbeidstre.

## Vurdering

### 1. Dagens oppførsel for rotruten `/`
`src/app/page.tsx` er en ren serverside `redirect("/dashboard")`, uten sesjonssjekk. En partner som åpner demoens rot havner dermed på **`/dashboard` i gammelt Project Scout-skall**: slate-topp «Project Scout», gult DEMO-banner, navigasjon «Dashboard / Mine agenter / Nye søk», og en offentlig annonseliste fra den syntetiske kilden (dashboard krever ikke innlogging). Det er den første flaten en partner ser hvis URL-en deles uten `/login`.

### 2. Ruter en partner kan nå fra den tiltenkte flyten
Fra `/login` → (innlogget) `/searches` og kun disse, alle i Merovo-skall (kontrollert i e2e: ingen lenker til `/agents` eller `/dashboard` i navigasjonen):
- `/login` (inkl. `?error=1`), utlogging → `/login`
- `/searches`, `/searches/new`, `/searches/[id]`, `/searches/[id]/preview`, `/searches/[id]/preview/[listingId]`, Merovo-«ikke funnet» under `/searches/**`
Utenfor flyten, men fortsatt nåbare **ved å taste URL**: `/` → `/dashboard`, `/dashboard`, `/agents` (+ `/agents/new`, `/agents/[id]`, `/agents/[id]/runs/**`), `/opportunities/[id]`. Én lenke fra Merovo-flaten peker ut: den globale `not-found` (for ukjente URL-er utenfor `/searches`-segmentet) har gammel stil og lenken «Til dashboard».

### 3. Minimal endring slik at roten leder riktig
Endre `src/app/page.tsx` fra `redirect("/dashboard")` til `redirect("/login")`.
- Anonym partner: `/` → `/login` (Merovo).
- Innlogget partner: `/` → `/login` → eksisterende regel i `/login` sender allerede `member`/`no_membership` til `/searches` (to redirects, ingen ny logikk).
- Uten Supabase-konfigurasjon viser `/login` den nøytrale «Innlogging er ikke satt opp»-meldingen.
Alternativ (ikke anbefalt): `redirect("/searches")`. Da møter anonym partner en liten «logg inn»-melding på søkesiden i stedet for innloggingsskjemaet, og vi sender én ekstra redirect-kjede for ingenting.
Ingen sesjons-, auth-, RLS- eller tenancy-kode berøres; `/login`-siden og `signIn`/`signOut` er uendret.

### 4. Kan dette gjøres uten å påvirke gamle Project Scout-ruter?
Ja. `/dashboard`, `/agents/**`, `/opportunities/**` og deres tester er teknisk uendret og fortsatt tilgjengelige direkte via URL; bare *hvor roten peker* endres. Kjente følger (må være greit for deg):
- Den eneste automatiske veien fra `/` til gammel UI forsvinner. Gamle sider nås nå bare via `/dashboard` direkte (eller via den gamle menyen etter at man selv har åpnet dem).
- `scripts/qa-demo-mode.sh` og README beskriver `/dashboard` direkte og er upåvirket; README-linjen om visninger bør få en setning om at roten nå går til `/login`.
- E2E-skript starter alle på `/login` eller direkte URL-er og forventes upåvirket; ingen test bruker `/` (grep gjort). Jeg legger til én e2e-sjekk (rot → `/login`, og innlogget rot → `/searches`).

### 5. Filer som vil endres
- `src/app/page.tsx` (én linje)
- `tests/e2e/search005.e2e.mjs` (to nye sjekker; ev. skjermbilde)
- `README.md` (én setning om inngangsflyten)
- `reviews/DEV-006F.md`, `MVP_BACKLOG.md`
Ikke endret: auth/session/RLS/tenancy, `/login`, `/searches/**`, global `not-found.tsx`, gamle ruter, providere, TAX.

## Åpne punkter som du bør vurdere (ikke del av minimumsendringen)
1. **Gamle ruter er fortsatt offentlig nåbare på et lukket demovertskap**: `/dashboard` krever ikke innlogging og viser syntetiske annonser i gammelt skall; `/agents` og `/opportunities` likeså (agent-sider krever firma, men viser Project Scout-stil). Hvis det skal skjules for partnere, krever det en egen beslutning (f.eks. hosting-nivå-blokkering, eller redirect av disse rutene), ikke gjort her.
2. **Global `not-found`** (ukjente URL-er utenfor `/searches`, f.eks. `/foo`) viser fortsatt Project Scout-lignende tekst med lenke til `/dashboard`. Du ba tidligere om å la den stå; jeg foreslår å la den stå også her og ta den i en egen oppgave om partneren får se den.
3. Hosting, domene, miljøvariabler, brukerinvitasjon og tilgangskontroll er ikke del av denne oppgaven (ingen deploy).
4. Supabase-DB-suitene er fortsatt ikke kjørt mot faktisk Supabase (uendret fra DEV-006-FINAL).

5. **Eldre e2e-skript er foreldet av DEV-006E-redirecten (nytt funn, ikke kjørt):** `tests/e2e/dev002-auth.e2e.mjs`, `dev004-agents.e2e.mjs` og `qa001-app-paths.e2e.mjs` venter på `/agents` etter innlogging (`waitForURL(/\/agents/)`), men innlogging går nå til `/searches`. De er ikke del av standard `npm test` og ble ikke kjørt i DEV-006E (de krever lokal Supabase). De vil feile på denne ventingen til de oppdateres. Forslag: én-linjes oppdatering (vent på `/searches`, naviger deretter til `/agents`) i denne oppgaven eller i en egen; jeg gjør det bare hvis du godkjenner det.

## Godkjenning og implementasjon
Godkjent: (a) `/` → `/login`; (b) gamle ruter uendret; (c) global `not-found` uendret; (d) eldre e2e-skript tilpasses.

### Endringer
| Fil | Endring |
|---|---|
| `src/app/page.tsx` | `redirect("/dashboard")` → `redirect("/login")`. Ingen ny sesjonslogikk; `/login` sender fortsatt innlogget bruker (`member`/`no_membership`) til `/searches`. |
| `tests/e2e/dev002-auth`, `dev004-agents`, `qa001-app-paths` | venter på `/searches` etter vellykket innlogging og navigerer deretter eksplisitt til `/agents`; dev002 beholder «feil passord → `/login?error=1`»-grenen. Ingen endring av hva som testes. |
| `tests/e2e/dev005-search-runs.e2e.mjs` | **Ikke på din liste, men samme feil:** ventet også på `/agents` etter innlogging. Samme minimale tilpasning. |
| `tests/e2e/search005.e2e.mjs` | to nye sjekker: `/` anonym → `/login` uten Project Scout; `/` innlogget → `/searches`. |
| `scripts/qa-demo-mode.sh` | **Ikke på listen, men feilet allerede før denne oppgaven:** sjekken hardkodet «av 109 i syntetisk kilde», som DEV-006C gjorde til 115. Endret til «N ≥ 109» (antallet vises). Kjørt: alle kontroller består. |
| `README.md` | én setning om inngangsflyten |
| `MVP_BACKLOG.md`, `reviews/DEV-006F.md` | status |
Ikke endret: auth/sesjon/RLS/tenancy, `/login`, `/searches/**`, `/dashboard`, `/agents/**`, `/opportunities/**`, global `not-found.tsx`, providere, TAX.

### Blokkerer ekstern partnertilgang — IKKE løst
**`/dashboard`, `/agents/**` og `/opportunities/**` er fortsatt tilgjengelige via direkte URL** (gammelt Project Scout-skall med gult banner; `/dashboard` og `/opportunities` krever ikke innlogging og viser syntetiske annonser; `/agents` viser demo-agenter uten innlogging eller firmaets agenter med innlogging). Den globale not-found (ukjente URL-er utenfor `/searches`) har også gammel stil og lenke til `/dashboard`. **Dette må vurderes som en blokker før ekstern partnertilgang gis.** Det er bevisst ikke endret i DEV-006F og skal ikke anses som løst.

## Kontroller faktisk kjørt
| Kontroll | Resultat |
|---|---|
| `npx tsc --noEmit`, `npx eslint .` | uten feil |
| `npx vitest run` | 24 filer, **556 / 556** bestått |
| `npm run build` | OK |
| `bash scripts/qa-secret-scan.sh` | ingen funn (lokal-Supabase-delen hoppet over) |
| `bash scripts/test-e2e-search005.sh` (Chromium mot **emulator** + isolert PG, ikke Supabase) | **76 / 76** (74 + 2 nye) |
| `bash scripts/qa-demo-mode.sh` (demomodus uten Supabase) | alle kontroller bestått etter at den hardkodede 109-sjekken ble rettet (før rettelsen feilet én kontroll, uavhengig av DEV-006F) |

### Oppdatert, men IKKE kjørt (krever lokal Supabase/Docker)
`tests/e2e/dev002-auth.e2e.mjs`, `dev004-agents.e2e.mjs`, `qa001-app-paths.e2e.mjs`, `dev005-search-runs.e2e.mjs`. De er syntakskontrollert (`node --check`) men ikke utført; ingen påstand om at de består. Ikke kjørt heller: DB-/RLS-suitene mot Supabase og mutasjonstestene.

## Begrensninger
Ikke testet mot ekte Supabase Auth; ingen deploy, hosting, domene eller brukerinvitasjon; kun syntetiske data (ingen ekte leverandørdata).
