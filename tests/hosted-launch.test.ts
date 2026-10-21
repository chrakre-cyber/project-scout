// HOST-001-FIX2: programstart uten shell (Linux og simulert Windows), faktiske inngangspunkter i de låste pakkene, spesialtegn i argumenter, manglende programmer og feilede underprosesser.
// SKILLET: «FAKTISK» = kjører ekte prosesser på DENNE plattformen (Linux i CI/sandbox). «SIMULERT WINDOWS» = platform/path/filsystem er innsprøytet; det beviser logikken (stiforming, valg av bash, avvisning
// av WSL), men IKKE hvordan Windows' CreateProcess, libuv-sitering eller Supabase sin .exe oppfører seg. Det kan bare en faktisk kjøring på Windows vise (node scripts/hosted/windows-selftest.mjs).
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path, { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { LaunchError, NODE_TOOLS, createLauncher, findBash, isMainModule, nodeToolEntry } from "../scripts/hosted/launch.mjs";
import { WEIRD_ARGS, runSelfTest } from "../scripts/hosted/windows-selftest.mjs";

const ROOT = process.cwd();
const real = { root: ROOT, fs: { readFileSync, existsSync }, pathMod: path.posix };
const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "scout-launch-")); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("FAKTISK: inngangspunktene i de låste pakkene (ikke antatt)", () => {
  const meta = (p: string) => JSON.parse(readFileSync(`node_modules/${p}/package.json`, "utf8"));
  it("supabase, vitest og next har JS-inngang: dist/supabase.js, vitest.mjs og dist/bin/next (shebang node)", () => {
    expect(nodeToolEntry("supabase", real).replace(ROOT, "")).toBe("/node_modules/supabase/dist/supabase.js");
    expect(nodeToolEntry("vitest", real).replace(ROOT, "")).toBe("/node_modules/vitest/vitest.mjs");
    expect(nodeToolEntry("next", real).replace(ROOT, "")).toBe("/node_modules/next/dist/bin/next");
    expect(readFileSync("node_modules/next/dist/bin/next", "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
    expect(NODE_TOOLS).toEqual(["supabase", "vitest", "next"]);
  });
  it("supabase-skallet starter den NATIVE CLI-en fra platformpakken uten shell (windows-x64 → .exe), og lockfilen har Windows-pakkene", () => {
    const shim = readFileSync("node_modules/supabase/dist/supabase.js", "utf8");
    expect(shim).toContain('spawn(binPath, process.argv.slice(2), { stdio: "inherit" })');
    expect(shim).not.toMatch(/shell\s*:\s*true/);
    expect(shim).toContain('win32: { arm64: ["windows-arm64"], x64: ["windows-x64"] }');
    expect(shim).toContain('process.platform === "win32" ? ".exe" : ""');
    const lock = readFileSync("package-lock.json", "utf8");
    for (const pkg of ["@supabase/cli-windows-x64", "@next/swc-win32-x64-msvc", "@rolldown/binding-win32-x64-msvc", "lightningcss-win32-x64-msvc", "@img/sharp-win32-x64"]) expect(lock, pkg).toContain(`"node_modules/${pkg}"`);
    expect(Object.keys(meta("supabase").optionalDependencies)).toContain("@supabase/cli-windows-x64");
  });
  it("«npm run build» er nøyaktig «next build» (derfor startes build som `next build`), og versjonene er låst", () => {
    const pj = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pj.scripts.build).toBe("next build");
    expect(pj.devDependencies.supabase).toBe("2.119.0");
    expect(meta("supabase").version).toBe("2.119.0");
  });
  it("ekte oppstart (Linux): vitest, next og supabase svarer på --version uten shell; bash svarer", async () => {
    const l = createLauncher({ root: ROOT });
    for (const t of ["vitest", "next", "supabase"]) { const r = await l.run(t, ["--version"]); expect(r.code, t).toBe(0); expect(r.out, t).toMatch(/\d+\.\d+\.\d+/); expect(r.launchError).toBeUndefined(); }
    const b = await l.run("bash", ["--version"]);
    expect(b.out).toMatch(/GNU bash/);
  });
});

describe("inngangspunkter som IKKE er JavaScript, mangler eller er ugyldige avvises (lukket)", () => {
  const fakeFs = (files: Record<string, string>) => ({ readFileSync: (p: string) => { if (!(p in files)) throw new Error("ENOENT"); return files[p]!; }, existsSync: (p: string) => p in files });
  const ctx = (files: Record<string, string>) => ({ root: "/r", fs: fakeFs(files), pathMod: path.posix });
  const pj = (bin: unknown) => JSON.stringify({ name: "x", bin });
  it("native binær (ELF/PE, ingen .js, ingen node-shebang) ⇒ LaunchError «ikke JavaScript»", () => {
    expect(() => nodeToolEntry("x", ctx({ "/r/node_modules/x/package.json": pj({ x: "bin/x" }), "/r/node_modules/x/bin/x": "\u007fELF\u0002\u0001" }))).toThrow(/ikke JavaScript/);
    expect(() => nodeToolEntry("x", ctx({ "/r/node_modules/x/package.json": pj("bin/x.exe"), "/r/node_modules/x/bin/x.exe": "MZ\u0090" }))).toThrow(/ikke JavaScript/);
    expect(() => nodeToolEntry("x", ctx({ "/r/node_modules/x/package.json": pj("bin/x"), "/r/node_modules/x/bin/x": "#!/bin/sh\necho hei" }))).toThrow(/ikke JavaScript/);
  });
  it("manglende pakke, manglende bin, manglende fil", () => {
    expect(() => nodeToolEntry("x", ctx({}))).toThrow(/ikke installert/);
    expect(() => nodeToolEntry("x", ctx({ "/r/node_modules/x/package.json": JSON.stringify({ name: "x" }) }))).toThrow(/ingen kjørbar/);
    expect(() => nodeToolEntry("x", ctx({ "/r/node_modules/x/package.json": pj({ x: "bin/x.js" }) }))).toThrow(/finnes ikke/);
  });
  it("godtatt: .js/.mjs/.cjs, node-shebang uten endelse, bin som streng eller objekt (navngitt eller eneste)", () => {
    for (const [bin, file, body] of [["bin/x.js", "bin/x.js", ""], ["./a.mjs", "a.mjs", ""], ["c.cjs", "c.cjs", ""], ["b/x", "b/x", "#!/usr/bin/env node\n"]] as const)
      expect(nodeToolEntry("x", ctx({ "/r/node_modules/x/package.json": pj(bin), [`/r/node_modules/x/${file}`]: body }))).toBe(`/r/node_modules/x/${file}`);
    expect(nodeToolEntry("x", ctx({ "/r/node_modules/x/package.json": pj({ andre: "y.js" }), "/r/node_modules/x/y.js": "" }))).toBe("/r/node_modules/x/y.js");
  });
  it("npx/npm/ukjente programmer finnes ikke i launcheren", () => {
    const l = createLauncher({ root: ROOT });
    for (const t of ["npx", "npm", "cmd", "sh", "rm"]) expect(() => l.resolve(t, [])).toThrow(LaunchError);
  });
});

describe("SIMULERT Windows: stier og valg av bash (logikk, ikke Windows-oppførsel)", () => {
  const W = path.win32;
  const fsOf = (present: string[]) => ({ readFileSync: (p: string) => { throw new Error(`les ${p}`); }, existsSync: (p: string) => present.includes(p) });
  const base = { platform: "win32", pathMod: W };
  const GIT = "C:\\Program Files\\Git\\bin\\bash.exe";
  it("Node-programmer: execPath + JS-inngang med Windows-sti, uten shell-programmer", () => {
    const files: Record<string, string> = { "C:\\repo\\node_modules\\supabase\\package.json": JSON.stringify({ bin: { supabase: "dist/supabase.js" } }), "C:\\repo\\node_modules\\supabase\\dist\\supabase.js": "#!/usr/bin/env node\n" };
    const l = createLauncher({ ...base, root: "C:\\repo", execPath: "C:\\Program Files\\nodejs\\node.exe", fs: { readFileSync: (p: string) => files[p]!, existsSync: (p: string) => p in files } });
    expect(l.resolve("supabase", ["db", "push", "--dry-run"])).toEqual({ file: "C:\\Program Files\\nodejs\\node.exe", args: ["C:\\repo\\node_modules\\supabase\\dist\\supabase.js", "db", "push", "--dry-run"] });
  });
  it("bash: Git for Windows i Program Files, Program Files (x86), LocalAppData og via PATH; SCOUT_BASH har forrang når gyldig", () => {
    expect(findBash({ ...base, env: { ProgramFiles: "C:\\Program Files" }, fs: fsOf([GIT]) })).toBe(GIT);
    expect(findBash({ ...base, env: { "ProgramFiles(x86)": "C:\\Program Files (x86)" }, fs: fsOf(["C:\\Program Files (x86)\\Git\\bin\\bash.exe"]) })).toBe("C:\\Program Files (x86)\\Git\\bin\\bash.exe");
    expect(findBash({ ...base, env: { LOCALAPPDATA: "C:\\Users\\k\\AppData\\Local" }, fs: fsOf(["C:\\Users\\k\\AppData\\Local\\Programs\\Git\\bin\\bash.exe"]) })).toBe("C:\\Users\\k\\AppData\\Local\\Programs\\Git\\bin\\bash.exe");
    expect(findBash({ ...base, env: { PATH: "C:\\x;D:\\tools\\Git\\bin" }, fs: fsOf(["D:\\tools\\Git\\bin\\bash.exe"]) })).toBe("D:\\tools\\Git\\bin\\bash.exe");
    expect(findBash({ ...base, env: { SCOUT_BASH: "E:\\git\\bin\\bash.exe", ProgramFiles: "C:\\Program Files" }, fs: fsOf(["E:\\git\\bin\\bash.exe", GIT]) })).toBe("E:\\git\\bin\\bash.exe");
  });
  it("WSLs bash.exe (System32/WindowsApps) avvises — også når den står først i PATH og som SCOUT_BASH", () => {
    const wsl = "C:\\Windows\\System32\\bash.exe", apps = "C:\\Users\\k\\AppData\\Local\\Microsoft\\WindowsApps\\bash.exe";
    expect(() => findBash({ ...base, env: { PATH: "C:\\Windows\\System32" }, fs: fsOf([wsl]) })).toThrow(/bash ikke funnet/);
    expect(() => findBash({ ...base, env: { PATH: "C:\\Users\\k\\AppData\\Local\\Microsoft\\WindowsApps" }, fs: fsOf([apps]) })).toThrow(/bash ikke funnet/);
    expect(() => findBash({ ...base, env: { SCOUT_BASH: wsl }, fs: fsOf([wsl]) })).toThrow(/SCOUT_BASH/);
    expect(findBash({ ...base, env: { PATH: "C:\\Windows\\System32", ProgramFiles: "C:\\Program Files" }, fs: fsOf([wsl, GIT]) })).toBe(GIT);   // Git Bash velges selv om WSL finnes
  });
  it("manglende bash ⇒ tydelig LaunchError (ikke ENOENT-krasj); ugyldig SCOUT_BASH (finnes ikke, feil filnavn) avvises", () => {
    expect(() => findBash({ ...base, env: {}, fs: fsOf([]) })).toThrow(/installer Git for Windows/);
    expect(() => findBash({ ...base, env: { SCOUT_BASH: "C:\\finnes\\ikke\\bash.exe" }, fs: fsOf([]) })).toThrow(/SCOUT_BASH/);
    expect(() => findBash({ ...base, env: { SCOUT_BASH: "C:\\x\\sh.exe" }, fs: fsOf(["C:\\x\\sh.exe"]) })).toThrow(/SCOUT_BASH/);
  });
  it("Linux/macOS: bash via PATH uendret", () => { expect(findBash({ platform: "linux", env: {}, fs: fsOf([]), pathMod: path.posix })).toBe("bash"); });
  it("isMainModule: file:///C:/… sammenlignes riktig (den gamle file://${argv1}-sammenligningen stemmer aldri på Windows)", () => {
    const toWin = (p: string) => pathToFileURL(p, { windows: true });
    const meta: string = "file:///C:/repo/scripts/hosted/cli.mjs";
    expect(isMainModule(meta, "C:\\repo\\scripts\\hosted\\cli.mjs", toWin)).toBe(true);
    expect(meta === `file://${["C:", "repo", "scripts", "hosted", "cli.mjs"].join("\\")}`).toBe(false);          // bevis for den gamle feilen
    expect(isMainModule(meta, "C:\\repo\\scripts\\hosted\\annen.mjs", toWin)).toBe(false);
    expect(isMainModule(meta, undefined, toWin)).toBe(false);
    expect(isMainModule(pathToFileURL(process.argv[1]!).href, process.argv[1])).toBe(true);   // faktisk på denne plattformen
  });
});

describe("FAKTISK (Linux): ingen shell, spesialtegn i argumenter, manglende programmer og feilede prosesser", () => {
  const script = (body: string) => { const f = join(tmp(), "s.mjs"); writeFileSync(f, body); return f; };
  const argvScript = () => script("process.stdout.write(JSON.stringify(process.argv.slice(2)));");
  const l = () => createLauncher({ root: ROOT });
  it("argumenter med mellomrom, anførselstegn, &, |, ^, %, $, backticks, ;, *, ?, newline, unicode, tom streng og backslash kommer uendret fram", async () => {
    const args = [...WEIRD_ARGS, "linje1\nlinje2", "x".repeat(20000)];
    const r = await l().runFile(process.execPath, [argvScript(), ...args]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual(args);
  });
  it("shell-tolkning skjer ikke: kommandosubstitusjon, ; && | > og glob utføres ikke (ingen sidefiler)", async () => {
    const dir = tmp(), marker = join(dir, "HACK");
    const evil = [`$(touch ${marker})`, `\`touch ${marker}\``, `x; touch ${marker}`, `x && touch ${marker}`, `x | touch ${marker}`, `> ${marker}`, "*"];
    const r = await l().runFile(process.execPath, [argvScript(), ...evil]);
    expect(JSON.parse(r.out)).toEqual(evil);
    expect(existsSync(marker)).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });
  it("databaseadresse med passord og spesialtegn kommer uendret fram og ligger aldri i resultatets feilfelt", async () => {
    const url = ["post", "gres"].join("") + "://postgres.ref:p%40ss%26w%22rd%20x@aws-0-eu.pooler.supabase.com:5432/postgres?sslmode=verify-full&application_name=a b";
    const r = await l().runFile(process.execPath, [argvScript(), "db", "push", "--db-url", url]);
    expect(JSON.parse(r.out)).toEqual(["db", "push", "--db-url", url]);
    expect(r.launchError).toBeUndefined();
  });
  it("exit-koder videreføres (0, 1, 3, 255), signaldrap gir ≠ 0, og stdout+stderr fanges", async () => {
    for (const code of [0, 1, 3, 255]) expect((await l().runFile(process.execPath, [script(`process.exit(${code})`)])).code).toBe(code);
    expect((await l().runFile(process.execPath, [script("process.kill(process.pid, 'SIGKILL')")])).code).not.toBe(0);
    const r = await l().runFile(process.execPath, [script("process.stdout.write('ut');process.stderr.write('feil');process.exit(2)")]);
    expect(r).toMatchObject({ code: 2 });
    expect(r.out).toContain("ut"); expect(r.out).toContain("feil");
  });
  it("manglende program ⇒ code 127 + launchError (kategori), uten argumenter, passord eller sti i feilen; aldri unntak", async () => {
    const SECRET = ["pw", "SENT", "k3j2h1"].join("-");
    const r = await l().runFile("/finnes/ikke/programmet-xyz", ["--db-url", SECRET]);
    expect(r.code).toBe(127);
    expect(r.launchError).toMatch(/kunne ikke starte/);
    expect(JSON.stringify(r)).not.toContain(SECRET);
    expect(JSON.stringify(r)).not.toContain("programmet-xyz");
  });
  it("spawn som kaster synkront og feil i verktøyoppslag gir også 127 uten å lekke argumenter; uinstallert pakke starter ingenting", async () => {
    const SECRET = ["pw", "SENT", "z9x8c7"].join("-");
    const calls: unknown[] = [];
    const boom = createLauncher({ root: ROOT, spawnImpl: () => { calls.push(1); throw Object.assign(new Error(`bom ${SECRET}`), { code: "EINVAL" }); } });
    const r1 = await boom.runFile("x", [SECRET]);
    expect(r1).toMatchObject({ code: 127 }); expect(JSON.stringify(r1)).not.toContain(SECRET);
    const empty = tmp(), spy: unknown[] = [];
    const none = createLauncher({ root: empty, spawnImpl: () => { spy.push(1); throw new Error("skal ikke kalles"); } });
    const r2 = await none.run("supabase", ["db", "push", "--db-url", SECRET]);
    expect(r2).toMatchObject({ code: 127, launchError: expect.stringMatching(/ikke installert/) });
    expect(spy).toHaveLength(0);
    expect(JSON.stringify(r2)).not.toContain(SECRET);
  });
  it("spawn-valg: shell false, windowsHide, stdio uten stdin; miljø = prosessmiljø + tillegg", async () => {
    const seen: { file: string; args: string[]; opts: Record<string, unknown> }[] = [];
    const fake = createLauncher({ root: ROOT, env: { A: "1" }, spawnImpl: (file: string, args: string[], opts: Record<string, unknown>) => { seen.push({ file, args, opts }); const c = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() }); setImmediate(() => c.emit("close", 0, null)); return c; } });
    await fake.runFile("f", ["x"], { B: "2" });
    expect(seen[0]!.opts).toMatchObject({ shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { A: "1", B: "2" } });
  });
});

