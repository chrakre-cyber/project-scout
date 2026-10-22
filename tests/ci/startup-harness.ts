/**
 * Kjører den FAKTISKE oppstartsdelen av et e2e-skript (fra første linje til og med `await connectBackend(...)`) med ekte støttemoduler (preflight, backend) men en FALSK pg-Client og uten
 * nettleser, bygging, nettverk eller database. Alle kall mot klienten (`new Client`, `connect`, `query`) logges, slik at tester kan kreve «null DB-kall før avslag».
 * Importlinjer i skriptet erstattes med dynamiske importer av de samme modulene; `createRequire`/`require("pg")` erstattes med den falske klienten.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { vi } from "vitest";

const E2E = path.join(__dirname, "../e2e");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export interface StartupResult { calls: string[]; error: Error | null; value: unknown }

export async function runStartup(script: "econ006.e2e.mjs" | "econ006d.e2e.mjs" | "l4-browser.e2e.mjs", env: Record<string, string>, opts: { stubEmulator?: boolean } = {}): Promise<StartupResult> {
  const calls: string[] = [];
  class FakeClient {
    constructor() { calls.push("new Client"); }
    async connect() { calls.push("connect"); }
    async query(sql: string) { calls.push(norm(sql)); return { rows: [{ id: "00000000-0000-4000-a000-000000000001" }] }; }
    async end() { calls.push("end"); }
  }
  const source = readFileSync(path.join(E2E, script), "utf8");
  const marker = source.indexOf("await connectBackend(");
  if (marker < 0) throw new Error(`fant ikke connectBackend i ${script}`);
  const end = source.indexOf("\n", marker);
  let startup = source.slice(0, end + 1);
  // importer ⇒ dynamiske importer (relative støttemoduler løses mot tests/e2e)
  startup = startup.replace(/^import\s+\{([^}]*)\}\s+from\s+"([^"]+)";\s*$/gm, (_m, names: string, spec: string) => `const {${names}} = await __imp(${JSON.stringify(spec)});`);
  startup = startup.replace(/^const require = createRequire\(import\.meta\.url\);\s*$/m, "");
  startup = startup.replace(/^const \{ Client \} = require\(process\.env\.PG \?\? "pg"\);\s*$/m, "const Client = __Client;");
  if (/\brequire\(|import\.meta/.test(startup)) throw new Error(`uventet require/import.meta i oppstartsdelen av ${script}`);
  // Sist: la scriptets egen oppstart avslutte med verdien av backend-objektet
  const varName = /const (\w+) = await connectBackend\(/.exec(startup)![1]!;
  startup += `\nreturn ${varName};`;

  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const __imp = async (spec: string) => {
    if (opts.stubEmulator && spec.endsWith("backend.mjs")) {
      return { connectBackend: async (o: Parameters<typeof import("../e2e/support/backend.mjs").connectBackend>[0]) => {
        // emulatoren (HTTP-server + pg-pool) startes ikke i enhetstest; den felles valideringen kjøres likevel
        const { preflightTargets } = await import("../e2e/support/preflight.mjs");
        preflightTargets({ mode: "emulator", env: { ...process.env, SUPABASE_TEST_DB_URL: o.dbUrl } });
        calls.push("connectBackend(emulator, stub)");
        return { mode: "emulator", url: "http://127.0.0.1:1", publishableKey: "x", log: [], close: async () => {}, cleanup: async () => {} };
      } };
    }
    return import(spec.startsWith(".") ? path.join(E2E, spec) : spec);
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...a: string[]) => (...args: unknown[]) => Promise<unknown>;
  const run = new AsyncFunction("__imp", "__Client", startup);
  try {
    const value = await run(__imp, FakeClient);
    return { calls, error: null, value };
  } catch (e) {
    return { calls, error: e as Error, value: null };
  }
}
