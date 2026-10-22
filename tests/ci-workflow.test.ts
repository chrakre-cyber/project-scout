/**
 * Statisk kontroll av Actions-oppsettet for lokal Supabase (L1–L3, L7). Workflowen kjøres ikke her; testen låser rammene:
 * kun manuell start, minimale rettigheter, ingen secrets/tredjeparts-actions/artefakter/hosted/deploy, ingen kommandoer som kan lekke nøkler.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const WF_PATH = ".github/workflows/supabase-local.yml";
const text = readFileSync(join(ROOT, WF_PATH), "utf8");
const code = text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n"); // uten kommentarlinjer
const script = readFileSync(join(ROOT, "scripts/ci-supabase-local.sh"), "utf8");
const scriptCode = script.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");

describe("workflow: rammer", () => {
  it("er den eneste workflowen, og kun manuell workflow_dispatch uten inndata er trigger", () => {
    const on = /^on:\n((?:[ \t]+.*\n)+)/m.exec(code)![1]!;
    expect(on.trim()).toBe("workflow_dispatch:");
    expect(code).not.toMatch(/\b(push|pull_request|pull_request_target|schedule|workflow_run|workflow_call|repository_dispatch|release|issue_comment|issues)\s*:/);
    expect(code).not.toMatch(/\binputs\s*:/);
    expect(code).not.toMatch(/\$\{\{\s*(github\.event|inputs|github\.head_ref|github\.ref_name)/); // ingen injeksjonsflate
  });

  it("permissions: bare contents: read (ingen skrivetilgang, ingen id-token)", () => {
    const top = /^permissions:\n((?:[ \t]+.*\n)+)/m.exec(code)![1]!;
    expect(top.trim()).toBe("contents: read");
    expect(code.match(/^\s*permissions\s*:/gm)).toHaveLength(1);
  });

  it("tidsgrense, ingen parallelle dobbeltkjøringer, standard Ubuntu-runner", () => {
    expect(code).toMatch(/timeout-minutes:\s*(\d+)/);
    expect(Number(/timeout-minutes:\s*(\d+)/.exec(code)![1])).toBeLessThanOrEqual(180);
    expect(code).toMatch(/concurrency:\n\s+group:\s*supabase-local\n\s+cancel-in-progress:\s*false/);
    expect(code.match(/runs-on:\s*(.+)/g)).toEqual(["runs-on: ubuntu-latest"]);
    expect(code).not.toMatch(/self-hosted|larger|ubuntu-\d+\.\d+-\d+-core|-xl|-large/i);
  });

  it("ingen secrets, tredjeparts-actions, artefakter, cache, deploy eller hosted Supabase", () => {
    for (const bad of [/\bsecrets\./, /\bsecrets:/, /^\s*-?\s*uses:/m, /upload-artifact|download-artifact|actions\/cache|\bcache:/, /vercel|deploy|environment:/i, /supabase\s+(link|db\s+push|projects|login|functions\s+deploy)|--linked|--project-ref|access[_-]?token/i, /continue-on-error/]) {
      expect(code, String(bad)).not.toMatch(bad);
    }
    expect(text + script).not.toMatch(/supabase\.com|api\.supabase|\.supabase\.co\b/);
  });

  it("ingen kommando som kan skrive nøkler eller rådata til loggen", () => {
    for (const f of [code, scriptCode]) {
      expect(f).not.toMatch(/set\s+-[a-z]*x|bash\s+-[a-z]*x|\bprintenv\b|^\s*env\s*$|\benv\s*\||docker\s+(inspect|logs)|\bcat\b[^\n]*(status\.env|\.env\b)/m);
      expect(f).not.toMatch(/supabase\s+status(?![^\n]*-o\s+env[^\n]*>\s*"?\$W)/); // status bare til privat fil
      expect(f).not.toMatch(/ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG|--debug|DEBUG=/);
    }
  });

  it("checkout uten action og uten lagrede innloggingsdata; npm ci fra låsefilen; kjører den sanerte orkestreringen", () => {
    expect(code).toMatch(/git fetch -q --no-tags origin "\$\{GITHUB_SHA\}"/);
    expect(code).not.toMatch(/extraheader|GITHUB_TOKEN|github\.token/);
    expect(code).toMatch(/npm ci /);
    expect(code).toMatch(/bash scripts\/ci-supabase-local\.sh/);
    expect(code).toMatch(/if:\s*always\(\)[\s\S]*supabase stop/);
  });
});

describe("orkestreringsskript: rammer", () => {
  it("rå utskrift går til en privat midlertidig katalog; eneste utskrift er den sanerte rapporten", () => {
    expect(scriptCode).toMatch(/W="\$\(mktemp -d\)"; chmod 700 "\$W"/);
    expect(scriptCode).toMatch(/node scripts\/ci\/evaluate\.mjs "\$W"/);
    expect(scriptCode).toMatch(/::add-mask::/);
    const direct = scriptCode.split("\n").filter((l) => /npx supabase (start|db reset|status)|qa-upgrade-check|test-db\.sh|qa-secret-scan|npm run build/.test(l) && !/^\s*(run |QA_OUT=|NEXT_PUBLIC|SCOUT_L6_DIAG_FILE="\$W\/l6-diag\.txt" run )/.test(l) && !/> "\$W|>\/dev\/null/.test(l));
    expect(direct).toEqual([]);
  });

  it("nekter alt som ikke er lokal Supabase, og avviser ikke-lokal DB_URL", () => {
    expect(scriptCode).toMatch(/\*127\.0\.0\.1\*\|\*localhost\*/);
    expect(scriptCode).toMatch(/exit "\$rc"/);
    expect(scriptCode).not.toMatch(/^\s*exit 0\b/m); // ingen «exit 0» som overstyrer resultatet
  });
});

