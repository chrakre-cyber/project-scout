// HOST-001-FIX2: start eksterne programmer UTEN shell, på Linux og Windows. Bakgrunn: `child_process.spawn("npx"|"npm", …)` uten shell feiler på Windows (npx.cmd/npm.cmd er ikke kjørbare filer; ENOENT/EINVAL),
// og med `shell: true` ville databaseadressen (med passord) gått gjennom cmd.exe-tolking. Her startes i stedet Node (`process.execPath`) direkte med programmets JS-inngangspunkt, lest fra den LÅSTE pakken i
// node_modules (package.json «bin»), og bash resolves eksplisitt. Inngangspunktene er kontrollert mot de låste pakkene (ikke antatt):
//   · supabase 2.119.0 → dist/supabase.js (ESM-skall som starter den native CLI-binæren fra den platform-spesifikke valgfrie pakken, f.eks. @supabase/cli-windows-x64, med spawn uten shell)
//   · vitest 5.0.3     → vitest.mjs     · next 16.3.8 → dist/bin/next (CJS med `#!/usr/bin/env node`)
// `npm run build` er `next build` (package.json; kontrollert av test), så build startes som `next build`. bash er ikke en npm-pakke: på Windows brukes Git for Windows sin bash.exe (ALDRI WSLs
// C:\Windows\System32\bash.exe), ev. overstyrt med SCOUT_BASH. Feil gir bare en KATEGORI — aldri argumenter, miljø eller adresser.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export class LaunchError extends Error {
  constructor(category) { super(category); this.name = "LaunchError"; this.category = category; }
}
export const NODE_TOOLS = Object.freeze(["supabase", "vitest", "next"]);
const JS_EXT = new Set([".js", ".mjs", ".cjs"]);

/** Leser pakkens «bin» fra package.json og returnerer absolutt sti til en JavaScript-fil (endelse .js/.mjs/.cjs, eller shebang med node). Ikke-JS ⇒ LaunchError. */
export function nodeToolEntry(pkg, { root, fs, pathMod }) {
  let meta;
  try { meta = JSON.parse(fs.readFileSync(pathMod.join(root, "node_modules", pkg, "package.json"), "utf8")); } catch { throw new LaunchError(`pakken «${pkg}» er ikke installert (kjør npm ci)`); }
  const bin = typeof meta.bin === "string" ? meta.bin : meta.bin?.[pkg] ?? (Object.keys(meta.bin ?? {}).length === 1 ? Object.values(meta.bin)[0] : undefined);
  if (typeof bin !== "string") throw new LaunchError(`pakken «${pkg}» har ingen kjørbar «bin»`);
  const file = pathMod.resolve(root, "node_modules", pkg, bin);
  if (!fs.existsSync(file)) throw new LaunchError(`inngangspunktet til «${pkg}» finnes ikke`);
  const head = fs.readFileSync(file, "utf8").slice(0, 120);
  const isJs = JS_EXT.has(pathMod.extname(file).toLowerCase()) || /^#!.*\bnode\b/.test(head);
  if (!isJs) throw new LaunchError(`inngangspunktet til «${pkg}» er ikke JavaScript (kan ikke startes uten shell)`);
  return file;
}

const isWslLauncher = (p) => /[\\/](windows[\\/]system32|windowsapps)[\\/]/i.test(p);   // WSLs bash.exe-starter: kjører Linux-distribusjonen, ikke Git Bash

/** Finner bash. Linux/macOS: «bash» (PATH). Windows: SCOUT_BASH, ellers Git for Windows' bash.exe; WSL-lanseringsprogrammet i System32/WindowsApps avvises. */
export function findBash({ platform, env, fs, pathMod }) {
  if (platform !== "win32") return "bash";
  const ok = (p) => typeof p === "string" && p !== "" && /\\bash\.exe$/i.test(p) && !isWslLauncher(p) && fs.existsSync(p);
  if (env.SCOUT_BASH !== undefined && env.SCOUT_BASH !== "") { if (ok(env.SCOUT_BASH)) return env.SCOUT_BASH; throw new LaunchError("SCOUT_BASH peker ikke på en gyldig Git Bash (bash.exe; ikke WSL)"); }
  const roots = [env.ProgramFiles, env.ProgramW6432, env["ProgramFiles(x86)"]].filter(Boolean).map((r) => pathMod.join(r, "Git"));
  if (env.LOCALAPPDATA) roots.push(pathMod.join(env.LOCALAPPDATA, "Programs", "Git"));
  for (const r of roots) for (const rel of [["bin", "bash.exe"], ["usr", "bin", "bash.exe"]]) { const c = pathMod.join(r, ...rel); if (ok(c)) return c; }
  for (const d of String(env.PATH ?? env.Path ?? "").split(";").filter(Boolean)) { const c = pathMod.join(d, "bash.exe"); if (ok(c)) return c; }
  throw new LaunchError("bash ikke funnet (installer Git for Windows, eller sett SCOUT_BASH til Git Bash sin bash.exe)");
}

export function createLauncher({ platform = process.platform, root = process.cwd(), env = process.env, execPath = process.execPath, fs = { readFileSync, existsSync }, pathMod = platform === "win32" ? path.win32 : path.posix, spawnImpl = spawn } = {}) {
  /** Logisk program → { file, args } uten shell. «npx»/«npm» finnes ikke: bruk «supabase», «vitest», «next» eller «bash». */
  const resolve = (tool, args) => {
    if (NODE_TOOLS.includes(tool)) return { file: execPath, args: [nodeToolEntry(tool, { root, fs, pathMod }), ...args] };
    if (tool === "bash") return { file: findBash({ platform, env, fs, pathMod }), args };
    throw new LaunchError("ukjent program");
  };
  /** Kjører fila direkte (shell: false), fanger stdout+stderr. Aldri unntak: oppstartsfeil gir { code: 127, launchError: kategori }. */
  const runFile = (file, args, extraEnv = {}) => new Promise((resolveRun) => {
    let out = "", done = false;
    const finish = (r) => { if (!done) { done = true; resolveRun(r); } };
    let child;
    try { child = spawnImpl(file, args, { env: { ...env, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true }); }
    catch (e) { return finish({ code: 127, out, launchError: `kunne ikke starte programmet (${e?.code ?? "feil"})` }); }
    child.stdout?.on("data", (d) => { out += d; }); child.stderr?.on("data", (d) => { out += d; });
    child.on("error", (e) => finish({ code: 127, out, launchError: `kunne ikke starte programmet (${e?.code ?? "feil"})` }));
    child.on("close", (code, signal) => finish({ code: code ?? (signal ? 128 : 1), out }));
  });
  const run = async (tool, args, extraEnv = {}) => {
    let cmd;
    try { cmd = resolve(tool, args); } catch (e) { return { code: 127, out: "", launchError: e instanceof LaunchError ? e.category : "ukjent oppstartsfeil" }; }
    return runFile(cmd.file, cmd.args, extraEnv);
  };
  return { resolve, run, runFile };
}

/**
 * «Er denne modulen programmets inngang?» Sammenligner med pathToFileURL (riktig også på Windows: file:///C:/…). Den gamle sammenligningen `import.meta.url === \`file://${argv[1]}\`` stemmer aldri på
 * Windows (file:///C:/… mot file://C:\…), så CLI-et ville avsluttet stille uten å gjøre noe.
 */
export const isMainModule = (metaUrl, argv1, toUrl = pathToFileURL) => { try { return typeof argv1 === "string" && argv1 !== "" && toUrl(argv1).href === metaUrl; } catch { return false; } };