describe("selvtesten (faktisk kjøring på denne plattformen — ikke Windows hvis plattformen ikke er win32)", () => {
  it("består her og sier hvilken plattform som ble kjørt", async () => {
    const r = await runSelfTest({ root: ROOT });
    expect(r.items.filter((i) => i.status !== "PASS")).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.info[0]).toBe(`plattform: ${process.platform}`);
  });
  it("en feilet delkontroll gir IKKE BESTÅTT (lukket): manglende bash og avvikende argument-roundtrip", async () => {
    const base = createLauncher({ root: ROOT });
    const nobash = { ...base, run: async (t: string, a: string[]) => (t === "bash" ? { code: 127, out: "", launchError: "bash ikke funnet" } : base.run(t, a)) };
    expect((await runSelfTest({ launcher: nobash as never, root: ROOT })).ok).toBe(false);
    const mangled = { ...base, runFile: async (f: string, a: string[]) => { const r = await base.runFile(f, a); return { ...r, out: r.out.replace("a b", "a_b") }; } };
    const r = await runSelfTest({ launcher: mangled as never, root: ROOT });
    expect(r.ok).toBe(false);
    expect(r.items.find((i) => /uendret fram/.test(i.name))!.status).toBe("FAIL");
  });
  it("selvtesten starter ingen hosted kontakt og leser ikke credentials", () => {
    const src = readFileSync("scripts/hosted/windows-selftest.mjs", "utf8");
    expect(src).not.toMatch(/SUPABASE_TEST|SCOUT_HOSTED|process\.env|fetch\(|https?:\/\/|pg\b/);
  });
});

