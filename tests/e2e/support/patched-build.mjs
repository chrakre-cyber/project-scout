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
    ["src/domain/provider-rights.ts", "derivedEconomics: Object.freeze({ allow: Object.freeze({ price: true, registration: true, specs: true }), display: true })", "derivedEconomics: Object.freeze({ allow: Object.freeze({ price: true, registration: true, specs: true }), display: false })"],
  ],
  /** Ukjent rettighetsprofil: ingen profil er registrert i kjøretiden (kilden kan hverken identifiseres eller vises). */
  no_rights_profile: [
    ["src/domain/provider-rights.ts", "export const REGISTERED_PROFILES: readonly ProviderRightsProfile[] = Object.freeze([SYNTHETIC_RIGHTS_PROFILE]);", "export const REGISTERED_PROFILES: readonly ProviderRightsProfile[] = Object.freeze([]);"],
  ],
  /** Ukjent rettighetsprofil: profilen finnes, men er bare et utkast (ikke verifisert) og er dermed ikke i kraft. */
  draft_rights_profile: [
    ["src/domain/provider-rights.ts", `  version: 1,\n  status: "verified",\n  validFrom: "2026-10-01T00:00:00Z",\n  validUntil: null,\n  sourceRef: "Intern syntetisk`, `  version: 1,\n  status: "draft",\n  validFrom: "2026-10-01T00:00:00Z",\n  validUntil: null,\n  sourceRef: "Intern syntetisk`],
  ],
  /** Visning av leverandørens annonse-id (`listing_id`) er nektet; alt annet som før. */
  deny_listing_id: [
    ["src/domain/provider-rights.ts", "display: Object.freeze({ ...allRights(), images: false }),", "display: Object.freeze({ ...allRights(), images: false, listing_id: false }),"],
  ],
};

/** `names`: én eller flere patcher (se PATCHES), anvendt i rekkefølge på kopien. */
export function buildPatchedCopy({ root, names, env }) {
  const name = names.join("+");
  const dir = mkdtempSync(path.join(tmpdir(), `scout-e2e-${name}-`));
  execFileSync("bash", ["-c", `tar -C "${root}" -c --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./reviews --exclude=./docs/tax/primarkilder --exclude='./*.zip' --exclude=./tsconfig.tsbuildinfo . | tar -x -C "${dir}"`]);
  // Turbopack avviser en symlenke ut av prosjektroten; harde lenker (cp -al) krever samme filsystem og kopierer ingen data.
  execFileSync("cp", ["-al", path.join(root, "node_modules"), path.join(dir, "node_modules")]);
  for (const n of names) {
    for (const [rel, from, to] of PATCHES[n]) {
      const file = path.join(dir, rel);
      const text = readFileSync(file, "utf8");
      if (!text.includes(from)) throw new Error(`Patch '${n}' passer ikke lenger mot ${rel}`);
      writeFileSync(file, text.replace(from, to));
    }
  }
  execFileSync("npm", ["run", "build"], { cwd: dir, env, stdio: ["ignore", "ignore", "inherit"] });
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
