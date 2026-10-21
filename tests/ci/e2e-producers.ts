// Leser sjekkidentitetene direkte fra produsentene (tests/e2e/*.e2e.mjs), uavhengig av scripts/ci/e2e-plan.json.
// Hvert check(…)/skip(…)-kall med bokstavelig første argument gir ett mønster; «${…}» i malliteraler blir et jokertegn.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeCheckName } from "../../scripts/ci/e2e-names.mjs";

export const PRODUCER_FILE = { l4: "l4-browser.e2e.mjs", econ006: "econ006.e2e.mjs", econ006d: "econ006d.e2e.mjs" } as const;
export interface Producer { kind: "check" | "skip"; literal: string; dynamic: boolean; regex: RegExp; line: number }

/** Leser en streng-/mal-literal fra posisjon i (peker på åpningstegn). Returnerer innholdet (med «\u0000» for ${…}) og posisjon etter literalen. */
function readLiteral(src: string, i: number): { text: string; end: number; dynamic: boolean } {
  const q = src[i]!; let out = "", dyn = false; i++;
  while (i < src.length && src[i] !== q) {
    if (src[i] === "\\") { out += src[i + 1] === "n" ? "\n" : src[i + 1]; i += 2; continue; }
    if (q === "`" && src[i] === "$" && src[i + 1] === "{") {
      let depth = 1; i += 2;
      while (i < src.length && depth > 0) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; i++; }
      out += "\u0000"; dyn = true; continue;
    }
    out += src[i]; i++;
  }
  return { text: out, end: i + 1, dynamic: dyn };
}

export function producers(key: keyof typeof PRODUCER_FILE): Producer[] {
  const src = readFileSync(join(__dirname, "../e2e", PRODUCER_FILE[key]), "utf8");
  const res: Producer[] = [];
  for (const m of src.matchAll(/(?<![.\w])(check|skip)\(\s*(["`])/g)) {
    const start = m.index! + m[0].length - 1;
    const lit = readLiteral(src, start);
    const esc = normalizeCheckName(lit.text).split("\u0000").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+?");
    res.push({ kind: m[1] as "check" | "skip", literal: lit.text, dynamic: lit.dynamic, regex: new RegExp(`^${esc}$`), line: src.slice(0, m.index).split("\n").length });
  }
  return res;
}