describe("L3b (CI-001-FIX2): separat isolert klynge, ingen installasjon, strenge sjekker", () => {
  const l3b = readFileSync(join(ROOT, "scripts/ci/run-l3b.sh"), "utf8");
  const l3bCode = l3b.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  const isolated = readFileSync(join(ROOT, "scripts/test-db-isolated.sh"), "utf8");

  it("orkestreringen kjører L3b etter L3a, uavhengig av stakken, med rå utskrift til privat katalog", () => {
    expect(scriptCode).toMatch(/bash scripts\/ci\/run-l3b\.sh "\$W" > \/dev\/null 2>&1/);
    expect(scriptCode.indexOf("run-l3b.sh")).toBeGreaterThan(scriptCode.indexOf("test-db.sh"));
    expect(l3bCode).toMatch(/> "\$W\/l3b\.out" 2>&1/);
    expect(l3bCode).toMatch(/--reporter=json --outputFile="\$W\/l3b\.json"/);
  });

  it("ingen automatisk installasjon eller nettverk i L3b, workflowen eller orkestreringen; manglende binærer gir l3b.nobinaries", () => {
    for (const f of [l3bCode, scriptCode, code]) {
      expect(f).not.toMatch(/\bapt(-get)?\b|\bsudo\b|\bbrew\b|\bpip3?\b|npm\s+(i|install)\s+-g|curl\s|wget\s|dpkg\s+-i|docker\s+pull/);
    }
    expect(l3bCode).toMatch(/: > "\$W\/l3b\.nobinaries"; exit 0/);
    for (const b of ["initdb", "pg_ctl", "psql", "postgres"]) expect(l3bCode).toContain(b);
  });

  it("klyngeskriptet avslutter ≠ 0 ved endret eller tomt øyeblikksbilde", () => {
    expect(isolated).toMatch(/OPPGRADERING FEIL: øyeblikksbildet endret seg[^\n]*exit 3/);
    expect(isolated).toMatch(/\[ -n "\$BEFORE" \] && \[ -n "\$AFTER" \] \|\| \{ echo "OPPGRADERING FEIL: tomt øyeblikksbilde"; exit 3; \}/);
  });

  it("de seks er identifisert i en fast liste (fil + fullt navn), ikke bare telt", () => {
    const list = JSON.parse(readFileSync(join(ROOT, "scripts/ci/isolated-upgrade-tests.json"), "utf8")) as { file: string; fullName: string }[];
    expect(list).toHaveLength(6);
    for (const t of list) { expect(t.file).toMatch(/^tests\/db\/.+\.test\.ts$/); expect(t.fullName.length).toBeGreaterThan(30); }
  });
});
