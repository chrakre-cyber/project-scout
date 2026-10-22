# HOST-001-FIX2 — Windows-kompatibel prosessoppstart uten shell (til uavhengig review, 22.10.2026)

**HOST-001 forblir REVIEW.** Ingenting er installert på Christians maskin; ingen prosjekt opprettet; ingen credentials brukt; ingen hosted kontakt; ingen Actions; `main` urørt. **Ikke kjørt på Windows.** Repoets lokale plassering hos Christian er ikke avklart; Codex sin reviewkopi er ikke brukt som arbeidsrepo (arbeidet er gjort i dette repoet på grenen `claude/wonderful-bardeen-yussx3`). Økonomiflagg `false`; L3c utsatt; CI-002 utsatt.

## Problem (funnet ved kartlegging av Windows-bruk)
1. `cli.mjs` startet `npx`, `npm` og `bash` med `spawn` uten shell. På Windows er `npx`/`npm` `.cmd`-filer (ENOENT/EINVAL uten shell), og `shell: true` ville latt cmd.exe tolke argumentene — inkl. databaseadressen med passord. ⇒ `dry-run`, `apply` og `h3-api` ville feilet. *(Basert på Node-dokumentasjon; ikke reprodusert, siden vi ikke har Windows.)*
2. `import.meta.url === \`file://${process.argv[1]}\`` stemmer aldri på Windows (`file:///C:/…`): CLI-et ville avsluttet stille uten å gjøre noe. *(Vises regnemessig i testen.)*
3. `bash` kunne bli WSLs `C:\Windows\System32\bash.exe` (Linux-distribusjonen, ikke Git Bash).
4. Ingen `.gitattributes`: Git for Windows kan gi CRLF i `*.sh`.

## Kontroll av faktiske inngangspunkter i de låste pakkene (ikke antatt)
| Program | Låst pakke | Inngangspunkt (fra `package.json` «bin») | Merknad |
|---|---|---|---|
| supabase | 2.119.0 | `dist/supabase.js` (ESM, `#!/usr/bin/env node`) | **ikke selve CLI-en:** skallet starter en **native binær** fra platformpakken (`@supabase/cli-windows-x64` → `bin/supabase.exe`) med `spawn(binPath, argv, { stdio: "inherit" })` uten shell; lockfilen har `@supabase/cli-windows-x64` |
| vitest | 5.0.3 | `vitest.mjs` | JS |
| next | 16.3.8 | `dist/bin/next` (ingen endelse, shebang `node`) | JS; `npm run build` = `next build` (testet) |
| bash | – | ikke en npm-pakke | Windows: Git for Windows sin `bash.exe`; WSL avvist; `SCOUT_BASH` |
Lockfilen har også Windows-pakkene for Next SWC, Rolldown (Vite 8/Vitest), lightningcss og sharp (`npm ci` på Windows er likevel **ikke verifisert**).

## Retting (avgrenset)
- **Ny `scripts/hosted/launch.mjs`:** `createLauncher()` → logiske programmer `supabase`, `vitest`, `next`, `bash` startes med `child_process.spawn(file, args, { shell: false, windowsHide: true, stdio: [ignore, pipe, pipe] })`. Node-programmene: `process.execPath` + JS-inngang fra pakkens `bin` (valideres: .js/.mjs/.cjs eller node-shebang; ellers `LaunchError` «ikke JavaScript»). `npx`/`npm` finnes ikke. Oppstartsfeil gir `{ code: 127, launchError: <kategori> }` (aldri unntak, aldri argumenter/miljø/adresser i feilen). Argumenter går uendret via `spawn`-matrisen, så passordet tolkes aldri av cmd.exe og skrives ikke til logg (utskrift fra underprosess fanges og saneres som før).
- **`cli.mjs`:** `deps.run("supabase"|"vitest"|"next"|"bash", …)`; `launchError` gir tydelig melding og FEIL/IKKE bestått (ikke PASS). `isMainModule()` bruker `pathToFileURL`. Linux-oppførsel, målvalidering, TLS (`hostedDbConfig`), beleggbinding og alle PASS-krav er uendret (evaluator/`scripts/ci/` uendret).
- **`scripts/hosted/windows-selftest.mjs`:** selvtest uten nettverk/hosted/credentials som Christian kan kjøre etter `npm ci` (separat godkjent). Gir den faktiske Windows-kjøringen som repoets tester ikke kan gi.
- **`.gitattributes` (EGEN, tydelig del av diffen):** `*.sh text eol=lf`. Berører bare linjeslutt i arbeidskopien for shell-skript; alle sporede `*.sh` er allerede LF (testet), så ingen filinnhold endres.

