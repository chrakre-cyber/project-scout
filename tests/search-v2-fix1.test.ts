/**
 * SEARCH-002-FIX1 — regresjoner for Codex-funn F1 og F2 (feiler på 7ccb2f2, består etter retting).
 *
 * F1: en gammel kostnadsvurdering må ikke kunne gi positiv budsjettstatus etter at kostnadsforutsetningene,
 *     kandidaten eller kandidatrevisjonen er endret.
 * F2: offentlig validering/eksport skal avvise ukjente nøkler og misformet input med feilsti,
 *     aldri la felt falle bort stille og aldri kaste.
 * Forventningene er hentet fra kravteksten (reviewen), ikke fra implementasjonen. Syntetisk data, ingen avgiftssatser.
 */
import { describe, expect, it } from "vitest";
import { classifyBudget, costBasisOf } from "@/domain/search-v2/budget";
import { emptySpec } from "@/domain/search-v2/factory";
import { specFromJson, specToJson } from "@/domain/search-v2/serialization";
import type { CostLine, SearchSpec } from "@/domain/search-v2/types";
import { validateSpec } from "@/domain/search-v2/validation";
import { CAND, NOW, TEST_CATALOG, glsSpec, synthAssessment } from "./fixtures/search-v2";

const line = (over: Partial<CostLine> & { id: string }): CostLine => ({
  kind: "custom", label: "Linje", currency: "NOK", amountMinor: 100_000n, vatBasis: "incl", includedInBudget: true, ...over,
});
function specWith(costs: CostLine[], over: Partial<SearchSpec["budget"]> = {}): SearchSpec {
  const s = glsSpec();
  s.plannedRegistration = { requested: "passenger" };
  s.budget = { maxTotalNokMinor: 75_000_000n, deviationBasisPoints: 1000, costs, ...over };
  return s;
}
/** En vurdering som er korrekt laget for dette søket og gitt total. */
const assessFor = (s: SearchSpec, total = 74_900_000n) =>
  synthAssessment(total, { coveredCostLineIds: s.budget.costs.filter((c) => c.includedInBudget).map((c) => c.id), costBasis: costBasisOf(s) });
const classify = (s: SearchSpec, a: ReturnType<typeof assessFor>, cand: { id: string; version: string } = CAND) => classifyBudget(s, cand, a, NOW);

// ---------------------------------------------------------------- F1

