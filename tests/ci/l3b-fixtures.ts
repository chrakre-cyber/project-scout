// Testhjelpere for L3a/L3b-vurderingen. De seks navngitte oppgraderingstestene leses fra samme JSON-liste som vurdereren bruker.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type TestRow = { file: string; fullName: string; status: string };
export const SIX: { file: string; fullName: string }[] = JSON.parse(readFileSync(join(__dirname, "../../scripts/ci/isolated-upgrade-tests.json"), "utf8"));

/** vitest-JSON (som `--reporter=json`) fra rader med fil, fullt navn og status. */
export function vitestJson(rows: TestRow[], success = true): string {
  const byFile = new Map<string, TestRow[]>();
  for (const r of rows) byFile.set(r.file, [...(byFile.get(r.file) ?? []), r]);
  return JSON.stringify({ success, testResults: [...byFile].map(([file, rs]) => ({ name: `/work/${file}`, assertionResults: rs.map((r) => ({ status: r.status, title: r.fullName.split(" ").pop(), fullName: r.fullName })) })) });
}
export const sixWith = (status: string): TestRow[] => SIX.map((t) => ({ ...t, status }));
/** Øvrige tester i samme filer som vitests -t-filter utelot (status skipped). */
export const filteredOut = (n = 3): TestRow[] => Array.from({ length: n }, (_, i) => ({ file: "tests/db/econ005b-rights.test.ts", fullName: `ECON-005b: annen test ${i}`, status: "skipped" }));

/** En fullstendig bestått L3b-katalog (JSON + rc + «OPPGRADERING OK» + versjon) til evaluateDir. */
export function l3bPass(): Record<string, string> {
  return { "l3b.json": vitestJson([...sixWith("passed"), ...filteredOut()]), "l3b.rc": "0", "l3b.out": "migrasjon anvendt: x.sql\nOPPGRADERING OK: eksisterende agenter (abc)\n", "l3b.pg.txt": "postgres (PostgreSQL) 16.14\n" };
}

/** Alle forhåndsdefinerte L4a/L6-tester (scripts/ci/l4-l6-tests.json) som bestått, til en l3.json der L4a og L6 skal være PASS. */
export const L46: { L4a: { file: string; fullName: string }[]; L6: { file: string; fullName: string }[] } = JSON.parse(readFileSync(join(__dirname, "../../scripts/ci/l4-l6-tests.json"), "utf8"));
export const l46Rows = (status = "passed"): TestRow[] => [...L46.L4a, ...L46.L6].map((t) => ({ ...t, status }));
