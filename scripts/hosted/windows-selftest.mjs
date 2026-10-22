// HOST-001-FIX2: selvtest av prosessoppstart og verktøy på DENNE maskinen — ingen nettverk, ingen hosted, ingen credentials, leser ikke miljøvariabler utover det launcheren trenger.
// Kjøres FØRST etter at avhengighetene er installert (`npm ci`, godkjent separat): `node scripts/hosted/windows-selftest.mjs`. Utskriften sier hvilken plattform som faktisk ble kjørt;
// bare en kjøring som viser «plattform: win32» er en faktisk Windows-kjøring (testene i repoet simulerer Windows og beviser ikke Windows-oppførsel).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { createLauncher, isMainModule } from "./launch.mjs";

/** Argumenter som ville blitt tolket av en shell (cmd.exe/bash), men som må komme uendret fram. */
export const WEIRD_ARGS = ["a b", "  ledende og etterfølgende  ", 'han sa "hei"', "it's", "a&b", "a|b", "a^b", "a%PATH%b", "$HOME", "`id`", "$(id)", "x; echo HACK", "x && echo HACK", "> ut.txt", "*", "?sslmode=verify-full&a=b", "æøå ✓", "\\bak\\slash\\", "tom:", ""];

export async function runSelfTest({ launcher = createLauncher(), platform = process.platform, root = process.cwd(), tmp = os.tmpdir() } = {}) {
  const items = [];
  const add = (name, ok, note = "") => items.push({ name, status: ok ? "PASS" : "FAIL", note });
  const info = [`plattform: ${platform}`, `arkitektur: ${os.arch()}`, `node: ${process.version}`];
  for (const tool of ["supabase", "vitest", "next"]) {
    try { const c = launcher.resolve(tool, ["--version"]); add(`inngangspunkt ${tool}`, true, c.args[0].replace(root, ".")); }
    catch (e) { add(`inngangspunkt ${tool}`, false, e.category ?? "feil"); }
  }
  for (const [tool, re] of [["vitest", /\d+\.\d+\.\d+/], ["next", /\d+\.\d+\.\d+/], ["supabase", /\d+\.\d+\.\d+/]]) {
    const r = await launcher.run(tool, ["--version"]);
    add(`${tool} --version starter og avslutter med 0`, r.code === 0 && re.test(r.out), r.launchError ?? `exit ${r.code}`);
  }
  const b = await launcher.run("bash", ["--version"]);
  add("bash (Git Bash) starter", b.code === 0 && /GNU bash/.test(b.out), b.launchError ?? `exit ${b.code}`);
  // argumenter uten shell-tolkning: roundtrip gjennom operativsystemets prosessoppstart
  const dir = mkdtempSync(join(tmp, "scout-selftest-"));
  try {
    const script = join(dir, "argv.mjs");
    writeFileSync(script, "process.stdout.write(JSON.stringify(process.argv.slice(2)));");
    const r = await launcher.runFile(process.execPath, [script, ...WEIRD_ARGS]);
    let got = null; try { got = JSON.parse(r.out); } catch { /* feil nedenfor */ }
    const same = Array.isArray(got) && got.length === WEIRD_ARGS.length && got.every((v, i) => v === WEIRD_ARGS[i]);
    add("argumenter med mellomrom og spesialtegn kommer uendret fram", same, same ? "" : `avvik i ${got ? got.filter((v, i) => v !== WEIRD_ARGS[i]).length : "alle"} argument(er)`);
    add("ingen shell-tolkning (utskriften er bare den ene JSON-listen; ingen kommando ble kjørt)", r.code === 0 && /^\[.*\]$/s.test(r.out.trim()) && got !== null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  let crlf = null;
  try { crlf = readFileSync(join(root, "scripts/hosted/run.sh"), "utf8").includes("\r"); } catch { /* ikke funnet */ }
  add("scripts/hosted/run.sh har LF-linjeslutt (ingen CR)", crlf === false, crlf === null ? "filen ble ikke funnet (kjør fra repoets rot)" : "");
  return { info, items, ok: items.every((i) => i.status === "PASS") };
}

if (isMainModule(import.meta.url, process.argv[1])) {
  const r = await runSelfTest();
  console.log(["Selvtest av prosessoppstart (HOST-001-FIX2) — ingen hosted kontakt, ingen credentials", ...r.info, "", ...r.items.map((i) => `${i.status === "PASS" ? "OK  " : "FEIL"} ${i.name}${i.note ? ` — ${i.note}` : ""}`), "", `Samlet: ${r.ok ? "BESTÅTT" : "IKKE BESTÅTT"} (plattform ${process.platform}; en simulert eller annen plattform er ikke en Windows-kjøring)`].join("\n"));
  process.exit(r.ok ? 0 : 1);
}