describe("kildekode: ingen shell og ingen npx/npm; .gitattributes (egen del av diffen)", () => {
  const files = readdirSync("scripts/hosted").filter((f) => f.endsWith(".mjs"));
  it("spawn finnes bare i launch.mjs; ingen `shell: true`, exec/execSync eller npx/npm-start noe sted i scripts/hosted", () => {
    for (const f of files) {
      const code = readFileSync(`scripts/hosted/${f}`, "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
      expect(code, f).not.toMatch(/shell\s*:\s*true/);
      expect(code, f).not.toMatch(/\bexec(Sync|File|FileSync)?\s*\(/);
      expect(code, f).not.toMatch(/deps\.run\("(npx|npm)"|\["(npx|npm)"|"npx\.cmd"|"npm\.cmd"/);
      if (f !== "launch.mjs") expect(code, f).not.toMatch(/\bspawn(Sync)?\s*\(|child_process/);
    }
    expect(readFileSync("scripts/hosted/launch.mjs", "utf8")).toMatch(/shell: false/);
  });
  it("cli.mjs starter bare logiske programmer: supabase, vitest, next, bash", () => {
    const calls = [...readFileSync("scripts/hosted/cli.mjs", "utf8").matchAll(/deps\.run\("([a-z]+)"/g)].map((m) => m[1]);
    expect(new Set(calls)).toEqual(new Set(["supabase", "vitest", "next", "bash"]));
  });
  it(".gitattributes: *.sh text eol=lf — gjelder alle skript, og alle sporede *.sh er allerede LF (ingen innholdsendring i repoet)", () => {
    expect(readFileSync(".gitattributes", "utf8").split("\n").filter((l) => l && !l.startsWith("#"))).toEqual(["*.sh text eol=lf"]);
    const attr = spawnSync("git", ["check-attr", "text", "eol", "--", "scripts/hosted/run.sh", "scripts/ci-supabase-local.sh", "tests/db/support/x.sh"], { encoding: "utf8" }).stdout;
    expect(attr.match(/text: set/g)).toHaveLength(3);
    expect(attr.match(/eol: lf/g)).toHaveLength(3);
    const sh = spawnSync("git", ["ls-files", "*.sh"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
    expect(sh.length).toBeGreaterThan(10);
    for (const f of sh) expect(readFileSync(f, "utf8").includes("\r"), f).toBe(false);
  });
});
