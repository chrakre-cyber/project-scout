// TESTHJELPER (ECON-006c): bygger en MIDLERTIDIG KOPI av appen med en endret rettighetsprofil, slik at rettighetsavslag kan kontrolleres i en ekte nettleser UTEN testkrok i produksjonskoden.
// Produksjonskoden i repoet endres aldri; kopien slettes etter kjøringen. Endringen gjøres som en eksakt tekstbytting i `src/domain/provider-rights.ts` i kopien og feiler høyt hvis
// teksten ikke finnes (så en refaktorering ikke stille gjør testen meningsløs).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const PATCHES = {
  /** Økonomi: beregningsrett finnes, men visningsrett (`derivedEconomics.display`) er nektet. */
  deny_economics_display: [
    ["derivedEconomics: Object.freeze({ allow: Object.freeze({ price: true, registration: true, specs: true }), display: true })", "derivedEconomics: Object.freeze({ allow: Object.freeze({ price: true, registration: true, specs: true }), display: false })"],
  ],
  /** Visning av leverandørens annonse-id (`listing_id`) er nektet; alt annet som før. */
  deny_listing_id: [
    ["display: Object.freeze({ ...allRights(), images: false }),", "display: Object.freeze({ ...allRights(), images: false, listing_id: false }),"],
  ],
};

export function buildPatchedCopy({ root, name, env }) {
  const dir = mkdtempSync(path.join(tmpdir(), `scout-e2e-${name}-`));
  execFileSync("bash", ["-c", `tar -C "${root}" -c --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./reviews --exclude=./docs/tax/primarkilder --exclude='./*.zip' --exclude=./tsconfig.tsbuildinfo . | tar -x -C "${dir}"`]);
  // Turbopack avviser en symlenke ut av prosjektroten; harde lenker (cp -al) krever samme filsystem og kopierer ingen data.
  execFileSync("cp", ["-al", path.join(root, "node_modules"), path.join(dir, "node_modules")]);
  const file = path.join(dir, "src/domain/provider-rights.ts");
  let text = readFileSync(file, "utf8");
  for (const [from, to] of PATCHES[name]) {
    if (!text.includes(from)) throw new Error(`Patch '${name}' passer ikke lenger mot provider-rights.ts`);
    text = text.replace(from, to);
  }
  writeFileSync(file, text);
  execFileSync("npm", ["run", "build"], { cwd: dir, env, stdio: ["ignore", "ignore", "inherit"] });
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