describe("F1: kostnadsvurderingen er knyttet til beregningsgrunnlag og kandidat", () => {
  it("Codex' reproduksjon: 749 000 kr med transport 1 000 kr; transport endres til 100 000 kr → ikke lenger positiv", () => {
    const s = specWith([line({ id: "transport", kind: "transport", label: "Transport", amountMinor: 100_000n })]);
    const a = assessFor(s);
    expect(classify(s, a)).toMatchObject({ status: "within_budget", reason: null });
    s.budget.costs[0]!.amountMinor = 10_000_000n; // 100 000 kr
    expect(validateSpec(s, TEST_CATALOG)).toEqual([]); // søket er fortsatt gyldig
    expect(classify(s, a)).toMatchObject({ status: "not_calculated", reason: "cost_basis_changed" });
  });

  it("grunnlaget er en dokumentert, kanonisk streng av inkluderte linjer (id, type, valuta, beløp, mva.-grunnlag)", () => {
    const s = specWith([
      line({ id: "b-line", currency: "EUR", amountMinor: 250n, vatBasis: "excl" }),
      line({ id: "a-line", kind: "conversion", label: "Ombygging", amountMinor: null, vatBasis: null }),
      line({ id: "skip", includedInBudget: false, amountMinor: 999n }),
    ]);
    expect(costBasisOf(s)).toBe('[["a-line","conversion","NOK",null,null],["b-line","custom","EUR","250","excl"]]');
    expect(costBasisOf(specWith([]))).toBe("[]");
  });

  describe("endring av en inkludert linje med samme id krever ny vurdering", () => {
    const base = () => specWith([line({ id: "c1", kind: "transport", label: "Transport" })]);
    const mutations: [string, (c: CostLine) => void][] = [
      ["beløp", (c) => { c.amountMinor = 100_001n; }],
      ["beløp 0 i stedet for 1 000", (c) => { c.amountMinor = 0n; }],
      ["valuta", (c) => { c.currency = "EUR"; }],
      ["mva.-grunnlag", (c) => { c.vatBasis = "excl"; }],
      ["mva.-grunnlag fra oppgitt til ikke oppgitt", (c) => { c.vatBasis = null; }],
      ["type", (c) => { c.kind = "custom"; }],
    ];
    for (const [name, mutate] of mutations) {
      it(`${name}`, () => {
        const s = base();
        const a = assessFor(s);
        mutate(s.budget.costs[0]!);
        expect(validateSpec(s, TEST_CATALOG)).toEqual([]);
        expect(classify(s, a)).toMatchObject({ status: "not_calculated", reason: "cost_basis_changed" });
      });
    }
    it("inkludering slått av: totalen inneholdt linjen, grunnlaget er ikke lenger det samme", () => {
      const s = base();
      const a = assessFor(s);
      s.budget.costs[0]!.includedInBudget = false;
      expect(classify(s, a).reason).toBe("cost_basis_changed");
    });
    it("inkludering slått på: en ny linje i totalen som vurderingen ikke kjenner", () => {
      const s = specWith([line({ id: "c1", includedInBudget: false })]);
      const a = assessFor(s); // laget uten c1
      s.budget.costs[0]!.includedInBudget = true;
      expect(classify(s, a).status).toBe("not_calculated");
      expect(["included_cost_not_covered", "cost_basis_changed"]).toContain(classify(s, a).reason);
    });
    it("ny inkludert linje, også når dekkelisten nevner den", () => {
      const s = specWith([line({ id: "c1" })]);
      const a = assessFor(s);
      s.budget.costs.push(line({ id: "c2", amountMinor: 5n }));
      expect(classify(s, { ...a, coveredCostLineIds: ["c1", "c2"] }).reason).toBe("cost_basis_changed");
    });
    it("linje fjernet etter at vurderingen ble laget", () => {
      const s = specWith([line({ id: "c1" }), line({ id: "c2" })]);
      const a = assessFor(s);
      s.budget.costs.pop();
      expect(classify(s, a).reason).toBe("cost_basis_changed");
    });
  });

  describe("endringer som IKKE krever ny vurdering (uendret grunnlag)", () => {
    it("uendret grunnlag gir fortsatt positiv status", () => {
      const s = specWith([line({ id: "c1" }), line({ id: "c2", currency: "EUR", amountMinor: 5_000n })]);
      expect(classify(s, assessFor(s)).status).toBe("within_budget");
    });
    it("endret rekkefølge av identiske linjer", () => {
      const s = specWith([line({ id: "c1" }), line({ id: "c2", currency: "EUR", amountMinor: 5_000n })]);
      const a = assessFor(s);
      s.budget.costs.reverse();
      expect(costBasisOf(s)).toBe(a.costBasis);
      expect(classify(s, a).status).toBe("within_budget");
    });
    it("endret visningsnavn (label)", () => {
      const s = specWith([line({ id: "c1", label: "Gammelt navn" })]);
      const a = assessFor(s);
      s.budget.costs[0]!.label = "Nytt navn";
      expect(classify(s, a).status).toBe("within_budget");
    });
    it("linje som ikke er inkludert i budsjettet kan endres fritt (ligger utenfor totalen)", () => {
      const s = specWith([line({ id: "c1" }), line({ id: "x", includedInBudget: false, amountMinor: null, currency: "SEK" })]);
      const a = assessFor(s);
      s.budget.costs[1]!.amountMinor = 777n;
      s.budget.costs[1]!.currency = "EUR";
      expect(classify(s, a).status).toBe("within_budget");
    });
    it("ren budsjettendring: samme kandidattotal vurderes mot nytt budsjett uten ny kostnadsberegning", () => {
      const s = specWith([line({ id: "c1" })]);
      const a = assessFor(s, 74_900_000n);
      expect(classify(s, a).status).toBe("within_budget");
      s.budget.maxTotalNokMinor = 70_000_000n; // grensen 77 000 000 med 10 %
      expect(classify(s, a)).toMatchObject({ status: "within_deviation", reason: null });
      s.budget.deviationBasisPoints = null;
      expect(classify(s, a).status).toBe("over_limit");
      s.budget.maxTotalNokMinor = 80_000_000n;
      expect(classify(s, a).status).toBe("within_budget");
    });
  });

  describe("kandidatidentitet og -versjon", () => {
    const s = specWith([]);
    it("en annen bils total behandles ikke som samme vurdering", () => {
      expect(classify(s, assessFor(s), { id: "cand-2", version: CAND.version }).reason).toBe("candidate_mismatch");
    });
    it("en annen revisjon av samme kandidat krever ny vurdering", () => {
      expect(classify(s, assessFor(s), { id: CAND.id, version: "rev-2" }).reason).toBe("candidate_version_mismatch");
    });
    it("ingen positiv status ved avvik", () => {
      for (const cand of [{ id: "other", version: CAND.version }, { id: CAND.id, version: "other" }]) {
        expect(["within_budget", "within_deviation"]).not.toContain(classify(s, assessFor(s), cand).status);
      }
    });
    it("riktig kandidat og versjon gir positiv status", () => {
      expect(classify(s, assessFor(s), { id: CAND.id, version: CAND.version }).status).toBe("within_budget");
    });
  });

  it("vurderinger uten de nye feltene (7ccb2f2-formen) eller med ugyldige verdier avvises som ugyldige, ikke som positive", () => {
    const s = specWith([]);
    const old = { ...assessFor(s) } as Record<string, unknown>;
    for (const key of ["candidateId", "candidateVersion", "costBasis"]) {
      const a = { ...old };
      delete a[key];
      expect(classifyBudget(s, CAND, a as never, NOW)).toMatchObject({ status: "not_calculated", reason: "assessment_invalid" });
    }
    expect(classifyBudget(s, CAND, { ...old, candidateId: "" } as never, NOW).reason).toBe("assessment_invalid");
    expect(classifyBudget(s, CAND, { ...old, candidateVersion: 3 } as never, NOW).reason).toBe("assessment_invalid");
    expect(classifyBudget(s, CAND, { ...old, costBasis: null } as never, NOW).reason).toBe("assessment_invalid");
  });

  it("de eksisterende konservative sperrene består: ukjent og ikke dekket inkludert kostnad", () => {
    const unknown = specWith([line({ id: "c1", amountMinor: null })]);
    expect(classify(unknown, assessFor(unknown)).reason).toBe("included_cost_unknown");
    const s = specWith([line({ id: "c1" })]);
    expect(classify(s, { ...assessFor(s), coveredCostLineIds: [] }).reason).toBe("included_cost_not_covered");
  });
});

