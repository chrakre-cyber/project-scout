/** De 10 representative agentoppsettene: validering, aktivering og mapping mot syntetisk provider. */
import { describe, expect, it } from "vitest";
import { activationIssues } from "@/domain/agent-validation";
import { SyntheticMarketplaceProvider } from "@/providers/marketplace/synthetic/provider";
import { parseAgentForm } from "@/server/agent-form";
import { AGENT_SETUPS, toFormData } from "./fixtures/agent-setups";

const NOW = new Date("2026-10-06T12:00:00Z");

describe.each(AGENT_SETUPS)("$id $title", (s) => {
  const parsed = parseAgentForm(toFormData(s.form), NOW);

  it(s.valid ? "er et gyldig utkast" : "avvises med feil på forventede felt", () => {
    expect(parsed.draft !== null).toBe(s.valid);
    if (!s.valid) expect(Object.keys(parsed.errors).sort()).toEqual([...(s.errorFields ?? [])].sort());
  });

  if (s.valid) {
    it(s.ready ? "kan aktiveres" : "blokkeres for aktivering med forklaring", () => {
      const issues = activationIssues(parsed.draft!, NOW);
      expect(issues.length === 0).toBe(s.ready);
      for (const text of s.issueContains ?? []) expect(issues.join(" | ")).toContain(text);
    });

    it("filtrene er en gyldig søkespørring mot den syntetiske provideren", async () => {
      const page = await new SyntheticMarketplaceProvider().search(parsed.draft!.filters, { pageSize: 1 });
      expect(page.sourceTotal).toBeGreaterThanOrEqual(0);
    });
  }
});
