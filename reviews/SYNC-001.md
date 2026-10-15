# SYNC-001 — sammenligningsrapport og installasjonsplan

Status: **REVIEW** (ikke DONE). Utfører Claude Code, kontrollør Codex. Ingen ny oppgave startet. Hosted regresjon og ny appintegrasjon er ikke utført og ikke påstått.

## 1. Utgangspunkt (før endring)

- Branch `claude/wonderful-bardeen-yussx3`, faktisk **HEAD `46d395e`** («legg ved review-ZIP for d96d125»). Ingen commits etter dette; koden er identisk med `d96d125` (46d395e la bare ZIP-filen til).
- **Base for ny diff: `46d395e`.** Arbeidsområdet var rent (ingen endrede eller usporede filer). Ingenting er nullstilt eller kastet.
- Lokal referanse: `local-reference/` fra Christians `project_scout_DEV_005B`, ingen Git-historikk. **Manifest verifisert mot snapshot**: 145 filer, 0 avvik i størrelse/SHA-256, ingen filer utenfor manifestet.

## 2. Metode

Alle 145 manifestfiler er sammenlignet byte-for-byte (SHA-256) mot repoets sporede filer, og alle sporede repofiler er sjekket mot manifestet. Klassifisering er gjort på innhold, ikke dato. Resultat:

| Kategori | Antall |
|---|---|
| Identiske (SHA-256 lik) | **137** |
| Avviker (finnes begge steder) | **5** |
| Bare lokalt | **3** |
| Bare i repoet (ikke i snapshot) | **38 sporede filer** |