// ---------------------------------------------------------------- F2

describe("F2: struktur- og nøkkelkontroll av intern input", () => {
  const codes = (input: unknown) => validateSpec(input, TEST_CATALOG);
  const withExtra = (path: string[], key: string): unknown => {
    const s = glsSpec() as unknown as Record<string, unknown>;
    let node: Record<string, unknown> = s;
    for (const p of path) node = (Array.isArray(node[p]) ? (node[p] as unknown[])[0] : node[p]) as Record<string, unknown>;
    node[key] = ["DE"];
    return s;
  };

  it("Codex' reproduksjon: requirements.country avvises med feilsti og kjent ikke-støttet kode, og eksport gir ikke ok", () => {
    const s = glsSpec();
    Object.assign(s.requirements, { country: ["DE"] });
    const r = specToJson(s, TEST_CATALOG);
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("value");
    expect(!r.ok && r.issues).toContainEqual(expect.objectContaining({ path: "requirements.country", code: "criterion_not_supported" }));
    // feltet ble ikke slettet fra inndata
    expect((s.requirements as unknown as Record<string, unknown>).country).toEqual(["DE"]);
  });

  it("kjente, ikke-støttede kriterier gir egen kode på alle nivåer; helt ukjente nøkler gir unknown_key med sti", () => {
    for (const field of ["power", "packages", "towbar", "cruise", "climate", "damage", "vat", "weight"]) {
      expect(codes(withExtra(["requirements"], field)), field).toContainEqual(expect.objectContaining({ path: `requirements.${field}`, code: "criterion_not_supported" }));
    }
    const cases: [string[], string][] = [
      [[], "hacked"],
      [["vehicle"], "vehicle.hacked"],
      [["requirements"], "requirements.hacked"],
      [["requirements", "seats"], "requirements.seats.hacked"],
      [["requirements", "modelYear"], "requirements.modelYear.hacked"],
      [["appearance"], "appearance.hacked"],
      [["appearance", "exteriorColors"], "appearance.exteriorColors.hacked"],
      [["equipment"], "equipment[0].hacked"],
      [["budget"], "budget.hacked"],
      [["plannedRegistration"], "plannedRegistration.hacked"],
    ];
    for (const [path, expectedPath] of cases) {
      const issues = codes(withExtra(path, "hacked"));
      expect(issues.some((i) => i.code === "unknown_key" && i.path === expectedPath), `${expectedPath}: ${JSON.stringify(issues)}`).toBe(true);
    }
    const s = glsSpec();
    s.budget.costs = [line({ id: "c1" })];
    Object.assign(s.budget.costs[0]!, { hacked: 1 });
    expect(codes(s)).toContainEqual(expect.objectContaining({ path: "budget.costs[0].hacked", code: "unknown_key" }));
  });

  it("utstyrsnøkler som er kjente ikke-boolske prototypekriterier avvises som ikke støttet", () => {
    for (const key of ["cruise", "climate", "towbar"]) {
      const s = glsSpec();
      s.equipment = [{ key, priority: "must" }];
      expect(codes(s)).toContainEqual(expect.objectContaining({ path: "equipment[0].key", code: "criterion_not_supported" }));
    }
  });

  it("null og feil form i vehicle/requirements/equipment/budget.costs gir Issues, ikke unntak", () => {
    const mk = (mutate: (s: Record<string, any>) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const s = glsSpec() as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      s.budget.costs = [line({ id: "c1" })];
      mutate(s);
      return s;
    };
    const bad: [string, unknown][] = [
      ["null", null], ["undefined", undefined], ["tall", 5], ["tekst", "x"], ["liste", []], ["funksjon", () => 1],
      ["vehicle null", mk((s) => { s.vehicle = null; })],
      ["vehicle tekst", mk((s) => { s.vehicle = "gls"; })],
      ["requirements null", mk((s) => { s.requirements = null; })],
      ["requirements liste", mk((s) => { s.requirements = []; })],
      ["seats tekst", mk((s) => { s.requirements.seats = "7"; })],
      ["fuels null", mk((s) => { s.requirements.fuels = null; })],
      ["firstRegistration.from tekst", mk((s) => { s.requirements.firstRegistration = { from: "2021", to: null }; })],
      ["appearance null", mk((s) => { s.appearance = null; })],
      ["exteriorColors.values null", mk((s) => { s.appearance.exteriorColors = { values: null, priority: "must" }; })],
      ["equipment null", mk((s) => { s.equipment = null; })],
      ["equipment [null]", mk((s) => { s.equipment = [null]; })],
      ["equipment ['x']", mk((s) => { s.equipment = ["carplay"]; })],
      ["equipment objekt", mk((s) => { s.equipment = {}; })],
      ["budget null", mk((s) => { s.budget = null; })],
      ["costs null", mk((s) => { s.budget.costs = null; })],
      ["costs tekst", mk((s) => { s.budget.costs = "x"; })],
      ["costs [null]", mk((s) => { s.budget.costs = [null]; })],
      ["costs [5]", mk((s) => { s.budget.costs = [5]; })],
      ["plannedRegistration null", mk((s) => { s.plannedRegistration = null; })],
      ["mangler nøkkel", mk((s) => { delete s.budget; })],
      ["klasseinstans", Object.assign(Object.create({ inherited: 1 }) as object, glsSpec())],
      ["kastende getter", Object.defineProperty({ ...glsSpec() }, "vehicle", { enumerable: true, get() { throw new Error("boom"); } })],
    ];
    for (const [name, input] of bad) {
      let issues: ReturnType<typeof validateSpec> = [];
      expect(() => { issues = validateSpec(input, TEST_CATALOG); }, name).not.toThrow();
      expect(issues.length, name).toBeGreaterThan(0);
      let json: ReturnType<typeof specToJson> | undefined;
      expect(() => { json = specToJson(input as never, TEST_CATALOG); }, `${name} (eksport)`).not.toThrow();
      expect(json?.ok, `${name} (eksport)`).toBe(false);
      expect(json, name).not.toHaveProperty("value");
    }
  });

  it("feil gir ingen delvis eksport, og originalinput er uendret", () => {
    const s = glsSpec();
    Object.assign(s, { hacked: true });
    Object.assign(s.requirements, { country: ["DE"] });
    const snapshot = JSON.stringify(s, (_k, v) => (typeof v === "bigint" ? `${v}n` : v));
    const r = specToJson(s, TEST_CATALOG);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(s, (_k, v) => (typeof v === "bigint" ? `${v}n` : v))).toBe(snapshot);
    // flere feil samtidig rapporteres
    expect(!r.ok && r.issues.map((i) => i.path).sort()).toEqual(["hacked", "requirements.country"]);
  });

  it("gyldig input og tapsfri rundtur fungerer fortsatt, også med alle felt satt", () => {
    expect(validateSpec(emptySpec(), TEST_CATALOG)).toEqual([]);
    const s = glsSpec();
    s.vehicle.variant = "GLS 450 d 4MATIC";
    s.requirements.firstRegistration = { from: { precision: "month", year: 2021, month: 6 }, to: null };
    s.requirements.bodyTypes = ["suv"];
    s.appearance.interiorMaterials = { values: ["leather"], priority: "nice" };
    s.plannedRegistration = { requested: "van" };
    s.budget.costs = [line({ id: "c1", currency: "EUR", amountMinor: null }), line({ id: "c2", amountMinor: 0n })];
    expect(validateSpec(s, TEST_CATALOG)).toEqual([]);
    const json = specToJson(s, TEST_CATALOG);
    expect(json.ok).toBe(true);
    const back = specFromJson(JSON.parse(JSON.stringify(json.ok ? json.value : null)), TEST_CATALOG);
    expect(back.ok && back.value).toEqual(s);
  });
});
