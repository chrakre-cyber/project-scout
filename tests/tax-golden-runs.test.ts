/**
 * Forberedte (ikke kjørte) golden-kjøringer PHEV/EV/diesel (ECON-002): bare dokumenterte input, ingen gjetting, ingen kjøredato.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOCUMENTATION_CHECKLIST, GOLDEN_CASES, TEST_DATE } from "./fixtures/tax-golden";

const DIR = join(__dirname, "..", "docs/tax/golden-runs");
const FILES = { "GR-PENDING-PHEV": GOLDEN_CASES[0]!, "GR-PENDING-EV": GOLDEN_CASES[1]!, "GR-PENDING-DIESEL": GOLDEN_CASES[2]! } as const;
const read = (n: string) => readFileSync(join(DIR, `${n}.md`), "utf8");
const row = (md: string, key: string) => md.split("\n").find((l) => l.startsWith(`| \`${key}\``)) ?? "";

describe("forberedte golden-kjøringer: ingen kjøring, ingen gjetting", () => {
  for (const [ref, c] of Object.entries(FILES)) {
    const md = read(ref);
    it(`${ref}: midlertidig referanse, status forberedt/ikke kjørt, og alle sjekklistepunkter er med`, () => {
      expect(md).toContain(`# ${ref} —`);
      expect(md).toContain("FORBEREDT, IKKE KJØRT");
      for (const k of DOCUMENTATION_CHECKLIST) expect(row(md, k), k).not.toBe("");
      expect(md).toMatch(/18\.10\.2026 er historisk testdato/);
      expect(md).toMatch(/ikke.*rekonstruksjon/s);
    });
    it(`${ref}: dokumenterte verdier er ordrett de eksisterende (${c.id}); manglende felt er merket MANGLER`, () => {
      const d = c.documented;
      expect(md).toContain(`${String(d.referenceTaxWeightKg).replace(/(\d)(\d{3})$/, "$1 $2")} kg`);
      expect(row(md, "co2ValueAndMethod")).toContain(`${d.co2GramsPerKm} g/km`);
      expect(row(md, "firstRegistrationDate")).toContain(d.firstRegistrationWorkingDate.split("-").reverse().join("."));
      expect(row(md, "firstRegistrationDate")).toContain("faktisk dag **MANGLER**");
      // alt som ikke er dokumentert er MANGLER
      for (const k of ["calculatorRunDate", "calculatorVersionOrUrl", "norwegianRegistrationDateUsed", "powertrainEvidence", "allInputs", "inputScreenshot", "resultScreenshot", "resultBreakdown", "runBy"]) expect(row(md, k), k).toContain("**MANGLER**");
      // statusene stemmer med fixturens sjekkliste (missing ⇒ MANGLER; partial ⇒ delvis)
      for (const k of DOCUMENTATION_CHECKLIST) {
        const status = c.documentation[k];
        if (status === "missing") expect(row(md, k), k).toContain("MANGLER");
        if (status === "partial") expect(row(md, k), k).toContain("Dokumentert (delvis)");
      }
    });
    it(`${ref}: ingen kjøredato, URL, hash eller resultat er fylt inn; forventet total fra tidligere validering er ikke forhåndsutfylt`, () => {
      expect(md).not.toMatch(/https?:\/\//);
      expect(md).not.toMatch(/[0-9a-f]{64}/);
      expect(md).not.toContain(String(c.expectedTotalNok));
      expect(md).not.toContain(c.expectedTotalNok.toLocaleString("nb-NO"));
      expect(md).not.toContain(TEST_DATE.split("-").reverse().join(".") + " er kjøredato");
      expect(row(md, "calculatorRunDate")).toMatch(/\*\*MANGLER\*\*\s*\|\s*\|$/);
    });
  }
  it("README har én tabell med hva Christian må fremskaffe per kjøretøy og advarer mot gjetting/trinngrenser", () => {
    const md = readFileSync(join(DIR, "README.md"), "utf8");
    for (const v of ["PHEV", "EV", "Diesel"]) expect(md).toContain(`**${v}**`);
    for (const need of ["kjøredato", "vektdefinisjon", "drivlinjebevis", "SHA-256", "norsk registreringsdato"]) expect(md, need).toContain(need);
    expect(md).toMatch(/Kjøringene av 18\.10\.2026 er mottatt/);
    expect(md).toMatch(/ikke klasse 1/);
    expect(md).toMatch(/historisk testdato/);
    expect(md).toMatch(/U-009/);
  });
});