Identiske inkluderer `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `eslint.config.mjs`, `next.config.ts`, `vitest*.config.ts`, alle `supabase/migrations/*` (historiske migrasjoner uendret), all øvrig appkode, alle øvrige tester og alle andre dokumenter. **Det er ingen avvik i pakker/lås, konfigurasjon eller migrasjoner**, så ingen pakkeløsning var nødvendig (ingen oppgradering/nedgradering, ingen installerte API-er).

## 3. Alle forskjeller

### 3a. Filer som finnes begge steder, men avviker (5)

| Fil | Klassifisering | Innhold | Håndtering |
|---|---|---|---|
| `tests/architecture.test.ts` | **Lokal rettelse** | `path.sep → '/'` på kontrollstiene (`rel`), så sikkerhetsreglene (`src/domain/…` osv.) treffer på Windows. | **Innarbeidet** fra lokal. Lagt til to tester (se §5), så lokal fil må oppdateres (`replace`). |
| `src/app/agents/[id]/runs/[runId]/page.tsx` | **Lokal rettelse** | «Slettes automatisk» → «Utløper senest» + avsnitt om at kjøring og resultater *skjules* ved utløp (eller tidligere hvis rettigheter opphører), at fysisk sletting skjer ved opprydding, og at automatisk opprydding foreløpig ikke er satt opp. | **Innarbeidet** fra lokal (byte-lik). Ingen test refererer den gamle teksten (søk i repoet). |
| `src/server/search-runs.ts` | **Lokal rettelse** | Kommentar til `expiresAt`: «Seneste synlighetsfrist (DEC-028). Fysisk sletting skjer ved separat opprydding.» | **Innarbeidet** fra lokal (kun kommentar). |
| `DECISIONS.md` | **Nytt Claude-arbeid** (repo har DEC-031 + FIX1-tillegg) | Lokal = repo minus DEC-031. DEC-030 er lik begge steder. | **Repoets versjon beholdt** (superset). Lokal må erstattes (filplan: `replace`). Ingen beslutning konstruert. |
| `MVP_BACKLOG.md` | **Dokumenttillegg / nytt Claude-arbeid** | Lokal inneholder QA-DEP-001-, QA-SEARCH-001- og SPEC-SEARCH-001-oppføringene; repo har samme **pluss** radene/loggpostene for SEARCH-001A-UI, SEARCH-002, FIX1 og nå SYNC-001. De tre QA-linjene (92, 94, 96) er **innholdslike**; lokal har bare CRLF på dem (Windows-redigert). | **Sammenflettet**: repoets versjon beholdt, QA-linjene er til stede, SYNC-001 lagt til. Linjeslutt for de tre linjene blir LF i repoet (rent formelt). |

### 3b. Bare lokalt (3)

| Fil | Klassifisering | Håndtering |
|---|---|---|
| `reviews/QA-DEP-001.md` | Dokumenttillegg (lokal) | Lagt til i repoet, byte-lik. Backloggen refererer den. |
| `reviews/QA-SEARCH-001.md` | Dokumenttillegg (lokal) | Lagt til i repoet, byte-lik. |
| `start-scout-local.cmd` | Lokal rettelse / lokalt oppsett | Lagt til i repoet **uendret** (viser til lokalt `certs\prod-ca-2021.crt` som ikke er distribuert). Ikke endret, ingen sertifikatvalidering fjernet, `rejectUnauthorized` ikke rørt. Sertifikat og `.env.local` finnes ikke i repoet og berøres ikke. |

### 3c. Bare i repoet (38 sporede filer — ikke installert lokalt ennå, skal ikke slettes)

- **Ny Claude-arbeid, må legges til lokalt (`add`)** — 35 filer: `prototypes/merovo-search/**` (README, `index.html`, `css/style.css`, `js/{app,data,logic}.js`, `assets/*` inkl. Figtree + OFL-lisens og 3 logofiler), `src/domain/search-v2/*.ts` (8 filer), `tests/{search-prototype.test.ts, search-v2.test.ts, search-v2-fix1.test.ts, fixtures/search-v2.ts, e2e/search001a-prototype.e2e.mjs}`, `reviews/{SEARCH-001A-UI.md, SEARCH-002.md}` og 9 skjermbilder i `reviews/SEARCH-001A-UI/screenshots/`, (samt denne rapporten, `reviews/SYNC-001.md`, som 36. fil i planen).
- **Utelatt fra snapshot ved regel — uavklart, ikke i filplanen:** `.env.example` (mal uten hemmeligheter; snapshot-regelen utelater `.env*`, så den finnes sannsynligvis lokalt og skal ikke røres), `Project_Scout_Start_her.pdf` (PDF utelatt ved regel).
- **Generert artefakt:** `SEARCH-002-FIX1-review-d96d125.zip` i repoets rot (ble committet fordi en stop-hook krevde sporbar arbeidsmappe). Hører ikke hjemme i Christians kildemappe; ikke i filplanen. *Forslag (ikke utført):* fjern den fra repoet og lever review-ZIP-er utenfor Git.

## 4. Det som er bevart (krav i oppdraget)

| Krav | Status |
|---|---|
| Windows-normalisering i `tests/architecture.test.ts` | Bevart + regresjonstester lagt til |
| «Utløper senest», forklaring av skjuling/fysisk sletting, `expiresAt`-kommentar | Bevart (byte-lik lokal) |
| Lokale dokumenttillegg QA-DEP-001, QA-SEARCH-001, spesifikasjon, DEC-030 | Bevart; QA-rapportene lagt til som filer |
| DEC-031, prototypehistorikk, review-belegg | Bevart (loggene er sammenflettet, ikke erstattet) |
| SEARCH-002-FIX1-kode (kandidat/revisjon/kostnadsgrunnlag, strukturvalidering) | Urørt |
| Eksisterende søk, RLS, betrodd skrivevei, historiske migrasjoner | Urørt (alle `supabase/**` identiske) |
| Prototypens UI, domeneregler, serveractions, API/provider-kontrakter, migrasjoner | Urørt. P3-merknaden om gammel prototypeimport er ikke løst. |

## 5. Windows-rettelsen og sikkerhetstestene

`tests/architecture.test.ts` bruker nå `relative(ROOT, path).split(sep).join("/")`. Siden jeg kjører på Linux (`sep === "/"`), er **ingen Windows-kjøring utført eller påstått**. I stedet er to tester lagt til:
1. regelen inspiseres med `path.win32`: en `win32`-relativ sti normaliseres til `src/domain/search-v2/types.ts`, og uten normalisering ville `startsWith("src/domain/")` stille feilet (dette er feilmodusen rettelsen hindrer);
2. sikkerhetsreglene gjennomgår faktisk domenefilene, inkludert `matching.ts` og fire `search-v2`-filer, og ingen kontrollsti inneholder `\`.
Codex etterprøver på Christians maskin senere.

## 6. Kontroller faktisk kjørt (Linux, syntetisk/demomodus, uten credentials)

- `tsc --noEmit`: ren. `eslint .`: ren.
- `vitest run` (ikke-DB): **328/328** i 17 filer. Det inkluderer prototypens logikktester (`search-prototype.test.ts`, 80), SEARCH-002 (`search-v2.test.ts`, 65) og FIX1-regresjonene (`search-v2-fix1.test.ts`, 29), i tillegg til arkitekturtesten (nå 13). Før SYNC-001: 326.
- `qa-secret-scan.sh`: «INGEN FUNN». `npm run build`: OK.
- Demo uten Supabase: produksjonsserver startet lokalt; `/agents` → 200 og `/login` → 200 (demoinnhold synlig), `/` og `/agents/new` → 307 (omdirigering). Kjøringssiden med «Utløper senest» krever en lagret kjøring og er bare verifisert i kildekode, ikke i nettleser.
- **Tørrkjøring av filplanen:** planen er anvendt (med hashkontroll av `expectedLocalSha256`/«finnes ikke») på en kopi av den lokale snapshoten i en midlertidig mappe. Resultat: alle plan-dekkede filer er byte-like med repoet (0 avvik), alle 142 `preserve`-filer uendret, og `tsc` + `vitest` (328/328) består på den oppdaterte kopien. Skriptet er ikke en del av leveransen og ingen lokal fil ble berørt.
- Ikke kjørt: DB-tester, hosted innlogging/søk/lagring, nettleser-e2e (ingen UI endret utover én tekststreng), Windows.
- Ingen database, reset, purge, auth-endring, migrasjon, utsending eller publisering.

## 7. Uavklarte / for Christian og Codex

Ingen prinsipiell konflikt (ingen beregnings- eller tilgangsregel avviker). Punkter å avklare før oppdatering:
1. `start-scout-local.cmd` forutsetter `certs\prod-ca-2021.crt` lokalt. Ingen endring gjort; filen skal bli stående hos Christian (se `preserve`).
2. Skal `SEARCH-002-FIX1-review-d96d125.zip` fjernes fra Git (forslag)?
3. `.env.example` og `Project_Scout_Start_her.pdf` var ikke i snapshotet; bekreft at lokale kopier finnes og ikke skal oppdateres.
4. Linjeslutt: lokal `MVP_BACKLOG.md` har CRLF på tre linjer; repoets versjon har LF.

## 8. Filplan for trygg lokal oppdatering

`reviews/SYNC-001-file-plan.json` (maskinlesbar, relative stier, SHA-256):
- `add`: 36 filer som ikke finnes lokalt (35 + denne rapporten). Hvis filen allerede finnes lokalt: **stopp**, ikke overskriv.
- `replace`: 3 filer (`DECISIONS.md`, `MVP_BACKLOG.md`, `tests/architecture.test.ts`) med `expectedLocalSha256` (fra LOCAL-MANIFEST.json) og `sha256` for sluttfilen. Ved avvik fra forventet lokal hash stoppes kopieringen av *den* filen.
- `preserve`: 142 lokale filer: 137 identiske, `page.tsx` og `search-runs.ts` (repoet har nå byte-lik kopi av den lokale rettelsen, så lokal fil trenger ingen endring) og de 3 som bare fantes lokalt (repoet har byte-like kopier) — med begrunnelse.
- `skipped`: filer utenfor planen (`.env.example`, PDF, generert ZIP, selve plan-filen).
- `deletions`: tom. Ingen sletting foreslås. Ingen skript som overskriver prosjektmappen, ingen `.env`/sertifikat-håndtering.

Hash for `reviews/SYNC-001.md` selv står i planen; selve planen er utelatt fra egen hash.

## 9. Neste mulige oppgave (ikke startet)

Etter godkjent og gjennomført lokal oppdatering: kandidat-/prototypeadapter og senere kontrollert lagring (SEARCH-001B). Ikke del av SYNC-001.
