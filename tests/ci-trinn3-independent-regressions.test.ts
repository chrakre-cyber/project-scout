import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { evaluateE2E, E2E_PLAN } from "../scripts/ci/evaluate.mjs";

it("accepts a successful real-mode L4 report using the actual script's check names", () => {
  const source = readFileSync(join(__dirname, "e2e/l4-browser.e2e.mjs"), "utf8");
  // Names come from the producer, not the evaluator's plan. No browser or
  // Supabase is run; this is a producer/consumer contract regression.
  const names = [...source.matchAll(/\bcheck\("([^"]+)"/g)].map((m) => m[1]!);
  expect(names).toHaveLength(12);
  const output = [
    "MODUS: EKTE lokal Supabase (GoTrue + PostgREST)",
    ...names.map((n) => `OK  ${n}`),
    `${names.length}/${names.length} sjekker OK [modus: real]`,
  ].join("\n");
  const result = evaluateE2E("l4", output, 0);
  expect(result.status, result.notes.join("\n")).toBe("PASS");
});

it("uses the same L4 check identity in the plan and real producer, without the emulator skip reason", () => {
  const source = readFileSync(join(__dirname, "e2e/l4-browser.e2e.mjs"), "utf8");
  const realName = /if \(backend\.mode === "real"\) check\("([^"]+)"/.exec(source)![1]!;
  expect(E2E_PLAN.l4!.checks).toContain(realName);
});