## Tester og kontroller (alt kjørt på Linux)
| Kontroll | Resultat |
|---|---|
| `npx vitest run` | 93 filer / **2 107 tester bestått** (27 nye i `tests/hosted-launch.test.ts`) |
| FAKTISK: ekte inngangspunkter | supabase/vitest/next løses til JS; `vitest`, `next`, `supabase` starter og svarer på `--version` uten shell (native `cli-linux-x64`); `bash` svarer |
| FAKTISK: argumenter | 19 spesialtegn-strenger + newline + 20 000 tegn + passord-URL kommer uendret fram; kommandosubstitusjon/`;`/`&&`/`\|`/`>`/glob utføres ikke (ingen sidefiler) |
| FAKTISK: feilbaner | manglende program ⇒ 127 + kategori uten argumenter/passord; spawn som kaster ⇒ 127; uinstallert pakke ⇒ ingenting startes; exit-koder 0/1/3/255 videreføres; signaldrap ≠ 0; stdout+stderr fanges; spawn-valg `shell:false`, `windowsHide`, stdin ignorert |
| SIMULERT Windows | Windows-stier og `execPath`, bash i Program Files/(x86)/LocalAppData/PATH/`SCOUT_BASH`, WSL (System32, WindowsApps) avvist selv først i PATH, manglende bash ⇒ tydelig feil, `isMainModule` med `file:///C:/…` |
| Statisk | `spawn` bare i `launch.mjs`; ingen `shell: true`/`exec*`/`npx`/`npm`; `.gitattributes` aktiv (`git check-attr`); alle `*.sh` LF; `npm run build` = `next build`; supabase-skallet uten shell |
| Selvtest (`windows-selftest.mjs`) | kjørt **her**: plattform linux, alle 11 delkontroller bestått; feilede delkontroller gir IKKE BESTÅTT (testet). **Ikke kjørt på Windows** |
| `bash scripts/test-hosted-offline.sh` (isolert PostgreSQL, ikke Supabase) | 20 bestått |
| `tsc` / `eslint` / `qa-secret-scan.sh` | exit 0 / ingen funn / INGEN FUNN |
| Uendret | `src/`, `supabase/`, `.github/`, `scripts/ci/`, `tests/e2e/` |

## Begrensninger
- **Ingen faktisk Windows-kjøring.** Simulerte tester beviser logikken, ikke Windows' CreateProcess/libuv-siterings- eller `supabase.exe`-oppførsel, ikke at `npm ci` fungerer på Windows (lockfilen har Windows-pakkene), og ikke at Git for Windows' `bash.exe` kjører `qa-secret-scan.sh` korrekt (grep/xargs/git i MSYS). Selvtesten er laget for å gi dette beviset senere.
- Databaseadressen ligger fortsatt som argument til Supabase CLI (synlig for samme bruker i prosesslisten); kjøres bare på eierens maskin; utskrift saneres.
- `fs`-rettigheter (`0700/0600`) for `.hosted/` har ingen effekt på Windows (NTFS-ACL fra mappen); mappen er git-ignorert og inneholder bare fingeravtrykk/tall.
- Node 24 er ikke prøvd av oss (prosjektet testet på 22).
